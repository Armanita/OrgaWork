# OrgaWork System Map

## Purpose

Navigation map for project changes.

This document answers:
- Where does a capability live?
- Which layer owns a responsibility?
- Which files should be inspected before implementation?

---

# Change Investigation Path

Requirement
|
v
SYSTEM-MAP
|
v
Capability Owner
|
v
Frontend / API / Module / Database
|
v
Implementation Plan
|
v
Patch

---

# Capability Navigation

## Authentication

Frontend:
- apps/web/app/login
- apps/web/lib/identity-api.ts

API:
- apps/api/src/routes/identity-organization.ts

Modules:
- modules/authentication
- modules/identity

Database:
- 0005_create-password-credentials.sql
- 0006_create-session-and-organization-context.sql


## Organization Administration

Frontend:
- apps/web/app/organization

API:
- apps/api/src/routes/organization-administration.ts

Module:
- modules/organization-administration

Database:
- 0004_create-identity-organization-schema.sql
- 0007_create-authorization-and-administration.sql


## Work Management

Frontend:
- apps/web/lib/work-management-api.ts

API:
- apps/api/src/routes/work-management.ts

Module:
- modules/work-management

Database:
- 0010_create-work-management-foundation.sql


## Platform Control Plane

Frontend:
- apps/web/app/platform
- apps/web/lib/platform-api.ts

API:
- apps/api/src/routes/platform-control-plane.ts

Module:
- modules/organization-administration

Database:
- 0011_create-platform-control-plane.sql
- 0012_extend-platform-control-plane-management.sql

---

# Database Ownership Map

## Identity and Organization

Tables:
- orgawork_users
- orgawork_organizations
- orgawork_memberships
- orgawork_teams
- orgawork_team_memberships

Migrations:
- 0004

Owners:
- identity
- organizations
- organization-context
- teams


## Authentication

Tables:
- orgawork_password_credentials
- orgawork_sessions
- orgawork_login_rate_limits
- orgawork_password_reset_tokens

Migrations:
- 0005
- 0006

Owner:
- authentication


## Authorization and Administration

Tables:
- orgawork_role_permissions
- orgawork_membership_roles
- orgawork_explicit_denials
- orgawork_authorization_audit
- orgawork_invitations

Migrations:
- 0007

Owners:
- authorization
- organization-administration


## Work Management

Tables:
- orgawork_cases
- orgawork_case_responsibilities
- orgawork_actions
- orgawork_case_current_work

Migration:
- 0010

Owners:
- work-management
- cases
- actions
- assignments

---

# Change Routing Rules

If changing:

Login:
- inspect identity UI
- identity API client
- authentication module
- session migrations

Organization membership:
- inspect organization UI
- organization-administration API
- organization-administration module
- membership tables

Dashboard metrics:
- inspect existing capability ownership first
- prefer existing tables
- do not create migration unless data model requires it

---

# Encoding Rule

Documentation files should use plain text compatible symbols.

Use:
|
v

Instead of special arrow characters.

---

# Documentation Relationship

- SYSTEM-BEHAVIOR.md: expected system behavior
- ARCHITECTURE-NOTES.md: architecture decisions
- FEATURE-SPECIFICATION.md: feature definition
- DEVELOPMENT-METHOD.md: development workflow
- ACCEPTANCE.md: acceptance rules
- SYSTEM-MAP.md: change navigation
---

# Runtime Dependency Map

Backend runtime composition:

apps/api/src/main.ts

|

v

apps/api/src/identity-organization-runtime.ts

|

v

Service Factory

|

v

Module Repository

|

v

Database


Rules:
- Routes receive dependencies through ApplicationOptions.
- Runtime creates services and repositories.
- Routes should not contain direct database access.

---

# API Contract Map

API structure:

Route

|

v

Request Validation

|

v

Service Call

|

v

Response Contract


Contract ownership:
- packages/contracts contains shared API contracts.
- apps/api/src/routes contains HTTP behavior.
- modules contain business behavior.


---

# Test Map

## Module Tests

Location:

modules/*/src/**/*.test.ts

Purpose:
- Domain rules
- Application behavior
- Infrastructure behavior


## API Tests

Location:

apps/api/src/routes/*.test.ts

Purpose:
- HTTP behavior
- Authentication boundaries
- Authorization checks


## Frontend Tests

Location:

apps/web/**/*.test.ts

Purpose:
- UI behavior
- API client behavior


## Acceptance

Reference:

docs/ACCEPTANCE.md

Purpose:
- Final acceptance rules
- Independent verification gates


---

# Capability Ownership Verification Rule

Before changing a capability:

1. Identify Capability Owner.
2. Check Frontend entry point.
3. Check API route.
4. Check Module.
5. Check Database ownership.
6. Check Tests.
7. Prepare implementation patch.

---

# Platform Control Plane Note

Platform Control Plane ownership requires explicit verification before future changes.

Current mapping:
- Frontend: apps/web/app/platform
- API: apps/api/src/routes/platform-control-plane.ts
- Runtime: platformControlPlane service
- Database: platform control plane migrations

---


---

# Local Development Runtime

Infrastructure startup:

pnpm infra:start

|

v

tools/scripts/local-infrastructure.ts

|

v

tools/scripts/local-infrastructure-plan.ts

|

v

Docker Compose

Services:
- PostgreSQL
- Redis
- MinIO

Initialization:
- orgawork-minio-bucket-init

Persistent volumes:
- orgawork-postgres-data
- orgawork-redis-data
- orgawork-minio-data


Application startup:

run-apps.ps1

|

+-- apps/web
+-- apps/api
+-- apps/worker
+-- apps/scheduler

---

# Migration Ownership Map

Source:

infra/migrations/*.sql

|

v

packages/database/src/migrations.ts

|

v

loadVersionedMigrations()

|

v

packages/database/src/migration-history.ts

|

v

runTrackedVersionedMigrations()

|

v

orgawork_migration_history


Rules:
- Migrations are versioned.
- Execution is tracked.
- Migration history is persisted.

---

# Background Runtime Map

## apps/worker

Purpose:
- Background execution runtime.
- Connectivity checks.
- Runtime configuration.


## apps/scheduler

Purpose:
- Scheduled execution runtime.
- Connectivity checks.
- Runtime configuration.

---

# Development Identity Matrix

Known development identities:

admin@live.orgawork.test
- Role: organization_admin

manager@live.orgawork.test
- Role: manager

member@live.orgawork.test
- Role: member

invitee@live.orgawork.test
- Role: invitation flow

platform@live.orgawork.test
- Role: platform control plane identity


Password source:
- Not stored in repository.
- Not stored in migration files.
- Managed separately from source control.

---

# Infrastructure Safety Rules

infra:stop
- Stops infrastructure services.
- Preserves persistent volumes.


infra:cleanup
- Removes containers and compose network.
- Preserves persistent volumes.


Forbidden destructive compose arguments:
- --volumes
- -v
- --remove-orphans

---
