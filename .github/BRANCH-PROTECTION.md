# Branch protection baseline for OrgaWork

The repository administrator should require the following checks before merging into `main`

- `Quality (ubuntu-latest)`
- `Quality (windows-latest)`
- `Contracts OpenAPI and migrations`
- `Architecture and repository policy (ubuntu-latest)`
- `Architecture and repository policy (windows-latest)`
- `Build four applications`
- `Dependency vulnerability audit`

Recommended repository settings

- Require a pull request before merging
- Require at least one approving review
- Dismiss stale approvals when new commits are pushed
- Require conversation resolution
- Require branches to be up to date before merging
- Block force pushes and branch deletion
- Do not allow bypass except for an audited emergency procedure

This file records the approved baseline only
Remote branch protection is not changed by local project scripts
