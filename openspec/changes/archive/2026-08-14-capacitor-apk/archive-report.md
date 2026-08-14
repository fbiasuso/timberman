# Archive Report: Android APK Distribution via Capacitor (sideload)

**Change**: capacitor-apk
**Archived at**: 2026-08-14
**Archived to**: `openspec/changes/archive/2026-08-14-capacitor-apk/`
**Verified at**: branch `feature/capacitor-apk` (chained PRs #46–#50) — planning commit `fb93eef` (openspec artifacts); implementation PR #46 `c0edb58` (config+deps+web: `beb955a` deps, `33e30f2` config, `79b22de` android scaffold, `a331e37` telemetry off), PR #47 `55da4a1` (android signing: `5dad108` keystore ignore, `2c561f2` custody docs, `ec5b639` fail-loud signing guard), PR #48 `b149de5` (workflow + install: `cabd2c7` install page, `6e0dcea` redirect, `415710f` README, `75cbaa8`/`f87ea6d` keystore CI fixes), PR #49 `1410d49`, PR #50 `34d54b3` (chain merge complete).

## Status

**ARCHIVED**

## Executive Summary

SDD cycle complete: proposal → spec → design → tasks → apply → verify → archive. All 22 tasks complete and checked in `tasks.md` (Phases 1–4); verification verdict **PASS** — 273/273 client tests (21 files) and `tsc && vite build` green on fresh runs, all 17 spec scenarios compliant (8 automated runtime tests, 5 static/CI, 4 manual/live device E2E), zero CRITICAL and zero WARNING issues. The delta spec `android-apk-distribution` was a NEW capability (absent from the main tree) and is a full spec, so it was copied verbatim into the baseline. The change folder was moved to the archive as an audit trail, `openspec/config.yaml` `archive:` gained the `capacitor-apk` entry, `openspec/CHANGELOG.md` gained the entry, and `openspec/project.md` gained the capability index line. No source code was touched during archive — specs/artifacts only.

## Artifacts Synced (delta → baseline)

| Domain | Action | Details |
|--------|--------|---------|
| `android-apk-distribution` | Created (new baseline spec) | New capability — not present in `openspec/specs/`. Full spec copied verbatim: Capacitor WebView Shell, WebView Asset Loading, Build-Time API URL, Back-Button Navigation, Signed Release APK Pipeline, Central App-Version Constant, Install Landing Page, No Regressions to the Web Client — 8 requirements, 16 scenarios. |

Resulting baseline file:
- `openspec/specs/android-apk-distribution/spec.md` (8 requirements, 16 scenarios)

All 10 pre-existing baseline specs were untouched (the delta declares no MODIFIED/REMOVED/RENAMED requirements and no changes to other capabilities — additive packaging).

## Artifacts Moved

The full change folder was moved to the archive:
- `proposal.md` (Success Criteria flipped `[ ]` → `[x]` — all 5 demonstrably met per verification)
- `exploration.md`
- `design.md`
- `tasks.md` (22/22 `[x]`, zero unchecked implementation tasks)
- `verify-report.md`
- `specs/android-apk-distribution/spec.md`
- `archive-report.md` (this file)

## Verification State

Change-wide gate on branch `feature/capacitor-apk`: **PASS**, no CRITICAL/WARNING issues.

- Client: 273 tests passed (21 files) + `tsc && vite build` green — fresh runs during verify.
- Device E2E (Android 9+): cartelera/tickets/ranking/admin render without 404s, back navigates history and exits at root, JWT session survives restart, in-place updates preserve data (v0.1.1 → v0.1.2 → v0.1.3, user-confirmed "quedó todo perfecto").
- Live: GET https://timbermanpro.netlify.app/install → 200 serving the install page (not SPA fallback).
- Compliance: 17/17 scenarios compliant. Design decisions D1–D9 followed; one cosmetic deviation (D5: workflow triggers on `main` push + `workflow_dispatch`, `update_release: true` dropped per softprops v2, commit `c246a7b`) — does not break spec.

## Tasks Final State

- 22/22 tasks complete (1.1–1.7, 2.1–2.5, 3.1–3.4, 4.1–4.6), all `[x]` in the archived `tasks.md`. No archive-time reconciliation was needed — no stale unchecked implementation tasks.

## Open Follow-ups (non-blocking, tracked)

Two reviewer SUGGESTIONs from verify-report remain unaddressed and are carried forward for a future cleanup pass:

1. **Disable Eliminar while save pending** — in `client/src/components/admin/Equipos.tsx` the in-form delete button is disabled only on `deletePending` (line 480); it stays enabled while a save/upload (`isPending`/`uploading`) is in flight. Suggested: also gate on `isPending || uploading`.
2. **Dead `.team-row-actions` CSS cleanup** — the class is still referenced (`Equipos.tsx` line 639) but now wraps only the Editar button since Eliminar moved into the edit form; the desktop side-by-side + mobile column-stack rules are mostly vestigial. Suggested: simplify/remove the mobile override.

Neither blocks the spec (no requirement covers these UI polish items); no spec amendment needed.

## Final State

- Baseline specs reflect the new behavior: Capacitor WebView shell with committed Android scaffold, relative asset loading, build-time HTTPS API URL with fail-loud gate, hardware back-button navigation, keystore-signed release APK pipeline with GitHub Release asset, central app-version constant, and the Netlify `/install` sideload page.
- Proposal Success Criteria checkboxes flipped `[ ]` → `[x]` in the archived proposal (all demonstrably met per verification).
- Change folder archived in full: `proposal.md`, `exploration.md`, `specs/` (1 domain), `design.md`, `tasks.md`, `verify-report.md`, `archive-report.md`.
- `openspec/config.yaml` `archive:` section updated with `capacitor-apk` entry (archived_at 2026-08-14, status complete, 273 tests, 5 PRs).
- `openspec/CHANGELOG.md` gained the `2026-08-14 — capacitor-apk` entry; `openspec/project.md` gained the `android-apk-distribution` capability line.
- No code, spec semantics, or schema were modified during archive — documentation/artifacts only.

## Next Recommended

**none** — SDD cycle complete. Ready for the next change (candidates: forced-update check via the version constant, PWA/Play Store distribution path, or the two SUGGESTION cleanups above).