declare const contractBrand: unique symbol;

export const contractVersion = '1.0.0' as const;

export type Brand<Value, Name extends string> = Value & {
  readonly [contractBrand]: Name;
};

export type OrganizationId = Brand<string, 'OrganizationId'>;
export type UserId = Brand<string, 'UserId'>;
export type MembershipId = Brand<string, 'MembershipId'>;
export type TeamId = Brand<string, 'TeamId'>;
export type TeamMembershipId = Brand<string, 'TeamMembershipId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type InvitationId = Brand<string, 'InvitationId'>;
export type PermissionId = Brand<string, 'PermissionId'>;
export type CaseId = Brand<string, 'CaseId'>;
export type CaseAssignmentId = Brand<string, 'CaseAssignmentId'>;
export type CaseResponsibilityId = CaseAssignmentId;
export type ActionItemId = Brand<string, 'ActionItemId'>;
export type FollowUpStateId = Brand<string, 'FollowUpStateId'>;
export type DecisionRequestId = Brand<string, 'DecisionRequestId'>;
export type DecisionResponseId = Brand<string, 'DecisionResponseId'>;
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;
export type RequestId = Brand<string, 'RequestId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type UtcTimestamp = Brand<string, 'UtcTimestamp'>;

const identifierPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const utcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const fieldPattern = /^[a-z][a-zA-Z0-9_.]{0,63}$/u;
const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

function createIdentifier<Name extends string>(value: string, label: string): Brand<string, Name> {
  const normalized = value.trim().toLowerCase();

  if (!identifierPattern.test(normalized)) {
    throw new TypeError(`شناسه ${label} معتبر نیست.`);
  }

  return normalized as Brand<string, Name>;
}

export function createOrganizationId(value: string): OrganizationId {
  return createIdentifier<'OrganizationId'>(value, 'سازمان');
}

export function createUserId(value: string): UserId {
  return createIdentifier<'UserId'>(value, 'کاربر');
}

export function createMembershipId(value: string): MembershipId {
  return createIdentifier<'MembershipId'>(value, 'عضویت');
}

export function createTeamId(value: string): TeamId {
  return createIdentifier<'TeamId'>(value, 'تیم');
}

export function createTeamMembershipId(value: string): TeamMembershipId {
  return createIdentifier<'TeamMembershipId'>(value, 'عضویت تیم');
}

export function createSessionId(value: string): SessionId {
  return createIdentifier<'SessionId'>(value, 'نشست');
}

export function createInvitationId(value: string): InvitationId {
  return createIdentifier<'InvitationId'>(value, 'دعوت');
}

export function createCaseId(value: string): CaseId {
  return createIdentifier<'CaseId'>(value, 'پرونده');
}

export function createCaseAssignmentId(value: string): CaseAssignmentId {
  return createIdentifier<'CaseAssignmentId'>(value, 'مسئولیت پرونده');
}

export const createCaseResponsibilityId = createCaseAssignmentId;

export function createActionItemId(value: string): ActionItemId {
  return createIdentifier<'ActionItemId'>(value, 'اقدام');
}

export function createFollowUpStateId(value: string): FollowUpStateId {
  return createIdentifier<'FollowUpStateId'>(value, 'وضعیت پیگیری');
}

export function createDecisionRequestId(value: string): DecisionRequestId {
  return createIdentifier<'DecisionRequestId'>(value, 'درخواست تصمیم');
}

export function createDecisionResponseId(value: string): DecisionResponseId {
  return createIdentifier<'DecisionResponseId'>(value, 'پاسخ تصمیم');
}

export function createIdempotencyKey(value: string): IdempotencyKey {
  const normalized = value.trim();

  if (!idempotencyKeyPattern.test(normalized)) {
    throw new TypeError('کلید عدم تکرار معتبر نیست.');
  }

  return normalized as IdempotencyKey;
}

export function createRequestId(value: string): RequestId {
  return createIdentifier<'RequestId'>(value, 'درخواست');
}

export function createCorrelationId(value: string): CorrelationId {
  return createIdentifier<'CorrelationId'>(value, 'همبستگی');
}

