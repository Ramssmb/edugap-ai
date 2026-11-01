# QA audit report

Audit of the full application after the initial build: every user flow driven in the browser (desktop and 375px mobile), every API route exercised by tests, and a code review focused on security, correctness and honesty of AI features. Each finding below was **fixed and re-verified** unless marked otherwise.

## Security

| # | Severity | Finding | Fix | Verified by |
|---|---|---|---|---|
| S1 | **Critical** | Anyone could self-register as a teacher and call `/api/teacher/questions`, which returns the correct answer for every question — a student could read the whole answer key. | Self-registered teacher accounts are created **inactive**; no session is issued; sign-in returns "waiting for administrator approval". Admins approve in *Users & roles* ("Awaiting approval" badge). | API test *self-registered teachers need admin approval…* |
| S2 | High | A fresh **production** database auto-seeded demo accounts that all share a documented password. | Auto-seed only outside production, or when `SEED_DEMO_DATA=true`. Added `npm run create-admin` for real deployments. | Production start log |
| S3 | High | Changing or resetting a password left other sessions (stolen cookie, shared computer) valid for up to 12 h. | Per-user `session_version` (migration `0001`) embedded in the JWT; bumped on password change, admin reset, deactivation or role change. The current device is re-issued a token. | API test *changing a password signs out other sessions…* |
| S4 | Medium | Sign-in rate limit counted successful logins per IP — a whole class signing in from one school NAT IP would be locked out. | `skipSuccessfulRequests`; limit applies to failed attempts only. | Code review |
| S5 | Medium | `trust proxy` was always on, so clients could spoof `X-Forwarded-For` to bypass IP rate limits. | Off by default; opt in with `TRUST_PROXY`. | Code review |
| S6 | Medium | Roster CSV export was vulnerable to spreadsheet formula injection (a student named `=HYPERLINK(...)`). | Cells starting with `= + - @` tab/CR are prefixed with `'`; all cells quoted. | Code review |
| S7 | Low | Deleting a teacher assessment or content cascaded into students' answer history, silently changing their mastery. | Deletion is refused (409) once any student has answered; UI explains why. | API test (409 on delete) |

Pre-existing protections confirmed by tests: CSRF header required, role checks on every route, teachers scoped to their own classes, students cannot read/submit others' attempts, answers never sent before submission, unserved answers ignored, double submit rejected, deactivation takes effect immediately.

## Functional bugs

| # | Finding | Fix |
|---|---|---|
| F1 | **Recommendation priority collided across subjects**: priorities were computed by rank *within* a subject, so a 37% maths topic could outrank a 24% science topic. | Priority derived from mastery itself, so all subjects interleave correctly (weakest first). |
| F2 | A lesson completed weeks ago but **recommended again** after a new failed attempt had no "complete" button, so the recommendation could never be resolved from the lesson page. | Lesson API returns `recommended`; the page shows **"Mark as studied again"** with an explanation. |
| F3 | **Teacher "needs attention" flagged 5 of 6 students**: trend included practice sets (which deliberately target weak concepts, so they score lower) and 2 weak topics out of 12 triggered a flag. | Trend uses diagnostics + teacher assessments only; flag at ≥3 weak topics or a ≥15-point drop. Same bias removed from the teacher summary's progress sentence. |
| F4 | **Daily goals and streaks used UTC days**, so for Indian users "today" rolled over at 05:30. | All calendar days computed in the school timezone (`APP_TIMEZONE`, default `Asia/Kolkata`). |
| F5 | In development the API started on the **web port** (the dev runner sets `PORT` for the process tree), so every API call failed with 502. | Dev API uses `API_PORT` (default 4000); production uses `PORT`. |
| F6 | Dev sessions were signed out on every hot reload (random JWT secret per process). | Dev secret generated once and stored in the git-ignored `server/.data/`. |
| F7 | Re-seeding while the dev server held the embedded database open risked corrupting it. | `npm run seed` detects a running server and refuses, with instructions. |
| F8 | Offline tutor's "quick check" question was unrelated to the question asked (asked about the hypotenuse, got a triangle-angles question). | Check question chosen by relevance to the student's words, then their weak concepts, then difficulty. |
| F9 | Seeded histories were noisy (±50-point swings from 2–3 answers per topic) and the main demo student showed a 0-day streak. | Error-diffusion answer simulation (accuracy tracks ability, with jitter); Aarav's recent practice avoids maths so his gap stays open and his streak is 3. |

## UI / UX

| # | Finding | Fix |
|---|---|---|
| U1 | Logo rendered as a **blank square** on mobile: the hidden desktop sidebar contained an SVG gradient with the same `id`. | Unique, sanitised gradient id per logo instance (`useId`). |
| U2 | Dashboard eyebrow read "GRADE 8-A · GRADE 8". | Shows the class name only. |
| U3 | `/api/auth/me` returned 401 on every public page load, filling the console with errors. | Returns `{ user: null }` when signed out. |
| U4 | Question form showed "Options must be different" when options were simply empty. | The more specific per-option error is shown first. |
| U5 | Stacked status bar on the admin overview had no separation between segments. | 2px surface gap between segments. |
| U6 | Subject chart colours checked for colour-blind safety. | Validated (indigo / emerald / violet pass CVD separation); status colours always paired with a text label. |

## Verification summary

- `npm test`: **42/42 passing** (15 engine unit tests, 27 API integration tests including the full 9-step demo flow).
- `npm run typecheck`: clean (server and client). `npm run build`: succeeds.
- Browser: all three roles' pages exercised; demo flow completed through the UI (diagnostic 2/10 → lesson → practice 5/5 → Fractions 18% → 81% → visible to the teacher); no horizontal overflow at 375px on any student route; no console errors in the production build.
- AI: failure path verified with an invalid key (falls back to offline mode for both tutor and report).

## Not verified / remaining

- **Live Claude output** (needs an API key). Prompts, structured-output schemas and validation are in place, but the generated content itself has not been reviewed.
- Load and performance testing beyond the demo dataset (dashboards issue several small queries per request; fine at classroom scale).
- Screen-reader walkthrough: labels, roles and keyboard support were checked in code and spot-checked in the browser, but there was no full assistive-technology pass.
