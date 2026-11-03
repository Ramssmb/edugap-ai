# Contributing to EduGap AI

Thanks for helping improve EduGap AI. This guide covers local setup, the checks every change must pass, and how to submit work.

## Local setup

Requirements: Node.js 22+ (the version in `.nvmrc` is recommended). No database server or API key is needed.

```bash
npm install
npm run dev        # API on :4000, web app on http://localhost:5180
```

The first start creates an embedded PostgreSQL database in `server/.data/` and loads demo data. Demo accounts and the 3-minute demo script are in the [README](README.md#demo-accounts).

## Before you open a pull request

Run the full check. CI runs the same steps on Node 22, 24 and 26, runs the tests again on a real PostgreSQL server, and builds and smoke-tests the Docker image.

```bash
npm run check      # lint + typecheck + tests + build
```

Individual commands: `npm run lint` (`lint:fix` to auto-fix), `npm run typecheck`, `npm test`, `npm run build`.

## Project layout

| Path | What lives there |
|---|---|
| `server/src/routes/` | HTTP routes, one file per area (auth, student, tutor, teacher, admin, catalog, profile) |
| `server/src/services/engine.ts` | Pure gap engine: mastery, classification, adaptive selection, recommendations |
| `server/src/services/` | Database-backed services (learning state, assessments, insights, AI, offline fallback) |
| `server/src/db/` | Drizzle schema, database bootstrap, demo seed |
| `server/drizzle/` | Generated SQL migrations |
| `server/src/test/` | Unit, API, functional-audit and AI-integration tests |
| `client/src/pages/` | Pages, grouped by role |
| `client/src/components/` | Shared UI components |

## Conventions

- **TypeScript everywhere**, strict mode. No `any` unless there's no reasonable alternative.
- **Validate every input** on the server with Zod, and **authorise every route**: role checks at the router, ownership/scope checks for anything addressed by id. Return 404 (not 403) for records outside the caller's scope.
- **Grading stays on the server.** Never send `correctIndex` or explanations to the browser before an attempt is submitted.
- **AI is optional.** Every AI feature needs a working rule-based fallback and must label its source (`ai` / `rules`).
- **Keep the engine pure.** `engine.ts` has no database access, so its rules can be unit-tested.
- Match the surrounding code's style; `.editorconfig` and ESLint enforce the basics.

### Database changes

1. Edit `server/src/db/schema.ts`.
2. Generate a migration: `npm run db:generate -w server -- --name short_description`.
3. Commit the schema change and the generated files in `server/drizzle/` together. Migrations run automatically on server start.

### Tests

Add or update tests with every behaviour change:
- engine rules → `engine.test.ts`
- API behaviour and permissions → `api.test.ts` / `audit.test.ts`
- AI request/response handling → `ai.test.ts` (uses a local stand-in for the Claude API; no key needed)

## Commits and pull requests

- One logical change per pull request; keep unrelated refactors out.
- Write commit subjects in the imperative ("Add …", "Fix …"), with a body explaining *why* when it isn't obvious.
- Fill in the pull request template, including how you tested the change.

## Reporting bugs and security issues

Open a [bug report](https://github.com/Ramssmb/edugap-ai/issues/new/choose) for normal bugs. **Do not** open public issues for security vulnerabilities; see [SECURITY.md](SECURITY.md).
