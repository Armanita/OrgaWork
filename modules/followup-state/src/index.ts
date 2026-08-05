import {
  continuationKinds,
  createCaseId,
  createDecisionRequestId,
  createDecisionResponseId,
  createFollowUpStateId,
  createOrganizationId,
  createTeamId,
  createUserId,
  createUtcTimestamp,
  type CaseId,
  type ContinuationKind,
  type DecisionRequestId,
  type DecisionResponseId,
  type FollowUpStateId,
  type OrganizationId,
  type OutcomeAndContinuation,
  type TeamId,
  type UserId,
  type UtcTimestamp,
} from '@workspace/contracts';

export const followUpStateKinds = ['internal_wait', 'external_wait', 'blocked', 'paused'] as const;
export type FollowUpStateKind = (typeof followUpStateKinds)[number];
export const followUpStateStatuses = ['active', 'completed', 'cancelled'] as const;
export type FollowUpStateStatus = (typeof followUpStateStatuses)[number];

export const followUpDomainErrorCodes = [
  'INVALID_FOLLOWUP_STATE',
  'INVALID_FOLLOWUP_TRANSITION',
  'FOLLOWUP_OUTCOME_REQUIRED',
  'FOLLOWUP_CANCELLATION_REASON_REQUIRED',
  'INVALID_DECISION_REQUEST',
  'INVALID_DECISION_TRANSITION',
  'DECISION_RESPONSE_REQUIRED',
  'DECISION_VERSION_CONFLICT',
] as const;
export type FollowUpDomainErrorCode = (typeof followUpDomainErrorCodes)[number];

export class FollowUpDomainError extends Error {
  override readonly name = 'FollowUpDomainError';

