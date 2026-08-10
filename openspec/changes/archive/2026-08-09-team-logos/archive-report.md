# Archive Report: Team Logos — Supabase Storage, File Upload, Shield Seeding

**Change**: team-logos
**Archived at**: 2026-08-09
**Archived to**: `openspec/changes/archive/2026-08-09-team-logos/`
**Verified at**: branch `feature/teams-leagues` — planning commit `38a6d39` (docs), implementation PRs #39 `7a8e9bf` (shared validation + storeFromBuffer), #40 `84edbb7` (Supabase backend + factory + env), #41 `84c7a0d` (multipart logo route), #42 `22f211a` (client file picker + two-step upload), #43 `0644a40` (idempotent seed-shields script).

## Summary

SDD cycle complete: proposal → spec → design → tasks → apply → verify → archive. All 6 tasks complete (T1–T5 implemented and checked by sdd-apply; T6 verification gate executed by sdd-verify — see Reconciliation below). Verification verdict: **PASS WITH WARNINGS** — 790 tests green (530 server + 260 client), `tsc --noEmit` clean on both sides; the two warnings are documentation-only (D2 key-format drift and test-count reference), both corrected in this archive commit. The 3 delta specs were synced into the baseline (`openspec/specs/`), the proposal's 5 Success Criteria checkboxes were flipped to `[x]` and its test count updated, the change folder was moved to the archive as an audit trail, `openspec/config.yaml` `archive:` gained the `team-logos` entry, `openspec/CHANGELOG.md` gained the entry, and `openspec/project.md` capability descriptions were updated to reflect the durable storage + upload + seed pipeline. No source code was touched during archive — specs/artifacts only.

## Artifacts Synced (delta → baseline)

| Domain | Action | Details |
|--------|--------|---------|
| `team-image-hosting` | Updated | 2 MODIFIED requirements replaced: Shield Acquisition (+active-backend storage, resolved logo value persists — full public URL or relative path), Shield Serving (+Supabase bucket logos with cache-control 30d non-immutable, full URL or relative path both accepted). 3 ADDED requirements appended: Storage Backend Selection (2 scenarios), Buffer Store Operation (3 scenarios), Seed Shields Population (5 scenarios). Shield Fallback preserved unchanged. Delta `(Previously: ...)` annotations dropped as change metadata. |
| `team-registry` | Updated | 1 ADDED requirement appended: Shield Logo Upload Endpoint (5 scenarios — JSON `{url}` compat, multipart `file` field, 1 MiB cap, magic-byte sniff, failed upload keeps team unchanged). All 9 existing requirements preserved. |
| `admin-operations` | Updated | 1 ADDED requirement appended: Team Logo Upload UI (6 scenarios — file picker accept png/jpeg/webp, createObjectURL preview, client validation, multipart FormData upload, add/replace logo). All 17 existing requirements preserved. |

Resulting baseline files:
- `openspec/specs/team-image-hosting/spec.md` (6 requirements, 18 scenarios)
- `openspec/specs/team-registry/spec.md` (10 requirements)
- `openspec/specs/admin-operations/spec.md` (18 requirements)

## Verification State

Change-wide T6 gate on branch `feature/teams-leagues`: **PASS WITH WARNINGS**, no CRITICAL issues.

- Server: 530 tests passed + `tsc --noEmit` clean.
- Client: 260 tests passed + `tsc --noEmit` clean.
- Total: 790 tests green; no regressions in `resolveLogoUrl`/static serving (D6 untouched).
- Warnings (documentation-only, corrected at archive): (1) D2 key-format drift — see Design Updates Made; (2) proposal/tasks referenced the pre-change "728+" test baseline instead of the actual 790.

## Reconciliation (archive-time, per sdd-archive policy)

**T6 checkbox**: `tasks.md` showed `- [ ] T6` while the verification gate it represents was executed and green (verify-report: 790 tests = 530 server + 260 client, tsc clean both sides; orchestrator declared the gate PASS WITH WARNINGS). Flipped to `[x]` at archive as exceptional mechanical reconciliation backed by the verify-report — recorded inline in the archived `tasks.md` and here. No implementation task was unchecked without proof. Note: sdd-verify did not persist a `verify-report.md` for this change; the archived `verify-report.md` was reconstructed at archive time from the orchestrator's T6 gate summary (tests counts, tsc results, verdict, and the two warnings).

## Design Updates Made

- D1–D6 decisions held through implementation; design.md matched by implementation evidence.
- **D2 key-format drift (warning #1)**: design.md stated the Supabase upload path as `{teamId}.{ext}` and the public URL as `…/object/public/logos/{teamId}.{ext}`. The implementation uploads `team-{teamId}.{ext}` (`server/src/infrastructure/images/supabase-image-service.ts:76`, `upsert` replaces the old object) and the port JSDoc documents the local relative value as `logos/{teamId}.{ext}` (`server/src/domain/ports/image-service.ts`). Synced the design text to the actual implementation: `team-{teamId}.{ext}` for the Supabase object key and public URL; the same drift in proposal.md (Approach step 2) and tasks.md (T2 acceptance) corrected to match.
- **Test count (warning #2)**: proposal.md Success Criteria and tasks.md T6 acceptance updated from the pre-change "728+" baseline to the actual gate result of 790 (530 server + 260 client).

## Tasks Final State

- 6/6 tasks complete (T1–T5 `[x]` by sdd-apply; T6 gate reconciled per above). Archived `tasks.md` shows zero unchecked implementation tasks.

## Final State

- Baseline specs reflect all new behavior: durable shield storage via `IMAGE_STORAGE` backend selection (local default / Supabase opt-in with fail-soft), shared validated buffer write path (`storeFromBuffer`), multipart shield upload endpoint with JSON compat, client file-picker upload UX with preview + validation, and the idempotent `seed-shields` population script.
- Proposal Success Criteria checkboxes flipped `[ ]` → `[x]` in the archived proposal (all demonstrably met per verification).
- Change folder archived in full: `proposal.md`, `specs/` (3 domains), `design.md`, `tasks.md`, `verify-report.md`, `archive-report.md`.
- `openspec/config.yaml` `archive:` section updated with `team-logos` entry (archived_at 2026-08-09, status complete, 790 tests, 5 PRs).
- `openspec/CHANGELOG.md` gained the `2026-08-09 — team-logos` entry; `openspec/project.md` capability descriptions updated for the durable storage pipeline.
- No code, spec semantics, or schema were modified during archive — documentation/artifacts only.

## Next Recommended

**none** — SDD cycle complete. Ready for the next change (Phase 2 candidates: API-FOOTBALL fixture ingestion, multi-league match dates, SVG shield support, legacy logo migration to Supabase).
