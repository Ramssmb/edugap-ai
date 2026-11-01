# Functional audit

Second audit, focused on proving the core workflow works end to end with real stored data, that the backend enforces permissions, and that nothing shown to users is fabricated. Starting point: 42 passing tests, clean type check. Result: **70 passing tests** (4 files), clean type check, production build succeeds.

Every claim below is backed by an automated test (named in brackets) or by a recorded manual check. Nothing was marked verified on the basis of reading code alone.

## 1. Critical workflow: verified

A fresh student account is used so every database row comes from the test. After each step the stored rows are inspected directly, and mastery is checked against an **independent re-implementation** of the documented formula in the test file (not by calling the engine). [`audit.test.ts › critical workflow, verified against stored records`]

| Step | What was verified | Result |
|---|---|---|
| 1. Student logs in | Session cookie issued; dashboard starts empty (0 assessments, mastery null) | ✅ |
| 2. Takes an assessment | An attempt row is created with the exact question list served; the response contains no answers or explanations | ✅ |
| 3. Answers evaluated correctly | Fractions answered wrong, the rest right: stored score = 10 − (fractions questions); percent matches; every stored answer's `is_correct` equals `selected_index = correct_index` | ✅ |
| 4. Results saved | `assessment_results` row completed with score/percent/time; 10 `student_answers` rows | ✅ |
| 5. Gaps from actual answers | Each topic's stored mastery equals the independent recomputation from the stored answers; Fractions = 0% (weak); its weak concepts equal exactly the concepts that were answered wrongly | ✅ |
| 6. Personalised recommendations | Pending recommendations cover exactly the non-strong topics; Fractions gets a lesson and a practice set; the reason cites a missed concept; the weakest topic is first | ✅ |
| 7. Completes learning material | `lesson_progress` row stored; lesson recommendation marked completed with a timestamp; the practice recommendation updates to "you've studied the lesson" | ✅ |
| 8. Takes another assessment | Practice served only Fractions questions; all answered correctly | ✅ |
| 9. Improvement calculated correctly | New mastery equals the independent recomputation; `previous_mastery` equals the value before; the before → after shown to the student matches the stored values; dashboard overall mastery equals the mean of stored gaps; Progress "then" equals mastery after the first attempt | ✅ |
| 10. Teacher sees updated performance | Class teacher's roster mastery = mean of the student's stored gaps; detail page gaps equal the stored rows; classroom average = mean of real roster values; a teacher of another class gets 404 | ✅ |

The same flow was also completed manually through the UI (diagnostic → result → lesson → practice → teacher view).

**Mutation check:** the independent formula was deliberately broken (per-answer instead of per-attempt recency); 2 tests failed as expected, then the file was restored. The assertions genuinely constrain the engine.

## 2. AI integration

| Question | Finding |
|---|---|
| Does the AI integration actually work? | **Works against a stand-in API; live output not verified.** With no API key on this machine, the real Anthropic SDK was pointed at a local server that imitates the Messages API. Verified: request goes to `/v1/messages` with the key as a bearer token, `server-side-fallback-2026-07-01` beta, `model: claude-opus-5-5`, `fallbacks: "default"`, low effort; the tutor prompt contains the chosen language, the grade and the student's stored gap data; structured output (`json_schema`) is requested and parsed for reports and summaries; generated questions are validated (duplicate options and unknown concepts are rejected) and saved as `source: ai`; the key never appears in responses. [`ai.test.ts`, 6 tests] Earlier, a real request with an invalid key confirmed the live failure path falls back. **Not verified:** the quality and correctness of content from the real model. |
| Does fallback work without a key? | **Yes.** Tutor (topic matching, Hindi output), report, summary and practice all return `source: rules` with real data. [`api.test.ts › AI tutor (offline fallback)`, `improvement report (fallback)`, workflow step 9 summary] A refusal and an HTTP 500 from the API also fall back. [`ai.test.ts`] |

## 3. Backend permissions: verified

A permission matrix calls **every API route** (52 routes) as each role. [`audit.test.ts › backend permissions on every route`]

