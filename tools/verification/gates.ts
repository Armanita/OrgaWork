export type GateId =
  | 'prepare-quality'
  | 'build-p2-modules'
  | 'format-all'
  | 'lint-all'
  | 'typecheck-all'
  | 'test-ci'
  | 'coverage-ci'
  | 'contracts'
  | 'migrations'
  | 'architecture'
  | 'security'
  | 'build-apps'
  | 'dependency-audit'
  | 'p3-contract-build'
  | 'p3-contract-typecheck'
  | 'p3-contract-lint'
  | 'p3-contract-test';

export type CiSuiteId =
  'quality' | 'quality-coverage' | 'contracts' | 'architecture' | 'build' | 'audit';

export interface GateDefinition {
  readonly id: GateId;
  readonly label: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
}

const minute = 60_000;

export const gates: Readonly<Record<GateId, GateDefinition>> = {
  'prepare-quality': {
    id: 'prepare-quality',
    label: 'Prepare foundation and domain declarations',
    args: ['run', 'prepare:quality'],
    timeoutMs: 4 * minute,
  },
  'build-p2-modules': {
    id: 'build-p2-modules',
    label: 'Build P2 runtime module declarations',
    args: ['run', 'build:p2:modules'],
    timeoutMs: 5 * minute,
  },
  'format-all': {
    id: 'format-all',
    label: 'Formatting',
    args: ['run', 'format:check'],
    timeoutMs: 3 * minute,
  },
  'lint-all': {
    id: 'lint-all',
    label: 'Lint',
    args: ['run', 'lint'],
    timeoutMs: 5 * minute,
  },
  'typecheck-all': {
    id: 'typecheck-all',
    label: 'TypeScript',
    args: ['run', 'typecheck'],
    timeoutMs: 5 * minute,
  },
  'test-ci': {
    id: 'test-ci',
    label: 'CI test suite',
    args: ['run', 'test:ci'],
    timeoutMs: 15 * minute,
  },
  'coverage-ci': {
    id: 'coverage-ci',
    label: 'CI tests with coverage',
    args: ['run', 'test:coverage:ci'],
    timeoutMs: 20 * minute,
  },
  contracts: {
    id: 'contracts',
    label: 'Contracts and OpenAPI',
    args: ['run', 'ci:contracts'],
    timeoutMs: 5 * minute,
  },
  migrations: {
    id: 'migrations',
    label: 'Migration and schema policy',
    args: ['run', 'ci:migrations'],
    timeoutMs: 5 * minute,
  },
  architecture: {
    id: 'architecture',
    label: 'Architecture policy',
    args: ['run', 'ci:architecture'],
    timeoutMs: 3 * minute,
  },
  security: {
    id: 'security',
    label: 'Repository security policy',
    args: ['run', 'ci:security'],
    timeoutMs: 3 * minute,
  },
  'build-apps': {
    id: 'build-apps',
    label: 'Build four applications',
    args: ['run', 'build:apps:direct'],
    timeoutMs: 20 * minute,
  },
  'dependency-audit': {
    id: 'dependency-audit',
    label: 'Production dependency audit',
    args: ['audit', '--prod', '--audit-level=high'],
    timeoutMs: 5 * minute,
  },
  'p3-contract-build': {
    id: 'p3-contract-build',
    label: 'P3.1 contract build',
    args: ['run', 'build:p3:contracts'],
    timeoutMs: 5 * minute,
  },
  'p3-contract-typecheck': {
    id: 'p3-contract-typecheck',
    label: 'P3.1 contract typecheck',
    args: ['run', 'typecheck:p3:contracts'],
    timeoutMs: 5 * minute,
  },
  'p3-contract-lint': {
    id: 'p3-contract-lint',
    label: 'P3.1 contract lint',
    args: ['run', 'lint:p3:contracts'],
    timeoutMs: 5 * minute,
  },
  'p3-contract-test': {
    id: 'p3-contract-test',
    label: 'P3.1 contract tests',
    args: ['run', 'test:p3:contracts'],
    timeoutMs: 5 * minute,
  },
};

export const ciSuiteGateIds: Readonly<Record<CiSuiteId, readonly GateId[]>> = {
  quality: [
    'prepare-quality',
    'build-p2-modules',
    'format-all',
    'lint-all',
    'typecheck-all',
    'test-ci',
  ],
  'quality-coverage': [
    'prepare-quality',
    'build-p2-modules',
    'format-all',
    'lint-all',
    'typecheck-all',
    'coverage-ci',
  ],
  contracts: ['prepare-quality', 'build-p2-modules', 'contracts', 'migrations'],
  architecture: ['architecture', 'security'],
  build: ['prepare-quality', 'build-p2-modules', 'build-apps'],
  audit: ['dependency-audit'],
};

export const fullGateIds: readonly GateId[] = [
  'prepare-quality',
  'build-p2-modules',
  'format-all',
  'lint-all',
  'typecheck-all',
  'coverage-ci',
  'contracts',
  'migrations',
  'architecture',
  'security',
  'build-apps',
  'dependency-audit',
];

export const infrastructureGateIds: readonly GateId[] = ['migrations', 'architecture', 'security'];
