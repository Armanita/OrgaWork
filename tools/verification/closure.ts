import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { VerificationReport } from './runner.js';
import { getStageDefinition, type StageDefinition } from './stages.js';

export type ClosureCommand = 'prepare' | 'check';

export interface ClosureOptions {
  readonly command: ClosureCommand;
  readonly stage: string;
  readonly evidence: string | undefined;
  readonly requireTag: boolean;
}

const ledgerStart = '<!-- ORGAWORK:STAGE-CLOSURE-LEDGER:START -->';
const ledgerEnd = '<!-- ORGAWORK:STAGE-CLOSURE-LEDGER:END -->';

function git(args: readonly string[], cwd = process.cwd()): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

export function reportDirectory(cwd = process.cwd()): string {
  const gitDirectory = git(['rev-parse', '--git-dir'], cwd).trim();
  return resolve(cwd, gitDirectory, 'orgawork', 'verification');
}

export function parseClosureArguments(argv: readonly string[]): ClosureOptions {
  const normalized = argv.filter((argument) => argument !== '--');
  const command = normalized[0] as ClosureCommand;
  if (!['prepare', 'check'].includes(command)) {
    throw new Error('Closure command must be prepare or check.');
  }

  let stage: string | undefined;
  let evidence: string | undefined;
  let requireTag = false;

  for (let index = 1; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (argument === '--stage') {
      stage = normalized[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--evidence') {
      evidence = normalized[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--require-tag') {
      requireTag = true;
      continue;
    }
    throw new Error(`Unknown closure argument: ${String(argument)}`);
  }

  if (stage === undefined) {
    throw new Error('Closure command requires --stage <stage-id>.');
  }

  if (command === 'prepare' && evidence === undefined) {
    throw new Error('Closure prepare requires --evidence <evidence-id>.');
  }

  return { command, stage, evidence, requireTag };
}

function readUtf8(path: string): string {
  return readFileSync(path, 'utf8');
}

function writeUtf8(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function replaceExactlyOnce(
  content: string,
  pattern: RegExp,
  replacement: string,
  label: string,
): string {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matches = content.match(new RegExp(pattern.source, flags)) ?? [];
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${matches.length}.`);
  }
  return content.replace(pattern, replacement);
}

function assertDocumentEncoding(path: string): void {
  const raw = readFileSync(path);
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    throw new Error(`${path}: UTF-8 BOM is not allowed.`);
  }

  const text = raw.toString('utf8');
  if (text.includes('\uFFFD')) {
    throw new Error(`${path}: Unicode replacement character detected.`);
  }
}

export function validateVerificationReport(
  report: VerificationReport,
  stage: StageDefinition,
  technicalCommit: string,
): void {
  if (!report.passed) {
    throw new Error('Latest verification report is not PASS.');
  }
  if (report.profile !== 'stage') {
    throw new Error('Latest verification report must use the stage profile.');
  }
  if (report.stage !== stage.id) {
    throw new Error(
      `Latest verification report belongs to ${String(report.stage)}, not ${stage.id}.`,
    );
  }
  if (report.gitHead !== technicalCommit) {
    throw new Error('Latest verification report does not match the current technical commit.');
  }
  if (report.changedFiles.length !== 0) {
    throw new Error(
      'Stage verification must be run on a clean technical commit before closure preparation.',
    );
  }

  if (stage.closureRequiresStageSpecificEvidence) {
    if (stage.closureEvidenceGateIds.length === 0) {
      throw new Error(
        `${stage.id} cannot be closed until its stage-specific closure evidence gates are registered.`,
      );
    }

    const passedGateIds = new Set(
      report.results.filter((result) => result.status === 'passed').map((result) => result.id),
    );

    for (const gateId of stage.closureEvidenceGateIds) {
      if (!passedGateIds.has(gateId)) {
        throw new Error(`${stage.id} closure evidence gate ${gateId} is missing or not PASS.`);
      }
    }
  }
}

function updateRoadmap(roadmap: string, stage: StageDefinition): string {
  const escapedItem = stage.documentation.roadmapItemFa.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');

  let updated = replaceExactlyOnce(
    roadmap,
    new RegExp(`^- \\[ \\] ${escapedItem}$`, 'mu'),
    `- [x] ${stage.documentation.roadmapItemFa}`,
    'ROADMAP stage checkbox',
  );

  updated = replaceExactlyOnce(
    updated,
    /^- آخرین زیرمرحله بسته‌شده: `[^`]+`$/mu,
    `- آخرین زیرمرحله بسته‌شده: \`${stage.documentation.titleFa}\``,
    'ROADMAP last closed stage',
  );

  return updated;
}

function updateProjectStatus(
  status: string,
  stage: StageDefinition,
  technicalCommit: string,
): string {
  const nextTitle = stage.documentation.nextStageTitleFa;
  const nextId = stage.documentation.nextStageId;
  if (nextTitle === undefined || nextId === undefined) {
    throw new Error(
      `${stage.id}: next-stage documentation metadata is required for substage closure.`,
    );
  }

  let updated = replaceExactlyOnce(
    status,
    /^- زیرمرحله جاری: `[^`]+`$/mu,
    `- زیرمرحله جاری: \`${nextTitle}\``,
    'PROJECT-STATUS current substage',
  );

  updated = replaceExactlyOnce(
    updated,
    /^- آخرین زیرمرحله بسته‌شده: `[^`]+`(?: \(.*\))?$/mu,
    `- آخرین زیرمرحله بسته‌شده: \`${stage.documentation.titleFa}\` (accepted در commit فنی \`${technicalCommit}\`)`,
    'PROJECT-STATUS last closed substage',
  );

  if (stage.id.startsWith('P3.') && nextId.startsWith('P3.')) {
    updated = replaceExactlyOnce(
      updated,
      /^- مرحله P3 به‌عنوان کل مرحله هنوز باز است؛ زیرمرحله‌های `P3\.\d+` به بعد اجرا نشده‌اند\.$/mu,
      `- مرحله P3 به‌عنوان کل مرحله هنوز باز است؛ زیرمرحله‌های \`${nextId}\` به بعد اجرا نشده‌اند.`,
      'PROJECT-STATUS remaining P3 substages',
    );
  }

  return updated;
}

function journalBlock(
  stage: StageDefinition,
  evidence: string,
  technicalCommit: string,
  report: VerificationReport,
): string {
  const nextStage = stage.documentation.nextStageTitleFa ?? 'مرحله بعد در Roadmap تعیین می‌شود';

  return [
    '',
    `<!-- ORGAWORK:CLOSURE:${stage.id} -->`,
    `# ${stage.documentation.titleFa} — اختتام استاندارد`,
    '',
    '## شواهد',
    '',
    `- شناسه شاهد: \`${evidence}\``,
    `- Commit فنی پذیرفته‌شده: \`${technicalCommit}\``,
    `- گزارش Verification: profile=\`${report.profile}\`، stage=\`${String(report.stage)}\`، result=\`PASS\``,
    `- زمان پایان Verification: \`${report.finishedAt}\``,
    '',
    '## بازبینی مستندات',
    '',
    ...stage.requiredDocuments.map((path) => `- به‌روزرسانی الزامی: \`${path}\``),
    ...stage.reviewDocuments.map((path) => `- بازبینی الزامی: \`${path}\``),
    '',
    '## نتیجه',
    '',
    `- زیرمرحله \`${stage.id}\` برای اختتام آماده و مستند شد.`,
    `- Tag پذیرش هدف: \`${stage.documentation.acceptanceTag}\``,
    `- مرحله بعد: \`${nextStage}\``,
    '',
  ].join('\n');
}

function acceptanceReport(
  stage: StageDefinition,
  evidence: string,
  technicalCommit: string,
  report: VerificationReport,
): string {
  const gateRows = report.results.map(
    (result) =>
      `| \`${result.id}\` | ${result.label} | ${result.status.toUpperCase()} | ${Math.round(result.durationMs)} ms |`,
  );

  return [
    `# گزارش پذیرش ${stage.documentation.titleFa}`,
    '',
    '> این فایل توسط `tools/verification/closure.ts` تولید می‌شود و نباید به‌صورت دستی برای دورزدن دروازه پذیرش ساخته شود.',
    '',
    '## وضعیت',
    '',
    '- وضعیت: آماده اختتام و انتشار',
    `- Stage: \`${stage.id}\``,
    `- شاهد: \`${evidence}\``,
    `- Commit فنی: \`${technicalCommit}\``,
    `- Tag پذیرش هدف: \`${stage.documentation.acceptanceTag}\``,
    `- Verification پایان‌یافته در: \`${report.finishedAt}\``,
    '',
    '## دروازه‌های Verification',
    '',
    '| Gate | عنوان | نتیجه | مدت |',
    '| --- | --- | --- | ---: |',
    ...gateRows,
    '',
    '## مستندات الزامی',
    '',
    ...stage.requiredDocuments.map((path) => `- \`${path}\``),
    '',
    '## اسناد بازبینی‌شده',
    '',
    ...stage.reviewDocuments.map((path) => `- \`${path}\``),
    '',
    '## قاعده انتشار',
    '',
    'این گزارش فقط زمانی به پذیرش منتشرشده تبدیل می‌شود که Commit اختتام، Tag پذیرش و Push اتمیک موفق ایجاد شوند.',
    '',
  ].join('\n');
}

function updateTraceability(
  traceability: string,
  stage: StageDefinition,
  evidence: string,
  technicalCommit: string,
): string {
  const row =
    `| ${stage.id} | ${evidence} | \`${technicalCommit}\` | ` +
    `\`${stage.documentation.acceptanceTag}\` | ` +
    `\`docs/acceptance/${stage.id}-ACCEPTANCE.md\` | آماده انتشار |`;

  if (traceability.includes(`| ${stage.id} | ${evidence} |`)) {
    throw new Error(`TRACEABILITY already contains closure evidence ${evidence} for ${stage.id}.`);
  }

  if (traceability.includes(ledgerStart) && traceability.includes(ledgerEnd)) {
    return traceability.replace(ledgerEnd, `${row}\n${ledgerEnd}`);
  }

  return [
    traceability.trimEnd(),
    '',
    '# دفتر اختتام استاندارد مراحل',
    '',
    ledgerStart,
    '| مرحله | شاهد | Commit فنی | Tag پذیرش | گزارش پذیرش | وضعیت |',
    '| --- | --- | --- | --- | --- | --- |',
    row,
    ledgerEnd,
    '',
  ].join('\n');
}

export function expectedClosurePaths(stage: StageDefinition): readonly string[] {
  return [
    'docs/PROJECT-STATUS.md',
    'docs/ROADMAP.md',
    'docs/IMPLEMENTATION-JOURNAL.md',
    'docs/TRACEABILITY-MATRIX.md',
    `docs/acceptance/${stage.id}-ACCEPTANCE.md`,
  ];
}

export interface PreparedClosure {
  readonly paths: readonly string[];
  readonly acceptancePath: string;
}

export function prepareClosureDocuments(
  root: string,
  stage: StageDefinition,
  evidence: string,
  technicalCommit: string,
  report: VerificationReport,
): PreparedClosure {
  validateVerificationReport(report, stage, technicalCommit);

  for (const relativePath of [...stage.requiredDocuments, ...stage.reviewDocuments]) {
    const fullPath = resolve(root, relativePath);
    if (!existsSync(fullPath)) {
      throw new Error(`Required closure document is missing: ${relativePath}`);
    }
    assertDocumentEncoding(fullPath);
  }

  const roadmapPath = resolve(root, 'docs/ROADMAP.md');
  const statusPath = resolve(root, 'docs/PROJECT-STATUS.md');
  const journalPath = resolve(root, 'docs/IMPLEMENTATION-JOURNAL.md');
  const traceabilityPath = resolve(root, 'docs/TRACEABILITY-MATRIX.md');
  const acceptancePath = resolve(root, `docs/acceptance/${stage.id}-ACCEPTANCE.md`);

  if (existsSync(acceptancePath)) {
    throw new Error(`Acceptance report already exists for ${stage.id}: ${acceptancePath}`);
  }

  const journal = readUtf8(journalPath);
  if (journal.includes(`<!-- ORGAWORK:CLOSURE:${stage.id} -->`)) {
    throw new Error(`Journal already contains a closure block for ${stage.id}.`);
  }

  writeUtf8(roadmapPath, updateRoadmap(readUtf8(roadmapPath), stage));
  writeUtf8(statusPath, updateProjectStatus(readUtf8(statusPath), stage, technicalCommit));
  writeUtf8(
    journalPath,
    `${journal.trimEnd()}\n${journalBlock(stage, evidence, technicalCommit, report)}`,
  );
  writeUtf8(
    traceabilityPath,
    updateTraceability(readUtf8(traceabilityPath), stage, evidence, technicalCommit),
  );
  writeUtf8(acceptancePath, acceptanceReport(stage, evidence, technicalCommit, report));

  const paths = expectedClosurePaths(stage);
  return {
    paths,
    acceptancePath: `docs/acceptance/${stage.id}-ACCEPTANCE.md`,
  };
}

export function loadLatestReport(cwd: string): VerificationReport {
  const path = resolve(reportDirectory(cwd), 'latest.json');
  if (!existsSync(path)) {
    throw new Error(
      'No verification report exists. Run verify:stage on the clean technical commit first.',
    );
  }
  return JSON.parse(readUtf8(path)) as VerificationReport;
}

function repositoryIsClean(cwd: string): boolean {
  return git(['status', '--porcelain=v1', '--untracked-files=all'], cwd).trim().length === 0;
}

function pnpmInvocation(args: readonly string[]): {
  readonly command: string;
  readonly args: readonly string[];
} {
  const npmExecPath = process.env['npm_execpath'];
  if (npmExecPath === undefined || !existsSync(npmExecPath)) {
    throw new Error('pnpm runner path is unavailable. Invoke stage closure through pnpm scripts.');
  }
  return { command: process.execPath, args: [npmExecPath, ...args] };
}

function runPnpm(args: readonly string[], cwd: string): void {
  const invocation = pnpmInvocation(args);
  const result = spawnSync(invocation.command, [...invocation.args], {
    cwd,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} failed.`);
  }
}

export function checkClosureDocuments(
  cwd: string,
  stage: StageDefinition,
  evidence: string | undefined,
  requireTag: boolean,
): void {
  const roadmap = readUtf8(resolve(cwd, 'docs/ROADMAP.md'));
  const status = readUtf8(resolve(cwd, 'docs/PROJECT-STATUS.md'));
  const journal = readUtf8(resolve(cwd, 'docs/IMPLEMENTATION-JOURNAL.md'));
  const traceability = readUtf8(resolve(cwd, 'docs/TRACEABILITY-MATRIX.md'));
  const acceptancePath = resolve(cwd, `docs/acceptance/${stage.id}-ACCEPTANCE.md`);

  if (!roadmap.includes(`- [x] ${stage.documentation.roadmapItemFa}`)) {
    throw new Error(`ROADMAP does not mark ${stage.id} as closed.`);
  }
  if (!status.includes(`- آخرین زیرمرحله بسته‌شده: \`${stage.documentation.titleFa}\``)) {
    throw new Error(`PROJECT-STATUS does not record ${stage.id} as last closed.`);
  }
  if (!journal.includes(`<!-- ORGAWORK:CLOSURE:${stage.id} -->`)) {
    throw new Error(`Journal closure block is missing for ${stage.id}.`);
  }
  if (!existsSync(acceptancePath)) {
    throw new Error(`Acceptance report is missing for ${stage.id}.`);
  }
  if (evidence !== undefined && !traceability.includes(`| ${stage.id} | ${evidence} |`)) {
    throw new Error(`Traceability closure row is missing for ${stage.id}/${evidence}.`);
  }

  for (const path of [
    ...stage.requiredDocuments,
    ...stage.reviewDocuments,
    `docs/acceptance/${stage.id}-ACCEPTANCE.md`,
  ]) {
    assertDocumentEncoding(resolve(cwd, path));
  }

  if (requireTag) {
    const tagTarget = git(['rev-list', '-n', '1', stage.documentation.acceptanceTag], cwd).trim();
    const head = git(['rev-parse', 'HEAD'], cwd).trim();
    if (tagTarget !== head) {
      throw new Error(
        `Acceptance tag ${stage.documentation.acceptanceTag} does not point to current HEAD.`,
      );
    }
  }
}

