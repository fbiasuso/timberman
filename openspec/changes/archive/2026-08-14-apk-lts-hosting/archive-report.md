# Archive Report: LTS APK Hosting on Supabase Storage

**Change**: apk-lts-hosting
**Archived at**: 2026-08-14
**Archived to**: `openspec/changes/archive/2026-08-14-apk-lts-hosting/`
**Verified at**: branch `feat/apk-lts-hosting` (PR #61, merge commit `38265d4` on main). Planning commits `0b2d604`, `ec7ff1b`, `064ea6e`; verify-report written during verify and carried into the archive.

## Status

**ARCHIVED** — intentional archive with 1 open human follow-up (task 3.2), explicitly approved by the orchestrator.

## Executive Summary

SDD cycle complete: proposal → spec → design → tasks → apply → verify → archive. Verification verdict **PASS WITH WARNINGS** — all 4 spec requirements of the new `apk-lts-distribution` capability compliant, zero CRITICAL issues. The change is a pure static edit (`client/public/install.html` href swap + footer link removal; README LTS documentation) merged to main via PR #61. The delta spec `apk-lts-distribution` was a NEW capability (absent from the main tree) and is a full spec, so it was copied into the baseline as the canonical full-spec form. The change folder was moved to the archive as an audit trail, `openspec/config.yaml` `archive:` gained the `apk-lts-hosting` entry, `openspec/CHANGELOG.md` gained the entry, and `openspec/project.md` gained the capability index line. No source code was touched during archive — specs/artifacts only.

## Artifacts Synced (delta → baseline)

| Domain | Action | Details |
|--------|--------|---------|
| `apk-lts-distribution` | Created (new baseline spec) | New capability — not present in `openspec/specs/`. Delta converted from `## ADDED Requirements` framing to the canonical full-spec format (`# APK LTS Distribution — Specification`, `## Purpose`, `## Requirements`), requirements and scenarios copied verbatim: LTS Download Link on Install Page, GitHub-Free Install Page, README LTS Distribution Documentation, GitHub Releases Untouched — 4 requirements, 9 scenarios. |

Resulting baseline file:
- `openspec/specs/apk-lts-distribution/spec.md` (4 requirements, 9 scenarios)

All 11 pre-existing baseline specs were untouched (the delta declares no MODIFIED/REMOVED/RENAMED requirements and no changes to other capabilities — additive packaging).

## Artifacts Moved

The full change folder was moved to the archive:
- `proposal.md` (Success Criteria 2–4 flipped `[ ]` → `[x]` — demonstrably met per verification; criterion 1 kept `[ ]` because its device-download portion is the open human task 3.2)
- `design.md`
- `tasks.md` (3/4 implementation tasks `[x]`; task 3.2 manual device E2E intentionally left unchecked — see Reconciliation below)
- `verify-report.md`
- `specs/apk-lts-distribution/spec.md`
- `archive-report.md` (this file)

## Reconciliation Note (stale unchecked task)

Task 3.2 ("Manual E2E: open the deployed `/install` on Android, tap download → APK arrives from the Supabase URL and installs over the previous version") remains **unchecked** in the archived `tasks.md` by explicit orchestrator approval. This is NOT a stale checkbox for completed work: it is a genuine human-owned manual E2E that no automated agent can execute. The verify-report documents it as a non-blocking WARNING (static href + live HEAD 200 evidence green; full install-over-previous-version flow unproven at runtime) and carries it forward as an open follow-up for the release owner. Archive proceeded under the orchestrator's explicit instruction to record it as an open follow-up rather than block the cycle.

## Verification State

Change-wide gate on `feat/apk-lts-hosting` (merged to main via PR #61): **PASS WITH WARNINGS** — 4/4 requirements, 9/9 scenarios compliant per the compliance matrix, zero CRITICAL.

- Static: href equals the LTS URL exactly; `git grep github.com` → 0 matches in `install.html`; `git diff origin/main...feat/apk-lts-hosting` scope = README.md + install.html + 4 openspec artifacts only; workflow + `netlify.toml` diff empty.
- Live (optional, executed): `HEAD https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/timberman.apk` → HTTP 200, `Content-Type: application/vnd.android.package-archive`, `Content-Length: 3304297`.
- Design decisions D1–D4 all coherent with implementation.

## Tasks Final State

- 3/4 tasks complete and checked (1.1, 1.2, 2.1, 2.2, 3.1 — all `[x]`). Task 3.2 (manual device E2E) intentionally unchecked — human-owned, documented as an open follow-up (see Reconciliation Note above).

## Open Follow-ups (non-blocking, tracked)

1. **Task 3.2 — manual device E2E of the LTS URL**: downloading + installing the APK on a real Android device from the Supabase URL remains for the human release owner. Full install-over-previous-version flow is unproven at runtime (static + live-head evidence is green).
2. **Per-release manual upload is a deliberate design choice (D3)**: the README checklist ties the upload to the version-bump cadence, but CI does not enforce it — the upload step can be skipped by a human. Automated/CI upload to the bucket remains future work (explicitly out of scope in the proposal).
3. **GitHub Releases continue as backup**: workflow and releases untouched; the `/install` page never links to them. SUGGESTION from verify: after deploy, confirm the Netlify `/install` serves the new page (Netlify caching could briefly serve the old GitHub-linked page).

## Final State

- Baseline specs reflect the new behavior: `/install` links to the stable LTS Supabase bucket URL, the page is GitHub-free, the README documents the LTS URL + manual upload procedure (dashboard + Storage API curl) with `Cache-Control: no-cache` and `application/vnd.android.package-archive`, and GitHub Releases/workflow are untouched.
- Proposal Success Criteria 2–4 flipped `[ ]` → `[x]` in the archived proposal (demonstrably met per verification); criterion 1 kept `[ ]` with its open task-3.2 note.
- Change folder archived in full: `proposal.md`, `specs/` (1 domain), `design.md`, `tasks.md`, `verify-report.md`, `archive-report.md`.
- `openspec/config.yaml` `archive:` section updated with `apk-lts-hosting` entry (archived_at 2026-08-14, status complete, 0 tests — static change, 1 PR).
- `openspec/CHANGELOG.md` gained the `2026-08-14 — apk-lts-hosting` entry; `openspec/project.md` gained the `apk-lts-distribution` capability line.
- No code, spec semantics, or schema were modified during archive — documentation/artifacts only.

## Next Recommended

**none** — SDD cycle complete. Ready for the next change (candidates: automated/CI upload to the LTS bucket, forced-update check via the version constant, or the open task-3.2 device E2E).