export function createUtcTimestamp(value: string | Date): UtcTimestamp {
  const normalized = value instanceof Date ? value.toISOString() : value.trim();

  if (!utcTimestampPattern.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    throw new TypeError('زمان UTC معتبر نیست.');
  }

  return new Date(normalized).toISOString() as UtcTimestamp;
}

export interface ApiResponseMeta {
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly timestamp: UtcTimestamp;
  readonly contractVersion: typeof contractVersion;
}

export interface ApiSuccessResponse<Data> {
  readonly ok: true;
  readonly data: Data;
  readonly meta: ApiResponseMeta;
}

export function createApiSuccess<Data>(
  data: Data,
  meta: Omit<ApiResponseMeta, 'contractVersion'>,
): ApiSuccessResponse<Data> {
  return {
    ok: true,
    data,
    meta: { ...meta, contractVersion },
  };
}

export const apiErrorCodes = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_ACCOUNT_DISABLED',
  'AUTH_SESSION_REQUIRED',
  'AUTH_SESSION_EXPIRED',
  'AUTH_SESSION_REVOKED',
  'AUTH_CSRF_INVALID',
  'AUTH_PASSWORD_POLICY_FAILED',
  'AUTH_PASSWORD_RESET_INVALID',
  'ORGANIZATION_CONTEXT_REQUIRED',
  'ORGANIZATION_MEMBERSHIP_REQUIRED',
  'ORGANIZATION_MEMBERSHIP_INACTIVE',
  'ORGANIZATION_SWITCH_FORBIDDEN',
  'AUTHORIZATION_DENIED',
  'INVITATION_INVALID',
  'INVITATION_EXPIRED',
  'INVITATION_REVOKED',
  'MEMBERSHIP_STATE_CONFLICT',
  'TEAM_ORGANIZATION_MISMATCH',
  'CASE_STATE_CONFLICT',
  'CASE_CURRENT_WORK_REQUIRED',
  'CASE_PRIMARY_ASSIGNMENT_REQUIRED',
  'ASSIGNMENT_STATE_CONFLICT',
  'ASSIGNMENT_PRIMARY_CONFLICT',
  'ACTION_STATE_CONFLICT',
  'ACTION_CONTINUATION_REQUIRED',
  'FOLLOWUP_STATE_CONFLICT',
  'FOLLOWUP_TRANSITION_INVALID',
  'DECISION_STATE_CONFLICT',
  'DECISION_VERSION_CONFLICT',
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export interface ApiErrorItem {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly field?: string;
}

export interface ApiErrorResponse {
  readonly ok: false;
  readonly error: ApiErrorItem;
  readonly meta: ApiResponseMeta;
}

export function normalizeContractField(value: string): string {
  const normalized = value.trim();

  if (!fieldPattern.test(normalized)) {
    throw new TypeError('نام فیلد قرارداد معتبر نیست.');
  }

  return normalized;
}

export function createApiError(
  code: ApiErrorCode,
  message: string,
  meta: Omit<ApiResponseMeta, 'contractVersion'>,
  field?: string,
): ApiErrorResponse {
  const normalizedMessage = message.trim();

  if (normalizedMessage === '') {
    throw new TypeError('پیام عمومی خطا نباید خالی باشد.');
  }

  const error: ApiErrorItem =
    field === undefined
      ? { code, message: normalizedMessage }
      : { code, message: normalizedMessage, field: normalizeContractField(field) };

  return {
    ok: false,
    error,
    meta: { ...meta, contractVersion },
  };
}

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface PageInfo extends PageRequest {
  readonly totalItems: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

export function normalizePageRequest(
  input: Partial<PageRequest> = {},
  maximumPageSize = 100,
): PageRequest {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 25;

  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError('شماره صفحه معتبر نیست.');
  }

  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    !Number.isInteger(maximumPageSize) ||
    maximumPageSize < 1 ||
    pageSize > maximumPageSize
  ) {
    throw new RangeError('اندازه صفحه معتبر نیست.');
  }

  return { page, pageSize };
}

export function createPageInfo(request: PageRequest, totalItems: number): PageInfo {
  if (!Number.isInteger(totalItems) || totalItems < 0) {
    throw new RangeError('تعداد کل اقلام معتبر نیست.');
  }

  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / request.pageSize);

  return {
    ...request,
    totalItems,
    totalPages,
    hasNext: request.page < totalPages,
    hasPrevious: totalPages > 0 && request.page > 1,
  };
}

