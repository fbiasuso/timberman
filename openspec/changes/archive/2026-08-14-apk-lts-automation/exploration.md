# Exploration: APK LTS Automation (dynamic version + CI upload to Supabase)

**Status**: success

## Executive Summary

The APK is already served from a stable public Supabase bucket (`apk/timberman.apk`, verified live: 3.3 MB, `Cache-Control: no-cache`, `Access-Control-Allow-Origin: *`), but upload is manual (README-documented curl) and `install.html` shows a hardcoded `v0.1.4`. This change adds: (1) a `version.txt` object in the bucket + a tiny inline fetch in `install.html` to display the live version, and (2) an ADDED `upload-lts` job in `.github/workflows/android-apk.yml` that uploads APK + version.txt after the build. The existing `release` job stays untouched (hard constraint). **Two prerequisites discovered**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are NOT yet GitHub secrets (verified via `gh secret list` — only the 4 keystore secrets exist), and the archived `apk-lts-distribution` spec currently REQUIRES the workflow to have zero diff — the delta spec must MODIFY that requirement.

## Workflow Map — `.github/workflows/android-apk.yml` (only workflow in repo)

Triggers: `push` to `main` + `workflow_dispatch`. Concurrency `android-apk-${{ github.ref }}` with `cancel-in-progress: true`. Top-level `permissions: contents: read`.

| Job | Key steps (ids) | Artifact/notes |
|-----|-----------------|----------------|
| `build-apk` | `actions/checkout@v4` → pnpm/node setup → `Gate on required secrets` (fails on missing keystore secrets) → `Install dependencies` → `Build client` → `Sync Capacitor Android` → `Materialize signing keystore` → `Assemble release APK` (workdir `client/android`, `./gradlew assembleRelease` → `client/android/app/build/outputs/apk/release/app-release.apk`) → `Rename APK to stable asset name` (mv → `Timberman.apk`) → `Upload APK artifact` (upload-artifact@v4, name `Timberman.apk`, retention 30d) → `Resolve version` (**id `version`**, `outputs.version` from `client/package.json`) | outputs: `version` |
| `release` | gated `github.ref == 'refs/heads/main'`, `needs: build-apk`, `permissions: contents: write` → `actions/download-artifact@v4` (name `Timberman.apk` → path `release/`) → `Publish GitHub Release` (softprops/action-gh-release@v2, tag `v${{ needs.build-apk.outputs.version }}`, files `release/Timberman.apk`) | **DO NOT TOUCH** (hard constraint) |

**Where the upload slots in**: NEW job `upload-lts` (ADD only, no edits to existing jobs/steps):
- `if: github.ref == 'refs/heads/main'`, `needs: build-apk`, default permissions (contents: read is enough — no release write needed)
- Steps: `actions/download-artifact@v4` (name `Timberman.apk` → e.g. path `release/`) → write `version.txt` from `${{ needs.build-apk.outputs.version }}` → upload APK (curl) → upload version.txt (curl)
- Alternative (NOT recommended): append steps to `release` job after `Publish GitHub Release` (APK already on disk at `release/Timberman.apk`) — but that modifies the release job, violating the hard constraint.

## Version Sources

| File | Field | Current value |
|------|-------|---------------|
| `client/package.json` | `version` | `0.1.4` (drives workflow `version` output + `v{version}` release tag) |
| `client/android/app/build.gradle` | `versionCode` / `versionName` | `5` / `"0.1.4"` |

No `version.txt` exists anywhere; no version-generation step (grep for `version.txt|versionName|versionCode` across `.github` + `client/android` → only build.gradle matches).

## install.html — `client/public/install.html` (fully static, 150 lines)

- Download button: `<a class="boton-descarga" href="https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/timberman.apk">Descargar Timberman.apk</a>` (line 101)
- Version elements to make dynamic:
  - `<p class="version">v0.1.4</p>` (line 105)
  - `<footer>Versión estable v0.1.4</footer>` (line 146)
- Scripts: NO `<script>` tags at all, no CSP meta, single inline `<style>`. No existing fetch. Netlify serves it with `Cache-Control: public,max-age=0,must-revalidate` and NO CSP header (verified live) → a small inline `<script>` doing `fetch(version.txt public URL)` is feasible.
- **Fetch feasibility: VERIFIED** — live HEAD on the bucket returned `Access-Control-Allow-Origin: *`; Supabase Storage public endpoints allow cross-origin reads. Public version.txt URL pattern: `https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/version.txt`.
- Page is copied to `dist` by Vite's default `publicDir` (no override in `client/vite.config.ts`), then published by Netlify.

## Upload Mechanics (proven recipe + version.txt variant)

