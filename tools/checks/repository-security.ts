import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export interface RepositorySecurityIssue {
  readonly code:
    | 'INVALID_UTF8'
    | 'TRACKED_ENV_FILE'
    | 'HIGH_CONFIDENCE_SECRET'
    | 'UNPINNED_DEPENDENCY'
    | 'UNSAFE_DEPENDENCY_SOURCE'
    | 'LOCKFILE_POLICY';
  readonly path: string;
  readonly detail: string;
}

export interface RepositorySecurityReport {
  readonly trackedFiles: number;
  readonly packageManifests: number;
  readonly issues: readonly RepositorySecurityIssue[];
}

const textExtensions = new Set([
  '.cjs',
  '.css',
  '.cts',
  '.env',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.pem',
  '.key',
  '.ps1',
  '.sh',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const unsafeDependencyPattern = /^(?:file:|git\+|git:|github:|https?:)/u;
const highConfidenceSecretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{60,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
] as const;
const assignmentPattern =
  /\b(?:password|secret|token|api[_-]?key|private[_-]?key)\b\s*[:=]\s*["']?([^\s,"'\]}]+)/giu;

function normalizePath(value: string): string {
  return value.split(sep).join('/');
}

function listDirectories(root: string): readonly string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root)
    .map((entry) => resolve(root, entry))
    .filter((path) => statSync(path).isDirectory());
}

function collectPackageManifests(repository: string): readonly string[] {
  const manifests = [resolve(repository, 'package.json')];

  for (const directory of ['apps', 'packages', 'modules']) {
    for (const root of listDirectories(resolve(repository, directory))) {
      const manifest = resolve(root, 'package.json');

      if (existsSync(manifest)) {
        manifests.push(manifest);
      }
    }
  }

  return manifests;
}

function trackedFiles(repository: string): readonly string[] {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: repository,
      encoding: 'utf8',
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    throw new Error(`git ls-files policy scan failed: ${String(result.stderr ?? '')}`);
  }

  return String(result.stdout ?? '')
    .split('\0')
    .filter((path) => path !== '');
}

function isTextFile(path: string): boolean {
  const extension = extname(path).toLowerCase();

  return (
    textExtensions.has(extension) ||
    path.endsWith('.env.example') ||
    path.endsWith('.gitignore') ||
    path.endsWith('Dockerfile')
  );
}

function decodeUtf8(buffer: Buffer): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return undefined;
  }
}

function allowedSample(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === '' ||
    normalized.includes('${{') ||
    normalized.includes('${') ||
    normalized.includes('<') ||
    normalized.includes('example') ||
    normalized.includes('placeholder') ||
    normalized.includes('changeme') ||
    normalized.includes('test') ||
    normalized.includes('ci-only') ||
    normalized === 'localhost' ||
    normalized === '127.0.0.1'
  );
}

function shouldInspectGenericAssignments(path: string): boolean {
  const extension = extname(path).toLowerCase();

  if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) {
    return false;
  }

  return new Set(['.env', '.ini', '.json', '.properties', '.toml', '.yaml', '.yml']).has(extension);
}

function inspectText(path: string, content: string): readonly RepositorySecurityIssue[] {
  const issues: RepositorySecurityIssue[] = [];

  for (const pattern of highConfidenceSecretPatterns) {
    if (pattern.test(content)) {
      issues.push({
        code: 'HIGH_CONFIDENCE_SECRET',
        path,
        detail: 'High-confidence secret pattern detected',
      });
    }
  }

  if (shouldInspectGenericAssignments(path)) {
    assignmentPattern.lastIndex = 0;
    let match = assignmentPattern.exec(content);

    while (match !== null) {
      const value = match[1];

      if (value !== undefined && !allowedSample(value)) {
        issues.push({
          code: 'HIGH_CONFIDENCE_SECRET',
          path,
          detail: 'A secret-like assignment contains a non-sample value',
        });
      }

      match = assignmentPattern.exec(content);
    }
  }

  return issues;
}

