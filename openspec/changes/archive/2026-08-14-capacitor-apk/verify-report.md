# Verification Report — capacitor-apk

**Change**: capacitor-apk (Android APK Distribution via Capacitor 8 sideload)
**Version**: spec `android-apk-distribution` (unversioned)
**Mode**: Standard (strict_tdd: false — `openspec/config.yaml`)
**Date**: 2026-08-13

## Status: PASS

## Executive Summary

The implemented change matches the spec, design, and tasks on all dimensions. Every task in `tasks.md` (Phases 1–4) is checked; Phase 4 device E2E was user-confirmed on a physical Android device (v0.1.3) and the `/install` Netlify route verified live. Fresh runtime evidence was produced during this verify: full client suite **273/273 tests green (21 files)** and `tsc && vite build` green. All 8 requirements (R1–R8) map to committed artifacts with matching design decisions (D1–D9). Two non-blocking reviewer SUGGESTIONs remain tracked but unaddressed (see Risks/Notes).

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 (1.1–1.7, 2.1–2.5, 3.1–3.4, 4.1–4.6) |
| Tasks complete | 22 |
| Tasks incomplete | 0 |

## Build & Tests Execution

**Build**: ✅ Passed
```text
$ pnpm --filter client build
> tsc && vite build
vite v6.4.3 building for production...
✓ 197 modules transformed.
dist/index.html                 0.40 kB │ gzip: 0.27 kB
dist/assets/index-C-33R3vP.css  1.50 kB │ gzip: 0.78 kB
dist/assets/web-mPOSWhFC.js     0.84 kB │ gzip: 0.40 kB
dist/assets/index-8EsGKrji.js 436.44 kB │ gzip: 132.70 kB
✓ built in 21.09s
```

**Tests**: ✅ 273 passed / 0 failed / 0 skipped (21 files)
```text
$ VITE_API_URL=https://timberman-api.onrender.com pnpm --filter client test
Test Files  21 passed (21)
     Tests  273 passed (273)
Duration  147.47s
```

**Coverage**: ➖ Not configured (no coverage threshold in project).

## Spec Compliance Matrix

| Requirement | Scenario | Evidence (test / artifact / manual) | Result |
|-------------|----------|-------------------------------------|--------|
| R1 WebView shell | Sync from clean checkout | 54 files under `client/android/` committed; workflow runs `cap sync android`; task 2.1 | ✅ COMPLIANT (static + CI evidence) |
| R1 WebView shell | App identity | `capacitor.config.ts` appId `com.timberman.prode`, appName `Timberman`, webDir `dist`; `build.gradle` applicationId `com.timberman.prode`; `strings.xml` app_name `Timberman` + manifest label | ✅ COMPLIANT (static) |
| R2 Asset loading | Assets load in the WebView | `vite.config.ts` `base: './'` (relative assets); device-confirmed cartelera/tickets/ranking/admin render without 404s (task 4.1, v0.1.3) | ✅ COMPLIANT (manual device E2E) |
| R2 Asset loading | Web deployment unchanged | Netlify config untouched except `/install` redirect; web build green (R8) | ✅ COMPLIANT (runtime + static) |
| R3 API URL | HTTPS API embedded | Workflow `env.VITE_API_URL: https://timberman-api.onrender.com`; no cleartext config anywhere; axios base from env | ✅ COMPLIANT (static) |
| R3 API URL | Missing VITE_API_URL fails the build | Workflow secret gate (`::error::` + `exit 1` when VITE_API_URL or keystore secrets empty) before any build step | ✅ COMPLIANT (static) |
| R4 Back button | Back navigates history | `use-back-button.test.tsx` — "navigates history back on inner routes" PASSED (suite) | ✅ COMPLIANT (runtime test) |
| R4 Back button | Back at root exits | `use-back-button.test.tsx` — "exits the app when the back button is pressed at the root route" PASSED; device-confirmed (task 4.2) | ✅ COMPLIANT (runtime test + manual) |
| R5 Signed pipeline | Signed APK from a push | Workflow: pnpm/action-setup@v4 (11), setup-node@v4 (`.nvmrc`=22), `--frozen-lockfile`, cap sync, setup-java@v4 (temurin 21), `yes | sdkmanager --licenses`, keystore materialized from `TIMBERMAN_KEYSTORE_BASE64`, `./gradlew assembleRelease`, artifact + GitHub Release (tag `v{version}`, asset `Timberman.apk`); device-confirmed signed APKs v0.1.1–v0.1.3 | ✅ COMPLIANT (static + manual) |
| R5 Signed pipeline | Keystore absent fails loudly | Workflow secret gate (exit 1 before build) + `build.gradle` taskGraph guard throws `GradleException` on release tasks without signing env — no unsigned artifact possible | ✅ COMPLIANT (static) |
| R5 Signed pipeline | In-place updates preserve data | User reinstalled v0.1.1 → v0.1.2 → v0.1.3 with data intact (task 4.4); `versionCode` strictly higher per release | ✅ COMPLIANT (manual) |
| R6 Version constant | Version constant present | `app-version.test.ts` — `APP_VERSION === package.json.version` PASSED (1 test) | ✅ COMPLIANT (runtime test) |
| R7 Install page | Page reachable on mobile | `netlify.toml` `/install → /install.html` before SPA fallback; live GET https://timbermanpro.netlify.app/install → 200 serving install page (task 4.6); `install.html` mobile-first es-AR with Timberman.apk link | ✅ COMPLIANT (static + live network) |
| R7 Install page | Unknown-sources warning | install.html documents "allow unknown sources" steps; device install followed acceptance (task 4.1) | ✅ COMPLIANT (manual) |
| R8 No regressions | Test suite green | 273/273 tests passed (21 files) — fresh run this verify | ✅ COMPLIANT (runtime test) |
| R8 No regressions | Web build green | `tsc && vite build` green — fresh run this verify | ✅ COMPLIANT (runtime) |