export const sortDirections = ['asc', 'desc'] as const;
export type SortDirection = (typeof sortDirections)[number];

export interface SortSpec {
  readonly field: string;
  readonly direction: SortDirection;
}

export function normalizeSortSpec(input: SortSpec): SortSpec {
  return {
    field: normalizeContractField(input.field),
    direction: input.direction,
  };
}

export const filterOperators = [
  'eq',
  'neq',
  'contains',
  'startsWith',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
] as const;

export type FilterOperator = (typeof filterOperators)[number];
export type FilterScalar = string | number | boolean | null;

export interface FilterSpec {
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: FilterScalar | readonly FilterScalar[];
}

export function normalizeFilterSpec(input: FilterSpec): FilterSpec {
  if (input.operator === 'in' && !Array.isArray(input.value)) {
    throw new TypeError('مقدار عملگر in باید آرایه باشد.');
  }

  if (input.operator !== 'in' && Array.isArray(input.value)) {
    throw new TypeError('مقدار فیلتر معتبر نیست.');
  }

  return {
    field: normalizeContractField(input.field),
    operator: input.operator,
    value: input.value,
  };
}

export interface MembershipResponsibilityTarget {
  readonly kind: 'membership';
  readonly membershipId: MembershipId;
}

export interface TeamResponsibilityTarget {
  readonly kind: 'team';
  readonly teamId: TeamId;
}

export type ResponsibilityTarget = MembershipResponsibilityTarget | TeamResponsibilityTarget;

export type ResponsibilityTargetInput =
  | { readonly kind: 'membership'; readonly membershipId: string }
  | { readonly kind: 'team'; readonly teamId: string };

export function createResponsibilityTarget(input: ResponsibilityTargetInput): ResponsibilityTarget {
  return input.kind === 'membership'
    ? { kind: 'membership', membershipId: createMembershipId(input.membershipId) }
    : { kind: 'team', teamId: createTeamId(input.teamId) };
}

export const currentWorkKinds = [
  'action',
  'internal_wait',
  'external_wait',
  'blocked',
  'paused',
  'decision_request',
] as const;
export type CurrentWorkKind = (typeof currentWorkKinds)[number];

export interface ActionCurrentWorkReference {
  readonly kind: 'action';
  readonly id: ActionItemId;
}

export interface FollowUpStateCurrentWorkReference {
  readonly kind: 'internal_wait' | 'external_wait' | 'blocked' | 'paused';
  readonly id: FollowUpStateId;
}

export interface DecisionCurrentWorkReference {
  readonly kind: 'decision_request';
  readonly id: DecisionRequestId;
}

export type CurrentWorkReference =
  ActionCurrentWorkReference | FollowUpStateCurrentWorkReference | DecisionCurrentWorkReference;

export interface ResponsibilityAcceptanceCurrentWorkReference {
  readonly kind: 'responsibility_acceptance';
  readonly id: CaseResponsibilityId;
}

export const caseCurrentWorkKinds = ['action', 'responsibility_acceptance'] as const;
export type CaseCurrentWorkKind = (typeof caseCurrentWorkKinds)[number];
export type CaseCurrentWorkReference =
  ActionCurrentWorkReference | ResponsibilityAcceptanceCurrentWorkReference;

export const continuationKinds = [...currentWorkKinds, 'resolved', 'cancelled'] as const;
export type ContinuationKind = (typeof continuationKinds)[number];

export interface ResolvedContinuation {
  readonly kind: 'resolved';
}

export interface CancelledContinuation {
  readonly kind: 'cancelled';
  readonly reason: string;
}

export type Continuation = CurrentWorkReference | ResolvedContinuation | CancelledContinuation;

export interface OutcomeAndContinuation {
  readonly outcome: string;
  readonly continuation: Continuation;
}

export interface SessionOrganizationContext {
  readonly sessionId: SessionId;
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
}

