import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  ciSuiteGateIds,
  fullGateIds,
  gates,
  infrastructureGateIds,
  type CiSuiteId,
  type GateDefinition,
  type GateId,
} from './gates.js';
import { getStageDefinition } from './stages.js';

export type VerificationProfile = 'fast' | 'stage' | 'full' | 'infra' | 'ci';

export interface RunnerOptions {
  readonly profile: VerificationProfile;
  readonly stage: string | undefined;
  readonly suite: CiSuiteId | undefined;
  readonly continueOnFailure: boolean;
}

export interface GateResult {
  readonly id: string;
  readonly label: string;
  readonly status: 'passed' | 'failed' | 'skipped';
  readonly durationMs: number;
  readonly exitCode?: number;
  readonly reason?: string;
}

export interface VerificationReport {
  readonly schemaVersion: 1;
  readonly profile: VerificationProfile;
  readonly stage?: string;
  readonly suite?: CiSuiteId;
  readonly gitHead: string;
  readonly changedFiles: readonly string[];
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly results: readonly GateResult[];
  readonly passed: boolean;
}

const prettierExtensions = new Set([
  '.cjs',
  '.css',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.cts',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const eslintExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.mts', '.cts', '.ts', '.tsx']);

const testPattern = /\.test\.(?:[cm]?[jt]sx?)$/u;

