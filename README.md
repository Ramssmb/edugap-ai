# EduGap AI

**Identify Learning Gaps. Personalize Learning. Improve Futures.**

EduGap AI finds *exactly* what each student doesn't understand yet — down to the concept behind every wrong answer — and builds a personal path to fix it. Teachers get a live view of their class; administrators manage users, classes and the curriculum.

- **Students** take adaptive assessments, see strong / needs-improvement / weak topics with the precise missing concepts, follow a personalised plan (lessons + targeted practice), ask a multilingual AI tutor, and watch their mastery grow.
- **Teachers** see a class heatmap, the most common misconceptions, students needing attention, per-student reports, and can create and assign assessments with question-level analysis.
- **Administrators** manage users and roles (including approving teacher accounts), classes, subjects, topics, lessons and the question bank, and monitor platform statistics and activity.

---

## Quick start

Requirements: **Node.js 20+** (tested on Node 24). No database server or API key is needed for the demo.

```bash
npm install
npm run dev
```

Open **http://localhost:5180**. On first start the server creates an embedded PostgreSQL database (PGlite, stored in `server/.data/`) and loads the demo data automatically.

| Command | What it does |
|---|---|
| `npm run dev` | API on :4000 + web app on :5180 (hot reload) |
| `npm test` | Server unit + API integration tests (in-memory database) |
| `npm run seed` | Reset the database to fresh demo data (**stop `npm run dev` first** — the embedded database is single-process; the script refuses to run if it detects the server) |
| `npm run build` then `npm start` | Production build; one Node server serves the API and the built web app |
| `npm run create-admin` | Create the first admin for a real deployment (`ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`) |
| `npm run typecheck` | Type-check server and client |

### Environment

Copy `.env.example` to `server/.env`. Everything is optional in development:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Use a real PostgreSQL server instead of the embedded one. Migrations run automatically on start. |
| `ANTHROPIC_API_KEY` | Enables Claude for the tutor, improvement reports, practice-question generation and teacher summaries. Server-side only — never sent to the browser. |
| `AI_MODEL` | Defaults to `claude-opus-5-5`. |
| `JWT_SECRET` | **Required in production** (32+ chars). In development one is generated and stored in `server/.data/`. |
| `APP_TIMEZONE` | School timezone for daily goals and streaks (default `Asia/Kolkata`). |
| `TRUST_PROXY` | Set (e.g. `1`) only when running behind a reverse proxy. |
| `SEED_DEMO_DATA` | `true` to load demo data into an empty **production** database (off by default, because demo accounts share a known password). |
| `API_PORT` / `PORT` | API port in development / production. |

---

## Demo accounts

All demo accounts use the password **`EduGap@2026`** (configurable with `DEMO_PASSWORD` when seeding). In development the sign-in page has one-click buttons for each role.

