import type { GateId } from './gates.js';

export interface StageDocumentation {
  readonly titleFa: string;
  readonly roadmapItemFa: string;
  readonly nextStageId?: string;
  readonly nextStageTitleFa?: string;
  readonly acceptanceTag: string;
}

export interface StageDefinition {
  readonly id: string;
  readonly title: string;
  readonly status: 'accepted' | 'planned' | 'active';
  readonly gates: readonly GateId[];
  readonly closureEvidenceGateIds: readonly GateId[];
  readonly requiredDocuments: readonly string[];
  readonly reviewDocuments: readonly string[];
  readonly documentation: StageDocumentation;
  readonly closureRequiresStageSpecificEvidence: boolean;
}

const commonClosureDocuments = [
  'docs/PROJECT-STATUS.md',
  'docs/ROADMAP.md',
  'docs/IMPLEMENTATION-JOURNAL.md',
  'docs/TRACEABILITY-MATRIX.md',
] as const;

const commonReviewDocuments = [
  'docs/TEST-AND-ACCEPTANCE.md',
  'docs/RISKS-ASSUMPTIONS-DEBT.md',
  'docs/DECISIONS.md',
] as const;

export const stageDefinitions: Readonly<Record<string, StageDefinition>> = {
  'P3.1': {
    id: 'P3.1',
    title: 'Domain contract for cases, assignments and actions',
    status: 'accepted',
    gates: [
      'p3-contract-build',
      'p3-contract-typecheck',
      'p3-contract-lint',
      'p3-contract-test',
      'architecture',
      'security',
    ],
    closureEvidenceGateIds: ['p3-contract-test'],
    requiredDocuments: commonClosureDocuments,
    reviewDocuments: commonReviewDocuments,
    documentation: {
      titleFa: 'P3.1 — تثبیت قرارداد دامنه پرونده',
      roadmapItemFa: 'P3.1 تثبیت قرارداد دامنه پرونده',
      nextStageId: 'P3.2',
      nextStageTitleFa: 'P3.2 — پیاده‌سازی ایجاد پرونده توسط کاربر',
      acceptanceTag: 'stage-p3.1-case-domain-contract-acceptance',
    },
    closureRequiresStageSpecificEvidence: true,
  },
  'P3.2': {
    id: 'P3.2',
    title: 'Create a case for the current user',
    status: 'planned',
    gates: [
      'prepare-quality',
      'build-p2-modules',
      'format-all',
      'lint-all',
      'typecheck-all',
      'contracts',
      'migrations',
      'architecture',
      'security',
      'build-apps',
    ],
    closureEvidenceGateIds: [],
    requiredDocuments: commonClosureDocuments,
    reviewDocuments: commonReviewDocuments,
    documentation: {
      titleFa: 'P3.2 — پیاده‌سازی ایجاد پرونده توسط کاربر',
      roadmapItemFa: 'P3.2 پیاده‌سازی ایجاد پرونده توسط کاربر',
      nextStageId: 'P3.3',
      nextStageTitleFa: 'P3.3 — پیاده‌سازی ایجاد پرونده برای شخص دیگر',
      acceptanceTag: 'stage-p3.2-create-case-acceptance',
    },
    closureRequiresStageSpecificEvidence: true,
  },
};

export function getStageDefinition(stageId: string): StageDefinition {
  const definition = stageDefinitions[stageId];
  if (definition === undefined) {
    throw new Error(
      `Stage ${stageId} is not registered in tools/verification/stages.ts. ` +
        'Register its gates and closure metadata before implementation starts.',
    );
  }
  return definition;
}