export function parseRunnerArguments(argv: readonly string[]): RunnerOptions {
  const normalized = argv.filter((argument) => argument !== '--');
  const profile = (normalized[0] ?? '') as VerificationProfile;
  if (!['fast', 'stage', 'full', 'infra', 'ci'].includes(profile)) {
    throw new Error('Profile must be one of: fast, stage, full, infra, ci.');
  }

  let stage: string | undefined;
  let suite: CiSuiteId | undefined;
  let continueOnFailure = false;

  for (let index = 1; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (argument === '--continue') {
      continueOnFailure = true;
      continue;
    }
    if (argument === '--stage') {
      stage = normalized[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--suite') {
      suite = normalized[index + 1] as CiSuiteId | undefined;
      index += 1;
      continue;
    }
    throw new Error(`Unknown verification argument: ${String(argument)}`);
  }

  if (profile === 'stage' && stage === undefined) {
    throw new Error('Stage profile requires --stage <stage-id>.');
  }

  if (profile === 'ci') {
    if (suite === undefined || ciSuiteGateIds[suite] === undefined) {
      throw new Error(
        'CI profile requires --suite <quality|quality-coverage|contracts|architecture|build|audit>.',
      );
    }
  }

  return { profile, stage, suite, continueOnFailure };
}

export function normalizeChangedFiles(raw: string): string[] {
  return raw
    .split(/\r?\n/u)
    .map((value) => value.trim().replaceAll('\\', '/'))
    .filter((value) => value.length > 0);
}

export function classifyChangedFiles(files: readonly string[]): {
  readonly prettier: readonly string[];
  readonly eslint: readonly string[];
  readonly tests: readonly string[];
  readonly sources: readonly string[];
  readonly architectureSensitive: boolean;
  readonly hasTypeScript: boolean;
} {
  const existing = files.filter((file) => existsSync(file));
  const prettier = existing.filter((file) => prettierExtensions.has(extname(file).toLowerCase()));
  const eslint = existing.filter((file) => eslintExtensions.has(extname(file).toLowerCase()));
  const tests = eslint.filter((file) => testPattern.test(file));
  const sources = eslint.filter((file) => !testPattern.test(file));

  const architectureSensitive = files.some(
    (file) =>
      file === 'package.json' ||
      file === 'pnpm-lock.yaml' ||
      file.startsWith('apps/') ||
      file.startsWith('modules/') ||
      file.startsWith('packages/') ||
      file.startsWith('tools/'),
  );

  return {
    prettier,
    eslint,
    tests,
    sources,
    architectureSensitive,
    hasTypeScript: eslint.length > 0,
  };
}

function git(args: readonly string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function collectChangedFiles(): string[] {
  const tracked = normalizeChangedFiles(git(['diff', '--name-only', 'HEAD']));
  const untracked = normalizeChangedFiles(git(['ls-files', '--others', '--exclude-standard']));
  return [...new Set([...tracked, ...untracked])].sort();
}

function pnpmInvocation(args: readonly string[]): {
  readonly command: string;
  readonly args: readonly string[];
} {
  const npmExecPath = process.env['npm_execpath'];
  if (npmExecPath === undefined || !existsSync(npmExecPath)) {
    throw new Error('pnpm runner path is unavailable. Invoke verification through pnpm scripts.');
  }

  return {
    command: process.execPath,
    args: [npmExecPath, ...args],
  };
}

function runCommand(
  id: string,
  label: string,
  args: readonly string[],
  timeoutMs: number,
): GateResult {
  const started = Date.now();
  process.stdout.write(`\n[${id}] ${label}\n`);
  process.stdout.write(`pnpm ${args.join(' ')}\n`);

  const invocation = pnpmInvocation(args);
  const result = spawnSync(invocation.command, [...invocation.args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    timeout: timeoutMs,
    windowsHide: true,
  });

  const durationMs = Date.now() - started;

  if (result.error !== undefined) {
    process.stderr.write(`[${id}] FAILED: ${result.error.message}\n`);
    return {
      id,
      label,
      status: 'failed',
      durationMs,
      reason: result.error.message,
    };
  }

  const exitCode = result.status ?? 1;
  return {
    id,
    label,
    status: exitCode === 0 ? 'passed' : 'failed',
    durationMs,
    exitCode,
  };
}

function runGate(definition: GateDefinition): GateResult {
  return runCommand(definition.id, definition.label, definition.args, definition.timeoutMs);
}

function fastCommands(changedFiles: readonly string[]): GateResult[] {
  const classification = classifyChangedFiles(changedFiles);
  const results: GateResult[] = [];

  if (changedFiles.length === 0) {
    return [
      {
        id: 'changed-files',
        label: 'Changed files',
        status: 'skipped',
        durationMs: 0,
        reason: 'No working-tree changes detected.',
      },
    ];
  }

  if (classification.prettier.length > 0) {
    results.push(
      runCommand(
        'format-changed',
        'Format changed files',
        ['exec', 'prettier', ...classification.prettier, '--check'],
        120_000,
      ),
    );
    if (results.at(-1)?.status === 'failed') return results;
  }

  if (classification.eslint.length > 0) {
    results.push(
      runCommand(
        'lint-changed',
        'Lint changed files',
        ['exec', 'eslint', ...classification.eslint, '--max-warnings=0'],
        180_000,
      ),
    );
    if (results.at(-1)?.status === 'failed') return results;
  }

  if (classification.hasTypeScript) {
    results.push(runGate(gates['typecheck-all']));
    if (results.at(-1)?.status === 'failed') return results;
  }

  if (classification.tests.length > 0) {
    results.push(
      runCommand(
        'tests-changed',
        'Run directly changed tests',
        ['exec', 'vitest', 'run', ...classification.tests, '--passWithNoTests'],
        300_000,
      ),
    );
    if (results.at(-1)?.status === 'failed') return results;
  }

  if (classification.sources.length > 0) {
    results.push(
      runCommand(
        'tests-related',
        'Run tests related to changed source',
        ['exec', 'vitest', 'related', '--run', ...classification.sources, '--passWithNoTests'],
        300_000,
      ),
    );
    if (results.at(-1)?.status === 'failed') return results;
  }

  if (classification.architectureSensitive) {
    results.push(runGate(gates.architecture));
    if (results.at(-1)?.status === 'failed') return results;
    results.push(runGate(gates.security));
  }

  return results;
}

export function gateIdsForProfile(options: RunnerOptions): readonly GateId[] {
  switch (options.profile) {
    case 'full':
      return fullGateIds;
    case 'infra':
      return infrastructureGateIds;
    case 'stage':
      return getStageDefinition(options.stage ?? '').gates;
    case 'ci':
      return ciSuiteGateIds[options.suite ?? 'quality'];
    case 'fast':
      return [];
  }
}

function runRegisteredGates(gateIds: readonly GateId[], continueOnFailure: boolean): GateResult[] {
  const results: GateResult[] = [];

  for (const gateId of gateIds) {
    const result = runGate(gates[gateId]);
    results.push(result);
    if (result.status === 'failed' && !continueOnFailure) {
      break;
    }
  }

  return results;
}

export function verificationReportDirectory(): string {
  if (process.env['CI'] === 'true') {
    return resolve(process.cwd(), 'artifacts', 'verification');
  }

  const gitDirectory = git(['rev-parse', '--git-dir']).trim();
  return resolve(gitDirectory, 'orgawork', 'verification');
}

function writeReport(report: VerificationReport): void {
  const directory = verificationReportDirectory();
  mkdirSync(directory, { recursive: true });

  const compactStage = report.stage?.replaceAll(/[^A-Za-z0-9_.-]/gu, '_') ?? report.suite ?? 'none';
  const stamp = report.finishedAt.replaceAll(/[:.]/gu, '-');
  const body = `${JSON.stringify(report, null, 2)}\n`;

  writeFileSync(`${directory}/latest.json`, body, 'utf8');
  writeFileSync(`${directory}/${report.profile}-${compactStage}-${stamp}.json`, body, 'utf8');
}

function printSummary(results: readonly GateResult[]): void {
  process.stdout.write('\nVERIFY RESULT\n\n');
  for (const result of results) {
    const duration = `${Math.round(result.durationMs / 100) / 10}s`;
    process.stdout.write(
      `${result.id.padEnd(22)} ${result.status.toUpperCase().padEnd(7)} ${duration}\n`,
    );
  }
}

function main(): void {
  const options = parseRunnerArguments(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const gitHead = git(['rev-parse', 'HEAD']).trim();
  const changedFiles = collectChangedFiles();

  process.stdout.write(`OrgaWork verification profile: ${options.profile}\n`);
  if (options.stage !== undefined) {
    process.stdout.write(`Stage: ${options.stage}\n`);
  }
  if (options.suite !== undefined) {
    process.stdout.write(`CI suite: ${options.suite}\n`);
  }
  process.stdout.write(`Git HEAD: ${gitHead}\n`);
  process.stdout.write(`Changed files detected: ${changedFiles.length}\n`);

  const results =
    options.profile === 'fast'
      ? fastCommands(changedFiles)
      : runRegisteredGates(gateIdsForProfile(options), options.continueOnFailure);

  const passed = results.every((result) => result.status !== 'failed');
  const report: VerificationReport = {
    schemaVersion: 1,
    profile: options.profile,
    ...(options.stage === undefined ? {} : { stage: options.stage }),
    ...(options.suite === undefined ? {} : { suite: options.suite }),
    gitHead,
    changedFiles,
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
    passed,
  };

  writeReport(report);
  printSummary(results);

  process.stdout.write(`\nRESULT: ${passed ? 'PASS' : 'FAIL'}\n`);
  if (!passed) {
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
