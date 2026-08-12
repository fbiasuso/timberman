# Tasks: Android APK Distribution via Capacitor (sideload)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,400 total (PR 1 ~330 · PR 2 ~780 · PR 3 ~300) |
| 400-line budget risk | High (slice 2 ~720 lines are generated scaffold; hand-written deltas ≈ 60) |
| Chained PRs recommended | Yes (3 slices) |
| Suggested split | PR 1 config+deps+web → PR 2 android scaffold+signing → PR 3 workflow+install |
| Delivery strategy | ask-on-risk (session: ask-always) |
| Chain strategy | pending (user chooses; suggested: feature-branch-chain) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Config, deps, Vite base, version constant, back hook + tests, `.nvmrc` | PR 1 | Base `feature/capacitor-apk`; commits: deps+lockfile, capacitor.config, vite base, APP_VERSION, back hook, node floor |
| 2 | Committed `client/android/` scaffold + signing config + keystore custody | PR 2 | Base = PR 1 branch. Generated diff ~720 lines — review hand-written only (signingConfig, colors, .gitignore). Accept as size-exception-grade |
| 3 | CI workflow + Release publish, `/install` page + redirect, README install | PR 3 | Base = PR 2 branch. Manual pre-req: keystore + secrets exist |

## Phase 1: Config + Deps + Web Changes (PR 1)

- [x] 1.1 Add `@capacitor/core@^8.5.0` dep; `@capacitor/cli`, `@capacitor/android`, `@capacitor/app` devDeps; `cap:sync` + `build:android` scripts to `client/package.json`. Verify: `pnpm install` updates lockfile; `tsc --noEmit` green.
- [x] 1.2 Create `client/capacitor.config.ts` (appId `com.timberman.prode`, appName `Timberman`, webDir `dist`). Verify: config parses; later `cap sync` uses it.
- [x] 1.3 Set `base: './'` in `client/vite.config.ts` (D2). Verify: `vite build` emits relative assets; Netlify build unaffected (R2).
- [x] 1.4 Create `client/src/constants/app-version.ts` (D3: `APP_VERSION` from `package.json`) + vitest spec asserting it equals `package.json` version (R6).
- [x] 1.5 Create `client/src/hooks/use-back-button.ts` (D7: native-only; `/` → `exitApp`, else `history.back()`) + vitest spec mocking `@capacitor/app`: root exits, inner navigates, non-native registers nothing (R4).
- [x] 1.6 Wire `useBackButton()` in `client/src/App.tsx`. Verify: full client suite + build green (R8).
- [x] 1.7 Create `.nvmrc` (`22`) + README Node ≥ 22 floor (D1). Verify: doc review.

## Phase 2: Android Scaffold + Signing (PR 2)

- [ ] 2.1 Generate committed `client/android/` via `pnpm --filter client exec cap add android` (D1). Verify: clean checkout → `cap sync android` regenerates cleanly (R1).
- [ ] 2.2 Add env-driven release `signingConfig` to `client/android/app/build.gradle` (D4: `ANDROID_KEYSTORE_PATH/PASSWORD/ALIAS/KEY_PASSWORD`; absent → build fails). Verify: `assembleRelease` fails loudly without secrets, signs with them (R5).
- [ ] 2.3 Apply dark theme `#132421` in `client/android` styles (`colors.xml`). Verify: APK windows/launch show dark background (D1).
- [ ] 2.4 Add keystore patterns (`*.jks`, `*.keystore`, `keystore.properties`) to root `.gitignore`; README keystore custody note. Verify: `git status` shows no keystore tracked (R5).
- [ ] 2.5 Project action item (manual, not automatable): `keytool` RSA-2048 keystore, base64 + passwords as GitHub secrets, offline backup recorded for owner. Verify: secrets set in GitHub before PR 3 (R5).

## Phase 3: CI Workflow + Release + /install (PR 3)

- [ ] 3.1 Create `.github/workflows/android-apk.yml` (D5): Node 22 + pnpm 11 frozen install; secret gate (`::error::` + exit 1 when `VITE_API_URL` or keystore secrets missing); `VITE_API_URL=https://timberman-api.onrender.com` build; `cap sync android`; JDK 21 + `yes | sdkmanager --licenses`; `assembleRelease`; upload-artifact; GitHub Release (`contents: write`, tag `v{version}`, asset `Timberman.apk`, `update_release: true`). Verify: push → signed APK artifact + Release asset; secrets absent → fail, no artifact (R3, R5).
- [ ] 3.2 Create `client/public/install.html` (D6: mobile-first, dark `#132421`, es-AR sideload steps, link to `Timberman.apk`). Verify: `vite build` copies it; mobile reachability (R7).
- [ ] 3.3 Add `netlify.toml` redirect `/install → /install.html` BEFORE SPA fallback (D6). Verify: other routes still SPA-fallback (R8).
- [ ] 3.4 README: install page link + "APK per UI change, bump version" cadence (R6/R7).

## Phase 4: Verification (device E2E + regression)

- [ ] 4.1 Install signed APK on Android 9+: cartelera, tickets, ranking, admin render without 404s (R2).
- [ ] 4.2 Back button: inner route → previous route; root → app exits (R4).
- [ ] 4.3 JWT session survives app restart (D8).
- [ ] 4.4 In-place update: install newer APK, same keystore, data preserved (R5).
- [ ] 4.5 Regression: `pnpm --filter client test` and `pnpm --filter client build` green (R8).
- [ ] 4.6 Confirm API traffic is HTTPS only; `/install` reachable on mobile Netlify (R3, R7).

## Spec Coverage

| Req | Tasks | 
|-----|-------|
| WebView shell (R1) | 1.1, 1.2, 2.1 |
| Asset loading (R2) | 1.3, 4.1 |
| API URL (R3) | 3.1, 4.6 |
| Back button (R4) | 1.5, 1.6, 4.2 |
| Signed pipeline (R5) | 2.2, 2.4, 2.5, 3.1, 4.4 |
| Version constant (R6) | 1.4, 3.1, 3.4 |
| Install page (R7) | 3.2, 3.3, 4.6 |
| No regressions (R8) | 1.3, 1.6, 3.3, 4.5 |

No cleanup phase needed — additive change; rollback = revert branch (Netlify untouched, prior APK reinstallable with same keystore).