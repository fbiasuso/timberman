# Android APK Distribution — Specification

## Purpose

Packages the existing React client as a Capacitor 8 Android WebView, distributed as a sideloaded, keystore-signed release APK. The web deployment and the server are untouched; Play Store, push notifications, and the forced-update mechanism are out of scope (the central version constant is its future hook).

## Requirements

### Requirement: Capacitor WebView Shell

The client MUST include Capacitor 8 dependencies and a `capacitor.config.ts` declaring appId `com.timberman.prode`, appName `Timberman`, and webDir `dist`, plus `cap:sync` and `build:android` scripts. The generated `client/android/` project MUST be committed so a clean checkout builds without re-running `cap add`.

#### Scenario: Sync from clean checkout

- GIVEN a clean checkout with Capacitor deps configured
- WHEN `pnpm --filter client exec cap sync android` runs
- THEN the committed `client/android/` Gradle project is generated/updated

#### Scenario: App identity

- GIVEN the installed APK
- WHEN its manifest is inspected
- THEN applicationId is `com.timberman.prode` and label is `Timberman`

### Requirement: WebView Asset Loading

The APK's client build MUST emit assets that resolve under the Capacitor local server origin (`https://localhost`). The existing web build MUST keep working.

#### Scenario: Assets load in the WebView

- GIVEN an APK built from the client
- WHEN the app launches
- THEN the entry page and its assets load without 404s

#### Scenario: Web deployment unchanged

- GIVEN the same build served on Netlify
- WHEN a browser loads it
- THEN pages and assets render as before

### Requirement: Build-Time API URL

The APK build MUST compile the client with `VITE_API_URL` set to the production HTTPS API. The CI APK build MUST fail when `VITE_API_URL` is absent, so an APK using the `/api` fallback is never produced.

#### Scenario: HTTPS API embedded

- GIVEN `VITE_API_URL` set to the production HTTPS URL
- WHEN the APK build runs
- THEN all runtime API traffic targets HTTPS with no cleartext configuration

#### Scenario: Missing VITE_API_URL fails the build

- GIVEN `VITE_API_URL` unset
- WHEN the CI APK build runs
- THEN the build fails and no APK artifact is uploaded

### Requirement: Back-Button Navigation

The app MUST use `@capacitor/app` so the hardware back button navigates in-app history when present and exits the app at the root route.

#### Scenario: Back navigates history

- GIVEN the user navigated to an inner route
- WHEN the back button is pressed
- THEN the previous route renders

#### Scenario: Back at root exits

- GIVEN the app at the root route
- WHEN the back button is pressed
- THEN the app exits without in-app navigation

### Requirement: Signed Release APK Pipeline

A GitHub Actions workflow MUST build and sign a release APK on push and manual dispatch: Node 22, frozen pnpm install, `VITE_API_URL`, `cap sync android`, JDK 21 with Android SDK licenses, and `assembleRelease` signed with the release keystore from GitHub secrets, uploading the signed APK as an artifact. The workflow MUST fail, producing no artifact, when the keystore secrets are absent.

#### Scenario: Signed APK from a push

- GIVEN keystore secrets configured in GitHub
- WHEN the workflow runs on a push
- THEN a release APK signed with the release keystore is uploaded as an artifact

#### Scenario: Keystore absent fails loudly

- GIVEN the keystore secret is missing
- WHEN the workflow runs
- THEN it fails with a clear error and no unsigned APK is uploaded

#### Scenario: In-place updates preserve data

- GIVEN an installed APK signed with the release keystore
- WHEN a newer APK with the same signature is installed
- THEN it updates in place without uninstalling

### Requirement: Central App-Version Constant

The client MUST expose the app version through a single central constant used by the APK packaging, serving as the hook for a future forced-update check against a server minimum. Each release MUST bump this version.

#### Scenario: Version constant present

- GIVEN the client source
- WHEN the central constant is read
- THEN it returns the current release version

### Requirement: Install Landing Page

The Netlify site MUST serve a mobile-friendly `/install` page with sideload instructions (allow unknown sources, download, open) and a link to the latest signed release APK.

#### Scenario: Page reachable on mobile

- GIVEN the deployed Netlify site
- WHEN a mobile browser opens `/install`
- THEN instructions and the APK download link render

#### Scenario: Unknown-sources warning

- GIVEN a user following the install steps
- WHEN they open the downloaded APK
- THEN Android shows the unknown-sources warning and installation proceeds after acceptance

### Requirement: No Regressions to the Web Client

The Capacitor additions MUST NOT break the existing client tests or web build; the Netlify build and deploy MUST remain unchanged.

#### Scenario: Test suite green

- GIVEN the branch with Capacitor changes
- WHEN `pnpm --filter client test` runs
- THEN all existing tests pass

#### Scenario: Web build green

- GIVEN the branch with Capacitor changes
- WHEN `pnpm --filter client build` runs
- THEN `tsc` and `vite build` succeed
