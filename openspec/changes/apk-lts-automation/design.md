# Design: APK LTS Automation

## Technical Approach

Two deliverables sharing one version source: (1) an ADD-only `upload-lts` job in `.github/workflows/android-apk.yml` mirroring the proven manual curl recipe to upsert `timberman.apk` + `version.txt` to the Supabase `apk` bucket on main pushes, failing soft on upload errors so `release` is never blocked; (2) version display from the existing `APP_VERSION` constant (splash, login/register) plus a live fetch in `install.html` with hardcoded `v0.1.4` fallback. Covers both delta specs.

## Architecture Decisions

### Decision: Retry — bash loop over curl

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `actions/retry` composite | Third-party dep; less control over warn+`exit 0` | Rejected |
| Bash loop (3 attempts, backoff) | Zero deps; matches workflow's bash style; exact final-failure `::warning::` + `exit 0` | **Chosen** |

### Decision: version.txt source

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Re-read `client/package.json` | Duplicate resolution; could drift from the built APK | Rejected |
| `${{ needs.build-apk.outputs.version }}` | Single resolution; matches APK + release tag; no checkout | **Chosen** |

### Decision: Upload trigger gate

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `github.ref == 'refs/heads/main'` only | Dispatch re-run upserts a stale APK over LTS | Rejected |
| `event_name == 'push' && ref == 'refs/heads/main'` | Dispatch re-runs never clobber LTS; dispatch still exercises build+release | **Chosen** |

### Decision: Fail-loud vs fail-soft

Secret gate = separate hard-fail step (mirrors build-apk's `Gate on required secrets` — spec "Missing Supabase secrets fail loudly"). Uploads retry 3× then `::warning::` + `exit 0` (spec "Upload Failure Policy"). Fail-soft covers upload network errors only, never misconfiguration.

### Decision: No checkout

`upload-lts` consumes only the artifact + build-apk outputs; secrets via env. Faster, no version drift.

## Data Flow

    main push ──▶ build-apk ──▶ artifact Timberman.apk + outputs.version
                     │  ├──▶ release (untouched, never blocked)
                     │  └──▶ upload-lts: download → gate → version.txt
                     │         → retry-curl version.txt, APK (warn+exit 0)
                     ▼
        bucket apk (public) ◀── timberman.apk + version.txt
        install.html fetch(version.txt) → live; fallback v0.1.4

## CI Job Design

`upload-lts` — `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `needs: build-apk`, `runs-on: ubuntu-latest`, no checkout. Steps (ids): `download-apk` (download-artifact@v4, name `Timberman.apk`, path `release`); `gate-on-supabase-secrets` (`::error::` + `exit 1` if either secret empty → uploads nothing); `write-version-txt` (`printf '%s' "${{ needs.build-apk.outputs.version }}" > version.txt` — no `v`, no newline); `upload-version-txt` and `upload-apk` via a shared retry wrapper:

```bash
retry_upload() { local file="$1" ctype="$2" url="$3"
  for i in 1 2 3; do
    if curl -fsS -X POST "$url?cacheControl=no-cache" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: $ctype" -H "x-upsert: true" \
      --data-binary "@$file"; then return 0; fi
    [ "$i" -lt 3 ] && sleep $((i * 5))
  done
  echo "::warning::upload-lts failed after 3 attempts: $file — LTS keeps previous version"
  return 0; }
retry_upload version.txt text/plain "$SUPABASE_URL/storage/v1/object/apk/version.txt"
retry_upload release/Timberman.apk application/vnd.android.package-archive "$SUPABASE_URL/storage/v1/object/apk/timberman.apk"
```

`release` keeps no `needs: upload-lts` → parallel sibling, never blocked. Job is ADD-only.

## install.html Dynamic Version

Static HTML keeps `v0.1.4` as default text (the fallback — no empty flash). One inline `<script>` before `</body>`: `const FALLBACK = '0.1.4'`; `fetch` the public `version.txt` URL with an `AbortController` 5s timeout; on `res.ok` → `text().trim()`; if non-empty, set `v{ver}` on both `#install-version` and `#footer-version` (one fetch, two targets); errors/timeouts leave the hardcoded default. No frameworks; CORS open + no CSP verified live.

## In-App Version Display

- `client/src/components/layout/SplashScreen.tsx`: import `APP_VERSION`; add `<span className="splash-version">v{APP_VERSION}</span>` after `.splash-spinner` — inside the overlay, fades with it (per spec).
- `client/src/styles/global.css`: `.splash-version { position: absolute; bottom: 28px; left: 0; right: 0; text-align: center; font-size: 0.8rem; color: #a3b8b5; }` (muted, theme.textoSecundario).
- `client/src/components/auth/LoginPage.tsx`: import `APP_VERSION`; add `<p style={{ textAlign: 'center', color: theme.textoSecundario, fontSize: 12, marginTop: 24 }}>v{APP_VERSION}</p>` after the tab/form block, outside the tab conditional → visible on both tabs.
- Native splash untouched (static PNG); `client/capacitor.config.ts` unchanged.

## README Changes

- Secrets list ("Android APK (sideload)"): add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- "Manual upload to the LTS bucket" → "Automated upload (CI)": `upload-lts` primary; dashboard + curl retained as emergency fallback; note `version.txt` upserted per release and `/install` reads it live.
- Keep `Cache-Control: no-cache` + `application/vnd.android.package-archive` requirements.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Workflow | YAML validity, ADD-only diff | `npx actionlint`; `git diff` vs main; run on main push |
| CI behavior | Objects current | After main push: `curl` both public URLs; `version.txt` == `client/package.json` version |
| install.html | Live + fallback | `curl` the live URL; Netlify preview throttled/offline → fallback `v0.1.4` |
| App unit | Labels render | `pnpm --filter client test` (extend `LoginPage.test.tsx`; `app-version.test.ts` exists) |
| App build | Imports / types | `pnpm --filter client build` (`tsc && vite build`); screenshot splash + login |
| Server | Unaffected | `pnpm --filter server test` (no server changes) |

Full suite: `pnpm --recursive test`.

## Migration / Rollout

No data migration. Prerequisite: add both GitHub secrets pre-merge (values exist in `server/.env`). Rollout = normal main push.

## Risks & Rollback

| Risk | Mitigation |
|------|------------|
| Secrets missing | Hard-fail gate; pre-merge action item |
| Upload fails 3× | Warning; LTS keeps previous; release unaffected; manual curl |
| Dispatch re-run clobbers LTS | `event_name == 'push'` gate |
| version.txt fetch fails | Static fallback `v0.1.4` |
| Netlify/CI race on first deploy | Visitor briefly sees fallback — acceptable |

Rollback: revert the commit; if a bad upload landed, re-run the README manual curl with the previous APK (upsert only).