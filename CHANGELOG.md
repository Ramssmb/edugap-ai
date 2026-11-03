# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- One-click deployment: Render Blueprint (`render.yaml`) for a free Render + Neon PostgreSQL setup.
- Search engine support: `robots.txt` and `sitemap.xml` generated from the serving address, Open Graph / Twitter share tags, crawler fallback text, and Google Search Console verification via `GOOGLE_SITE_VERIFICATION`.
- ESLint (TypeScript and React hooks rules), `.editorconfig`, `.gitattributes` and `.nvmrc`.
- GitHub Actions CI: lint, typecheck, tests and build on Node 22, 24 and 26; tests against a real PostgreSQL server; Docker image build and smoke test.
- `Dockerfile` (multi-stage, non-root) and `docker-compose.yml` with PostgreSQL.
- Dependabot, issue and pull request templates, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
- `npm run check` to run every quality gate locally.

### Changed
- The server shuts down cleanly on SIGINT/SIGTERM, closing the database (verified in CI with `docker stop`).
- A damaged local embedded database now produces a clear message explaining how to recreate it.
- Minimum Node.js is now 22 (Node 20 reached end of life); CI tests Node 22, 24 and 26.
- Dependency updates from Dependabot: Docker base image Node 26, `actions/checkout` and `actions/setup-node` v7, `concurrently` 10.
- A custom `DEMO_PASSWORD` is no longer printed in server logs.
- The Docker health check follows `PORT`, so it works when a host overrides the port.
- Removed state-syncing effects flagged by the React hooks rules (mobile drawer, profile and lesson forms) in favour of adjusting state during render.
- Split non-component exports out of component files so hot reload works reliably.
- Test files reset the database they seed, so the suite can run against a shared PostgreSQL server.

## [1.1.0] - 2026-11-01

### Fixed
- Mastery no longer depends on database row order; recency is weighted per attempt.
- Progress "then vs now" compares the same metric; the score trend excludes practice sets.
- Older results no longer show a "before" value taken from a later attempt.

### Added
- Functional audit tests against stored records, a permission matrix over every route, and AI integration tests against a local stand-in for the Claude API (70 tests in total). See `docs/FUNCTIONAL-AUDIT.md`.

## [1.0.0] - 2026-11-01

### Added
- First release: concept-level knowledge gap detection, adaptive assessments, personalised learning plans, multilingual AI tutor with offline fallback, and student, teacher and administrator experiences.
- Security hardening from the first QA audit (teacher approval, session revocation, rate limits, CSV escaping). See `docs/QA-REPORT.md`.
