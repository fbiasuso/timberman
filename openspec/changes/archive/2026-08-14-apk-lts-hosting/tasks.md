# Tasks: LTS APK Hosting on Supabase Storage

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~45 (install.html ~4 · README ~40) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Install Page

- [x] 1.1 Replace the download button href in `client/public/install.html` (~line 95) with `https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/timberman.apk`. Verify: href matches the LTS URL; page renders unchanged (R1).
- [x] 1.2 Remove the footer link "Ver todas las versiones publicadas" from `client/public/install.html` (~line 138). Verify: grep `github.com` in `install.html` → 0 matches (R2).

## Phase 2: README Documentation

- [x] 2.1 Update the "Install on a phone" paragraph in `README.md` (~line 115): the deployed `/install` page is the download source; drop the GitHub Releases download reference (R3).
- [x] 2.2 Add an LTS upload subsection under "Android APK (sideload)" in `README.md`: stable bucket URL, manual per-release upload via dashboard (bucket `apk`, path `timberman.apk`, upsert) or Storage API curl using `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from `server/.env`, `Cache-Control: no-cache`, content type `application/vnd.android.package-archive`; keep the keystore custody and version-bump cadence sections. Verify: README documents the URL, both upload options, and the headers (R3).

## Phase 3: Verification

- [x] 3.1 Scope guard: `git diff main` shows ONLY `client/public/install.html` + `README.md` — `.github/workflows/android-apk.yml` and `netlify.toml` untouched (R4).
- [ ] 3.2 Manual E2E: open the deployed `/install` on Android, tap download → APK arrives from the Supabase URL and installs over the previous version (R1).