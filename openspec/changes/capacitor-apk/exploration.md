# Exploration: Capacitor APK wrapper for the Timberman client

> Phase: sdd-explore · Change: `capacitor-apk` · Date: 2026-08-12
> Scope: client/ + Android build pipeline ONLY. Server code is out of scope.

## Current State

- **Client**: `client/` — React 19, Vite 6, TypeScript, TanStack Query, Zustand. Mobile-first (max-width 480px). No PWA manifest, no service worker, no Capacitor today.
- **API consumption**: `client/src/api/client.ts` reads `VITE_API_URL` at build time via `import.meta.env`, falling back to `/api` (Vite dev proxy → `http://localhost:3001`). The deployed API is HTTPS: `https://timberman-api.onrender.com` (Render, `render.yaml`).
- **Auth**: JWT persisted in `localStorage` (`client/src/stores/auth-store.ts`, key `auth-token`), attached by an axios request interceptor; 401 handler does `window.location.href = '/login'` (`client/src/api/client.ts`).
- **Routing**: `BrowserRouter` (react-router-dom 7) — SPA fallback on Netlify via `netlify.toml` redirect. `App.tsx` renders a web `SplashScreen` (styled text brand, 2.2s fade) on every boot.
- **Logos/shields**: `resolveLogoUrl` (`client/src/utils/format.ts`) passes absolute `https://` URLs through and rewrites relative values to `/public/{logo}` (API-origin path). Production uses `IMAGE_STORAGE=supabase` (render.yaml), so stored logos are absolute Supabase public URLs (`https://<project>.supabase.co/storage/v1/object/public/logos/...` — confirmed in `server/src/infrastructure/images/supabase-image-service.ts`).
- **Repo**: pnpm workspace (`pnpm-workspace.yaml`: `server`, `client`; lockfile v9). Root scripts: `pnpm --recursive build|test|lint`. No `.github/workflows` exists. GitHub remote: `git@github.com:fbiasuso/timberman.git`; branch `feature/capacitor-apk` already created, tree clean. No `.nvmrc`; no `engines` field anywhere; README states Node 20+; Render pins Node 22.
- **Toolchain**: local Node v22.2.0, pnpm 11.2.2 (Windows). Capacitor 8 CLI requires Node >= 22.0.0 (verified via npm `engines`).

## Affected Areas

- `client/package.json` — add `@capacitor/core` (dep), `@capacitor/cli`, `@capacitor/android`, optional `@capacitor/app` (devDeps); add `cap` scripts. Lockfile updates via `pnpm install`.
- `client/capacitor.config.ts` — NEW (appId `com.timberman.prode`, appName `Timberman`, `webDir: 'dist'`).
- `client/vite.config.ts` — add `base: './'` (required for the WebView asset paths).
- `client/index.html` — optional viewport hardening (`viewport-fit=cover`, `user-scalable=no`); no required change.
- `client/android/` — NEW scaffold from `npx cap add android`; commit it (standard Capacitor practice).
- `.github/workflows/android-apk.yml` — NEW minimal signed-release-APK workflow.
- `client/src/main.tsx` — optional `@capacitor/app` back-button wiring (small, high-value).
- `client/src/utils/format.ts` — OPTIONAL hardening: prefix relative `/public/...` logos with `VITE_API_URL` (not required — see Risks).
- NOT touched: `server/`, `netlify.toml` (web deploy unchanged), `render.yaml`.

## Findings by Investigation Area

### 1. Client changes for Capacitor