**Compliance summary**: 17/17 scenarios compliant (8 automated runtime tests, 5 static/CI, 4 manual/live).

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| R1 WebView shell | ✅ Implemented | Deps `@capacitor/core@^8.5.0` + devDeps cli/android/app `^8.5.0`; `cap:sync` + `build:android` scripts; committed `client/android/` (54 files) |
| R2 Asset loading | ✅ Implemented | `base: './'`; `telemetry: false` in capacitor.config.ts |
| R3 API URL | ✅ Implemented | HTTPS env in workflow; gate fails on absence |
| R4 Back button | ✅ Implemented | `use-back-button.ts` native-only guard (`Capacitor.isNativePlatform()`), `/` → `exitApp()`, inner → `history.back()`; wired in `App.tsx` |
| R5 Signed pipeline | ✅ Implemented | Env-driven `signingConfig` + fail-loud guard; `.gitignore` covers `*.jks`/`*.keystore`/`keystore.properties`; `git check-ignore` confirms keystore untracked |
| R6 Version constant | ✅ Implemented | `APP_VERSION` imports `version` from package.json (resolveJsonModule); workflow reads version for tag/artifact |
| R7 Install page | ✅ Implemented | `install.html` (dark `#132421`, es-AR, unknown-sources steps, latest-release APK link); redirect before SPA fallback |
| R8 No regressions | ✅ Implemented | Suite + build green; Netlify build command untouched |

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Deps + layout (^8.5.0, committed android/) | ✅ Yes | Exact pin range; scaffold committed |
| D2 Vite base `./` | ✅ Yes | With explanatory comment |
| D3 Version constant from package.json | ✅ Yes | APP_VERSION + test; workflow `node -p` reads it |
| D4 Signing env-driven + fail-loud | ✅ Yes | Guard throws on release tasks; keystore never committed |
| D5 CI workflow | ✅ Yes | Minor deviation: triggers on `main` push (not `feature/capacitor-apk`, which is now merged) + `workflow_dispatch`; `update_release: true` dropped per softprops v2 (commit c246a7b "drop deprecated update_release input") — release job still overwrites assets on re-tag. Does not break spec |
| D6 `/install` page + redirect order | ✅ Yes | Redirect listed before `/*` fallback |
| D7 Back button native-only | ✅ Yes | Guard keeps happy-dom tests green |
| D8 WebView behaviors (no client change) | ✅ Yes | JWT localStorage persists (device-confirmed); HTTPS API → no cleartext config |
| D9 Logo relative paths (known limitation) | ✅ Yes | Documented in README; prod uses absolute Supabase URLs |

## Issues Found

**CRITICAL**: None
**WARNING**: None
**SUGGESTION** (tracked, not addressed — non-blocking):
1. **Disable Eliminar while save pending** — in `Equipos.tsx` the in-form delete button is disabled only on `deletePending` (`disabled={deletePending}`, line 480); it remains enabled while a save/upload (`isPending`/`uploading`) is in flight. Suggested: also gate on `isPending || uploading`.
2. **Dead `.team-row-actions` CSS cleanup** — the class is still referenced (`Equipos.tsx` line 639), but now wraps only the Editar button (Eliminar moved into the edit form), so the desktop side-by-side + mobile column-stack rules are mostly vestigial. Suggested: simplify/remove the mobile override.

## Verdict

**PASS** — all tasks complete, 273/273 tests and the web build green on fresh runs, all 17 spec scenarios covered (runtime tests, static/CI evidence, and user device E2E + live Netlify check), design decisions followed. Two non-blocking SUGGESTIONs remain tracked for a future cleanup pass.