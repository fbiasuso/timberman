# Team Image Hosting — Specification

## Purpose

Self-hosted team shield pipeline: images are downloaded once, validated, stored under `public/logos/`, and served statically with long-lived cache. The DB stores relative paths only; remote hotlinks are eliminated for registered teams while manual URL fallback stays for legacy flows.

## Requirements

### Requirement: Shield Acquisition

When a team is created or seeded with a remote shield URL, the system MUST download the image once, validate its MIME type (must be an image) and size against configured limits, and store it under `public/logos/` with a unique filename. The team MUST persist the relative path. A failed download, invalid MIME, or oversized image MUST NOT block team creation: the team is created with no logo (null) and the failure is logged.

#### Scenario: Valid shield stored

- GIVEN a team being created with a remote shield URL
- WHEN the download succeeds and the image validates
- THEN the file is stored under public/logos/
- AND the team stores the relative path

#### Scenario: Invalid MIME does not block creation

- GIVEN a team being created whose shield URL returns an HTML page
- WHEN the download finishes
- THEN the team is still created with logo null
- AND the failure is logged

#### Scenario: Oversized image does not block creation

- GIVEN a team being created whose shield exceeds the size limit
- WHEN the image is validated
- THEN the team is still created with logo null

#### Scenario: Unreachable URL does not block creation

- GIVEN a team being created whose shield URL is unreachable
- WHEN the download fails
- THEN the team is still created with logo null
- AND the creation response succeeds

### Requirement: Shield Serving

The system MUST serve files under `public/logos/` as static assets with long-lived cache headers. The DB MUST store only relative paths, never full URLs.

#### Scenario: Shield served with cache

- GIVEN a stored shield file under public/logos/
- WHEN the logo URL is requested
- THEN the file is returned with long-lived cache headers

### Requirement: Shield Fallback

Teams MAY have no logo. The match forms and displays MUST fall back to the manual shield URL or no image when a team has no self-hosted logo. Manual URL fallback on matches (legacy `localImg`/`visitorImg`) MUST remain supported.

#### Scenario: No logo renders fallback

- GIVEN a team with no self-hosted logo
- WHEN the match form auto-fills the shield from the team
- THEN the shield field stays empty or uses the manual URL
- AND the match remains saveable

#### Scenario: Manual URL still accepted

- GIVEN a legacy match flow
- WHEN an admin provides a manual shield URL
- THEN the URL is stored and rendered as before
