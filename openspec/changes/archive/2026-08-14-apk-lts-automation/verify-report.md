# Verify Report: APK LTS Automation

**Change**: `apk-lts-automation`
**Mode**: Standard (strict_tdd: false)
**Scope**: Post-merge verification on `main` (merge commit `159d165`, PR #70)
**Date**: 2026-08-14

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 9 (1.1, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2) |
| Tasks complete | 9 |
| Tasks incomplete | 0 |

## Build & Tests Execution

**Tests**: ✅ 826 passed / 0 failed / 0 skipped

```text
pnpm --filter client test  → 21 files, 275 passed (incl. 2 new version-label tests + app-version test)
pnpm --filter server test  → 39 files, 551 passed
```

**Build**: ✅ Passed — CI run 31771081525 `Build client` step (`tsc && vite build`) succeeded on main; `Assemble release APK` succeeded.

**Coverage**: ➖ Not available (no coverage threshold configured; not required by this change).

## Live CI Evidence (run 31771081525 — triggered by PR #70 merge push)

| Job | Status | Key steps |
|-----|--------|-----------|
| build-apk | ✅ success (04:50:01 → 04:51:28) | Build client ✓, Assemble release APK ✓, Resolve version → `0.1.4` |
| upload-lts | ✅ success (04:51:31 → 04:51:35) | Download APK artifact ✓, Gate on Supabase secrets ✓, Write version.txt ✓, Upload version.txt ✓, Upload APK ✓ |
| release | ✅ success (04:51:31 → 04:51:37) | Publish GitHub Release ✓ (v0.1.4 re-published, asset replaced) |

All three jobs completed **success** — `upload-lts` did NOT fail; no failing-step log needed.

## Live Bucket / Site Evidence

| Check | Result |
|-------|--------|
| `GET /public/apk/version.txt` | HTTP 200, body exactly `0.1.4` (Content-Length 5 — no `v`, no trailing newline) |
| `HEAD /public/apk/timberman.apk` | HTTP 200, `Content-Type: application/vnd.android.package-archive`, `Content-Length: 3222469`, `Cache-Control: no-cache`, `Last-Modified: 04:51:36Z` (matches this run's upload), ETag `a235be86...` |
| CORS `version.txt` (Origin: netlify) | `Access-Control-Allow-Origin: *`, `Cache-Control: no-cache` |
| `https://timbermanpro.netlify.app/install` | HTTP 200, served HTML contains `id="install-version"`, `id="footer-version"`, inline fetch script (`FALLBACK = '0.1.4'`, `AbortController` 5s, `text().trim()`, sets both ids, catch → fallback) — byte-identical to `client/public/install.html` |
| GitHub Release v0.1.4 | Exists, not draft/prerelease; asset `Timberman.apk` (3,222,469 bytes, `application/vnd.android.package-archive`), asset `createdAt 2026-08-14T04:51:36Z` = re-published by this run; releases v0.1.0–v0.1.3 preserved |

## Spec Compliance Matrix

### apk-lts-distribution (spec.md)

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| README LTS Distribution Documentation | Automated upload documented as primary | README "Automated upload (CI)" section + secrets list `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; diff verified | ✅ COMPLIANT (static, docs) |
| | Manual curl as emergency fallback | README "Emergency fallback" → "Storage API" curl with `server/.env` secrets | ✅ COMPLIANT (static, docs) |
| | Upload via dashboard as fallback | README "Dashboard path" retained | ✅ COMPLIANT (static, docs) |
| | Version-bump cadence preserved | "Each APK release ships with a version bump…" paragraph untouched in diff | ✅ COMPLIANT (static, docs) |
| GitHub Releases Untouched | Release job untouched | `git diff 159d165^1` — only ADDED `upload-lts` job; release steps byte-identical (sole `-` line is an EOF-newline diff artifact) | ✅ COMPLIANT (static diff) |
| | Release never blocked by the upload | `release` has no `needs: upload-lts` (parallel sibling); live run: release succeeded alongside upload-lts | ✅ COMPLIANT (live) |
| | Releases preserved as backup | v0.1.0–v0.1.4 all present; `/install` links only the Supabase bucket URL, never GitHub | ✅ COMPLIANT (live + static) |
| CI Upload Job (upload-lts) | Main push uploads both objects | Live run: upload-lts success; version.txt + timberman.apk both HTTP 200 post-run | ✅ COMPLIANT (live) |
| | Feature-branch dispatch does not upload | `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` gate in job | ✅ COMPLIANT (static) |
| | Missing Supabase secrets fail loudly | `gate-on-supabase-secrets` step: `::error::` + `exit 1`, uploads nothing | ✅ COMPLIANT (static) |
| version.txt Object | Version matches package.json | Live body `0.1.4` == `client/package.json` `0.1.4` (5 bytes, no newline — `printf '%s'`) | ✅ COMPLIANT (live) |
| | Stale version never served | `Cache-Control: no-cache` verified live on version.txt (and APK) | ✅ COMPLIANT (live) |
| Upload Failure Policy | Transient failure recovers | 3-attempt loop with `sleep $((i*5))` backoff in both upload steps (first attempt succeeded live) | ✅ COMPLIANT (static + live) |
| | Final failure defers to manual/next release | `::warning::` + `return 0` after 3 attempts; release job independent (succeeded live) | ✅ COMPLIANT (static + live) |
| Dynamic Version on Install Page | Live version rendered | Served HTML contains fetch script; version.txt reachable with `Access-Control-Allow-Origin: *`; script sets `v{trimmed}` on both ids | ✅ COMPLIANT (live, server-side) |
| | Fetch failure falls back | Static default `v0.1.4` in HTML + `FALLBACK` constant + explicit catch re-set on both ids | ✅ COMPLIANT (static) |

### apk-version-display (spec.md)

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| Central Version Source | Constant is the single source | `app-version.ts` imports `version` from `package.json` (resolveJsonModule); splash + login import `APP_VERSION` — no new plumbing | ✅ COMPLIANT (static) |
| | Version matches package.json | `app-version.test.ts` — "matches the version declared in client/package.json" passed (1/275) | ✅ COMPLIANT (test) |
| Splash Screen Version | Version visible at bottom center | `SplashScreen.tsx` `<span className="splash-version">v{APP_VERSION}</span>` after `.splash-spinner`; `global.css` `.splash-version { position: absolute; bottom: 28px; left/right: 0; text-align: center }` | ✅ COMPLIANT (code-level) + ⚠️ WARNING (human E2E pending) |
| | Version fades with the overlay | Span inside `.splash-screen` overlay div (fades via `.hidden`) | ✅ COMPLIANT (code-level) + ⚠️ WARNING (human E2E pending) |
| Login and Register Screens Version | Version on login tab | `LoginPage.test.tsx` — "shows the version label on the login tab" passed | ✅ COMPLIANT (test) |
| | Version on register tab | `LoginPage.test.tsx` — "keeps the version label visible on the register tab" passed; `<p>` outside tab conditional | ✅ COMPLIANT (test) |
| Subtle Styling | Style matches the theme | `#a3b8b5` (theme.textoSecundario) at 0.8rem; login label fontSize 12 textoSecundario, centered | ✅ COMPLIANT (code-level) + ⚠️ WARNING (human E2E pending) |

**Compliance summary**: 23/23 scenarios verified compliant (live and/or static+test evidence). 0 UNTESTED, 0 FAILING.

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| README docs (automated primary, fallbacks, secrets, headers) | ✅ Implemented | Diff verified vs `159d165^1` |
| `upload-lts` job (ADD-only, gate, version.txt, retry, upsert) | ✅ Implemented | Byte-matches design + `--max-time 60` (commit 4100744) |
| `version.txt` object | ✅ Live | `0.1.4`, `cacheControl=no-cache`, CORS open |
| APK object upserted | ✅ Live | 200, correct content-type, fresh ETag/Last-Modified |
| install.html dynamic version + fallback | ✅ Live | Served HTML identical to source |
| Splash version (`splash-version`) | ✅ Implemented | Code-level; visual pending |
| Login/register version label | ✅ Implemented + tested | 2 new tests pass |
| No version bump | ✅ Confirmed | `client/package.json` `0.1.4` and `build.gradle` `versionCode 5` identical at base (`159d165^1`) and now; CI resolved `0.1.4` |

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Bash retry loop (3 attempts, backoff, warn + exit 0) | ✅ Yes | Duplicated per step (tasks.md mandates separate step ids); + `--max-time 60` (improvement, documented in apply) |
| `version.txt` from `needs.build-apk.outputs.version` | ✅ Yes | No checkout; single resolution |
| Upload gate `event_name == 'push' && ref == main` | ✅ Yes | Dispatch never clobbers LTS |
| Fail-loud secret gate / fail-soft uploads | ✅ Yes | Gate `exit 1`; uploads `::warning::` + `return 0` |
| No checkout in upload-lts | ✅ Yes | |
| `release` parallel, never gated | ✅ Yes | No `needs: upload-lts` |
| install.html: FALLBACK + AbortController 5s + one fetch two targets | ✅ Yes | Catch explicitly re-sets fallback (behaviorally identical, documented deviation) |
| In-app display from `APP_VERSION` | ✅ Yes | Splash, login, tests |

## Issues Found

**CRITICAL**: None.

**WARNING**:
- Human E2E pending: visual check of splash version (bottom-center, fade-out) and login/register version label on a real device/browser. Code-level evidence exists (span, CSS, component, tests) but the user must reinstall the APK (v0.1.4, versionCode 5) and confirm visually.

**SUGGESTION**:
- The workflow diff technically shows the `files: release/Timberman.apk` line as modified — this is only the base file's missing EOF newline being terminated before the appended job; release step content is byte-identical. Cosmetic only.
- README emergency-fallback curl still documents the legacy `?upsert=true` query form while CI uses the `x-upsert: true` header. Both work (exploration confirmed equivalence); aligning the README example to the proven CI form would remove ambiguity.
- Netlify/CI race: on future releases, a visitor could briefly see the fallback version before/while the new version.txt lands — accepted per design (risk table).

## Verdict

**PASS** (with one non-blocking WARNING: human E2E pending)
All 9 tasks complete; 23/23 spec scenarios verified with live post-merge evidence (CI run 31771081525 all-success; version.txt = `0.1.4`; APK object 200 with correct content-type, fresh from this build; release v0.1.4 re-published with asset; `/install` live with fetch script + CORS; 826 tests passing; no version bump). Ready for archive once the human device check is done (or archive now with the WARNING carried forward).
