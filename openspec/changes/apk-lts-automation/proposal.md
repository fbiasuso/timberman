# Proposal: APK LTS Automation

## Intent

APK upload to the LTS bucket is manual (README curl) and `install.html` shows a hardcoded `v0.1.4`. Automate the upload in CI and make the install page + the app itself display the real version, so users and support always see the truth without hand-editing.

## Scope

### In Scope
- ADD-only `upload-lts` job: uploads `Timberman.apk` + `version.txt` to Supabase bucket `apk`; 3 attempts; on final failure warn, still publish release, defer to manual/next release
- `version.txt` object (`cacheControl=no-cache`, content = package.json version)
- `install.html`: inline fetch of version.txt with hardcoded fallback (last known version); updates `.version` + footer
- In-app version: splash (bottom center) + login/register via existing `APP_VERSION`
- README: secrets list + upload section (manual curl kept as emergency fallback)
- Delta spec `apk-lts-distribution`

### Out of Scope
- Touching `release` job/steps (hard constraint)
- Per-version bucket objects (stable `timberman.apk` only)
- Forced-update/version-gating, Play Store publishing
- Netlify workflow changes

## Capabilities

### New Capabilities
- `apk-version-display`: splash and login/register show `v{APP_VERSION}` from client/package.json

### Modified Capabilities
- `apk-lts-distribution`: MODIFIED "GitHub Releases Untouched" (release job untouched, upload job ADDED — workflow now has a diff) and "README LTS Distribution Documentation" (manual → automated, curl kept as fallback); ADDED upload-job, version.txt, and dynamic install-page version requirements

## Approach

- **Job**: `upload-lts` (`if: main push`, `needs: build-apk`) — download-artifact, write `version.txt` from `needs.build-apk.outputs.version`, secret gate, then curl uploads: APK (`x-upsert: true`, `cacheControl=no-cache`, `application/vnd.android.package-archive`) then version.txt (`text/plain`); each step in a retry loop (3 attempts), final failure → `::warning::` + `exit 0` so release is never blocked
- **install.html**: inline `<script>` fetches public version.txt URL, trims, falls back to hardcoded version on failure; CORS verified
- **In-app**: use `APP_VERSION` (already imports `version` from package.json; `resolveJsonModule` on). Splash: add `.splash-version` div, bottom-center CSS — least invasive since splash is a React overlay, not native. Login/register: one text node in `LoginPage.tsx` (both tabs)
- **Tradeoffs**: React splash text vs native TextView (native needs new splash layout + version plumbing — rejected); `APP_VERSION` import vs Vite `define` (import = single source, already tested — chosen)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.github/workflows/android-apk.yml` | Modified | ADD `upload-lts` job only |
| `client/public/install.html` | Modified | Inline script + fallback version |
| `client/src/components/layout/SplashScreen.tsx`, `client/src/styles/global.css` | Modified | Version text + CSS |
| `client/src/components/auth/LoginPage.tsx` | Modified | Version text |
| `README.md` | Modified | Secrets + upload section |
| `openspec/specs/apk-lts-distribution/spec.md` | Delta | See Capabilities |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SUPABASE secrets missing (prereq) | Med | Fail loudly in job; documented pre-merge action |
| version.txt fetch fails | Low | Hardcoded fallback; CORS verified live |
| workflow_dispatch re-run clobbers LTS with old APK | Med | Gate to push events on main |
| Upload fails after retries | Low | Warning; release unaffected; manual/next-release fallback |

## Rollback Plan

Revert workflow ADD + install.html/app changes in a commit. If a bad upload landed, re-run the README manual curl with the previous APK. Upsert only — no data migration.

## Dependencies

- User adds `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` as GitHub secrets (values exist in `server/.env`) — pre-merge prerequisite, not a blocker

## Success Criteria

- [ ] Push to main: both public URLs serve new APK + version.txt
- [ ] install.html shows live version; fallback renders on fetch failure
- [ ] APK splash + login/register show `v{current}`
- [ ] `release` job diff = zero; GitHub Release still publishes