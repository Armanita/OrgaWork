import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { inspectArchitecture } from '../checks/architecture-policy.js';
import { inspectRepositorySecurity } from '../checks/repository-security.js';

export type FoundationAcceptanceMode = 'auto' | 'pre' | 'closed';

export const p110RequirementIds = [
  'P1.10.1',
  'P1.10.2',
  'P1.10.3',
  'P1.10.4',
  'P1.10.5',
  'P1.10.6',
  'P1.10.7',
  'P1.10.8',
  'P1.10.9',
  'P1.10.10',
  'P1.10.11',
] as const;

export interface FoundationAcceptanceReport {
  readonly schemaVersion: 1;
  readonly stage: 'P1.10';
  readonly mode: Exclude<FoundationAcceptanceMode, 'auto'>;
  readonly generatedAt: string;
  readonly evidenceCount: number;
  readonly workspaces: number;
  readonly sourceFiles: number;
  readonly trackedFiles: number;
  readonly packageManifests: number;
  readonly issues: readonly string[];
}

const requiredFiles = [
  '.github/workflows/ci.yml',
  '.github/BRANCH-PROTECTION.md',
  'apps/web/app/page.tsx',
  'apps/api/src/main.ts',
  'apps/worker/src/main.ts',
  'apps/scheduler/src/main.ts',
  'infra/compose/postgresql.compose.yaml',
  'infra/compose/redis.compose.yaml',
  'infra/compose/minio.compose.yaml',
  'infra/migrations/0001_create-migration-history.sql',
  'infra/migrations/0002_create-least-privilege-roles.sql',
  'infra/migrations/0003_create-tenant-runtime-infrastructure.sql',
  'packages/contracts/openapi/orgawork.openapi.json',
  'tools/checks/architecture-policy.ts',
  'tools/checks/repository-security.ts',
  'tools/spikes/p1.9-real-infrastructure.ts',
] as const;

function read(repository: string, relativePath: string): string {
  return readFileSync(resolve(repository, relativePath), 'utf8').replace(/\r\n?/gu, '\n');
}

function countMatches(content: string, pattern: RegExp): number {
  return [...content.matchAll(pattern)].length;
}

function resolveMode(
  roadmap: string,
  requestedMode: FoundationAcceptanceMode,
): Exclude<FoundationAcceptanceMode, 'auto'> {
  if (requestedMode !== 'auto') {
    return requestedMode;
  }

  return roadmap.includes('- مرحله جاری: `P2.1 تثبیت قرارداد دامنه هویت و سازمان`')
    ? 'closed'
    : 'pre';
}

function checklistPattern(stage: string, checked: boolean): RegExp {
  const escaped = stage.replaceAll('.', String.raw`\.`);
  const marker = checked ? 'x' : ' ';

  return new RegExp(String.raw`^- \[${marker}\] ${escaped}(?:\.|\s)`, 'gmu');
}

function requireMarker(issues: string[], content: string, marker: string, label: string): void {
  if (!content.includes(marker)) {
    issues.push(`${label}: ${marker}`);
  }
}