function main(): void {
  const options = parseClosureArguments(process.argv.slice(2));
  const cwd = process.cwd();
  const stage = getStageDefinition(options.stage);

  if (options.command === 'prepare') {
    if (!repositoryIsClean(cwd)) {
      throw new Error(
        'Closure preparation requires a clean technical commit. Commit implementation first.',
      );
    }

    const technicalCommit = git(['rev-parse', 'HEAD'], cwd).trim();
    const report = loadLatestReport(cwd);
    const evidence = options.evidence ?? '';

    const prepared = prepareClosureDocuments(cwd, stage, evidence, technicalCommit, report);

    try {
      runPnpm(['exec', 'prettier', ...prepared.paths, '--write'], cwd);
      execFileSync('git', ['add', '--', ...prepared.paths], {
        cwd,
        stdio: 'inherit',
      });
      execFileSync('git', ['diff', '--cached', '--check'], {
        cwd,
        stdio: 'inherit',
      });
      checkClosureDocuments(cwd, stage, evidence, false);
    } catch (error: unknown) {
      execFileSync('git', ['restore', '--staged', '--worktree', '--', ...prepared.paths], {
        cwd,
        stdio: 'ignore',
      });
      throw error;
    }

    process.stdout.write('\nSTAGE CLOSURE PREPARED\n');
    process.stdout.write(`Stage: ${stage.id}\n`);
    process.stdout.write(`Evidence: ${evidence}\n`);
    process.stdout.write(`Technical commit: ${technicalCommit}\n`);
    process.stdout.write(`Acceptance tag target: ${stage.documentation.acceptanceTag}\n`);
    process.stdout.write(
      'Next: review staged docs, then run stage:close:publish to create the closure commit, tag and atomic push.\n',
    );
    return;
  }

  checkClosureDocuments(cwd, stage, options.evidence, options.requireTag);
  process.stdout.write(`STAGE CLOSURE CHECK: PASS (${stage.id})\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
