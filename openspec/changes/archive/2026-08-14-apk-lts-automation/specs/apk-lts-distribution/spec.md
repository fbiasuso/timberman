# Delta for APK LTS Distribution

## MODIFIED Requirements

### Requirement: README LTS Distribution Documentation

The README "Android APK (sideload)" section MUST document the LTS bucket URL as the download source, the automated CI upload as the primary per-release procedure, the manual upload (dashboard or Storage API curl with service role key) as the documented emergency fallback, and the required GitHub secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; it MUST specify `Cache-Control: no-cache` and content type `application/vnd.android.package-archive` for the APK object.
(Previously: the README documented only a manual per-release upload — dashboard or Storage API curl — as the primary procedure, with no CI upload or secrets list.)

#### Scenario: Automated upload documented as primary

- GIVEN the README "Android APK (sideload)" section
- WHEN a new release is prepared
- THEN the CI upload is described as the primary path and the Supabase GitHub secrets are listed

#### Scenario: Manual curl as emergency fallback

- GIVEN `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`
- WHEN the documented curl upsert runs with the APK
- THEN the object is overwritten at `apk/timberman.apk` with `Cache-Control: no-cache`

#### Scenario: Upload via dashboard as fallback

- GIVEN the Supabase dashboard
- WHEN the operator uploads a new APK to bucket `apk` at path `timberman.apk`
- THEN the object replaces the previous one at the same stable URL

#### Scenario: Version-bump cadence preserved

- GIVEN a new release
- WHEN the README instructions are followed
- THEN the version bump precedes the upload and the LTS URL stays unchanged

### Requirement: GitHub Releases Untouched

The `release` job and its steps in the `android-apk` GitHub Actions workflow, and the existing GitHub Releases, MUST remain unchanged; this change MUST NOT modify any `release` job step or delete releases. The workflow MAY gain the ADD-only `upload-lts` job. The `release` job MUST NOT be gated or blocked by the upload job.
(Previously: the entire `android-apk` workflow file was required to remain unchanged with zero diff.)

#### Scenario: Release job untouched

- GIVEN the applied change
- WHEN `git diff` is inspected against `main`
- THEN the workflow diff touches only the ADDED `upload-lts` job and no `release` step is modified

#### Scenario: Release never blocked by the upload

- GIVEN a main push
- WHEN the workflow runs
- THEN the `release` job publishes regardless of the `upload-lts` outcome

#### Scenario: Releases preserved as backup

- GIVEN published GitHub Releases
- WHEN this change lands
- THEN they remain published and are never linked from `/install`

## ADDED Requirements

### Requirement: CI Upload Job (upload-lts)

The `android-apk` workflow MUST include an ADD-only `upload-lts` job that runs only on pushes to `main` (`github.ref == 'refs/heads/main'`), depends on `build-apk`, downloads the `Timberman.apk` artifact, writes `version.txt` from `needs.build-apk.outputs.version`, and uploads the APK and `version.txt` to bucket `apk` via the Supabase Storage API using the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets with `x-upsert: true` and `cacheControl=no-cache`.

#### Scenario: Main push uploads both objects

- GIVEN a push to `main` and both Supabase secrets configured
- WHEN the workflow run reaches `upload-lts`
- THEN `apk/timberman.apk` and `apk/version.txt` are upserted at their stable public URLs

#### Scenario: Feature-branch dispatch does not upload

- GIVEN a `workflow_dispatch` run on a non-main branch
- WHEN the workflow runs
- THEN `upload-lts` is skipped and the LTS objects are not overwritten

#### Scenario: Missing Supabase secrets fail loudly

- GIVEN `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` absent
- WHEN `upload-lts` runs
- THEN it fails with a clear error and uploads nothing

### Requirement: version.txt Object

The public bucket MUST expose a `version.txt` object — plain text containing only the version (e.g. `0.1.4`) — upserted on every main push with `x-upsert: true` and `cacheControl=no-cache`, readable at `https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/version.txt`.

#### Scenario: Version matches package.json

- GIVEN a main push with `client/package.json` at version `0.1.4`
- WHEN `upload-lts` writes `version.txt`
- THEN its content is exactly `0.1.4`

#### Scenario: Stale version never served

- GIVEN the object with `cacheControl=no-cache`
- WHEN a browser requests it
- THEN the response instructs revalidation so the latest version is served

### Requirement: Upload Failure Policy

The `upload-lts` job MUST retry each upload up to 2 times (3 attempts total); on final failure it MUST log a warning and complete without failing the workflow, leaving the LTS objects at their previous version for a later manual upload or the next release. The `release` job MUST NOT be modified, gated, or blocked by the upload outcome.

#### Scenario: Transient failure recovers

- GIVEN the first upload attempt fails transiently
- WHEN the retry runs
- THEN the upload succeeds within 3 attempts and both objects are current

#### Scenario: Final failure defers to manual/next release

- GIVEN 3 failed attempts
- WHEN the job finishes
- THEN it logs a warning, exits successfully, the release still publishes, and the LTS objects keep the previous version

### Requirement: Dynamic Version on Install Page

The `/install` page MUST fetch the `version.txt` public URL and render the returned version under the download button and in the footer, replacing the hardcoded value; when the fetch fails it MUST render a hardcoded last-known version in both places.

#### Scenario: Live version rendered

- GIVEN the deployed `/install` page and `version.txt` reachable
- WHEN the page loads
- THEN the version under the download button and in the footer equals the fetched value (trimmed)

#### Scenario: Fetch failure falls back

- GIVEN `version.txt` unreachable
- WHEN the page loads
- THEN both version locations render the hardcoded last-known version