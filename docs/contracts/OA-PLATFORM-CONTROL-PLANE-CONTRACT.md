# OA Platform Control Plane Contract

## 1. Status

- Contract ID: `OA-PLATFORM-CONTROL-PLANE`
- Capability: `OA — Organization Administration`
- Applies to: `OA-01`, `OA-02`, `OA-03`
- Architecture: Capability + Vertical Slice
- Decision baseline: `DEC-SEC-2026-001`
- Contract status: accepted for implementation
- Date: `2026-08-19`

This contract defines the exact first production-shaped control-plane boundary for
`platform_operator`. It does not grant tenant content access and does not replace
tenant RBAC.

## 2. Security invariants

1. `platform_operator` is a global platform authority, not a tenant membership role.
2. No `platform_operator` row may be required in `orgawork_membership_roles`.
3. `platform_operator` receives no implicit tenant permission.
4. Tenant RLS remains enabled and forced.
5. Platform provisioning uses explicit RLS policies bound to the authenticated global
   platform authority. No `BYPASSRLS`, superuser runtime, or hidden tenant context is allowed.
6. `orgawork_runtime` remains `NOSUPERUSER`, `NOBYPASSRLS`, `NOLOGIN`.
7. Every modifying platform request requires an active normal OrgaWork session plus
   CSRF validation.
8. Every platform command requires a human-readable `reason`.
9. Every successful provisioning command records actor, reason, organization,
   target user when applicable, timestamp, request ID, correlation ID and result.
10. Platform audit is separate from tenant authorization audit.
11. Tenant API/UI may assign only `member` and `manager`.
12. Tenant API/UI may not create, grant, replace or self-elevate
    `organization_admin`.
13. `organization_admin` is granted only by the platform provisioning boundary.
14. Public/self-service Organization creation remains forbidden.
15. Development seed/fixture is allowed only for the dedicated development database
    and is not the production provisioning contract.

## 3. Global platform authority

The implementation will introduce a global authority store:

`public.orgawork_platform_operators`

Required semantics:

- one row per platform user;
- references `public.orgawork_users(id)`;
- status is `active` or `disabled`;
- carries created/updated timestamps and positive version;
- no Organization ID;
- no membership dependency;
- no tenant permission catalog entry.

Runtime read access is limited by RLS to the currently authenticated user through
`orgawork.user_id`. Runtime does not receive arbitrary mutation rights on this table.

## 4. Platform provisioning audit

The implementation will introduce:

`public.orgawork_platform_provisioning_audit`

Minimum recorded fields:

- immutable audit ID;
- `actor_user_id`;
- action;
- reason;
- `organization_id` when known;
- `target_user_id` when applicable;
- request ID;
- correlation ID;
- result;
- UTC timestamp.

Audit is append-only from the runtime perspective. Normal runtime code receives no
UPDATE or DELETE permission.

Initial action values:

- `organization.create`
- `organization_admin.provision`

Initial result values:

- `succeeded`
- `failed`

## 5. Platform idempotency

Platform-changing commands use a global idempotency store separate from tenant Work
Management idempotency.

Required request header:

`Idempotency-Key`

Rules:

- 8 to 128 characters;
- characters limited to `[A-Za-z0-9._:-]`;
- scoped by actor user + operation + key;
- request fingerprint mismatch for a reused key is rejected;
- a completed identical request replays the original successful result;
- no tenant Organization context is used for platform idempotency.

## 6. Authentication and platform authorization

The normal OrgaWork session remains the authentication mechanism.

Platform routes:

1. read the normal session cookie;
2. resolve the active session using the existing Authentication service;
3. set `orgawork.user_id` for database authorization;
4. require an active row in `orgawork_platform_operators`;
5. do not require `currentOrganizationId`;
6. do not infer authority from tenant role keys.

Platform authority is default-deny.

## 7. HTTP contract

### 7.1 Read platform authority

`GET /v1/platform/session`

Requirements:

- authenticated session required;
- no Organization context required;
- no CSRF required because the operation is read-only.

Success data:

```json
{
  "platformOperator": {
    "userId": "uuid",
    "email": "operator@example.com",
    "status": "active"
  }
}
```

A valid OrgaWork user without active platform authority receives `403`.

### 7.2 Create Organization — OA-01

`POST /v1/platform/organizations`

Headers:

- session cookie;
- `x-csrf-token`;
- `Idempotency-Key`;
- optional request/correlation headers already supported by the API envelope.

Body:

```json
{
  "name": "Organization name",
  "reason": "Operational reason for provisioning"
}
```

Validation:

- `name`: trimmed, non-empty, maximum 120 characters;
- `reason`: trimmed, 10 to 500 characters.

Success data:

```json
{
  "organization": {
    "id": "uuid",
    "name": "Organization name"
  },
  "replayed": false
}
```

The command is transactional and records a platform audit event.

### 7.3 Provision initial Organization Admin — OA-02

`POST /v1/platform/organizations/:organizationId/initial-admin`

Headers:

- session cookie;
- `x-csrf-token`;
- `Idempotency-Key`.

Body:

```json
{
  "email": "admin@example.com",
  "reason": "Operational reason for assigning the initial administrator"
}
```

Validation:

- normalized valid email;
- `reason`: trimmed, 10 to 500 characters.

Behavior:

1. target Organization must exist;
2. an existing active user is reused;
3. if the email does not exist, an `active` OrgaWork user is created without a
   password credential;
