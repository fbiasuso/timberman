# Tasks: APK LTS Automation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~170 (WU1 ~135, WU2 ~35) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR, 4 work-unit commits |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | LTS automation: `upload-lts` job + dynamic install.html + README | PR 1 | Base main; commits: ci job, then install+docs |
| 2 | In-app version display: splash + login/register + tests | PR 1 | Independent files, same PR; commits: splash, then login+test |

Dependencies: Phases 1→2→4.1 sequential; Phase 3 parallel to Phases 1–2 (disjoint files); 3.3 → 3.4; 4.2 last.

## Phase 1: CI — upload-lts Job

- [x] 1.1 Add ADD-only `upload-lts` job to `.github/workflows/android-apk.yml` (design step ids `download-apk`, `gate-on-supabase-secrets`, `write-version-txt`, `upload-version-txt`, `upload-apk`): `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `needs: build-apk`, no checkout; download-artifact@v4 → `release/Timberman.apk`; gate `::error::` + `exit 1` when either Supabase secret empty; `printf '%s' "${{ needs.build-apk.outputs.version }}" > version.txt`; shared `retry_upload()` bash loop (3 attempts, `sleep $((i*5))`, final `::warning::` + `return 0`) uploading version.txt (`text/plain`) then APK (`application/vnd.android.package-archive`) to `$SUPABASE_URL/storage/v1/object/apk/{file}?cacheControl=no-cache` with `x-upsert: true`. Verify: `npx actionlint .github/workflows/android-apk.yml`; `git diff main --` shows only the new job (release untouched); feature-branch dispatch skips it.

## Phase 2: install.html Dynamic Version

- [x] 2.1 `client/public/install.html`: give the `.version` `<p>` `id="install-version"` (keep `v0.1.4` text) and wrap footer "Versión estable v0.1.4" in `id="footer-version"`.
- [x] 2.2 Add inline `<script>` before `</body>` (design "install.html Dynamic Version"): `FALLBACK = '0.1.4'`; fetch public `version.txt` URL, `AbortController` 5s timeout; on `res.ok` → `text().trim()`, if non-empty set `v{ver}` on both ids; errors/timeouts keep default. Verify: live URL serves trimmed version; offline/throttled → fallback `v0.1.4`.

## Phase 3: In-App Version Display

- [x] 3.1 `client/src/components/layout/SplashScreen.tsx`: import `APP_VERSION` from `../../constants/app-version`; add `<span className="splash-version">v{APP_VERSION}</span>` after `.splash-spinner` (inside overlay — fades with it).
- [x] 3.2 `client/src/styles/global.css`: add `.splash-version { position: absolute; bottom: 28px; left: 0; right: 0; text-align: center; font-size: 0.8rem; color: #a3b8b5; }` (muted, theme.textoSecundario).
- [x] 3.3 `client/src/components/auth/LoginPage.tsx`: import `APP_VERSION`; add `<p style={{ textAlign: 'center', color: theme.textoSecundario, fontSize: 12, marginTop: 24 }}>v{APP_VERSION}</p>` after the tab/form block, outside the tab conditional (visible on both tabs).
- [x] 3.4 Extend `client/src/components/__tests__/LoginPage.test.tsx`: assert `v{APP_VERSION}` visible on login tab and still after switching to register tab (spec "Version on login tab"/"register tab"). Verify: `pnpm --filter client test` + `pnpm --filter client build`.

## Phase 4: README + Final Verification

- [x] 4.1 README "Android APK (sideload)": add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to secrets list; retitle "Manual upload to the LTS bucket" → "Automated upload (CI)" — `upload-lts` primary, dashboard + curl emergency fallback, `version.txt` upserted per release, `/install` reads it live; keep `Cache-Control: no-cache` + `application/vnd.android.package-archive`.
- [x] 4.2 Final: `pnpm --filter client test`, `pnpm --filter server test`, `pnpm --filter client build`, `pnpm --recursive test`, `npx actionlint`; screenshots splash + login; post-main-push `curl` both public URLs (version.txt == package.json version).