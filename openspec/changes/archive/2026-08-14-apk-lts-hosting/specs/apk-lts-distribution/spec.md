# Delta for APK LTS Distribution

## ADDED Requirements

### Requirement: LTS Download Link on Install Page

The `/install` page download button MUST link to the stable LTS APK URL `https://uwjcgmitaedkawgaqrfk.supabase.co/storage/v1/object/public/apk/timberman.apk` and MUST NOT link to GitHub Releases.

#### Scenario: Button downloads from the LTS bucket

- GIVEN the deployed `/install` page
- WHEN the user taps the download button
- THEN the request hits the public Supabase bucket URL and returns the APK

#### Scenario: No GitHub fallback link

- GIVEN the `/install` page source
- WHEN it is scanned for `github.com/fbiasuso/timberman`
- THEN no match is found

### Requirement: GitHub-Free Install Page

The `/install` page MUST NOT contain any GitHub Releases link; the footer link "Ver todas las versiones publicadas" MUST be removed.

#### Scenario: Footer link removed

- GIVEN the updated `/install` page
- WHEN the footer renders
- THEN no GitHub releases link is present

### Requirement: README LTS Distribution Documentation

The README "Android APK (sideload)" section MUST document the LTS bucket URL as the download source and the manual per-release upload procedure — via dashboard or Storage API (curl with service role key) — and MUST specify `Cache-Control: no-cache` and content type `application/vnd.android.package-archive` for the object.

#### Scenario: Upload via Storage API

- GIVEN `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`
- WHEN the documented curl upsert runs with the APK
- THEN the object is overwritten at `apk/timberman.apk` with `Cache-Control: no-cache`

#### Scenario: Upload via dashboard

- GIVEN the Supabase dashboard
- WHEN the operator uploads the new APK to bucket `apk` at path `timberman.apk`
- THEN the object replaces the previous one at the same stable URL

#### Scenario: Version-bump cadence preserved

- GIVEN a new release
- WHEN the README instructions are followed
- THEN the version bump precedes the upload and the LTS URL stays unchanged

### Requirement: GitHub Releases Untouched

The `android-apk` GitHub Actions workflow and the existing GitHub Releases MUST remain unchanged; this change MUST NOT modify `.github/workflows/android-apk.yml` or delete releases.

#### Scenario: Workflow file unchanged

- GIVEN the applied change
- WHEN `git diff` is inspected against `main`
- THEN `.github/workflows/android-apk.yml` has no diff

#### Scenario: Releases preserved as backup

- GIVEN published GitHub Releases
- WHEN this change lands
- THEN they remain published and are never linked from `/install`