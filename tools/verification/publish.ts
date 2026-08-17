import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  checkClosureDocuments,
  expectedClosurePaths,
  loadLatestReport,
  validateVerificationReport,
} from './closure.js';
import { getStageDefinition, type StageDefinition } from './stages.js';

export interface PublishOptions {
  readonly stage: string;
  readonly evidence: string;
}

function git(cwd: string, args: readonly string[], stdio: 'pipe' | 'inherit' = 'pipe'): string {
  if (stdio === 'inherit') {
    execFileSync('git', args, { cwd, stdio: 'inherit' });
    return '';
  }

  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
  }).trim();
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function parsePublishArguments(argv: readonly string[]): PublishOptions {
  const normalized = argv.filter((argument) => argument !== '--');

  let stage: string | undefined;
  let evidence: string | undefined;

  for (let index = 0; index < normalized.length; index += 1) {
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
    throw new Error(`Unknown publish argument: ${String(argument)}`);
  }

  if (stage === undefined || evidence === undefined) {
    throw new Error('Stage publication requires --stage <stage-id> --evidence <evidence-id>.');
  }

  return { stage, evidence };
}

export function parseAheadBehind(value: string): {
  readonly behind: number;
  readonly ahead: number;
} {
  const parts = value.trim().split(/\s+/u);
  if (parts.length !== 2) {
    throw new Error(`Unexpected rev-list count: ${value}`);
  }

  const behind = Number.parseInt(parts[0] ?? '', 10);
  const ahead = Number.parseInt(parts[1] ?? '', 10);

  if (!Number.isFinite(behind) || !Number.isFinite(ahead)) {
    throw new Error(`Invalid rev-list count: ${value}`);
  }

  return { behind, ahead };
}

function assertPreparedClosure(cwd: string, stageId: string, evidence: string): void {
  const stage = getStageDefinition(stageId);
  const expected = expectedClosurePaths(stage);
  const staged = lines(git(cwd, ['diff', '--cached', '--name-only']));
  const unstaged = lines(git(cwd, ['diff', '--name-only']));
  const untracked = lines(git(cwd, ['ls-files', '--others', '--exclude-standard']));

  if (!sameSet(staged, expected)) {
    throw new Error(
      `Only prepared closure documents may be staged. Expected: ${expected.join(', ')}`,
    );
  }
  if (unstaged.length !== 0 || untracked.length !== 0) {
    throw new Error('Stage publication requires no unstaged or untracked files.');
  }

  checkClosureDocuments(cwd, stage, evidence, false);

  const report = loadLatestReport(cwd);
  const technicalCommit = git(cwd, ['rev-parse', 'HEAD']);
  validateVerificationReport(report, stage, technicalCommit);
}

function remoteRefCommit(cwd: string, ref: string, peeled = false): string | undefined {
  const queryRef = peeled ? `${ref}^{}` : ref;
  const output = git(cwd, ['ls-remote', 'origin', queryRef]);
  if (output.length === 0) return undefined;
  return output.split(/\s+/u)[0];
}

function assertRemoteLease(cwd: string, stage: StageDefinition): void {
  git(cwd, ['fetch', '--prune', 'origin'], 'inherit');

  const remoteTag = remoteRefCommit(cwd, `refs/tags/${stage.documentation.acceptanceTag}`, true);
  if (remoteTag !== undefined) {
    throw new Error(`Remote acceptance tag already exists: ${stage.documentation.acceptanceTag}`);
  }

  const counts = parseAheadBehind(
    git(cwd, ['rev-list', '--left-right', '--count', 'origin/main...HEAD']),
  );

  if (counts.behind !== 0) {
    throw new Error('origin/main contains commits not present locally. Publication stopped.');
  }
  if (counts.ahead < 1) {
    throw new Error('No local technical commit is ahead of origin/main. Publication stopped.');
  }
}

function verifyRemotePublication(cwd: string, stage: StageDefinition, closureCommit: string): void {
  const remoteMain = remoteRefCommit(cwd, 'refs/heads/main');
  const remoteTag = remoteRefCommit(cwd, `refs/tags/${stage.documentation.acceptanceTag}`, true);

  if (remoteMain !== closureCommit || remoteTag !== closureCommit) {
    throw new Error('Remote verification failed after atomic push: main/tag mismatch.');
  }
}