| Role | Email | Notes |
|---|---|---|
| Student | `aarav@edugap.demo` | **Main demo account.** Weak in Fractions; Grade 8-A |
| Teacher | `anita.sharma@edugap.demo` | Grade 8-A (Aarav's class) |
| Teacher | `rahul.verma@edugap.demo` | Grade 8-B |
| Admin | `admin@edugap.demo` | Platform management |
| Students | `diya`, `kabir`, `ananya`, `vihaan`, `ishita` `@edugap.demo` | Grade 8-A, varied performance (Diya: Hindi, Kabir: Punjabi, Ananya: Telugu) |
| Students | `arjun`, `meera`, `rohan`, `saanvi`, `aditya`, `priya` `@edugap.demo` | Grade 8-B |

Demo data: 12 students, 2 teachers, 1 admin, 2 classes, 3 subjects × 4 topics, 72 curated questions (each tagged with the concept it tests), 12 lessons, ~180 completed assessments over 5 weeks, and 2 teacher-assigned assessments. **Student histories are not hard-coded**: the seed simulates each student answering real assessments through the same grading pipeline the app uses, so every gap, recommendation and chart is derived from actual answers.

### The 9-step demo (≈3 minutes)

1. Sign in as **Aarav** (student). The dashboard shows Fractions as a weak topic with the exact concepts missed.
2. **Assessments → Mathematics → Retake diagnostic.** 10 adaptive questions (keys 1–4 answer, ←/→ move).
3. Submit — graded on the server; every answer has an explanation.
4. **"What you don't understand yet"** lists the precise concepts missed; topic mastery shows before → after.
5. **Your next steps** — the plan regenerates from the new gaps (lesson + targeted practice, weakest first). *My Learning Plan* adds an improvement report and weekly plan.
6. **Study lesson → Mark as complete.** The lesson recommendation is resolved and the practice recommendation updates.
7. **Practise this topic** — 5 questions targeting the weak concepts (Claude writes fresh ones when a key is set).
8. The result and dashboard show the improvement (e.g. Fractions 18% → 81%); *Progress* charts it.
9. Sign in as **Anita** (teacher) → *Students* → Aarav: updated mastery, last activity, topic gaps and a performance summary.

---

## Architecture

```
client/  React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query + Recharts + Lucide
server/  Node + Express 5 + TypeScript + Drizzle ORM + PostgreSQL (or embedded PGlite) + Zod
         └─ Claude via @anthropic-ai/sdk (server-side only)
```

```
Browser ──/api──▶ Express ──▶ routes (auth · student · tutor · teacher · admin · catalog · profile)
                     │            │
                     │            ├─ services/engine.ts      pure gap engine (mastery, classification, adaptive selection, recommendations)
                     │            ├─ services/learning.ts    recompute gaps, progress snapshots, regenerate recommendations
                     │            ├─ services/assessments.ts start / submit / grade attempts, AI practice generation
                     │            ├─ services/insights.ts    dashboards, progress, classroom analytics
                     │            ├─ services/ai.ts          Claude calls (structured output, refusal fallback)
                     │            └─ services/fallback.ts    rule-based tutor / report / summary (offline mode)
                     └─ Drizzle ──▶ PostgreSQL (DATABASE_URL) or PGlite (embedded)
```

### How gap detection works

Every question carries a **topic**, a **difficulty** and the **concept** it tests (e.g. *Fractions → "Adding unlike denominators"*).

- **Mastery per topic** = difficulty- and recency-weighted share of correct answers over the student's 8 most recent answers on that topic (hard = 2×, medium = 1.5×, easy = 1×; each older *attempt* counts 0.85× the attempt after it, and answers from the same attempt weigh the same). Improvement therefore shows up quickly, and one lucky easy answer can't mask a gap. The result is deterministic: ties are broken by answer id, never by database row order.
- **Classification:** ≥ 75% *strong*, 50–74% *needs improvement*, < 50% *weak*.
- **Weak concepts:** a concept is flagged when it's missed at least half the time, or was missed on the latest attempt.
- **Adaptive selection:** diagnostics split questions evenly across topics (extra questions go to the weakest), prefer the student's weak concepts, match difficulty to current mastery, and avoid recently seen questions.
- **Recommendations** are regenerated after every attempt and lesson: for each non-strong topic, weakest first — a lesson (unless already studied since the last attempt) and a targeted practice set. Each carries a data-backed reason ("You missed 'Dividing fractions' 2 of 2…").

### AI features and offline mode

| Feature | With `ANTHROPIC_API_KEY` (Claude) | Without (offline mode) |
|---|---|---|
| AI tutor | Grade-appropriate, step-by-step answers in English / Hindi / Punjabi / Telugu, aware of the student's gaps | Matches the question to a topic and answers from the lesson library: steps, worked example, a check question with a reveal; short summaries in all 4 languages |
| Improvement report | Personalised headline, focus areas, strengths and a 5-day plan from real gap data (structured output) | Same structure, built by rules from the same data |
| Practice questions | Fresh MCQs on the student's weak concepts, validated (4 distinct options, valid answer index, known concept) before use | Curated bank questions targeting weak concepts |
| Teacher summary | Overview, concerns, trend and classroom actions | Rule-based equivalent |

Every AI call has a deterministic fallback: no key, network error, rate limit, refusal or invalid output → offline mode. The UI always labels which engine produced the content ("Generated by Claude" / "Rule-based engine"). Requests use `fallbacks: "default"` for server-side refusal fallback, structured outputs via Zod, and low effort for latency.

### Data model

`users` · `student_profiles` · `teacher_profiles` · `classes` · `subjects` · `topics` · `questions` · `lessons` · `assessments` · `assessment_questions` · `assessment_results` (attempts) · `student_answers` · `knowledge_gaps` · `recommendations` · `lesson_progress` · `progress_records` (daily mastery snapshots) · `activity_log`. Schema: `server/src/db/schema.ts`; SQL migrations: `server/drizzle/`.

### Security

- Passwords hashed with bcrypt (cost 12); constant-time login response for unknown emails.
- Session: signed JWT in an `httpOnly`, `SameSite=Strict` cookie (`Secure` in production). The user is reloaded on every request, so deactivation or role changes apply immediately; a per-user session version signs out other devices on password change/reset.
- CSRF: SameSite=Strict plus a required custom header on state-changing requests.
- Role-based authorization on every route; teachers only see students in their own classes (others return 404); students only see their own attempts.
- Self-registered teacher accounts stay inactive until an admin approves them (teachers can see the answer key).
- Server-side grading: answers are never sent to the browser before submission; only questions actually served are graded; double submits are rejected.
- Zod validation on all inputs; parameterised SQL; JSON body limit; Helmet security headers and a strict CSP; rate limits on sign-in (failures only), AI endpoints and attempt creation; `Cache-Control: no-store` on API responses.
- Content deletion that would erase student history is blocked. CSV export neutralises spreadsheet formulas.

---

## Testing results

Run `npm test`. **70 tests, all passing** (4 files):

- **Engine unit tests (17):** classification thresholds, difficulty weighting, recency, 8-answer window, weak-concept detection, grading of invalid/missing answers, adaptive selection (quotas, weak concepts first, avoiding seen questions), recommendation ordering, lesson-studied logic, streaks.
- **API integration tests (27)**, against a fresh in-memory Postgres with the full demo seed:
  - the **complete 9-step demo flow**: diagnostic → server-side scoring (exact score asserted) → weak-concept detection → recommendations → lesson completion → practice → improvement on the dashboard → teacher sees the identical updated mastery;
  - auth: wrong password, CSRF header required, registration validation, duplicate email, no admin self-registration, teacher approval flow, password change signs out other sessions, deactivation ends access immediately;
  - authorization: students blocked from teacher/admin APIs, teachers from admin APIs, teachers only see their own classes, students can't read or submit others' attempts, unserved answers ignored, double submit rejected;
  - teacher assessments: create for own class, forbidden for other classes, students outside the class can't take it, results per student, deletion blocked once taken;
  - offline tutor (topic matching, Hindi output, validation), rule-based report, admin stats and question validation.

Manual browser verification (desktop and 375px mobile): landing, sign-in (one-click demo), student dashboard, assessment taking with keyboard shortcuts, results review, lesson completion, practice, learning plan, tutor (Hindi), progress, teacher overview/roster/student detail/assessment creation, admin overview/content (form validation), settings. No horizontal overflow on any student route at 375px; no console errors in the production build. A production build was started with `NODE_ENV=production` and verified (SPA routing, CSP headers, sign-in).

- **Functional audit tests (20)** — verify against the database itself, with an independent re-implementation of the mastery formula: the 10-step workflow with stored rows checked after each step; consistency of all demo data (scores vs stored answers, every gap recomputed, recommendations only for non-strong topics); a permission matrix over every route × role (anonymous 401, wrong role 403, missing CSRF header 403, other student/class 404); dashboard and admin statistics vs direct aggregates.
- **AI integration tests (6)** — the real SDK against a local stand-in for the Claude API: request shape (model, `fallbacks`, beta header, structured-output schema, gap data in the prompt), parsing, validation of generated questions, and fallback on refusal / API error.

See **[docs/QA-REPORT.md](docs/QA-REPORT.md)** and **[docs/FUNCTIONAL-AUDIT.md](docs/FUNCTIONAL-AUDIT.md)** for the audits: every issue found and how it was fixed.

---

## Known limitations

- **Live Claude responses have not been reviewed** (no API key was available). The integration is tested end to end against a local stand-in for the API, and against the real API with an invalid key (it falls back cleanly), but the quality of real generated content is unverified. Set `ANTHROPIC_API_KEY` to enable it.
- **AI-generated practice questions count towards mastery.** They are validated structurally (4 distinct options, valid answer index, known concept), but a wrong answer key from the model would mark a correct student wrong. Consider teacher review or a lower weight before relying on them.
- `npm audit` reports 4 moderate advisories, all from an old esbuild bundled inside `drizzle-kit` (a dev-only migration generator; the advisory concerns esbuild's dev server, which it never starts). npm's suggested fix downgrades drizzle-kit and would break migration generation, so it is intentionally not applied.
- **Offline multilingual tutoring is partial:** Hindi/Punjabi/Telugu get a translated topic summary and UI labels; the detailed steps stay in English (the reply says so). With Claude enabled, whole answers are translated.
- **Question bank size:** 6 curated questions per topic. Repeated diagnostics eventually reuse questions, and students see correct answers in their review, so a determined student can memorise them. With a key, practice sets get fresh AI-generated questions.
- **Embedded database is single-process** (fine for demos); use `DATABASE_URL` with PostgreSQL for real deployments.
- Sessions are stateless JWTs (12 h). Logout clears the cookie; immediate server-side revocation happens on password change/reset, deactivation or role change.
- No email delivery (password reset is admin-driven), no file uploads in lessons, and no per-teacher subject assignment (teachers own classes).
- The curriculum is Grade 8 Maths, Science and English; admins can add more through the content manager.
