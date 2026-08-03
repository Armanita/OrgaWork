import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export type WorkspaceKind = 'app' | 'package' | 'module';

export interface WorkspaceUnit {
  readonly kind: WorkspaceKind;
  readonly name: string;
  readonly root: string;
  readonly dependencies: readonly string[];
}

export interface ArchitectureIssue {
  readonly code:
    | 'CYCLE'
    | 'UNDECLARED_WORKSPACE_DEPENDENCY'
    | 'FORBIDDEN_LAYER_DEPENDENCY'
    | 'RELATIVE_BOUNDARY_ESCAPE';
  readonly source: string;
  readonly target: string;
  readonly detail: string;
}

export interface ArchitectureReport {
  readonly workspaces: readonly WorkspaceUnit[];
  readonly sourceFiles: number;
  readonly issues: readonly ArchitectureIssue[];
}

const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts']);
const importPatterns = [
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
  /import\(\s*['"]([^'"]+)['"]\s*\)/gu,
] as const;

function normalizePath(value: string): string {
  return value.split(sep).join('/');
}

function extension(value: string): string {
  const index = value.lastIndexOf('.');
  return index < 0 ? '' : value.slice(index);
}

function listFiles(root: string): readonly string[] {
  if (!existsSync(root)) {
    return [];
  }

  const output: string[] = [];

  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next' || entry === '.turbo') {
      continue;
    }

    const path = resolve(root, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      output.push(...listFiles(path));
    } else {
      output.push(path);
    }
  }

  return output;
}

function readJson(path: string): Readonly<Record<string, unknown>> {
  return JSON.parse(readFileSync(path, 'utf8')) as Readonly<Record<string, unknown>>;
}

function dependencyNames(document: Readonly<Record<string, unknown>>): readonly string[] {
  const output = new Set<string>();

  for (const key of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const section = document[key];

    if (typeof section !== 'object' || section === null || Array.isArray(section)) {
      continue;
    }

    for (const name of Object.keys(section)) {
      if (name.startsWith('@workspace/')) {
        output.add(name);
      }
    }
  }

  return [...output].sort();
}

function collectWorkspaceKind(
  repository: string,
  directory: 'apps' | 'packages' | 'modules',
  kind: WorkspaceKind,
): readonly WorkspaceUnit[] {
  const base = resolve(repository, directory);

  if (!existsSync(base)) {
    return [];
  }

  const output: WorkspaceUnit[] = [];

  for (const entry of readdirSync(base)) {
    const root = resolve(base, entry);

    if (!statSync(root).isDirectory()) {
      continue;
    }

    const manifest = resolve(root, 'package.json');

    if (!existsSync(manifest)) {
      continue;
    }

    const document = readJson(manifest);
    const name = document['name'];

    if (typeof name !== 'string' || name.trim() === '') {
      throw new TypeError(`Workspace name is invalid: ${manifest}`);
    }

    output.push({
      kind,
      name,
      root,
      dependencies: dependencyNames(document),
    });
  }

  return output;
}

export function collectWorkspaces(repository: string): readonly WorkspaceUnit[] {
  return [
    ...collectWorkspaceKind(repository, 'apps', 'app'),
    ...collectWorkspaceKind(repository, 'packages', 'package'),
    ...collectWorkspaceKind(repository, 'modules', 'module'),
  ].sort((left, right) => left.name.localeCompare(right.name));
}

function findOwner(path: string, workspaces: readonly WorkspaceUnit[]): WorkspaceUnit | undefined {
  const normalized = `${resolve(path)}${sep}`;

  return workspaces.find((workspace) => normalized.startsWith(`${resolve(workspace.root)}${sep}`));
}

function importSpecifiers(source: string): readonly string[] {
  const output = new Set<string>();

  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);

    while (match !== null) {
      const specifier = match[1];

      if (specifier !== undefined) {
        output.add(specifier);
      }

      match = pattern.exec(source);
    }
  }

  return [...output];
}

function workspaceDependencyName(specifier: string): string | undefined {
  if (!specifier.startsWith('@workspace/')) {
    return undefined;
  }

  const parts = specifier.split('/');

  return parts.length < 2 ? undefined : parts.slice(0, 2).join('/');
}

function forbidden(source: WorkspaceKind, target: WorkspaceKind, sameWorkspace: boolean): boolean {
  if (sameWorkspace) {
    return false;
  }

  if (source === 'package') {
    return target === 'app' || target === 'module';
  }

  if (source === 'module') {
    return target === 'app' || target === 'module';
  }

  return target === 'app';
}