export function createSessionOrganizationContext(input: {
  readonly sessionId: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly requestId: string;
  readonly correlationId: string;
}): SessionOrganizationContext {
  return {
    sessionId: createSessionId(input.sessionId),
    userId: createUserId(input.userId),
    organizationId: createOrganizationId(input.organizationId),
    requestId: createRequestId(input.requestId),
    correlationId: createCorrelationId(input.correlationId),
  };
}

export interface HealthResponse {
  readonly service: 'orgawork-api';
  readonly status: 'ok';
  readonly timestamp: UtcTimestamp;
}

export interface ReadinessResponse {
  readonly service: 'orgawork-api';
  readonly status: 'ready';
  readonly timestamp: UtcTimestamp;
}

export const contractOperations = {
  health: {
    operationId: 'getHealth',
    method: 'GET',
    path: '/health',
  },
  readiness: {
    operationId: 'getReadiness',
    method: 'GET',
    path: '/ready',
  },
} as const;

function isContractRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOperationalResponse(value: unknown, status: 'ok' | 'ready'): UtcTimestamp {
  if (
    !isContractRecord(value) ||
    value['service'] !== 'orgawork-api' ||
    value['status'] !== status ||
    typeof value['timestamp'] !== 'string'
  ) {
    throw new TypeError('پاسخ عملیاتی رابط برنامه‌نویسی معتبر نیست.');
  }

  return createUtcTimestamp(value['timestamp']);
}

export function parseHealthResponse(value: unknown): HealthResponse {
  return {
    service: 'orgawork-api',
    status: 'ok',
    timestamp: parseOperationalResponse(value, 'ok'),
  };
}

export function parseReadinessResponse(value: unknown): ReadinessResponse {
  return {
    service: 'orgawork-api',
    status: 'ready',
    timestamp: parseOperationalResponse(value, 'ready'),
  };
}

export interface AuthenticationSessionData {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly email: string;
  readonly status: 'active';
  readonly sessionRevision: number;
  readonly currentOrganizationId: OrganizationId | null;
  readonly csrfToken: string;
  readonly idleExpiresAt: UtcTimestamp;
  readonly absoluteExpiresAt: UtcTimestamp;
}

export interface OrganizationSummaryData {
  readonly id: OrganizationId;
  readonly name: string;
  readonly membershipId: MembershipId;
  readonly membershipStatus: 'active';
}

export const identityOrganizationOperations = {
  login: { operationId: 'login', method: 'POST', path: '/v1/auth/login' },
  logout: { operationId: 'logout', method: 'POST', path: '/v1/auth/logout' },
  logoutAll: { operationId: 'logoutAll', method: 'POST', path: '/v1/auth/logout-all' },
  session: { operationId: 'getSession', method: 'GET', path: '/v1/auth/session' },
  passwordResetRequest: {
    operationId: 'requestPasswordReset',
    method: 'POST',
    path: '/v1/auth/password-reset/request',
  },
  passwordResetConfirm: {
    operationId: 'confirmPasswordReset',
    method: 'POST',
    path: '/v1/auth/password-reset/confirm',
  },
  organizations: { operationId: 'listOrganizations', method: 'GET', path: '/v1/organizations' },
  currentOrganization: {
    operationId: 'switchCurrentOrganization',
    method: 'POST',
    path: '/v1/auth/current-organization',
  },
  memberships: {
    operationId: 'listOrganizationMemberships',
    method: 'GET',
    path: '/v1/organizations/{organizationId}/memberships',
  },
  updateMembership: {
    operationId: 'updateMembership',
    method: 'PATCH',
    path: '/v1/organizations/{organizationId}/memberships/{membershipId}',
  },
  replaceMembershipRoles: {
    operationId: 'replaceMembershipRoles',
    method: 'PATCH',
    path: '/v1/organizations/{organizationId}/memberships/{membershipId}/roles',
  },
  invitations: {
    operationId: 'createInvitation',
    method: 'POST',
    path: '/v1/organizations/{organizationId}/invitations',
  },
  teams: {
    operationId: 'listOrganizationTeams',
    method: 'GET',
    path: '/v1/organizations/{organizationId}/teams',
  },
  createTeam: {
    operationId: 'createTeam',
    method: 'POST',
    path: '/v1/organizations/{organizationId}/teams',
  },
} as const;
