import { createActionItem, type ActionItem } from '../domain/action.js';
import { createCaseResponsibility, type CaseResponsibility } from '../domain/responsibility.js';
import { createFollowUpCase, type CasePriority, type FollowUpCase } from '../domain/case.js';

export interface CreateOwnCaseCommand {
  readonly organizationId: string;
  readonly actorMembershipId: string;
  readonly title: string;
  readonly description: string;
  readonly priority: CasePriority;
  readonly dueAt?: string | Date;
  readonly initialAction: {
    readonly title: string;
    readonly dueAt?: string | Date;
  };
}

export interface CreateOwnCaseIdentity {
  readonly caseId: string;
  readonly responsibilityId: string;
  readonly actionId: string;
}

export interface CreateOwnCaseContext {
  readonly identity: CreateOwnCaseIdentity;
  readonly now: string | Date;
}

export interface CreateOwnCasePlan {
  readonly case: FollowUpCase;
  readonly primaryResponsibility: CaseResponsibility;
  readonly initialAction: ActionItem;
}

export function planCreateOwnCase(
  command: CreateOwnCaseCommand,
  context: CreateOwnCaseContext,
): CreateOwnCasePlan {
  const primaryResponsibility = createCaseResponsibility({
    id: context.identity.responsibilityId,
    caseId: context.identity.caseId,
    organizationId: command.organizationId,
    target: {
      kind: 'membership',
      membershipId: command.actorMembershipId,
    },
    assignedByMembershipId: command.actorMembershipId,
    acceptanceMode: 'self',
    role: 'primary',
    now: context.now,
  });

  const initialAction = createActionItem({
    id: context.identity.actionId,
    caseId: context.identity.caseId,
    organizationId: command.organizationId,
    sourceResponsibilityId: primaryResponsibility.id,
    responsible: {
      kind: 'membership',
      membershipId: command.actorMembershipId,
    },
    createdByMembershipId: command.actorMembershipId,
    kind: 'primary',
    title: command.initialAction.title,
    ...(command.initialAction.dueAt === undefined ? {} : { dueAt: command.initialAction.dueAt }),
    now: context.now,
  });

  const createdCase = createFollowUpCase({
    id: context.identity.caseId,
    organizationId: command.organizationId,
    title: command.title,
    description: command.description,
    priority: command.priority,
    ...(command.dueAt === undefined ? {} : { dueAt: command.dueAt }),
    createdByMembershipId: command.actorMembershipId,
    primaryResponsibilityId: primaryResponsibility.id,
    currentWork: {
      kind: 'action',
      id: initialAction.id,
    },
    now: context.now,
  });

  return {
    case: createdCase,
    primaryResponsibility,
    initialAction,
  };
}
