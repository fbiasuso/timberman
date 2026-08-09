# Delta for Team Image Hosting

## MODIFIED Requirements

### Requirement: Shield Acquisition

When a team is created or seeded with a remote shield URL, the system MUST download the image once, validate it through the shared write path (magic-byte sniff PNG/JPEG/WebP, 1 MiB cap), and store it through the active storage backend. The team MUST persist the resolved logo value: full public URL (Supabase) or relative path (local). Failed download, invalid type, or oversized image MUST NOT block team creation: the team is created with logo null and the failure logged.
(Previously: always stored under public/logos/ with relative path persisted)

#### Scenario: Valid shield stored

- GIVEN a team being created with a remote shield URL
- WHEN the download succeeds and the image validates
- THEN the file is stored through the active backend
- AND the team persists the resolved logo value

#### Scenario: Invalid image type does not block creation

- GIVEN a team whose shield URL returns an HTML page
- WHEN the download finishes
- THEN the team is created with logo null
- AND the failure is logged

#### Scenario: Oversized image does not block creation

- GIVEN a team whose shield exceeds the 1 MiB cap
- WHEN the image is validated
- THEN the team is created with logo null

#### Scenario: Unreachable URL does not block creation

- GIVEN a team whose shield URL is unreachable
- WHEN the download fails
- THEN the team is created with logo null
- AND the creation response succeeds

### Requirement: Shield Serving

The system MUST serve shields through the active backend: static assets under public/logos/ with long-lived cache headers (local), or public bucket `logos` URLs with cache-control `30d` non-immutable (Supabase). teams.logo MAY store a full public URL or a relative local path; both MUST be accepted downstream.
(Previously: served only from public/logos/; DB stored only relative paths)

#### Scenario: Shield served with cache

- GIVEN a stored shield file under public/logos/
- WHEN the logo URL is requested
- THEN the file is returned with long-lived cache headers

#### Scenario: Supabase URL served with 30d cache

- GIVEN a shield uploaded to bucket logos
- WHEN its public URL is requested
- THEN it is returned with cache-control 30d non-immutable

## ADDED Requirements

### Requirement: Storage Backend Selection

The system MUST select the image storage backend from `IMAGE_STORAGE`: `local` (default) uses LocalFileImageService; `supabase` uses SupabaseImageService on public bucket `logos`. Invalid supabase configuration MUST fail soft to local with a clear log.

#### Scenario: Local backend default

- GIVEN IMAGE_STORAGE unset
- WHEN the server starts
- THEN LocalFileImageService serves public/logos/

#### Scenario: Supabase backend opt-in

- GIVEN IMAGE_STORAGE=supabase with valid credentials
- WHEN the server starts
- THEN SupabaseImageService targets bucket logos

### Requirement: Buffer Store Operation

The ImageService port MUST expose `storeFromBuffer(bytes, teamId): Promise<string|null>`, validating bytes by magic-byte sniff (PNG/JPEG/WebP) and the 1 MiB cap, storing through the active backend and returning the resolved logo value, or null on any failure, and MUST never throw. `downloadAndStore` MUST reuse the same validated write path.

#### Scenario: Valid buffer stored

- GIVEN a PNG buffer under 1 MiB
- WHEN storeFromBuffer is called with a teamId
- THEN the logo value is returned and the file is stored

#### Scenario: Invalid type returns null

- GIVEN a text buffer
- WHEN storeFromBuffer is called
- THEN null is returned and nothing is stored

#### Scenario: Oversized buffer returns null

- GIVEN a buffer over 1 MiB
- WHEN storeFromBuffer is called
- THEN null is returned and nothing is stored

### Requirement: Seed Shields Population

The seed-shields script MUST resolve each seeded team's shield via Wikimedia (es.wikipedia.org pageimages, pithumbsize 256) with TheSportsDB (searchteams.php?t={name}) as fallback, store it through the active backend, and update teams.logo. Re-runs MUST skip teams with a logo unless `--force`; unresolvable teams MUST be reported without failing the script.

#### Scenario: Wikimedia primary resolution

- GIVEN a team with a Wikimedia page
- WHEN the seed script resolves its shield
- THEN the shield is stored and teams.logo is updated

#### Scenario: TheSportsDB fallback

- GIVEN a team with no Wikimedia thumbnail
- WHEN the seed script resolves its shield
- THEN the TheSportsDB badge is used instead

#### Scenario: Existing logo skipped

- GIVEN a team whose logo is already set
- WHEN the seed script runs
- THEN the team is skipped and its logo is untouched

#### Scenario: Force re-syncs

- GIVEN a team with an existing logo
- WHEN the seed script runs with --force
- THEN the logo is re-resolved and re-stored

#### Scenario: Unresolved reported

- GIVEN a team with no resolvable shield anywhere
- WHEN the seed script runs
- THEN the team is listed as unresolved and the script completes
