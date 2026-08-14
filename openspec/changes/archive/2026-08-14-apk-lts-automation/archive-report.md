# Archive Report: APK LTS Automation

**Change**: apk-lts-automation
**Archived at**: 2026-08-14
**Archived to**: `openspec/changes/archive/2026-08-14-apk-lts-automation/`
**Verified at**: branch `feat/apk-lts-automation` (PR #70, merge commit `159d165` on main). Planning commit `06363f5`; implementation commits `82377a3`, `d3cc506`, `92c62b0`, `4f06509`, `850577f`, `4100744`; verify-report written during verify (post-merge, on main) and carried into the archive.

## Status

**COMPLETE** — verify PASS (23/23 scenarios) with one WARNING (human E2E) now CONFIRMED by the user on a real device ("Se ven perfectamente"). No open follow-ups blocking the cycle; non-blocking SUGGESTIONs carried forward below.

## Executive Summary

SDD cycle complete: proposal → spec → design → tasks → apply → verify → archive. Verification verdict **PASS** — all 23 spec scenarios across both delta specs compliant (live post-merge evidence + static + tests), zero CRITICAL. The change automates the LTS bucket upload in CI (`upload-lts` ADD-only job), makes `/install` render the live `version.txt`, and shows the version inside the APK (splash + login/register from the existing `APP_VERSION` constant). Merged to main via PR #70. The delta spec `apk-lts-distribution` was merged into the existing baseline (2 MODIFIED requirements replaced, 4 ADDED requirements appended); the new capability spec `apk-version-display` was created in the baseline tree. The change folder was moved to the archive as an audit trail, `openspec/config.yaml` `archive:` gained the `apk-lts-automation` entry, `openspec/CHANGELOG.md` gained the entry, and `openspec/project.md` gained the `apk-version-display` capability line and updated the `apk-lts-distribution` line. No source code or CI files were touched during archive — specs/artifacts only.

## Artifacts Synced (delta → baseline)

| Domain | Action | Details |
|--------|--------|---------|
| `apk-lts-distribution` | Updated (existing baseline) | Delta merged into the existing baseline spec: **2 MODIFIED** requirements replaced in place (README LTS Distribution Documentation, GitHub Releases Untouched) and **4 ADDED** requirements appended (CI Upload Job (upload-lts), version.txt Object, Upload Failure Policy, Dynamic Version on Install Page). Scenario IDs preserved; requirements not in the delta (LTS Download Link on Install Page, GitHub-Free Install Page) untouched. Purpose paragraph updated to reflect the automated upload + ADD-only workflow job. Result: 8 requirements, 19 scenarios (16 from the delta + 3 preserved from the original spec). |
| `apk-version-display` | Created (new baseline spec) | New capability — not present in `openspec/specs/`. The change's version was already a full spec (not a delta); copied verbatim: Central Version Source, Splash Screen Version, Login and Register Screens Version, Subtle Styling — 4 requirements, 7 scenarios. |

Resulting baseline files:
- `openspec/specs/apk-lts-distribution/spec.md` (8 requirements, 19 scenarios)
- `openspec/specs/apk-version-display/spec.md` (4 requirements, 7 scenarios)

All other pre-existing baseline specs were untouched (the delta declares no REMOVED/RENAMED requirements and no changes to other capabilities).

## Artifacts Moved

The full change folder was moved to the archive:
- `proposal.md` (Success Criteria 1–4 flipped `[ ]` → `[x]` — all demonstrably met per verification, including the human E2E confirmed by the user)
- `exploration.md`
- `design.md`
- `tasks.md` (9/9 implementation tasks `[x]`)
- `apply-progress.md`
- `verify-report.md`
- `specs/apk-lts-distribution/spec.md`
- `specs/apk-version-display/spec.md`
- `archive-report.md` (this file)

## Verification State

Change-wide gate (post-merge on main, merge commit `159d165`, PR #70): **PASS** — 23/23 spec scenarios compliant per the compliance matrix, 0 UNTESTED, 0 FAILING, zero CRITICAL.

- Tests: 826 passed / 0 failed (client 275 incl. 2 new version-label tests; server 551).
- Build: `tsc && vite build` succeeded on main; `Assemble release APK` succeeded.
- Live CI run 31771081525 (triggered by the PR #70 merge push): `build-apk` ✅, `upload-lts` ✅ (download → gate → write version.txt → upload version.txt → upload APK), `release` ✅ (v0.1.4 re-published, asset replaced). `upload-lts` did NOT fail.
- Live bucket: `version.txt` HTTP 200 body exactly `0.1.4` (5 bytes, no `v`, no newline); `timberman.apk` HTTP 200, `application/vnd.android.package-archive`, `Cache-Control: no-cache`, fresh ETag/Last-Modified matching this run.
- Live site: `https://timbermanpro.netlify.app/install` HTTP 200, served HTML byte-identical to `client/public/install.html` (fetch script + FALLBACK + both ids); CORS on `version.txt` → `Access-Control-Allow-Origin: *`.
- Static diff vs `159d165^1`: workflow ADD-only (`upload-lts` job); no `release` step modified (sole `-` line is an EOF-newline diff artifact — cosmetic).
- Design decisions (retry loop, version.txt source, push-only gate, fail-loud gate / fail-soft uploads, no checkout, release never gated) all coherent with implementation; `--max-time 60` improvement documented in apply.
- **Human E2E (previously the WARNING): CONFIRMED** — user reinstalled the APK (v0.1.4, versionCode 5) on a real device and confirmed the splash + login/register version labels render correctly: "Se ven perfectamente".

## Tasks Final State

- 9/9 tasks complete and checked (1.1, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2 — all `[x]`). No stale unchecked tasks; no reconciliation needed.

## Open Follow-ups (non-blocking)

1. **README fallback curl cosmetic alignment (SUGGESTION from verify)**: the README emergency-fallback curl still documents the legacy `?upsert=true` query form while CI uses the `x-upsert: true` header. Both work (equivalence confirmed during exploration); aligning the README example to the proven CI form would remove ambiguity. Optional, non-blocking.
2. **`version.txt` fallback sync on future bumps**: `client/public/install.html` keeps `FALLBACK = '0.1.4'` as the static last-known version. On future version bumps, keep the fallback in sync with `client/package.json` (otherwise the fallback path renders a stale version). Note: the live path always wins — the fallback only renders when `version.txt` is unreachable.
3. **Netlify/CI race**: on future releases, a visitor could briefly see the fallback version before the new `version.txt` lands — accepted per design (risk table).

## Final State

- Baseline specs reflect the new behavior: `apk-lts-distribution` (8 requirements, 19 scenarios) now covers the CI upload job, `version.txt` object, upload failure policy, and dynamic install-page version on top of the existing LTS link + GitHub-free page + README docs + untouched releases; `apk-version-display` (4 requirements, 7 scenarios) is a new baseline capability.
- Proposal Success Criteria 1–4 flipped `[ ]` → `[x]` in the archived proposal (all demonstrably met per verification, human E2E confirmed).
- Change folder archived in full: `proposal.md`, `exploration.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, `specs/` (2 domains), `archive-report.md`.
- `openspec/config.yaml` `archive:` section updated with `apk-lts-automation` entry (archived_at 2026-08-14, status complete, 826 tests, 1 PR).
- `openspec/CHANGELOG.md` gained the `2026-08-14 — apk-lts-automation` entry; `openspec/project.md` gained the `apk-version-display` capability line and updated the `apk-lts-distribution` line (automated upload + dynamic version).
- No code, spec semantics, or schema were modified during archive — documentation/artifacts only.

## Next Recommended

**none** — SDD cycle complete. Ready for the next change (candidates: forced-update/version-gating via `APP_VERSION`, README fallback curl alignment, or Play Store publishing).