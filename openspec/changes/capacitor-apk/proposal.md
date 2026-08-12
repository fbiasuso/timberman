# Proposal: Android APK distribution via Capacitor (sideload)

## Intent

Existing Android-first users want an installable APK; today the app is web-only on Netlify. Wrap the React client as-is in a Capacitor 8 WebView and ship a signed release APK per UI change via sideload (WhatsApp/Drive). No feature cuts; no server changes.

## Scope

### In Scope

- Capacitor 8 deps, `capacitor.config.ts` (`com.timberman.prode` / `Timberman` / webDir `dist`), build scripts
- `vite.config.ts` `base: './'` (required for WebView asset paths)
- `client/android/` scaffold, committed
- `@capacitor/app` back-button handling
- GitHub Actions workflow: Node 22, `VITE_API_URL` at build, `cap sync`, `assembleRelease` (JDK 21), keystore-signed APK artifact
- Central app-version constant (hook for a future forced-update check)
- Distribution aids: signed release APK + install-instructions page on the Netlify site

### Out of Scope

- Server changes; Google Play/AAB; TWA; push; native splash (no logo asset)
- Forced-update mechanism (future; version constant is its hook)
- Zero-friction paths (Play Store/PWA) — future alternatives only

## Capabilities

### New Capabilities

- `android-apk-distribution`: WebView shell, back-button behavior, signed APK pipeline, build-time API URL

### Modified Capabilities

- None — additive packaging; existing specs behavior-unchanged

## Approach

Capacitor 8 over TWA/PWABuilder (needs manifest/SW), React Native rewrite (unjustified), PWA-only (APK is the requirement). APK per UI change, single keystore. JWT/HTTPS work in the WebView as-is — no cleartext config.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `client/package.json` | Modified | Capacitor deps + cap scripts |
| `client/vite.config.ts` | Modified | `base: './'` |
| `client/capacitor.config.ts` | New | App config |
| `client/android/` | New | Committed scaffold |
| `client/src/main.tsx` | Modified | Back-button wiring |
| `client/src/` (version constant) | New | Central app version |
| `.github/workflows/android-apk.yml` | New | Signed APK pipeline |
| Netlify install page | New | `/install` route |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Node floor (Cap 8 needs >= 22) | Med | Pin Node 22 in CI + README |
| Relative logo paths break in WebView | Low | Local-storage mode only; prod uses absolute Supabase URLs (optional `format.ts` hardening) |
| Keystore loss breaks updates (data loss) | Med | Secret in GitHub + local backup; custody is a project decision |
| Scaffold commit > 400-line review budget | High | Chained PRs: config → android/ → workflow+signing |

## Rollback Plan

Revert the branch (client-only; Netlify deploy untouched). Installed APKs keep working; reinstall a prior APK (same keystore) to downgrade.

## Dependencies

- Node >= 22, pnpm 11, JDK 21 + Android SDK on CI; keystore secret in GitHub
- Physical Android device (9+) to verify

## Success Criteria

- [ ] Workflow emits a signed release APK from clean checkout
- [ ] APK installs; cartelera, tickets, ranking, admin work
- [ ] Back navigates history; JWT session survives restart
- [ ] Netlify deploy + client tests unchanged, green
- [ ] Install page live

## Proposal question round

Assumptions for user review: (1) keystore custody — you own generation, secrets, backup; (2) `/install` route + content; (3) appName `Timberman` / `com.timberman.prode`.