function cycleIssues(workspaces: readonly WorkspaceUnit[]): readonly ArchitectureIssue[] {
  const byName = new Map(workspaces.map((workspace) => [workspace.name, workspace]));
  const state = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];
  const issues: ArchitectureIssue[] = [];
  const cycles = new Set<string>();

  function visit(name: string): void {
    const current = state.get(name);

    if (current === 'visited') {
      return;
    }

    if (current === 'visiting') {
      const start = stack.indexOf(name);
      const cycle = [...stack.slice(start), name];
      const identity = cycle.join(' -> ');

      if (!cycles.has(identity)) {
        cycles.add(identity);
        issues.push({
          code: 'CYCLE',
          source: name,
          target: name,
          detail: identity,
        });
      }
      return;
    }

    state.set(name, 'visiting');
    stack.push(name);

    const workspace = byName.get(name);

    if (workspace !== undefined) {
      for (const dependency of workspace.dependencies) {
        if (byName.has(dependency)) {
          visit(dependency);
        }
      }
    }

    stack.pop();
    state.set(name, 'visited');
  }

  for (const workspace of workspaces) {
    visit(workspace.name);
  }

  return issues;
}

export function inspectArchitecture(repository: string): ArchitectureReport {
  const workspaces = collectWorkspaces(repository);
  const byName = new Map(workspaces.map((workspace) => [workspace.name, workspace]));
  const issues: ArchitectureIssue[] = [...cycleIssues(workspaces)];
  const files = [
    ...listFiles(resolve(repository, 'apps')),
    ...listFiles(resolve(repository, 'packages')),
    ...listFiles(resolve(repository, 'modules')),
  ].filter((path) => sourceExtensions.has(extension(path)));

  for (const file of files) {
    const owner = findOwner(file, workspaces);

    if (owner === undefined) {
      continue;
    }

    const source = readFileSync(file, 'utf8');

    for (const specifier of importSpecifiers(source)) {
      const dependencyName = workspaceDependencyName(specifier);

      if (dependencyName !== undefined) {
        const target = byName.get(dependencyName);

        if (target === undefined) {
          continue;
        }

        if (!owner.dependencies.includes(dependencyName)) {
          issues.push({
            code: 'UNDECLARED_WORKSPACE_DEPENDENCY',
            source: normalizePath(relative(repository, file)),
            target: dependencyName,
            detail: `${owner.name} must declare ${dependencyName}`,
          });
        }

        if (forbidden(owner.kind, target.kind, owner.name === target.name)) {
          issues.push({
            code: 'FORBIDDEN_LAYER_DEPENDENCY',
            source: owner.name,
            target: target.name,
            detail: `${owner.kind} cannot depend on ${target.kind}`,
          });
        }
        continue;
      }

      if (!specifier.startsWith('.')) {
        continue;
      }

      const targetPath = resolve(dirname(file), specifier);
      const target = findOwner(targetPath, workspaces);

      if (target === undefined || target.name === owner.name) {
        continue;
      }

      issues.push({
        code: 'RELATIVE_BOUNDARY_ESCAPE',
        source: normalizePath(relative(repository, file)),
        target: normalizePath(relative(repository, targetPath)),
        detail: 'Workspace boundaries must use declared package imports',
      });

      if (forbidden(owner.kind, target.kind, false)) {
        issues.push({
          code: 'FORBIDDEN_LAYER_DEPENDENCY',
          source: owner.name,
          target: target.name,
          detail: `${owner.kind} cannot depend on ${target.kind}`,
        });
      }
    }
  }

  return {
    workspaces,
    sourceFiles: files.length,
    issues: issues.sort((left, right) =>
      `${left.code}:${left.source}:${left.target}`.localeCompare(
        `${right.code}:${right.source}:${right.target}`,
      ),
    ),
  };
}

export function assertArchitecture(repository: string): ArchitectureReport {
  const report = inspectArchitecture(repository);

  if (report.issues.length > 0) {
    throw new Error(
      `Architecture policy failed\n${report.issues
        .map((issue) => `${issue.code}: ${issue.source} -> ${issue.target} | ${issue.detail}`)
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
  const report = assertArchitecture(process.cwd());
  process.stdout.write(
    `ARCHITECTURE_POLICY_PASSED: ${String(report.workspaces.length)} workspaces and ${String(report.sourceFiles)} source files\n`,
  );
}