| Check | Result |
|---|---|
| Anonymous → every protected route | 401 ✅ |
| Student → every teacher and admin route | 403 ✅ |
| Teacher → every student, tutor and admin route | 403 ✅ |
| Admin → student and tutor routes | 403 ✅ |
| Every state-changing route without the CSRF header | 403 ✅ |
| Student B → student A's result / recommendation | 404, record unchanged ✅ |
| Teacher B → class A's student, summary, result, assessment results, delete | 404 ✅ (class A's teacher: 200) |

Earlier suites also cover: teacher approval before access to the answer key, session revocation on password change, deactivation taking effect immediately, attempts not readable/submittable by others, unserved answers ignored, double submit rejected.

## 4. Dashboard statistics come from real records: verified

- Student dashboard: overall mastery, assessment and lesson counts, topic classification totals compared with database aggregates. [workflow step 9]
- Teacher: roster mastery, classroom average and student count compared with aggregates. [workflow step 10]
- Admin: user counts by role, completed assessments, answer count, platform mastery, status mix compared with direct queries. [`admin statistics come from the database`]
- The only sample data in the UI is the illustrative card on the public landing page, which is visibly labelled "Sample".

## 5. Demo data is realistic and consistent: verified

Across **all** seeded data [`demo data is internally consistent…`]:
- Every completed attempt (180+): stored score equals its stored correct answers; total equals questions served; topic breakdown sums match; completion after start and not in the future; every answer belongs to the attempt's question list and its correctness matches the answer key.
- Every knowledge gap (≥144): equals the independent recomputation; status matches the thresholds; every weak concept was actually answered wrongly.
- Recommendations: only for non-strong topics, no duplicates, lesson recommendations point at a lesson; every weak topic has a recommendation.
- Assigned assessments were only taken by students of that class.
- Realism: 12 students, all covering 3 subjects; at least one student averages below 50% and one above 75%; more than 10 topics in each of strong / needs improvement / weak.

## 6. Placeholders: none found

- Every API path the client calls exists on the server (47 paths checked); every in-app link and navigation target is a real route.
- A scan of every `<Button>` and `<button>` element found no button without a click handler, submit role or tab role, and no `href="#"` links.
- Every page loads real data from the API (manually checked for all three roles).

## Issues found and fixed

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **Medium** | **Non-deterministic mastery.** All answers in one attempt share a timestamp; the engine sorted by timestamp alone, so ties fell back to database row order (not guaranteed by Postgres). Two answers from the same sitting got different recency weights (1.0 vs 0.85) arbitrarily, and the 8-answer window could cut an arbitrary one. | Recency is ranked per attempt (same attempt = same weight), ties broken by answer id. Unit tests added; README updated. The demo database was reseeded with the fixed engine. |
| 2 | **Medium** | **"Then vs now" compared different metrics.** "Then" was raw accuracy on the first 4 answers; "now" was weighted mastery. | "Then" is now the topic's mastery after its first attempt, using the same formula. Verified against the independent recomputation. |
| 3 | Low | The Progress "average score earlier → recent" included practice sets, which deliberately target weak concepts and pull the average down. | Uses diagnostics and teacher assessments only; labelled accordingly. |
| 4 | Low | Reopening an *older* result showed "was X%", where X came from a later attempt. | Before → after is shown only right after submitting; older results show current mastery, labelled "As of today". |

No security vulnerabilities were found in this pass. The previous audit's fixes are confirmed by the permission matrix.

## Remaining risks and work

| Item | Severity | Notes |
|---|---|---|
| Real Claude output unverified | Medium | Needs an API key: check tutor quality in all 4 languages, report accuracy, and the correctness of generated questions. |
| AI-generated questions affect mastery | Medium | Validated structurally only. A wrong answer key from the model would penalise a correct student. Recommend teacher review, or a lower weight for `source: ai` answers. Not changed here because it alters the scoring design. |
| Gap recompute runs after the save transaction | Low | If the recompute failed, the attempt would be saved with stale gaps until the next attempt on those topics (the recompute is idempotent and self-heals). |
| `npm audit`: 4 moderate | Low | All from esbuild 0.18 inside `drizzle-kit` (dev-only migration tool; advisory concerns esbuild's dev server, which it doesn't start). The suggested fix downgrades drizzle-kit and breaks migration generation, so it is not applied. |
| Small question bank (6 per topic) | Low | Repeated diagnostics reuse questions; students see answers in review. |
| Load/performance and a full screen-reader pass | — | Not performed. |
