# Proposal: LTS APK Hosting on Supabase Storage

## Intent

End users install the Timberman APK from a stable, permanent URL instead of GitHub. The APK is already hosted as an LTS object in a public Supabase Storage bucket (`apk/timberman.apk`, Cache-Control: no-cache). This change points `/install` at that URL, removes GitHub links from the page, and documents the manual upload flow in the README. GitHub Releases stay as internal backup/version history — never touched, never linked from `/install`.

## Scope

### In Scope

- `client/public/install.html`: download button href → `https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/timberman.apk`
- `client/public/install.html`: remove the footer "Ver todas las versiones publicadas" GitHub link
- `README.md`: rewrite the "Android APK (sideload)" section — LTS URL, manual upload (dashboard + Storage API), Cache-Control/content-type; keystore custody and version-bump cadence kept

### Out of Scope

- `.github/workflows/android-apk.yml` — untouched
- GitHub Releases — no deletion, no workflow changes
- `netlify.toml`, server, client app code — untouched
- Automated/CI upload to the bucket (future work; upload is manual per release)

## Capabilities

### New Capabilities

- `apk-lts-distribution`: stable LTS APK URL in public Supabase Storage, `/install` download flow without GitHub exposure, manual upload ops procedure documented

### Modified Capabilities

- None — new capability only; `android-apk-distribution` (capacitor-apk) behavior unchanged

## Approach

Pure static change: swap one href, delete one link, rewrite one README section. No build, CI, or runtime code touched. The bucket object is overwritten per release (upsert) at the same path, so the URL never changes — that is the LTS contract.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/public/install.html` | Modified | Download href → LTS URL; footer GitHub link removed |
| `README.md` | Modified | APK section documents LTS flow + manual upload |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stale APK served if Cache-Control: no-cache is lost on re-upload | Med | README pins the header in the upload command; verify header after upload |
| Public bucket exposes the APK to anyone | Low | Intended — APK is a public sideload artifact; no secrets in the bucket |
| Forgetting the manual upload per release | Med | README checklist ties upload to the existing version-bump release cadence |
| GitHub link leaks elsewhere on the page | Low | Verify: grep finds no `github.com/fbiasuso/timberman` in `install.html` |

## Rollback Plan

Revert the branch (2 files). `/install` links back to GitHub Releases as before; README reverts. Bucket object stays untouched.

## Dependencies

- Supabase project `uwjcgmitaedkawgaqrfk` (bucket `apk`, public) — already live
- `server/.env`: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for the Storage API upload command (documented, not committed)

## Success Criteria

- [ ] `/install` download button resolves to the LTS URL and downloads the APK — href + live HEAD verified (HTTP 200, `application/vnd.android.package-archive`); full install-over-previous-version on a real device remains as open follow-up task 3.2
- [x] No `github.com` link in `client/public/install.html` — `git grep github.com` → 0 matches
- [x] README documents LTS URL, manual upload steps, Cache-Control/content-type — "Android APK (sideload)" + "Manual upload to the LTS bucket" sections
- [x] `git diff` shows only `install.html` + `README.md` — workflow untouched