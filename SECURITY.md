# Security Policy

## Supported versions

Security fixes are maintained for the current `main` branch and the latest production release. Older branches, superseded pull-request branches, and historical snapshots are not supported security targets.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for a suspected vulnerability.

Preferred reporting paths:

1. If this repository shows **Report a vulnerability** in the GitHub **Security** tab, use that private reporting flow.
2. Otherwise, contact the repository administrator, **@wpessential**, through an existing private project communication channel.

Include enough information to reproduce and assess the issue:

- affected feature, route, component, or workflow
- affected commit, branch, or release when known
- impact and realistic attack scenario
- minimal reproduction steps or proof of concept
- relevant logs or screenshots with secrets and customer data removed
- any suggested mitigation, if available

Do not include credentials, access tokens, production secrets, private customer data, or other sensitive data in a report.

## Coordinated disclosure

Please keep vulnerability details private until the repository administrator confirms that a fix or mitigation is available. Public disclosure should avoid exposing reusable secrets, customer data, or unnecessarily weaponized exploit details.

## Security controls

The repository uses automated dependency auditing, repository security regression checks, CodeQL scanning, Dependabot update automation, and Production Confidence CI. Security-sensitive changes should continue to flow through reviewed pull requests and the required CI gates once repository branch protection is enabled.
