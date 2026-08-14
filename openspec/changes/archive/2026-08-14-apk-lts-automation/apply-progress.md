# Apply Progress: APK LTS Automation

**Mode**: Standard (strict_tdd: false — no TDD module loaded; standard workflow per sdd-apply Step 4).
**Branch**: `feat/apk-lts-automation` (from `origin/main` @ 549a8b0)
**Status**: All 9 tasks complete (2 batches: this is the only batch). Ready for verify.

## Work Units (commits)

| # | Commit | SHA | Tasks | Files |
|---|--------|-----|-------|-------|
| 0 | `docs(openspec): add apk-lts-automation change planning artifacts` | 06363f5 | — (repo convention) | openspec planning artifacts |
| 1 | `feat(ci): add upload-lts job` | 82377a3 | 1.1 | `.github/workflows/android-apk.yml` |
| 2 | `feat(install): live version + README LTS docs` | d3cc506 | 2.1, 2.2, 4.1 | `client/public/install.html`, `README.md` |
| 3 | `feat(client): version on splash` | 92c62b0 | 3.1, 3.2 | `SplashScreen.tsx`, `global.css` |
| 4 | `feat(client): version on auth screens` | 4f06509 | 3.3, 3.4 | `LoginPage.tsx`, `LoginPage.test.tsx` |

## Task Status

- [x] 1.1 — `upload-lts` job added, ADD-only. Steps: `download-apk` (download-artifact@v4 → `release/Timberman.apk`), `gate-on-supabase-secrets` (`::error::` + `exit 1` when either Supabase secret empty), `write-version-txt` (`printf '%s'` — no `v`, no newline), `upload-version-txt` + `upload-apk` via shared `retry_upload()` bash (3 attempts, `sleep $((i*5))` backoff, final `::warning::` + `return 0`). `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `needs: build-apk`, no checkout. `release` untouched, never gated. Verified: actionlint exit 0; `git diff origin/main` shows only the added job.
- [x] 2.1 — `id="install-version"` on `.version` `<p>` (kept `v0.1.4` text); footer version wrapped `<span id="footer-version">v0.1.4</span>` (prefix "Versión estable " preserved — span targets `v{ver}` only).
- [x] 2.2 — inline `<script>` before `</body>`: `FALLBACK = '0.1.4'`, fetch `version.txt` public URL, `AbortController` 5s timeout, `res.ok → text().trim()`, non-empty → sets `v{ver}` on both ids (one fetch, two targets); catch/timeout explicitly re-sets `v0.1.4` (idempotent with static default, uses FALLBACK constant per design).
- [x] 3.1 — `SplashScreen.tsx`: `import { APP_VERSION }`, `<span className="splash-version">v{APP_VERSION}</span>` after `.splash-spinner` (inside overlay, fades with it).
- [x] 3.2 — `global.css`: `.splash-version { position: absolute; bottom: 28px; left: 0; right: 0; text-align: center; font-size: 0.8rem; color: #a3b8b5; }` (theme.textoSecundario, commented).
- [x] 3.3 — `LoginPage.tsx`: `import { APP_VERSION }`; `<p style={{ textAlign: 'center', color: theme.textoSecundario, fontSize: 12, marginTop: 24 }}>v{APP_VERSION}</p>` after tab/form block, outside the tab conditional.
- [x] 3.4 — `LoginPage.test.tsx`: 2 new tests — version visible on login tab; still visible after switching to register tab (via `v${APP_VERSION}`).
- [x] 4.1 — README: secrets list + `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; "Manual upload to the LTS bucket" → "Automated upload (CI)" (upload-lts primary, dashboard + curl emergency fallback, version.txt upserted per release, `/install` reads it live; `Cache-Control: no-cache` + `application/vnd.android.package-archive` kept).
- [x] 4.2 — see Verification below.

## Verification (run on this branch)

| Check | Result |
|-------|--------|
| actionlint v1.7.7 (binary, since `npx actionlint` has no bin) | exit 0 — no warnings |
| `git diff origin/main` workflow | ADD-only: `upload-lts` job appended after `release`; no `release` step touched |
| `pnpm --filter client test` | 21 files / **275 tests passed** (273 before + 2 new) |
| `pnpm --filter server test` | 39 files / **551 tests passed** |
| `pnpm --filter client build` | `tsc && vite build` — built OK (20.8s) |
| `pnpm --recursive test` | server 551 + client 275 = **826 tests passed** |
| Live `timberman.apk` HEAD | HTTP 200, content-type `application/vnd.android.package-archive` ✓ |
| Live `version.txt` GET | HTTP 400 — object does not exist yet (pre-merge). Expected: created by `upload-lts` on next main push. Pre-merge this exercises the fallback path (`v0.1.4`). |

**Deferred to verify phase (cannot run pre-merge / without a device):**
- Screenshots of splash + login (requires running app in browser/emulator).
- Post-main-push `curl` of both public URLs (requires PR merged to main; verify `version.txt` == `client/package.json` `0.1.4`).

## Deviations from Design

1. **`retry_upload` defined per upload step** (duplicated in `upload-version-txt` and `upload-apk`) instead of a single run block with two calls (design bash snippet). Reason: tasks.md mandates step ids `upload-version-txt` AND `upload-apk` as separate steps; bash functions cannot be shared across steps without a composite action. Function body byte-matches the design.
2. **Catch handler re-sets fallback text** explicitly (`v0.1.4`) instead of leaving the static default untouched. Behaviorally identical (same value), but uses the required `FALLBACK` constant so it is not dead code.
3. **`docs(openspec)` commit for planning artifacts** added as commit 0 (repo convention — see `064ea6e`, `apk-lts-hosting`). The 4 orchestrator-specified work-unit commits are exactly as planned; the openspec artifacts were untracked and must land in the PR.
4. **apply-progress + `[x]` marks** bundled into one final `docs(openspec): mark apk-lts-automation tasks complete` commit (repo pattern from capacitor-apk change), rather than one docs commit per slice.

## Issues Found

- `npx --yes actionlint` fails ("could not determine executable to run" — npm package ships no bin). Resolved by downloading the official `actionlint` v1.7.7 Windows binary (exit 0).
- No PR template file exists in this repo (`.github/` contains only `workflows/`); PR body built manually per branch-pr skill format (matches PR #68 style).
- Repo uses `type:feature` / `type:fix` / `type:docs` + `status:approved` labels (not the full branch-pr label set). Using `type:feature` for this PR.

## Files Changed (vs origin/main)

```
 .github/workflows/android-apk.yml           |  84 ++
 README.md                                   |  14 +-
 client/public/install.html                  |  34 ++
 client/src/components/__tests__/LoginPage.test.tsx | 18 +
 client/src/components/auth/LoginPage.tsx    |   3 +
 client/src/components/layout/SplashScreen.tsx |   3 +
 client/src/styles/global.css                |  10 ++
 openspec/changes/apk-lts-automation/*       | 515 +++ (planning artifacts, commit 0)
```
Implementation diff (~170 forecast): 166 additions / 6 deletions across the 7 code+docs files.