export function inspectFoundationAcceptance(
  repository: string,
  requestedMode: FoundationAcceptanceMode = 'auto',
  now: Date = new Date(),
): FoundationAcceptanceReport {
  const roadmap = read(repository, 'docs/ROADMAP.md');
  const status = read(repository, 'docs/PROJECT-STATUS.md');
  const traceability = read(repository, 'docs/TRACEABILITY-MATRIX.md');
  const workflow = read(repository, '.github/workflows/ci.yml');
  const decisions = read(repository, 'docs/DECISIONS.md');
  const risks = read(repository, 'docs/RISKS-ASSUMPTIONS-DEBT.md');
  const packageDocument = JSON.parse(read(repository, 'package.json')) as {
    readonly packageManager?: string;
    readonly scripts?: Readonly<Record<string, string>>;
  };
  const tsconfigDocument = JSON.parse(read(repository, 'tsconfig.json')) as {
    readonly include?: readonly string[];
  };
  const mode = resolveMode(roadmap, requestedMode);
  const issues: string[] = [];

  for (const file of requiredFiles) {
    if (!existsSync(resolve(repository, file))) {
      issues.push(`فایل بنیاد P1 موجود نیست: ${file}`);
    }
  }

  for (let stageNumber = 1; stageNumber <= 9; stageNumber += 1) {
    const stage = `P1.${String(stageNumber)}`;
    const checked = countMatches(roadmap, checklistPattern(stage, true));
    const open = countMatches(roadmap, checklistPattern(stage, false));

    if (checked === 0 || open !== 0) {
      issues.push(`وضعیت Roadmap برای ${stage} بسته و یکدست نیست.`);
    }
  }

  for (const requirementId of p110RequirementIds) {
    const expected = mode === 'closed' ? `- [x] ${requirementId}` : `- [ ] ${requirementId}`;

    requireMarker(issues, roadmap, expected, `وضعیت ${requirementId} معتبر نیست`);
  }

  const expectedEvidenceCount = mode === 'closed' ? 30 : 29;

  for (let number = 1; number <= expectedEvidenceCount; number += 1) {
    const evidence = `EVD-${String(number).padStart(3, '0')}`;
    requireMarker(issues, traceability, evidence, 'شاهد ردیابی موجود نیست');
  }

  if (mode === 'pre') {
    requireMarker(
      issues,
      roadmap,
      '- مرحله جاری: `P1.10.1 — ممیزی همه مراحل P1.1 تا P1.9`',
      'مرحله جاری پیش از پذیرش',
    );
    requireMarker(
      issues,
      status,
      '- زیرمرحله جاری: `P1.10.1 — ممیزی همه مراحل P1.1 تا P1.9`',
      'وضعیت جاری پیش از پذیرش',
    );
  } else {
    requireMarker(
      issues,
      roadmap,
      '- مرحله جاری: `P2.1 تثبیت قرارداد دامنه هویت و سازمان`',
      'مرحله جاری پس از پذیرش',
    );
    requireMarker(
      issues,
      roadmap,
      '- آخرین زیرمرحله بسته‌شده: `P1.10.11 — ایجاد کامیت و برچسب بسته‌شدن P1`',
      'آخرین زیرمرحله بسته‌شده',
    );
    requireMarker(
      issues,
      status,
      '- زیرمرحله جاری: `P2.1 — تثبیت قرارداد دامنه هویت و سازمان`',
      'وضعیت جاری پس از پذیرش',
    );
    requireMarker(
      issues,
      decisions,
      'DEC-P110-001 — پذیرش بنیاد P1 و اجازه آغاز P2',
      'تصمیم پایان P1',
    );
    requireMarker(
      issues,
      risks,
      'الحاقیه P1.10 — تعیین تکلیف ریسک‌های بنیاد P1',
      'انتقال رسمی ریسک‌ها',
    );
    requireMarker(issues, traceability, 'EVD-030 — شاهد پذیرش نهایی بنیاد P1', 'شاهد نهایی P1');

    if (!existsSync(resolve(repository, 'docs/acceptance/P1-FINAL-ACCEPTANCE.md'))) {
      issues.push('گزارش نهایی پذیرش P1 موجود نیست.');
    }
  }

  if (packageDocument.packageManager !== 'pnpm@11.17.0') {
    issues.push('نسخه Package Manager با خط‌مبنای P1 سازگار نیست.');
  }

  const scripts = packageDocument.scripts ?? {};
  const expectedScripts: Readonly<Record<string, string>> = {
    check: 'pnpm format:check && pnpm prepare:quality && pnpm lint && pnpm typecheck && pnpm test',
    'prepare:quality': 'pnpm build:foundation:direct',
    'build:apps:direct':
      'pnpm build:foundation:direct && pnpm --filter @workspace/api build && pnpm --filter @workspace/worker build && pnpm --filter @workspace/scheduler build && pnpm --filter @workspace/web build',
    'infra:start': 'tsx tools/scripts/local-infrastructure.ts start',
    'smoke:apps': 'pnpm build:apps && tsx tools/checks/coordinated-applications-smoke.ts',
    'accept:p1.10:audit': 'tsx tools/acceptance/p1.10-foundation-audit.ts auto',
  };

  for (const [name, command] of Object.entries(expectedScripts)) {
    if (scripts[name] !== command) {
      issues.push(`فرمان Package معتبر نیست: ${name}`);
    }
  }

  const installIndex = workflow.indexOf('pnpm install --frozen-lockfile');
  const prepareIndex = workflow.indexOf('pnpm prepare:quality');
  const lintIndex = workflow.indexOf('pnpm lint');

  if (installIndex < 0 || prepareIndex <= installIndex || lintIndex <= prepareIndex) {
    issues.push('ترتیب آماده‌سازی Type Declaration پیش از Lint در CI معتبر نیست.');
  }

  if (!(tsconfigDocument.include ?? []).includes('tools/acceptance/**/*.ts')) {
    issues.push('پوشه ابزار پذیرش در TypeScript Project ثبت نشده است.');
  }

  const architecture = inspectArchitecture(repository);
  for (const issue of architecture.issues) {
    issues.push(`Architecture ${issue.code}: ${issue.source} -> ${issue.target}`);
  }

  const security = inspectRepositorySecurity(repository);
  for (const issue of security.issues) {
    issues.push(`Security ${issue.code}: ${issue.path} | ${issue.detail}`);
  }

  return {
    schemaVersion: 1,
    stage: 'P1.10',
    mode,
    generatedAt: now.toISOString(),
    evidenceCount: expectedEvidenceCount,
    workspaces: architecture.workspaces.length,
    sourceFiles: architecture.sourceFiles,
    trackedFiles: security.trackedFiles,
    packageManifests: security.packageManifests,
    issues,
  };
}

function isMainModule(): boolean {
  const argument = process.argv[1];

  return argument !== undefined && import.meta.url === pathToFileURL(resolve(argument)).href;
}

if (isMainModule()) {
  const requested = process.argv[2] ?? 'auto';

  if (requested !== 'auto' && requested !== 'pre' && requested !== 'closed') {
    throw new Error('حالت ممیزی P1.10 باید auto، pre یا closed باشد.');
  }

  const report = inspectFoundationAcceptance(process.cwd(), requested);

  mkdirSync(resolve('artifacts/acceptance'), { recursive: true });
  writeFileSync(
    resolve('artifacts/acceptance/p1.10-foundation-audit.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  if (report.issues.length > 0) {
    throw new Error(`P1.10 foundation audit failed\n${report.issues.join('\n')}`);
  }

  process.stdout.write(
    `P1.10_FOUNDATION_AUDIT_PASSED: mode=${report.mode} evidence=${String(report.evidenceCount)} workspaces=${String(report.workspaces)} sourceFiles=${String(report.sourceFiles)} trackedFiles=${String(report.trackedFiles)}\n`,
  );
}