function printPublished(
  stage: StageDefinition,
  evidence: string,
  closureCommit: string,
  technicalCommit?: string,
): void {
  process.stdout.write('\nSTAGE PUBLICATION: PASS\n');
  process.stdout.write(`Stage: ${stage.id}\n`);
  process.stdout.write(`Evidence: ${evidence}\n`);
  if (technicalCommit !== undefined) {
    process.stdout.write(`Technical commit: ${technicalCommit}\n`);
  }
  process.stdout.write(`Closure commit: ${closureCommit}\n`);
  process.stdout.write(`Acceptance tag: ${stage.documentation.acceptanceTag}\n`);
  process.stdout.write('Remote main/tag and clean worktree verified.\n');
}

function retryOrConfirmExistingLocalPublication(
  cwd: string,
  stage: StageDefinition,
  evidence: string,
): boolean {
  const tagName = stage.documentation.acceptanceTag;
  const tagTarget = git(cwd, ['rev-list', '-n', '1', `refs/tags/${tagName}`]);
  const head = git(cwd, ['rev-parse', 'HEAD']);

  if (tagTarget !== head) {
    throw new Error(`Local acceptance tag ${tagName} exists but does not point to HEAD.`);
  }

  if (git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']).length !== 0) {
    throw new Error(
      'A local closure tag exists, but the repository is not clean. Inspect before retrying publication.',
    );
  }

  checkClosureDocuments(cwd, stage, evidence, true);
  git(cwd, ['fetch', '--prune', 'origin'], 'inherit');

  const remoteMain = remoteRefCommit(cwd, 'refs/heads/main');
  const remoteTag = remoteRefCommit(cwd, `refs/tags/${tagName}`, true);

  if (remoteMain === head && remoteTag === head) {
    printPublished(stage, evidence, head);
    return true;
  }

  if (remoteTag !== undefined && remoteTag !== head) {
    throw new Error(`Remote acceptance tag ${tagName} exists on a different commit.`);
  }

  const counts = parseAheadBehind(
    git(cwd, ['rev-list', '--left-right', '--count', 'origin/main...HEAD']),
  );
  if (counts.behind !== 0) {
    throw new Error('origin/main advanced after the local closure commit. Retry stopped.');
  }

  try {
    git(
      cwd,
      ['push', '--atomic', 'origin', 'HEAD:refs/heads/main', `refs/tags/${tagName}`],
      'inherit',
    );
  } catch (error: unknown) {
    throw new Error('Atomic publication retry failed. Local closure commit/tag are preserved.', {
      cause: error,
    });
  }

  verifyRemotePublication(cwd, stage, head);
  printPublished(stage, evidence, head);
  return true;
}

export function publishStageClosure(cwd: string, options: PublishOptions): void {
  const stage = getStageDefinition(options.stage);

  if (git(cwd, ['branch', '--show-current']) !== 'main') {
    throw new Error('Stage publication is allowed only from main.');
  }

  const localTagExists = git(cwd, ['tag', '--list', stage.documentation.acceptanceTag]).length > 0;

  if (localTagExists) {
    retryOrConfirmExistingLocalPublication(cwd, stage, options.evidence);
    return;
  }

  assertPreparedClosure(cwd, options.stage, options.evidence);
  assertRemoteLease(cwd, stage);

  const technicalCommit = git(cwd, ['rev-parse', 'HEAD']);
  const commitMessage = `docs(stage): close ${stage.id} [${options.evidence}]`;

  git(cwd, ['commit', '-m', commitMessage], 'inherit');
  const closureCommit = git(cwd, ['rev-parse', 'HEAD']);

  try {
    git(
      cwd,
      [
        'tag',
        '-a',
        stage.documentation.acceptanceTag,
        '-m',
        `${stage.id} acceptance ${options.evidence}`,
      ],
      'inherit',
    );

    checkClosureDocuments(cwd, stage, options.evidence, true);

    git(
      cwd,
      [
        'push',
        '--atomic',
        'origin',
        'HEAD:refs/heads/main',
        `refs/tags/${stage.documentation.acceptanceTag}`,
      ],
      'inherit',
    );
  } catch (error: unknown) {
    throw new Error(
      `Publication did not complete. Local closure commit ${closureCommit} ` +
        'and any local tag are preserved for inspection/retry.',
      { cause: error },
    );
  }

  verifyRemotePublication(cwd, stage, closureCommit);

  if (git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']).length !== 0) {
    throw new Error('Worktree is not clean after publication.');
  }

  printPublished(stage, options.evidence, closureCommit, technicalCommit);
}

function main(): void {
  publishStageClosure(process.cwd(), parsePublishArguments(process.argv.slice(2)));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
