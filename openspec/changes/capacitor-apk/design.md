# Design: Android APK Distribution via Capacitor (sideload)

## Technical Approach

Capacitor 8 WebView wrapper — no React architecture or server change. `vite build` (relative base) → `cap sync android` copies `dist/` into committed `client/android/` → Gradle `assembleRelease` signs via CI keystore → APK artifact + GitHub Release asset for sideload. Version in `client/package.json`, exposed via typed constant (future forced-update hook). Satisfies spec 1:1.

## Architecture Decisions

| # | Decision | Choice | Alternatives / Rationale |
|---|----------|--------|--------------------------|
| D1 | Deps + layout | `@capacitor/core@^8.5.0` (dep); `@capacitor/cli`, `@capacitor/android`, `@capacitor/app` (devDeps). `client/capacitor.config.ts` (`com.timberman.prode` / `Timberman` / `webDir dist`). `client/android/` committed | Rejected: cap add on CI, TWA/PWABuilder, RN. Pin `^8.5.0`, never 9.0.0-alpha (engines: Node >= 22) |
| D2 | Vite base | `base: './'` in `vite.config.ts` | Relative assets resolve under WebView origin `https://localhost`; Netlify unaffected |
| D3 | Version constant | `client/package.json` `version` = single source. `client/src/constants/app-version.ts`: `import { version } from '../../package.json'; export const APP_VERSION = version;` (`resolveJsonModule` on). Workflow reads it (`node -p "require('./client/package.json').version"`) for artifact name + release tag | Alternative: literal in TS — rejected (sources drift). **Hook surface (NOT built):** future `checkForUpdates()` compares `APP_VERSION` to a server minimum (`GET /api/version`) and gates UI. Bump every release |
| D4 | Signing | Local `keytool` JKS (RSA 2048); base64 + passwords as GitHub secrets. `client/android/app/build.gradle` release `signingConfig` reads env (`TIMBERMAN_KEYSTORE_PATH/PASSWORD/ALIAS/KEY_PASSWORD`); absent → Gradle fails loudly (guard throws on release tasks) | Alternative: committed `key.properties` — rejected (secret in git). Offline backup = project action item |
| D5 | CI workflow | `.github/workflows/android-apk.yml`: push to `feature/capacitor-apk` + `workflow_dispatch`. Steps: checkout → pnpm/action-setup@v4 (11) → setup-node@v4 (22, pnpm cache) → **secret gate** (`::error::` + exit 1 if `VITE_API_URL`/keystore secrets empty) → `pnpm install --frozen-lockfile` → `VITE_API_URL=https://timberman-api.onrender.com pnpm --filter client build` → `cap sync android` → setup-java@v4 (temurin 21) → `yes \| sdkmanager --licenses` → `./gradlew assembleRelease` → upload-artifact (`timberman-apk-v{version}`) → GitHub Release (tag `v{version}`, `update_release: true`, asset `Timberman.apk`) | Artifact alone lacks a stable URL; release asset gives `/install` a permanent link. Cache `~/.gradle` |
| D6 | `/install` page | Static `client/public/install.html` (inline CSS, dark `#132421`, Spanish — es-AR audience). `netlify.toml`: `[[redirects]]` `/install → /install.html` BEFORE the SPA fallback | Alternative: React route — rejected (boots whole SPA for one page). Vite copies `public/` verbatim; web pipeline unchanged |
| D7 | Back button | `client/src/hooks/use-back-button.ts`: register `backButton` listener only when `Capacitor.isNativePlatform()`; handler: `pathname === '/' → App.exitApp()` else `window.history.back()`. Wired in `App.tsx` | Guard keeps happy-dom tests green; spec: back navigates history, exits at root |
| D8 | WebView behaviors | **No client change:** JWT `localStorage` persists across restarts (verified); 401 `window.location.href='/login'` works (local server SPA-fallbacks); API HTTPS → no cleartext config; no external links in `src/` (verified) → no browser plugin | Future polish: router `navigate('/login')` — rejected now |
| D9 | Logo relative paths | **Known limitation, not hardened.** `resolveLogoUrl` relative → `/public/…` breaks in WebView, but prod uses absolute Supabase HTTPS URLs (verified) → matches Netlify. Defer `format.ts` hardening | Documented in README |

## Data Flow

```
vite build ─> dist ─(cap sync android)─> assets/public in client/android/
VITE_API_URL ─> axios ─> https://timberman-api.onrender.com
assembleRelease + CI keystore ─> signed APK ─> artifact + Release asset
sideload ─> WebView @ https://localhost ─> React SPA
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/capacitor.config.ts` | Create | App identity + webDir |
| `client/package.json` | Modify | Capacitor deps, cap scripts, version |
| `client/vite.config.ts` | Modify | `base: './'` (D2) |
| `client/src/constants/app-version.ts` | Create | `APP_VERSION` (D3) |
| `client/src/hooks/use-back-button.ts` | Create | Back handler (D7) |
| `client/src/App.tsx` | Modify | Wire `useBackButton()` |
| `client/android/` | Create | Scaffold + signingConfig (D4) + dark theme |
| `.github/workflows/android-apk.yml` | Create | D5 pipeline |
| `client/public/install.html` | Create | Sideload instructions + APK link (D6) |
| `netlify.toml` | Modify | `/install` redirect |
| `README.md` | Modify | Node 22 floor; keystore custody; install notes |
| `.nvmrc` | Create | `22` |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `use-back-button` | Mock `@capacitor/app`: `/` → `exitApp`; inner → `history.back`; non-native → no registration |
| Unit | `app-version` | `APP_VERSION === package.json.version` |
| Regression | Client suite + build | `pnpm --filter client test` / `build` green; Netlify untouched |
| E2E (manual) | Signed APK | Android 9+: features, back nav, JWT survives restart |

## Migration / Rollout

No migration — additive. Rollback: revert branch; Netlify untouched; installed APKs keep working (reinstall prior APK, same keystore). Manual pre-conditions for slice 3: generate keystore, secrets + offline backup.

## Chained PR Plan (input to sdd-tasks)

1. **Config + deps + web changes** (~350 lines): D1 deps, D2 base, D3 constant, D7 hook + tests, `.nvmrc`, README Node floor.
2. **android/ scaffold + signing** (~800 lines: ~740 generated + ~60 hand-written signing, theme, cap scripts).
3. **Workflow + /install** (~320 lines): D5 workflow, D6 page + redirect, keystore/secrets setup (manual), README install section.

Guard forecast: **Decision needed before apply: Yes** · **Chained PRs recommended: Yes** · **400-line budget risk: High** (slice 2 mostly generated; review focuses on hand-written deltas).

## Open Questions

- [ ] Confirm GitHub Release publish (D5) — small addition beyond "artifact upload" that makes `/install` link permanent; alternative: link to releases page.
- [ ] Keystore offline backup location (user custody).