  constructor(
    readonly code: FollowUpDomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface FollowUpState {
  readonly id: FollowUpStateId;
  readonly caseId: CaseId;
  readonly organizationId: OrganizationId;
  readonly kind: FollowUpStateKind;
  readonly status: FollowUpStateStatus;
  readonly summary: string;
  readonly targetUserId: UserId | null;
  readonly targetTeamId: TeamId | null;
  readonly externalParty: string | null;
  readonly blocker: string | null;
  readonly pauseReason: string | null;
  readonly completion: OutcomeAndContinuation | null;
  readonly cancellationReason: string | null;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

function normalizeRequiredText(
  value: string,
  code: FollowUpDomainErrorCode,
  message: string,
): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');

  if (normalized === '') {
    throw new FollowUpDomainError(code, message);
  }

  return normalized;
}

function nextVersion(version: number, label: string): number {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError(`نسخه ${label} معتبر نیست.`);
  }

  return version + 1;
}

function baseState(input: {
  readonly id: string;
  readonly caseId: string;
  readonly organizationId: string;
  readonly kind: FollowUpStateKind;
  readonly summary: string;
  readonly now: string | Date;
}): FollowUpState {
  const now = createUtcTimestamp(input.now);

  return {
    id: createFollowUpStateId(input.id),
    caseId: createCaseId(input.caseId),
    organizationId: createOrganizationId(input.organizationId),
    kind: input.kind,
    status: 'active',
    summary: normalizeRequiredText(
      input.summary,
      'INVALID_FOLLOWUP_STATE',
      'شرح وضعیت پیگیری نباید خالی باشد.',
    ),
    targetUserId: null,
    targetTeamId: null,
    externalParty: null,
    blocker: null,
    pauseReason: null,
    completion: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function createInternalWait(input: {
  readonly id: string;
  readonly caseId: string;
  readonly organizationId: string;
  readonly summary: string;
  readonly targetUserId?: string;
  readonly targetTeamId?: string;
  readonly now: string | Date;
}): FollowUpState {
  const hasUser = input.targetUserId !== undefined;
  const hasTeam = input.targetTeamId !== undefined;

  if (hasUser === hasTeam) {
    throw new FollowUpDomainError(
      'INVALID_FOLLOWUP_STATE',
      'انتظار داخلی باید دقیقاً یک کاربر یا تیم هدف داشته باشد.',
    );
  }

  const targetUserId = input.targetUserId;
  const targetTeamId = input.targetTeamId;

  return {
    ...baseState({ ...input, kind: 'internal_wait' }),
    targetUserId: targetUserId === undefined ? null : createUserId(targetUserId),
    targetTeamId: targetTeamId === undefined ? null : createTeamId(targetTeamId),
  };
}

export function createExternalWait(input: {
  readonly id: string;
  readonly caseId: string;
  readonly organizationId: string;
  readonly summary: string;
  readonly externalParty: string;
  readonly now: string | Date;
}): FollowUpState {
  return {
    ...baseState({ ...input, kind: 'external_wait' }),
    externalParty: normalizeRequiredText(
      input.externalParty,
      'INVALID_FOLLOWUP_STATE',
      'طرف بیرونی انتظار باید مشخص باشد.',
    ),
  };
}

export function createBlockedState(input: {
  readonly id: string;
  readonly caseId: string;
  readonly organizationId: string;
  readonly summary: string;
  readonly blocker: string;
  readonly now: string | Date;
}): FollowUpState {
  return {
    ...baseState({ ...input, kind: 'blocked' }),
    blocker: normalizeRequiredText(input.blocker, 'INVALID_FOLLOWUP_STATE', 'مانع باید مشخص باشد.'),
  };
}

export function createPausedState(input: {
  readonly id: string;
  readonly caseId: string;
  readonly organizationId: string;
  readonly summary: string;
  readonly reason: string;
  readonly now: string | Date;
}): FollowUpState {
  return {
    ...baseState({ ...input, kind: 'paused' }),
    pauseReason: normalizeRequiredText(
      input.reason,
      'INVALID_FOLLOWUP_STATE',
      'توقف موقت به دلیل روشن نیاز دارد.',
    ),
  };
}

export function completeFollowUpState(
  value: FollowUpState,
  completion: OutcomeAndContinuation,
  now: string | Date,
): FollowUpState {
  if (value.status !== 'active') {
    throw new FollowUpDomainError(
      'INVALID_FOLLOWUP_TRANSITION',
      'فقط وضعیت پیگیری فعال را می‌توان پایان داد.',
    );
  }

  return {
    ...value,
    status: 'completed',
    completion: {
      ...completion,
      outcome: normalizeRequiredText(
        completion.outcome,
        'FOLLOWUP_OUTCOME_REQUIRED',
        'پایان وضعیت پیگیری بدون نتیجه مجاز نیست.',
      ),
    },
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(value.version, 'وضعیت پیگیری'),
  };
}

export function cancelFollowUpState(
  value: FollowUpState,
  reason: string,
  now: string | Date,
): FollowUpState {
  if (value.status !== 'active') {
    throw new FollowUpDomainError(
      'INVALID_FOLLOWUP_TRANSITION',
      'فقط وضعیت پیگیری فعال را می‌توان لغو کرد.',
    );
  }

  return {
    ...value,
    status: 'cancelled',
    cancellationReason: normalizeRequiredText(
      reason,
      'FOLLOWUP_CANCELLATION_REASON_REQUIRED',
      'لغو وضعیت پیگیری به دلیل روشن نیاز دارد.',
    ),
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(value.version, 'وضعیت پیگیری'),
  };
}

export type FollowUpTransitionSource =
  'action' | FollowUpStateKind | 'decision_request' | 'resolved' | 'closed' | 'cancelled';

const allContinuations = [...continuationKinds] as readonly ContinuationKind[];
const reopenedContinuations = [
  'action',
  'internal_wait',
  'external_wait',
  'blocked',
  'paused',
  'decision_request',
] as const;

export const followUpTransitionMatrix: Readonly<
  Record<FollowUpTransitionSource, readonly ContinuationKind[]>
> = {
  action: allContinuations,
  internal_wait: allContinuations,
  external_wait: allContinuations,
  blocked: [
    'action',
    'internal_wait',
    'external_wait',
    'paused',
    'decision_request',
    'resolved',
    'cancelled',
  ],
  paused: [
    'action',
    'internal_wait',
    'external_wait',
    'blocked',
    'decision_request',
    'resolved',
    'cancelled',
  ],
  decision_request: [
    'action',
    'internal_wait',
    'external_wait',
    'blocked',
    'paused',
    'resolved',
    'cancelled',
  ],
  resolved: reopenedContinuations,
  closed: reopenedContinuations,
  cancelled: [],
};

export function isFollowUpTransitionAllowed(
  source: FollowUpTransitionSource,
  target: ContinuationKind,
): boolean {
  return followUpTransitionMatrix[source].includes(target);
}

export function assertFollowUpTransition(
  source: FollowUpTransitionSource,
  target: ContinuationKind,
): void {
  if (!isFollowUpTransitionAllowed(source, target)) {
    throw new FollowUpDomainError(
      'INVALID_FOLLOWUP_TRANSITION',
      `انتقال وضعیت پیگیری از ${source} به ${target} مجاز نیست.`,
    );
  }
}

export const decisionRequestStatuses = ['open', 'answered', 'closed', 'cancelled'] as const;
export type DecisionRequestStatus = (typeof decisionRequestStatuses)[number];

export interface DecisionRequest {
  readonly id: DecisionRequestId;
  readonly caseId: CaseId;
  readonly organizationId: OrganizationId;
  readonly requestedByUserId: UserId;
  readonly decisionMakerUserId: UserId;
  readonly question: string;
  readonly status: DecisionRequestStatus;
  readonly latestResponseRevision: number;
  readonly latestResponseId: DecisionResponseId | null;
  readonly cancellationReason: string | null;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly version: number;
}

export interface DecisionResponse {
  readonly id: DecisionResponseId;
  readonly requestId: DecisionRequestId;
  readonly revision: number;
  readonly answer: string;
  readonly respondedByUserId: UserId;
  readonly supersedesResponseId: DecisionResponseId | null;
  readonly createdAt: UtcTimestamp;
}

export function createDecisionRequest(input: {
  readonly id: string;
  readonly caseId: string;
  readonly organizationId: string;
  readonly requestedByUserId: string;
  readonly decisionMakerUserId: string;
  readonly question: string;
  readonly now: string | Date;
}): DecisionRequest {
  const now = createUtcTimestamp(input.now);

  return {
    id: createDecisionRequestId(input.id),
    caseId: createCaseId(input.caseId),
    organizationId: createOrganizationId(input.organizationId),
    requestedByUserId: createUserId(input.requestedByUserId),
    decisionMakerUserId: createUserId(input.decisionMakerUserId),
    question: normalizeRequiredText(
      input.question,
      'INVALID_DECISION_REQUEST',
      'متن درخواست تصمیم نباید خالی باشد.',
    ),
    status: 'open',
    latestResponseRevision: 0,
    latestResponseId: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function recordDecisionResponse(
  request: DecisionRequest,
  input: {
    readonly id: string;
    readonly expectedRevision: number;
    readonly answer: string;
    readonly respondedByUserId: string;
    readonly now: string | Date;
  },
): { readonly request: DecisionRequest; readonly response: DecisionResponse } {
  if (request.status !== 'open' && request.status !== 'answered') {
    throw new FollowUpDomainError(
      'INVALID_DECISION_TRANSITION',
      'درخواست تصمیم بسته یا لغوشده پاسخ جدید نمی‌پذیرد.',
    );
  }

  if (input.expectedRevision !== request.latestResponseRevision) {
    throw new FollowUpDomainError(
      'DECISION_VERSION_CONFLICT',
      'نسخه پاسخ تصمیم با نسخه جاری سازگار نیست.',
    );
  }

  const timestamp = createUtcTimestamp(input.now);
  const responseId = createDecisionResponseId(input.id);
  const revision = request.latestResponseRevision + 1;
  const response: DecisionResponse = {
    id: responseId,
    requestId: request.id,
    revision,
    answer: normalizeRequiredText(
      input.answer,
      'DECISION_RESPONSE_REQUIRED',
      'پاسخ تصمیم نباید خالی باشد.',
    ),
    respondedByUserId: createUserId(input.respondedByUserId),
    supersedesResponseId: request.latestResponseId,
    createdAt: timestamp,
  };

  return {
    request: {
      ...request,
      status: 'answered',
      latestResponseRevision: revision,
      latestResponseId: responseId,
      updatedAt: timestamp,
      version: nextVersion(request.version, 'درخواست تصمیم'),
    },
    response,
  };
}

export function closeDecisionRequest(
  request: DecisionRequest,
  now: string | Date,
): DecisionRequest {
  if (request.status !== 'answered') {
    throw new FollowUpDomainError(
      'INVALID_DECISION_TRANSITION',
      'فقط درخواست تصمیم پاسخ‌داده‌شده را می‌توان بست.',
    );
  }

  return {
    ...request,
    status: 'closed',
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(request.version, 'درخواست تصمیم'),
  };
}

export function cancelDecisionRequest(
  request: DecisionRequest,
  reason: string,
  now: string | Date,
): DecisionRequest {
  if (request.status === 'closed' || request.status === 'cancelled') {
    throw new FollowUpDomainError(
      'INVALID_DECISION_TRANSITION',
      'درخواست تصمیم پایان‌یافته را نمی‌توان لغو کرد.',
    );
  }

  return {
    ...request,
    status: 'cancelled',
    cancellationReason: normalizeRequiredText(
      reason,
      'INVALID_DECISION_REQUEST',
      'لغو درخواست تصمیم به دلیل روشن نیاز دارد.',
    ),
    updatedAt: createUtcTimestamp(now),
    version: nextVersion(request.version, 'درخواست تصمیم'),
  };
}

export const followUpDomainEventNames = [
  'followup-state.created',
  'followup-state.completed',
  'followup-state.cancelled',
  'decision.requested',
  'decision.responded',
  'decision.response-amended',
  'decision.closed',
  'decision.cancelled',
] as const;
export type FollowUpDomainEventName = (typeof followUpDomainEventNames)[number];