function inspectDependencies(
  repository: string,
  manifests: readonly string[],
): readonly RepositorySecurityIssue[] {
  const issues: RepositorySecurityIssue[] = [];

  for (const manifest of manifests) {
    const document = JSON.parse(readFileSync(manifest, 'utf8')) as Readonly<
      Record<string, unknown>
    >;

    for (const sectionName of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      const section = document[sectionName];

      if (typeof section !== 'object' || section === null || Array.isArray(section)) {
        continue;
      }

      for (const [name, value] of Object.entries(section)) {
        if (typeof value !== 'string') {
          continue;
        }

        if (value.startsWith('workspace:')) {
          continue;
        }

        const path = normalizePath(relative(repository, manifest));

        if (unsafeDependencyPattern.test(value)) {
          issues.push({
            code: 'UNSAFE_DEPENDENCY_SOURCE',
            path,
            detail: `${name} uses ${value}`,
          });
        } else if (!exactVersionPattern.test(value)) {
          issues.push({
            code: 'UNPINNED_DEPENDENCY',
            path,
            detail: `${name} uses ${value}`,
          });
        }
      }
    }
  }

  return issues;
}

function inspectLockfile(repository: string): readonly RepositorySecurityIssue[] {
  const lockfile = resolve(repository, 'pnpm-lock.yaml');

  if (!existsSync(lockfile)) {
    return [
      {
        code: 'LOCKFILE_POLICY',
        path: 'pnpm-lock.yaml',
        detail: 'Lockfile is missing',
      },
    ];
  }

  const content = readFileSync(lockfile, 'utf8');
  const issues: RepositorySecurityIssue[] = [];

  for (const marker of ['lockfileVersion:', 'importers:', 'packages:']) {
    if (!content.includes(marker)) {
      issues.push({
        code: 'LOCKFILE_POLICY',
        path: 'pnpm-lock.yaml',
        detail: `Lockfile marker is missing: ${marker}`,
      });
    }
  }

  return issues;
}

export interface InspectRepositorySecurityOptions {
  readonly trackedPaths?: readonly string[];
}

export function inspectRepositorySecurity(
  repository: string,
  options: InspectRepositorySecurityOptions = {},
): RepositorySecurityReport {
  const paths = options.trackedPaths ?? trackedFiles(repository);
  const manifests = collectPackageManifests(repository);
  const issues: RepositorySecurityIssue[] = [
    ...inspectDependencies(repository, manifests),
    ...inspectLockfile(repository),
  ];

  for (const relativePath of paths) {
    const normalized = normalizePath(relativePath);

    if (normalized.startsWith('.env') && normalized !== '.env.example') {
      issues.push({
        code: 'TRACKED_ENV_FILE',
        path: normalized,
        detail: 'Only .env.example may be tracked',
      });
    }

    if (!isTextFile(normalized)) {
      continue;
    }

    const absolute = resolve(repository, relativePath);

    if (!existsSync(absolute) || statSync(absolute).isDirectory()) {
      continue;
    }

    const content = decodeUtf8(readFileSync(absolute));

    if (content === undefined) {
      issues.push({
        code: 'INVALID_UTF8',
        path: normalized,
        detail: 'Tracked text file is not valid UTF-8',
      });
      continue;
    }

    issues.push(...inspectText(normalized, content));
  }

  return {
    trackedFiles: paths.length,
    packageManifests: manifests.length,
    issues: issues.sort((left, right) =>
      `${left.code}:${left.path}:${left.detail}`.localeCompare(
        `${right.code}:${right.path}:${right.detail}`,
      ),
    ),
  };
}

export function assertRepositorySecurity(repository: string): RepositorySecurityReport {
  const report = inspectRepositorySecurity(repository);

  if (report.issues.length > 0) {
    throw new Error(
      `Repository security policy failed\n${report.issues
        .map((issue) => `${issue.code}: ${issue.path} | ${issue.detail}`)
        .join('\n')}`,
    );
  }

  return report;
}

function isMainModule(): boolean {
  const argument = process.argv[1];

  return argument !== undefined && import.meta.url === pathToFileURL(resolve(argument)).href;
}

if (isMainModule()) {
  const report = assertRepositorySecurity(process.cwd());
  process.stdout.write(
    `REPOSITORY_SECURITY_PASSED: ${String(report.trackedFiles)} tracked files and ${String(report.packageManifests)} package manifests\n`,
  );
}
