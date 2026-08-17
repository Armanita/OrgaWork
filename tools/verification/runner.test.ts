import { describe, expect, it } from 'vitest';

import {
  classifyChangedFiles,
  gateIdsForProfile,
  normalizeChangedFiles,
  parseRunnerArguments,
} from './runner.js';

describe('verification runner contract', () => {
  it('parses public and CI verification profiles', () => {
    expect(parseRunnerArguments(['fast'])).toEqual({
      profile: 'fast',
      stage: undefined,
      suite: undefined,
      continueOnFailure: false,
    });
    expect(parseRunnerArguments(['full', '--continue'])).toEqual({
      profile: 'full',
      stage: undefined,
      suite: undefined,
      continueOnFailure: true,
    });
    expect(parseRunnerArguments(['stage', '--stage', 'P3.1'])).toEqual({
      profile: 'stage',
      stage: 'P3.1',
      suite: undefined,
      continueOnFailure: false,
    });
    expect(parseRunnerArguments(['stage', '--', '--stage', 'P3.1'])).toEqual({
      profile: 'stage',
      stage: 'P3.1',
      suite: undefined,
      continueOnFailure: false,
    });
    expect(parseRunnerArguments(['infra'])).toEqual({
      profile: 'infra',
      stage: undefined,
      suite: undefined,
      continueOnFailure: false,
    });
    expect(parseRunnerArguments(['ci', '--suite', 'contracts', '--continue'])).toEqual({
      profile: 'ci',
      stage: undefined,
      suite: 'contracts',
      continueOnFailure: true,
    });
  });

  it('requires registered stage and CI suite identifiers', () => {
    expect(() => parseRunnerArguments(['stage'])).toThrow(
      'Stage profile requires --stage <stage-id>.',
    );
    expect(() => parseRunnerArguments(['ci'])).toThrow('CI profile requires --suite');
    expect(gateIdsForProfile(parseRunnerArguments(['stage', '--stage', 'P3.1']))).toContain(
      'p3-contract-test',
    );
    expect(gateIdsForProfile(parseRunnerArguments(['ci', '--suite', 'contracts']))).toEqual([
      'prepare-quality',
      'build-p2-modules',
      'contracts',
      'migrations',
    ]);
  });

  it('normalizes Git file output across Windows and Linux', () => {
    expect(normalizeChangedFiles('apps\\api\\src\\x.ts\r\ndocs/ROADMAP.md\n')).toEqual([
      'apps/api/src/x.ts',
      'docs/ROADMAP.md',
    ]);
  });

  it('classifies changed tests separately from changed sources', () => {
    const classification = classifyChangedFiles([
      'modules/cases/src/index.ts',
      'modules/cases/src/index.test.ts',
      'docs/ROADMAP.md',
    ]);

    expect(classification.tests).toEqual(['modules/cases/src/index.test.ts']);
    expect(classification.sources).toEqual(['modules/cases/src/index.ts']);
    expect(classification.prettier).toContain('docs/ROADMAP.md');
    expect(classification.architectureSensitive).toBe(true);
    expect(classification.hasTypeScript).toBe(true);
  });
});
