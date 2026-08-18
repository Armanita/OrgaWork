import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

interface ProjectState {
  readonly executionModel: string;
  readonly current: {
    readonly capabilityId: string;
    readonly milestoneId: string;
    readonly sliceId: string;
  };
  readonly legacyExecution: {
    readonly pModel: string;
    readonly lastAcceptedProductSubstage: string;
    readonly nextUnacceptedProductSubstage: string;
  };
  readonly publishedTrustBaseline: {
    readonly evidence: string;
    readonly closureCommit: string;
    readonly acceptanceTag: string;
  };
}

function state(): ProjectState {
  return JSON.parse(read('project-state.json')) as ProjectState;
}

describe('current documentation control plane', () => {
  it('uses capability vertical slices as the active execution model', () => {
    const current = state();
    expect(current.executionModel).toBe('capability-vertical-slice');
    expect(current.current.capabilityId).toBe('WM');
    expect(current.current.milestoneId).toBe('WM-A');
    expect(current.current.sliceId).toBe('WM-01');
  });

  it('preserves the accepted P history without using it as future execution', () => {
    const current = state();
    const historicalRoadmap = read('docs/history/ROADMAP-P-MODEL-20260819.md');

    expect(current.legacyExecution.pModel).toBe('retired-for-future-execution');
    expect(current.legacyExecution.lastAcceptedProductSubstage).toBe('P3.1');
    expect(current.legacyExecution.nextUnacceptedProductSubstage).toBe('P3.2');
    expect(historicalRoadmap).toContain('- [x] P3.1');
    expect(historicalRoadmap).toContain('- [ ] P3.2');
  });

  it('keeps Stage 00 trust evidence unchanged', () => {
    const current = state();
    expect(current.publishedTrustBaseline.evidence).toBe('EVD-043');
    expect(current.publishedTrustBaseline.closureCommit).toBe(
      '81a71b41c05055ad028df94447d677f08f2dcc36',
    );
    expect(current.publishedTrustBaseline.acceptanceTag).toBe('stage-00-trust-baseline-acceptance');
  });

  it('makes UI part of the first active vertical slice', () => {
    const roadmap = read('docs/ROADMAP.md');
    const architecture = read('docs/ARCHITECTURE.md');
    expect(roadmap).toContain('`WM-01` Create Own Case');
    expect(roadmap).toContain('فرم ایجاد پرونده در Dashboard');
    expect(architecture).toContain('UI بخشی از Vertical Slice است');
  });

  it('keeps historical acceptance evidence discoverable', () => {
    expect(existsSync('docs/acceptance/P1-FINAL-ACCEPTANCE.md')).toBe(true);
    expect(existsSync('docs/acceptance/P2-FINAL-ACCEPTANCE.md')).toBe(true);
    expect(existsSync('docs/acceptance/P2R-FINAL-ACCEPTANCE.md')).toBe(true);
    expect(existsSync('docs/acceptance/STAGE-00-ACCEPTANCE.md')).toBe(true);
  });

  it('declares a small active documentation set', () => {
    const index = read('docs/README.md');
    expect(index).toContain('`../project-state.json`');
    expect(index).toContain('`ARCHITECTURE.md`');
    expect(index).toContain('`QUALITY.md`');
    expect(index).toContain('Reference / History');
  });
});