4. a missing membership is created active;
5. the membership receives exactly `organization_admin`;
6. the operation may not be performed through tenant role-management routes;
7. result is audited in the platform audit stream.

Creating a user without a credential does not create a password or expose a secret.
The existing password-reset/account-setup flow is used to establish a credential.
In development, the existing development reset token behavior may be used for manual
testing. Production token delivery remains a separate notification/readiness concern.

Success data:

```json
{
  "organizationId": "uuid",
  "userId": "uuid",
  "email": "admin@example.com",
  "membershipId": "uuid",
  "role": "organization_admin",
  "accountSetupRequired": true,
  "replayed": false
}
```

`accountSetupRequired` is `false` when the target user already has a credential and
`true` when account setup is required.

## 8. OA-03 tenant role boundary

Tenant administration is narrowed to:

- `member`
- `manager`

The following are rejected in tenant invitation and role-replacement API/service
boundaries:

- `organization_admin`
- `platform_operator`
- any unknown role.

Existing `organization_admin` memberships remain readable and manageable only where
the accepted product rules allow, but tenant role mutation cannot create or replace
that role.

Database invitation constraints are tightened to `member|manager`.

`orgawork_membership_roles` continues to allow `organization_admin` because the
platform provisioning path owns its creation. Historical allowance of
`platform_operator` as a membership role is removed by the OA migration.

## 9. RLS contract

Platform provisioning does not disable RLS.

The OA migration introduces explicit RLS policies for `orgawork_runtime` that permit
only an authenticated active global platform operator to perform the narrow
provisioning operations required by OA-01/OA-02.

The policies do not grant the platform operator general SELECT/UPDATE/DELETE access
to tenant content.

No policy is introduced for Work Management, teams, files, actions, reports or other
tenant content.

## 10. Web UI contract

The web control plane lives under:

`/platform`

The first screen exposes:

- signed-in platform account;
- Create Organization form;
- after Organization creation, Initial Organization Admin form bound to that
  Organization;
- provisioning result;
- account-setup guidance when the created admin has no credential;
- recent provisioning audit entries performed by the current operator.

All public text uses `next-intl`.

Required locale behavior:

- Persian UI is fully RTL;
- English UI remains supported;
- no raw backend error or technical stack trace is shown.

After a successful normal login:

- if `/v1/platform/session` confirms active platform authority, the web app lands at
  `/platform`;
- otherwise the existing `/organization` path remains unchanged.

## 11. Development bootstrap

Manual browser testing requires a dedicated development-only platform account.

The implementation may add a guarded development seed/fixture that:

- runs only against the dedicated development database;
- creates or reuses `platform@live.orgawork.test`;
- grants global `platform_operator` authority;
- uses the existing Live Development credential policy;
- creates no tenant membership for this account.

This fixture is not a production bootstrap mechanism.

Production bootstrap of the first platform operator must be an explicit,
deployment-controlled Tool/Command and must not be exposed through tenant or public UI.

## 12. Required tests before manual acceptance

At minimum:

1. global platform authority is not a membership role;
2. platform operator has zero tenant permissions;
3. non-platform authenticated user receives 403 from platform routes;
4. unauthenticated platform request receives 401;
5. mutation without valid CSRF is rejected;
6. missing/invalid idempotency key is rejected;
7. idempotent replay returns the prior result;
8. key reuse with a different request fingerprint is rejected;
9. Organization creation succeeds without tenant context;
10. Organization creation does not disable or bypass RLS;
11. initial admin provisioning creates or reuses the user and creates one active
    membership with `organization_admin`;
12. tenant invitation cannot request `organization_admin`;
13. tenant role replacement cannot grant `organization_admin`;
14. `platform_operator` cannot read tenant Work Management data without an explicit
    tenant membership and normal tenant authorization;
15. platform audit is append-only and records the required metadata;
16. Persian/English UI keys stay aligned;
17. browser/manual flow covers login -> `/platform` -> create Organization -> provision
    admin -> account setup guidance.

## 13. Explicitly out of scope

This contract does not grant:

- tenant impersonation;
- arbitrary tenant data browsing;
- Organization deletion;
- Organization suspension;
- billing administration;
- arbitrary user administration;
- replacement/removal of an existing Organization Admin;
- support impersonation;
- platform analytics.

Each requires a separate product/security decision.

## 14. Runtime clarification recorded before implementation

### 14.1 Read current operator provisioning audit

`GET /v1/platform/audit?limit=20`

Requirements:

- authenticated normal OrgaWork session;
- active global `platform_operator`;
- read-only, therefore no CSRF requirement;
- returns only provisioning Audit rows whose `actor_user_id` is the current operator;
- default limit is 20 and maximum is 50.

This endpoint exists to fulfill the already accepted Web UI requirement for recent
operator provisioning Audit and does not expose another operator's Audit trail.

### 14.2 Explicit transaction-local platform target

The runtime provisioning transaction uses:

`orgawork.platform_target_organization_id`

This value is an explicit, transaction-local control-plane target and is distinct
from `orgawork.organization_id`. It does not create a tenant session context.

Platform RLS policies for Organization and membership provisioning require both:

1. an active global `platform_operator` matching `orgawork.user_id`;
2. the affected Organization to match the explicit platform target.

No Platform policy is added to Work Management or other tenant-content tables.
