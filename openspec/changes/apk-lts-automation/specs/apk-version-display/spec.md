# APK Version Display — Specification

## Purpose

Shows the current app version inside the Android APK so users and support can identify the installed release at a glance. The version is read from the existing central constant `APP_VERSION` (`client/src/constants/app-version.ts`, imported from `client/package.json` via `resolveJsonModule`) — no new plumbing mechanism is introduced. The version appears on the splash screen and the login/register screens, styled subtly to match the app's existing dark design language.

## Requirements

### Requirement: Central Version Source

The in-app version displays MUST read from the existing `APP_VERSION` constant exported by `client/src/constants/app-version.ts`, which imports `version` from `client/package.json` via `resolveJsonModule`; this change MUST NOT introduce a new version-plumbing mechanism.

#### Scenario: Constant is the single source

- GIVEN the client source
- WHEN any in-app version text renders
- THEN it derives from `APP_VERSION`, not from a new constant, env var, or hardcoded string

#### Scenario: Version matches package.json

- GIVEN `client/package.json` version `0.1.4`
- WHEN `APP_VERSION` is read
- THEN it equals `0.1.4`

### Requirement: Splash Screen Version

The splash screen MUST display the version as `v{APP_VERSION}` at the bottom center of the screen, rendered by the React overlay (`SplashScreen.tsx` plus `global.css`); the native splash (a static PNG background) MUST NOT be modified.

#### Scenario: Version visible at bottom center

- GIVEN the app is starting
- WHEN the splash overlay renders
- THEN a `v0.1.4`-style label is visible at the bottom center of the screen

#### Scenario: Version fades with the overlay

- GIVEN the splash fading out
- WHEN the overlay hides
- THEN the version label disappears with it and the login screen takes over

### Requirement: Login and Register Screens Version

The login and register screens (tabs of `LoginPage.tsx`) MUST display a small version label, visible on both tabs.

#### Scenario: Version on login tab

- GIVEN the login tab is active
- WHEN the page renders
- THEN the version label is visible

#### Scenario: Version on register tab

- GIVEN the register tab is active
- WHEN the page renders
- THEN the version label remains visible

### Requirement: Subtle Styling

The version labels MUST be styled subtly and consistently with the app's existing design language (small size, muted colors matching the theme tokens); they MUST NOT introduce loud UI.

#### Scenario: Style matches the theme

- GIVEN the rendered version labels
- WHEN they are inspected
- THEN they use muted colors and small sizing consistent with the app's theme tokens