- **Dependencies**: `@capacitor/core@^8.5.0` (dependencies), `@capacitor/cli@^8.5.0` + `@capacitor/android@^8.5.0` (devDependencies). Capacitor 8.5.0 is current stable (npm verified); do NOT float to 9.0.0-alpha. `pnpm-workspace.yaml` `allowBuilds` only gates esbuild; Capacitor packages have no install scripts → no workspace change needed.
- **Location**: `capacitor.config.ts` lives at `client/` root (the package root the CLI runs from); `android/` lands at `client/android/`. It is NOT a workspace package (no package.json) so `pnpm --recursive` scripts ignore it.
- **Scripts (client)**: `"cap:sync": "cap sync android"` and/or `"build:android": "tsc && vite build && cap sync android"`. Under pnpm, run via `pnpm --filter client exec cap ...` or `npx cap` with cwd `client/` — the CLI resolves `@capacitor/android` from the workspace tree.
- **cap init values**: `appId: com.timberman.prode`, `appName: Timberman` (sensible; user's domain-based naming for sideload).
- **Splash**: `SplashScreen.tsx` renders the brand as styled text; the real logo image was never committed (README). A native splash plugin (`@capacitor/splash-screen`) requires PNG assets → NOT worth it for sideload. Recommendation: keep the web splash; optional one-line native polish = set the Android launch theme background to `#132421` (app background, `global.css`) to avoid a white flash before the WebView mounts.
- **index.html**: current viewport `width=device-width, initial-scale=1.0` is functional. Optional: add `viewport-fit=cover` and `user-scalable=no` for a native feel.
- **Vite base**: `vite.config.ts` has NO `base` (default `/`). Capacitor's Android server serves at `https://localhost` so root-absolute `/assets/...` mostly works, but Ionic's official Vite guide mandates `base: './'` for reliability. **Required change.**
- **Env injection**: `VITE_API_URL` is consumed at build time only (single reference). The APK build MUST set `VITE_API_URL=https://timberman-api.onrender.com` — otherwise axios falls back to `/api` → resolves to `https://localhost/api` inside the WebView → broken. Build-time env is enough; no runtime fetch.

### 2. Android build path

- **No `.github/workflows` exists** → workflow must be created from scratch.
- **CI (recommended)**: minimal workflow on push to `feature/capacitor-apk` (+ `workflow_dispatch`):
  1. `actions/checkout@v4`
  2. `pnpm/action-setup@v4` (pin pnpm 11) → `actions/setup-node@v4` (Node 22) → `pnpm install --frozen-lockfile`
  3. `pnpm --filter client build` with `VITE_API_URL` env
  4. `pnpm --filter client exec cap sync android`
  5. `actions/setup-java@v4` (temurin 21) → `./gradlew assembleRelease` in `client/android` (Ubuntu-latest runners ship the Android SDK with `ANDROID_HOME` set; add `yes | sdkmanager --licenses` so Gradle can auto-fetch platform 36 if missing)
  6. Sign with the release keystore (base64 secret) via Gradle `signingConfig` reading env secrets — cleanest; `assembleRelease` emits the signed APK directly
  7. `actions/upload-artifact@v4` (or GitHub Release) → download and sideload via WhatsApp/Drive
  - JDK/SDK facts: AGP 8.13 + Gradle 8.14.3 (Capacitor 8 defaults) need Java 17+ (21 recommended); ubuntu-latest ships Temurin 21 and the Android SDK (platform 36 auto-provisioned once licenses are accepted).
- **Local alternative (Windows)**: install Android Studio 2025.2.1+ (bundles JDK 21 + SDK 36), open `client/android`, `Build → Generate Signed APK` with a `keytool`-generated keystore; or headless: `keytool -genkey ...` → `./gradlew assembleRelease` → `apksigner sign`. Tradeoff: full control, no CI, but manual per-release and heavier one-time install.
- **Keystore note**: one keystore signs ALL future releases; losing it or switching keys forces users to uninstall (data loss). Keep passwords in GitHub secrets AND a local backup.

### 3. HTTPS / cleartext

- Android 9+ blocks cleartext; the API is HTTPS (`https://timberman-api.onrender.com`) → **no `android:usesCleartextTraffic` change needed**. All runtime API traffic from the WebView is HTTPS.

### 4. Auth persistence in the WebView

- Capacitor Android WebView persists `localStorage` in the app's WebView data store across restarts (survives process kills and app updates; cleared on uninstall). JWT session survives → **no change needed**.
- 401 redirect `window.location.href = '/login'` does a full page load at `https://localhost/login`; Capacitor's Android local server falls back to serving the app entry (same contract as the Netlify SPA fallback), React boots, `ProtectedRoute` lands on `/login`. Works; cosmetic downside: the web splash re-runs (~2.8s). Optional polish: replace with router navigation (`navigate('/login')`).
- **Add `@capacitor/app`**: without it the Android hardware back button closes the app instead of navigating history. Small client-only addition, high UX value.

### 5. Risks & edge cases

1. **Node floor**: Capacitor 8 requires Node >= 22.0.0 (npm `engines` verified). Local Node 22.2.0 OK; README says "Node 20+" — document/pin Node 22 (CI + README). No `.nvmrc` exists.
2. **Relative logo paths break in the WebView**: `resolveLogoUrl` rewrites relative values to `/public/...`, which in the WebView resolves to `https://localhost/public/...` (broken). In practice prod runs Supabase storage → absolute HTTPS URLs → fine, and this matches current Netlify behavior (no new regression). Optional hardening: prefix relative paths with `VITE_API_URL` in `format.ts`.
3. **Large first commit / review budget**: `client/android/` scaffold + workflow far exceed the 400-line review budget → `sdd-tasks` must plan chained PRs (e.g., PR1: deps + config + `base:'./'` + web changes; PR2: `android/` scaffold; PR3: workflow + signing).
4. **pnpm + cap CLI cwd gotcha**: `cap` must run with cwd = `client/`; use `pnpm --filter client exec cap sync android`. Strict node_modules is fine for core packages; pin `@capacitor/*` versions to avoid 9.0.0-alpha in the lockfile.
5. **Signing key custody**: single keystore for life; losing it breaks updates for installed APKs.
6. **Splash flash**: without a launch-theme tweak, a white/blank frame can flash before the WebView paints (mitigation: dark launch theme matching `#132421`).

### 6. Test impact

- Client tests: vitest 2 + happy-dom (`vitest.config.ts`, includes `src/**/*.test.{ts,tsx}`) — Capacitor deps add no test files and nothing imports them in `src`, so `pnpm --filter client test` and `pnpm build` (`tsc && vite build`) are unaffected. `capacitor.config.ts` sits outside the `tsconfig` include (`src` only) → not typechecked, no breakage. Netlify build script unchanged (no `cap` in it). `strict_tdd: false` — no TDD constraint.

## Approaches

| Approach | Pros | Cons | Complexity |
|---|---|---|---|
| **A. Capacitor 8 + GitHub Actions signed APK** | Reproducible; no Android toolchain needed on Windows; keystore in secrets; artifact/release shareable; rerunnable | One-time workflow + keystore setup; secrets management; big scaffold commit | Medium |
| **B. Capacitor 8 + local Android Studio build** | No CI config; full manual control; simplest mental model | Requires Android Studio 2025.2.1+ / JDK 21 / SDK 36 install on Windows; manual, non-reproducible per-release signing | Medium (one-time env + repetitive manual work) |
| **C. Web-only (PWA-style) distribution** | Zero native work | Rejected by mission: user wants an installable APK via sideload | — |

## Recommendation

**Approach A — Capacitor 8 (pin `^8.5.0`) with the `android/` folder committed and a minimal GitHub Actions workflow producing a signed release APK** (artifact/Release download → WhatsApp/Drive sideload):

1. Add `@capacitor/core@^8.5.0`, `@capacitor/cli@^8.5.0`, `@capacitor/android@^8.5.0`, `@capacitor/app@^8.x`; create `client/capacitor.config.ts` (`com.timberman.prode` / `Timberman` / `webDir: 'dist'`); add `build:android` + `cap:sync` scripts.
2. `vite.config.ts`: `base: './'` (required).
3. `npx cap add android` once, commit `client/android/`.
4. Optional polish: `@capacitor/app` back-button handling in `main.tsx`; dark launch theme; viewport meta tweaks. Skip native splash plugin (no logo asset; web splash suffices).
5. Build pipeline: `VITE_API_URL=https://timberman-api.onrender.com` at build time (mandatory), `cap sync`, `./gradlew assembleRelease` (JDK 21), keystore signing from GitHub secrets, upload artifact.
6. No cleartext changes; JWT localStorage persistence works as-is.

## Risks

- Node >= 22 floor for Capacitor 8 (pin in CI; update README; no `.nvmrc` today).
- Relative logo paths (`/public/...`) break in the WebView (only in local storage mode; Supabase absolute URLs are the prod norm — not a new regression; optional `format.ts` hardening).
- First commit (android/ scaffold + workflow) exceeds the 400-line review budget → chained PRs needed.
- Signing-key custody: one keystore for life (loss = broken updates for installed APKs).

## Ready for Proposal

**Yes** — exploration complete, all facts verified against the codebase. The orchestrator should proceed to `sdd-propose` with Approach A, and tell `sdd-tasks` to plan chained PRs because of the scaffold size.
