# Design: LTS APK Hosting on Supabase Storage

## Technical Approach

Two static files, zero runtime code. The APK already lives at a stable public URL in Supabase Storage (`apk/timberman.apk`, upserted per release, Cache-Control: no-cache). `client/public/install.html` swaps its download href to that LTS URL and drops its GitHub footer link; `README.md` documents the LTS flow and the manual upload procedure. GitHub Releases remain published as internal backup; the workflow is not touched (user decision). Satisfies spec 1:1.

## Architecture Decisions

| # | Decision | Choice | Alternatives / Rationale |
|---|----------|--------|--------------------------|
| D1 | Canonical download source | Public Supabase bucket URL on `/install` | GitHub release asset rejected for end users: exposes GitHub; releases are backup only. Bucket is public by design; object path is stable across releases |
| D2 | No workflow change | `.github/workflows/android-apk.yml` untouched; releases keep publishing on every main push | Alternative: point the workflow at the bucket or delete releases — rejected. Keeps CI history and rollback safety; bucket upload is manual by decision |
| D3 | Upload procedure | Manual per release: dashboard or Storage API curl with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `server/.env`, upsert at `apk/timberman.apk` with `Cache-Control: no-cache` and `application/vnd.android.package-archive` | Automated CI upload rejected for now (deliberately small change; upload stays with the release owner alongside the version bump) |
| D4 | Freshness | Cache-Control: no-cache on the object so browsers revalidate and never serve a stale APK after an upsert | Bucket default caching could serve old builds to new installs |

## Data Flow

```
release build (workflow, unchanged) ──> signed APK ──> GitHub Release (backup)
      │
      └─(manual upload, per release)─> Supabase Storage apk/timberman.apk (LTS URL)
                                             │
/install button ──> GET …/object/public/apk/timberman.apk ──> user sideloads
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/public/install.html` | Modify | Download href → LTS URL (~line 95); remove footer GitHub link (~line 138) |
| `README.md` | Modify | Rewrite "Android APK (sideload)": LTS URL + manual upload (dashboard + curl) + Cache-Control/content-type; keep keystore custody + version-bump cadence |

## Interfaces / Contracts

LTS URL (stable contract — object overwritten via upsert per release):

```
https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/timberman.apk
```

Upload command (documented in README; run from repo root with `server/.env` loaded):

```bash
curl -X POST "$SUPABASE_URL/storage/v1/object/apk/timberman.apk?upsert=true" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/vnd.android.package-archive" \
  -H "Cache-Control: no-cache" \
  --data-binary @client/android/app/build/outputs/apk/release/app-release.apk
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Verification (manual) | `install.html` | Grep `github.com/fbiasuso/timberman` → 0 matches; href equals LTS URL; `vite build` still copies the page |
| Verification (manual) | README | Review: LTS URL, dashboard + curl upload options, Cache-Control/content-type, cadence + keystore custody kept |
| Regression | Scope guard | `git diff` lists only `install.html` + `README.md` — workflow untouched |
| E2E (manual) | Download | Open `/install` on Android; tap button; APK downloads from Supabase and installs over the previous version |

## Migration / Rollout

No migration — static change. Rollout = normal PR; rollback = revert (2 files).

## Open Questions

- [ ] None blocking. (Future: automate bucket upload in CI — deferred, not in scope.)
