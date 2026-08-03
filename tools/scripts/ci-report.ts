import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface CiReportEnvironment {
  readonly status?: string;
  readonly commit?: string;
  readonly ref?: string;
  readonly runId?: string;
  readonly operatingSystem?: string;
}

export interface CiReport {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly status: string;
  readonly commit: string;
  readonly ref: string;
  readonly runId: string;
  readonly operatingSystem: string;
  readonly artifacts: {
    readonly junit: boolean;
    readonly coverageSummary: boolean;
    readonly lcov: boolean;
  };
  readonly coverage?: Readonly<Record<string, unknown>>;
}

function readCoverageSummary(repository: string): Readonly<Record<string, unknown>> | undefined {
  const path = resolve(repository, 'artifacts/coverage/coverage-summary.json');

  if (!existsSync(path)) {
    return undefined;
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Readonly<Record<string, unknown>>;
  const total = parsed['total'];

  return typeof total === 'object' && total !== null
    ? (total as Readonly<Record<string, unknown>>)
    : undefined;
}

export function createCiReport(
  repository: string,
  environment: CiReportEnvironment = {},
  now: Date = new Date(),
): CiReport {
  const outputDirectory = resolve(repository, 'artifacts/ci');
  mkdirSync(outputDirectory, { recursive: true });

  const coverage = readCoverageSummary(repository);
  const report: CiReport = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: environment.status ?? 'unknown',
    commit: environment.commit ?? 'local',
    ref: environment.ref ?? 'local',
    runId: environment.runId ?? 'local',
    operatingSystem: environment.operatingSystem ?? process.platform,
    artifacts: {
      junit: existsSync(resolve(repository, 'artifacts/test-results/junit.xml')),
      coverageSummary: coverage !== undefined,
      lcov: existsSync(resolve(repository, 'artifacts/coverage/lcov.info')),
    },
    ...(coverage === undefined ? {} : { coverage }),
  };

  writeFileSync(
    resolve(outputDirectory, 'summary.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  const markdown = [
    '# OrgaWork CI summary',
    '',
    `- Status: ${report.status}`,
    `- Commit: ${report.commit}`,
    `- Ref: ${report.ref}`,
    `- Run: ${report.runId}`,
    `- OS: ${report.operatingSystem}`,
    `- JUnit: ${report.artifacts.junit ? 'available' : 'missing'}`,
    `- Coverage summary: ${report.artifacts.coverageSummary ? 'available' : 'missing'}`,
    `- LCOV: ${report.artifacts.lcov ? 'available' : 'missing'}`,
    '',
  ].join('\n');

  writeFileSync(resolve(outputDirectory, 'summary.md'), markdown, 'utf8');

  return report;
}

function isMainModule(): boolean {
  const argument = process.argv[1];

  return argument !== undefined && import.meta.url === pathToFileURL(resolve(argument)).href;
}

if (isMainModule()) {
  const status = process.env['ORGAWORK_CI_STATUS'];
  const commit = process.env['GITHUB_SHA'];
  const ref = process.env['GITHUB_REF'];
  const runId = process.env['GITHUB_RUN_ID'];
  const operatingSystem = process.env['RUNNER_OS'];
  const report = createCiReport(process.cwd(), {
    ...(status === undefined ? {} : { status }),
    ...(commit === undefined ? {} : { commit }),
    ...(ref === undefined ? {} : { ref }),
    ...(runId === undefined ? {} : { runId }),
    ...(operatingSystem === undefined ? {} : { operatingSystem }),
  });

  process.stdout.write(`CI_REPORT_CREATED: artifacts/ci/summary.json status=${report.status}\n`);
}