Secrets (GitHub): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — values exist in `server/.env` (names confirmed; values NOT read). Both must be ADDED as repo secrets (verified absent today).

```bash
# APK (proven working recipe)
curl -X POST "$SUPABASE_URL/storage/v1/object/apk/timberman.apk?cacheControl=no-cache" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/vnd.android.package-archive" \
  -H "x-upsert: true" \
  --data-binary "@release/Timberman.apk"

# version.txt (new object, plain text)
echo "0.1.4" > version.txt   # content from ${{ needs.build-apk.outputs.version }}
curl -X POST "$SUPABASE_URL/storage/v1/object/apk/version.txt?cacheControl=no-cache" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: text/plain" \
  -H "x-upsert: true" \
  --data-binary "@version.txt"
```

Notes: use `x-upsert: true` header + `cacheControl=no-cache` query param (the working recipe); README currently documents the older `?upsert=true` form — equivalent, but keep the proven one in CI. `version.txt` content should be bare `0.1.4` (trim trailing newline on the client or accept it — recommend trimming in the fetch code).

## README / Docs Needing Update

- `README.md` — "Android APK (sideload)": (a) required-secrets list (lines 105-109) gains `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; (b) "Manual upload to the LTS bucket" section (lines 121-138) becomes "automated" (curl stays as manual fallback) and gains `version.txt`; (c) line 115 mentions "manual" flow implicitly — refresh wording.
- `openspec/specs/apk-lts-distribution/spec.md` — REQUIRED updates at archive: "GitHub Releases Untouched" requirement (workflow-zero-diff scenario) must be MODIFIED to "release job/steps untouched, upload job ADDED"; "README LTS Distribution Documentation" MODIFIED (manual → automated); ADDED requirements for dynamic version + version.txt. Delta spec must carry these MODIFIED/ADDED blocks.
- Archived design `openspec/changes/archive/2026-08-14-apk-lts-hosting/design.md` D3 explicitly deferred CI upload ("not in scope") — this change closes that (history only, no edit).
- `install.html` itself (the two elements + inline script).

## Netlify Deploy Mechanism

`netlify.toml` (repo root): `base = "client"`, `command = "pnpm install --frozen-lockfile && pnpm build"`, `publish = "dist"`; redirects `/install` → `/install.html` (status 200) before the SPA wildcard. **No Netlify workflow in `.github/`** → Netlify is connected DIRECTLY to GitHub (deploys on push to main via Netlify's integration), independent of the GitHub Actions run. Same main push triggers both: GH Actions builds/upload APK, Netlify deploys the page. No build-time race (version fetch is client-side at render time), but a visitor during the window before version.txt lands sees the fallback text.

## Risks / Edge Cases

- **Missing secrets**: `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` absent in GitHub today → upload job MUST fail loudly (mirror the existing "Gate on required secrets" pattern) or it will be silently skipped; document secret setup as a pre-merge action item.
- **Workflow re-run overwrites**: `cancel-in-progress: true` + upsert means a re-run of an OLD commit re-uploads an OLD APK over the new one (same risk profile as the existing softprops release overwrite). Mitigate: gate `upload-lts` to `github.ref == 'refs/heads/main'` AND consider `github.event_name == 'push'` so `workflow_dispatch` re-runs don't clobber LTS (design decision — the release job's tag overwrite already behaves this way).
- **Artifact across jobs**: `upload-lts` must re-download via `actions/download-artifact@v4` (same pattern as `release`); retention-days 30 is fine within a run.
- **version.txt fetch failure**: page must keep a static fallback (current default text) when fetch fails/404s, and trim whitespace; `cacheControl=no-cache` on version.txt so browsers revalidate.
- **Hard constraint**: do NOT touch `release` job or its steps; do NOT gate/delay releases on the upload.
- **CSP/CORS**: verified no CSP on Netlify response and `Access-Control-Allow-Origin: *` on the bucket — no blockers found; re-verify after implementation.
- **Spec drift**: archived spec's "workflow file unchanged" scenario will FAIL `git diff` check once the upload job lands — the delta spec MUST MODIFY that requirement (releases preserved, workflow gains an additive job).

## Next Recommended

`sdd-propose` — scope: (1) add `upload-lts` job (ADD-only), (2) `version.txt` object + curl upload, (3) install.html inline fetch with fallback, (4) README + spec delta updates, (5) action item: add the two GitHub secrets. Flag the spec-drift requirement MODIFICATION explicitly in the proposal.

## Skill Resolution

paths-injected — sdd-explore + work-unit-commits (exact paths from orchestrator); shared refs `_shared/sdd-phase-common.md` + `_shared/openspec-convention.md` loaded.