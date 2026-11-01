# Security policy

EduGap AI stores student learning data, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub's [private vulnerability reporting](https://github.com/Ramssmb/edugap-ai/security/advisories/new) for this repository.

Include what you found, the steps to reproduce it, and the impact you expect. You should get an acknowledgement within a few days. Please give us a reasonable amount of time to fix the issue before disclosing it publicly.

## Supported versions

Only the latest commit on `main` receives security fixes.

## Security model (summary)

- Passwords are hashed with bcrypt. Sessions are signed JWTs in `httpOnly`, `SameSite=Strict` cookies (`Secure` in production), revoked via a per-user session version on password change, reset, deactivation or role change.
- State-changing requests require a custom header (CSRF defence in depth).
- Every route is role-checked. Teachers are scoped to their own classes; students to their own records.
- Grading happens on the server; answers are never sent to the browser before submission.
- Self-registered teacher accounts stay inactive until an administrator approves them.
- The Claude API key is used only on the server.
- Rate limits apply to sign-in failures, AI endpoints and attempt creation.

## Deployment requirements

- Set a strong `JWT_SECRET` (32+ random characters). The server refuses to start in production without one.
- Serve over **HTTPS** (for example behind a reverse proxy, with `TRUST_PROXY=1`). Production cookies are `Secure` and the CSP upgrades insecure requests, so plain HTTP only works on `localhost`.
- Do **not** set `SEED_DEMO_DATA=true` on a real deployment: demo accounts share a published password. Create the first administrator with `npm run create-admin`.
- Use PostgreSQL (`DATABASE_URL`) rather than the embedded database.

See [docs/QA-REPORT.md](docs/QA-REPORT.md) and [docs/FUNCTIONAL-AUDIT.md](docs/FUNCTIONAL-AUDIT.md) for the audits performed so far.
