# Verify Report — apk-lts-hosting

- **Change**: apk-lts-hosting — LTS APK Hosting on Supabase Storage
- **Mode**: Full artifacts (proposal, spec, design, tasks) — verified against `origin/feat/apk-lts-hosting`
- **Date**: 2026-08-13
- **Verdict**: **PASS WITH WARNINGS**

## Executive Summary

The implementation fully satisfies the 4 spec requirements of `apk-lts-distribution`: the `/install` button points to the stable Supabase LTS URL, the page is GitHub-free, the README documents the LTS bucket and the manual upload procedure, and the GitHub Actions workflow + GitHub Releases are untouched. Live check confirms the LTS object is reachable (HTTP 200, `application/vnd.android.package-archive`, ~3.3 MB).

**Premise mismatch (important)**: the orchestrator instruction assumed "the change is already merged; verify the current main state". That is NOT the case. `git log --oneline -5 origin/main` shows no LTS commit (`f522599`, `84884de`, `c518000`, `0ba87aa`, `af1ba82`); `git merge-base --is-ancestor 0b2d604 origin/main` fails — the change commits (`0b2d604`, `ec7ff1b`, `064ea6e`) exist ONLY on `origin/feat/apk-lts-hosting`. The working tree (branch `fix/equipos-followups`) still contains the pre-change `install.html` pointing at GitHub Releases. Verification was therefore executed against the feature branch as the source of truth. **The change is not live until `feat/apk-lts-hosting` is merged into main.**

## Task Completeness

| Task | Status | Evidence |
|---|---|---|
| 1.1 Replace download href with LTS URL | [x] | Branch `install.html` line ~95: `href="https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/timberman.apk"` |
| 1.2 Remove footer GitHub link | [x] | Footer renders `Versión estable — actualizada manualmente` (no link); `git grep github.com` → 0 matches |
| 2.1 Update "Install on a phone" README paragraph | [x] | `README.md` "Android APK (sideload)" section rewrites download source to the LTS URL |
| 2.2 Add LTS upload subsection | [x] | "### Manual upload to the LTS bucket" subsection present with dashboard + curl paths |
| 3.1 Scope guard | [x] | `git diff origin/main...origin/feat/apk-lts-hosting --name-only` = README.md + install.html + 4 openspec artifacts only |
| 3.2 Manual E2E (device download) | [ ] | Human-owned; remains for the release owner (see Risks) |

## Build / Tests Evidence

- **Tests run**: none. The change is static HTML/docs; no covering unit tests exist, and the design's testing strategy is manual grep/review (executed below). Client test suite not run — the working tree is not the change branch, and the change introduces no testable code.
- **Live check (optional, executed)**: `HEAD https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/timberman.apk` → **HTTP 200**, `Content-Type: application/vnd.android.package-archive`, `Content-Length: 3304297`.

## Spec Compliance Matrix — `apk-lts-distribution`

| # | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | LTS Download Link on Install Page — button MUST link to the LTS URL, NOT GitHub Releases | **PASS** | Branch `install.html` href equals the LTS URL exactly. Scenario "No GitHub fallback link": `git grep -n "github.com" origin/feat/apk-lts-hosting -- client/public/install.html` → 0 matches (exit 1). Scenario "Button downloads from the LTS bucket": static href + live HEAD 200; full download exercised by manual task 3.2 |
| R2 | GitHub-Free Install Page — footer "Ver todas las versiones publicadas" MUST be removed | **PASS** | Footer now contains plain text `Versión estable — actualizada manualmente`; no `github.com` references anywhere in the page (grep = 0 matches) |
| R3 | README LTS Distribution Documentation — LTS URL, manual per-release upload (dashboard or Storage API curl with service role key), `Cache-Control: no-cache`, content type `application/vnd.android.package-archive` | **PASS** | README "Android APK (sideload)" documents LTS URL; "### Manual upload to the LTS bucket" covers bucket `apk` / path `timberman.apk`, dashboard path (Storage → bucket `apk` → overwrite + set headers), curl using `$SUPABASE_URL` + `$SUPABASE_SERVICE_ROLE_KEY` with `upsert=true`, `Cache-Control: no-cache` and `application/vnd.android.package-archive`; version-bump cadence (version + versionCode) and keystore custody kept |
| R4 | GitHub Releases Untouched — workflow MUST have no diff vs main; releases preserved | **PASS** | `git diff origin/main...origin/feat/apk-lts-hosting -- .github/workflows/android-apk.yml netlify.toml` → empty. Workflow still publishes via `softprops/action-gh-release@v2` (tag `v${{ needs.build-apk.outputs.version }}`). No netlify/src/server changes in the branch diff |

## Design Coherence

| Decision | Coherent? | Notes |
|---|---|---|
| D1 Canonical source = public Supabase bucket URL on `/install` | ✅ | Implemented exactly |
| D2 No workflow change; releases stay as backup | ✅ | Workflow diff vs main = empty |
| D3 Manual upload per release (dashboard or curl) | ✅ | Both paths documented in README |
| D4 `Cache-Control: no-cache` for freshness | ✅ | Documented (README + curl example); live header not re-verified via HEAD (Supabase may not expose it) |

## Issues

### CRITICAL
- None (spec compliance is fully met on the branch).

### WARNING
1. **Change not merged to main** — the verify premise ("already merged") is false. `origin/main` does not contain commits `0b2d604`/`ec7ff1b`/`064ea6e`; they exist only on `origin/feat/apk-lts-hosting`. Until that branch merges, end users still download from GitHub Releases (current main `install.html`). Orchestrator must schedule the merge for this change to be live.
2. **Task 3.2 (manual device E2E) unchecked** — downloading + installing the APK on a real Android device from the Supabase URL remains for the human release owner. Static + live-head evidence is green, but the full install-over-previous-version flow is unproven at runtime.

### SUGGESTION
- After merge, confirm the deployed `/install` (Netlify) serves the new page; Netlify caching could briefly serve the old GitHub-linked page.

## Risks / Notes

- **Stale APK / forgotten upload**: mitigated in docs — `Cache-Control: no-cache` on the object (browsers revalidate) and the README version-bump cadence ties the upload to each release. Remaining human risk: the per-release upload step can be skipped; CI does not enforce it (deliberate D3 decision).
- **Rollback**: trivial revert of 2 files; no runtime code involved.
- **Report placement**: `openspec/changes/apk-lts-hosting/` exists only on the feature branch; this report was written to the same path in the working tree (untracked) and must be carried with the branch when merged.
