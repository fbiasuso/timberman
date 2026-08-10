# Tournament Management — Specification

## Purpose

Tournament date lifecycle: create, set results, close dates, and start new tournaments with full historical preservation.

## Requirements

### Requirement: Create Tournament Date

An admin MUST be able to create a tournament date via `POST /api/admin/dates` (admin role required), wired to the existing CreateDateUseCase. The system MUST compute `dateNumber` as the maximum existing dateNumber for the tournament plus one, create the date in 'open' status with `betAmount` from system config and `pozo` 0, and reject creation when an 'open' date already exists for the tournament (one betting round at a time). The system MUST reject creation when the tournament's status is not `active`; 'finished' and 'archived' tournaments accept no new dates.

#### Scenario: Create next date after publishing

- GIVEN a tournament whose latest date is 'closed' or 'results' with dateNumber 1
- WHEN an admin creates a new date
- THEN the new date gets dateNumber 2 in 'open' status with pozo 0
- AND betAmount comes from system config
- AND users can place bets on it

#### Scenario: Reject when an open date exists

- GIVEN a tournament with an existing date in 'open' status
- WHEN an admin creates a new date
- THEN the system rejects the request
- AND no new date is created

#### Scenario: Reject on non-active tournament

- GIVEN a tournament with status 'finished' or 'archived'
- WHEN an admin creates a date
- THEN the system rejects the request
- AND no date is created

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user posts to the create-date endpoint
- THEN the system returns 403 Forbidden

### Requirement: Date Lifecycle

Tournament dates MUST follow the lifecycle: `open → closed → results-published`. Closing computes pozo and financials (see Close Date Financials); the publish-results action transitions closed → results-published, computes and PERSISTS points per user+tournament+date in `tournament_points` (points are awarded only at this step), and distributes payouts per prize-payouts.

#### Scenario: Close date prevents new bets

- GIVEN a date in "open" status with bets placed
- WHEN an admin closes the date
- THEN the date status changes to "closed"
- AND no new bets can be placed

#### Scenario: Publish results after close

- GIVEN a date in "closed" status with stored results
- WHEN results are published
- THEN the date transitions to "results-published"
- AND points are calculated and persisted per user+tournament+date
- AND payouts are credited per prize-payouts

### Requirement: Set Match Results

An admin MUST be able to set the final score or outcome for each match on a date by submitting the two raw scores (`localScore`, `visitorScore`); the server MUST derive the match result (L/E/V) and compose the score string from them and MUST persist the derived values (see admin-operations for the derivation and validation rules). No client-computed result or score MAY reach the database. Setting results MUST NOT calculate, award, or accumulate points; points are computed and persisted only when the date is published (see Date Lifecycle).

#### Scenario: Results update does not award points

- GIVEN a closed date with placed bets
- WHEN an admin sets the final scores for each match
- THEN the scores are stored
- AND no user points change until the date is published

#### Scenario: Server derives result from raw scores

- GIVEN a closed date match
- WHEN an admin submits `{ localScore: "3", visitorScore: "2" }`
- THEN the match stores the derived result "L" and score "3-2"
- AND the composed score format is `"l-v"`

### Requirement: Start New Tournament

An admin MUST be able to start a new tournament while preserving all historical data. On creation the system MUST set `tournament.commission` from the system-config rate (the field is informational and MUST NOT feed pozo calculation) and MUST set the status to `active` with carryover 0. When a tournament is archived, the next tournament is auto-created (see Archive Tournament).

#### Scenario: New tournament with clean slate

- GIVEN existing tournaments with closed dates and history
- WHEN an admin creates a new tournament
- THEN the new tournament starts with no dates and status 'active'
- AND all previous tournament data remains accessible for ranking queries

#### Scenario: New tournament records config commission

- GIVEN system-config commission 15%
- WHEN an admin creates a new tournament
- THEN the tournament stores commission 15% as informational data
- AND pozo calculation at close uses the live system-config rate, not this field

### Requirement: Historical Preservation

Closed tournaments and their associated bets, results, and rankings MUST be preserved and queryable.

#### Scenario: Historical data survives new tournament

- GIVEN a closed tournament with dates, bets, and points
- WHEN a new tournament is started
- THEN the closed tournament's data is still available via the ranking API
- AND bet records remain intact

### Requirement: Close Date Financials

When closing a date the system MUST compute `pozo = tournament.carryover + (gross − commission)`, consume the carryover (reset to 0), credit the commission to the closing admin's balance (from the authenticated JWT), and write a `commission_payout` audit_log entry.

#### Scenario: Close with carryover

- GIVEN a date with gross 5000 cents, config commission 10%, and tournament carryover 1200 cents
- WHEN an admin closes the date
- THEN pozo = 1200 + 4500 = 5700 cents is stored
- AND carryover resets to 0

#### Scenario: Commission credited to closing admin

- GIVEN an admin with balance 0 closing a date with commission 500 cents
- WHEN the date closes
- THEN the admin's balance is credited 500 cents
- AND an audit_log entry `commission_payout` records admin, amount, and timestamp

#### Scenario: Close with no bets

- GIVEN a date with no bets and carryover 0
- WHEN the date closes
- THEN pozo and commission are zero

### Requirement: Carryover Lifecycle

`tournaments.carryover` (integer cents, default 0) MUST accumulate unpaid pozo on publish (see prize-payouts) and be consumed on the next date close.

#### Scenario: Carryover feeds next date

- GIVEN a tournament with carryover 1500 cents
- WHEN the next date is closed
- THEN the new pozo includes the 1500 cents
- AND the carryover is consumed (reset to 0)

### Requirement: Match Creation

An admin MUST be able to create a match on a tournament date via `POST /api/admin/matches` (admin role required) with `localTeam`, `visitorTeam`, optional `localImg`, `visitorImg`, `scheduledAt`, and optional `localTeamId`, `visitorTeamId`. When a team id is provided, the system MUST resolve it against the teams registry, persist it as the FK, and persist the string field as that team's name; an unknown team id MUST be rejected (HTTP 422) and no match created. When only free text is provided, the team id MUST be null. The system MUST reject creation when the parent date is not 'open' or when the tournament's status is not `active`.

#### Scenario: Create match on open date

- GIVEN an admin and a date with status 'open'
- WHEN the admin posts a match with both teams
- THEN the match is created and persisted
- AND the response includes the new match

#### Scenario: Create match on non-open date rejected

- GIVEN a date with status 'closed' or 'results'
- WHEN an admin posts a match for it
- THEN the system returns an error (422)
- AND no match is created

#### Scenario: Create match on non-active tournament rejected

- GIVEN a tournament with status 'finished' or 'archived' and a date in 'open' status
- WHEN an admin posts a match for it
- THEN the system rejects the request
- AND no match is created

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user posts to the create-match endpoint
- THEN the system returns 403 Forbidden

#### Scenario: Create match from registry teams

- GIVEN an admin and a date with status 'open'
- WHEN the admin posts a match with `localTeamId` and `visitorTeamId`
- THEN the match stores both team ids
- AND the string fields are set to the teams' names

#### Scenario: Unknown team id rejected

- GIVEN an admin and a date with status 'open'
- WHEN the admin posts a match with a non-existent team id
- THEN the system returns 422
- AND no match is created

#### Scenario: Free text without team id stays legacy

- GIVEN an admin and a date with status 'open'
- WHEN the admin posts a match with only free-text teams
- THEN the match is created with null team ids
- AND the strings are stored as written

### Requirement: Match Details Editing

An admin MUST be able to edit a match's `localTeam`, `visitorTeam`, `localImg`, `visitorImg`, `scheduledAt`, and optional `localTeamId`, `visitorTeamId` via `PATCH /api/admin/matches/:matchId` (admin role required). Providing a team id MUST resolve it against the registry, set the FK, and set the string to the team's name; updating a string without a team id MUST set the FK to null. The update MUST be partial and applied through the immutable `Match.withDetails()` method. Editing MUST be allowed only when the parent date is 'open'; result editing stays on `PATCH /api/admin/matches/:matchId/result`.

#### Scenario: Partial details update

- GIVEN a match on an open date
- WHEN an admin PATCHes only the visitor team
- THEN the visitor team changes
- AND all other fields remain unchanged

#### Scenario: Edit on non-open date rejected

- GIVEN a match on a date with status 'closed' or 'results'
- WHEN an admin PATCHes its details
- THEN the system returns an error (422)
- AND no fields change

#### Scenario: Unknown match

- GIVEN a matchId that does not exist
- WHEN an admin PATCHes it
- THEN the system returns 404 Not Found

#### Scenario: Update team via registry

- GIVEN a match on an open date with a free-text local team
- WHEN an admin PATCHes `localTeamId` for a registry team
- THEN the FK is stored
- AND the local team string becomes that team's name

#### Scenario: Free text clears the team id

- GIVEN a match with a stored local team id
- WHEN an admin PATCHes only free-text `localTeam`
- THEN the local team id becomes null
- AND the string is stored as written

### Requirement: Bet Amount Propagation Boundary

Bet amount propagation MUST run only when an admin changes the config default (see system-config); it MUST NOT run on date creation. Date-creation rules MUST remain unchanged: `POST /api/admin/dates` still snapshots `betAmount` from system config and still rejects when an open date already exists for the tournament. Propagation MUST NOT create, close, or delete dates, and MUST NOT affect the one-open-date-per-tournament rule.

#### Scenario: Propagation never creates dates

- GIVEN a tournament with no open date
- WHEN the admin changes the default bet amount
- THEN no date is created
- AND no open-date conflict is raised

#### Scenario: Creation snapshots config at creation time

- GIVEN a tournament whose open date was created before a default change
- WHEN an admin later creates a new date after the open one is closed
- THEN the new date snapshots the current default
- AND no propagation runs during creation

### Requirement: Tournament Status Model

`tournaments.status` MUST replace the `isActive` boolean with a three-state enum: `active`, `finished`, `archived`. Every tournament MUST have exactly one status; creation MUST set it to `active`. The migration MUST map existing rows with `is_active = true` to `status = 'active'`. At boot, when NO tournament exists, the system MUST auto-create "Torneo 1" with status `active`, carryover 0, and commission from system config; when at least one exists, boot MUST NOT create a duplicate.

#### Scenario: Boot creates first tournament

- GIVEN an empty tournaments table
- WHEN the server boots
- THEN a tournament named "Torneo 1" is created with status 'active'
- AND its carryover is 0

#### Scenario: Boot keeps existing tournaments

- GIVEN a database with an existing active tournament
- WHEN the server boots
- THEN no additional tournament is created

#### Scenario: Migrated legacy row

- GIVEN a pre-migration tournament with is_active = true
- WHEN the migration runs
- THEN the tournament has status 'active'

### Requirement: Terminate Tournament

An admin MUST be able to terminate an `active` tournament. Terminate MUST transition the status to `finished`, determine the winner(s) as ALL users tied at the maximum total tournament points read from persisted `tournament_points` (only when that maximum is greater than zero), and persist the winner user IDs and `finished_at` on the tournament. Terminate MUST be rejected with HTTP 409 when the tournament has an open date. Prize payment MUST be stubbed: terminate MUST NOT credit balances, split pozo, or change prizes. Terminate MUST be rejected when the tournament is not `active`.

#### Scenario: Terminate freezes finished tournament

- GIVEN an active tournament with all dates paid and one user holding the most points
- WHEN an admin terminates it
- THEN the status becomes 'finished'
- AND the top user is persisted as winner with finished_at set
- AND no balance or prize changes occur

#### Scenario: Tie produces multiple winners

- GIVEN two users tied at the maximum points
- WHEN the tournament is terminated
- THEN both users are persisted as winners

#### Scenario: Open date blocks terminate

- GIVEN a tournament with an open date
- WHEN an admin terminates it
- THEN the system returns HTTP 409
- AND the status stays 'active'

#### Scenario: Terminating a finished tournament

- GIVEN a tournament with status 'finished'
- WHEN an admin terminates it
- THEN the request is rejected

### Requirement: Archive Tournament

An admin MUST be able to archive a `finished` tournament. Archive MUST hide it from all active flows (active-tournament resolution, ranking default, Cartelera, "Fechas anteriores", admin Partidos) and MUST auto-create the next tournament "Torneo N+1" (N = archived number) with status `active`, carryover 0, and an admin-editable name. The archived tournament's carryover MUST stay frozen. Archive MUST be rejected when the tournament is not `finished`; archived data MUST remain queryable (Historical Preservation). The next name MUST be unique (Unique Tournament Name). On auto-name collision (23505), archive MUST retry the 2-stage operation with the next candidate ("Torneo N+2", "Torneo N+3", ...) in a fresh transaction until a name is available or the bounded loop exhausts — archive MUST fail and roll back (PostgreSQL aborts transactions after 23505; state consistency keeps retry safe). Auto-generated names MUST NOT 409; manually edited colliding names DO return 409.

#### Scenario: Archive creates next tournament

- GIVEN a finished tournament "Torneo 2"
- WHEN an admin archives it
- THEN its status becomes 'archived'
- AND a tournament named "Torneo 3" is created with status 'active' and carryover 0

#### Scenario: Next tournament name is editable

- GIVEN the auto-created next tournament
- WHEN an admin renames it to a unique name
- THEN the new name persists

#### Scenario: Carryover stays frozen

- GIVEN a finished tournament with carryover 1500 cents
- WHEN it is archived
- THEN the next tournament starts with carryover 0
- AND the archived tournament keeps its 1500 cents

#### Scenario: Archive of active tournament rejected

- GIVEN a tournament with status 'active'
- WHEN an admin archives it
- THEN the request is rejected

#### Scenario: Archive retries on collision

- GIVEN a finished "Torneo 2" and existing "Torneo 3"
- WHEN an admin archives "Torneo 2"
- THEN archive retries with "Torneo 4" in a fresh transaction
- AND "Torneo 2" becomes 'archived' and "Torneo 4" is created 'active', carryover 0

### Requirement: Unique Tournament Name

Tournament names MUST be unique under a normalized comparison key `lower(regexp_replace(name,'\s+','','g'))` — names differing only by case or whitespace are the same name. A DB functional unique index MUST enforce it for all rows. Names MUST be stored exactly as written (zod min(1).max(100)); normalization is comparison-only, never stored. Every name-persisting flow (manual create, boot, archive, rename) MUST respect it — advisory lock is the primary boot guard, index the backstop. A manually typed name collision MUST return HTTP 409, code `TOURNAMENT_NAME_TAKEN`, "Ya existe un torneo con ese nombre" — never silently changing it. Auto-generated names MUST NOT 409: boot no-ops, archive retries. The repository MUST map PG 23505 to typed `TournamentNameAlreadyExistsError` (DomainError, 409, `TOURNAMENT_NAME_TAKEN`).

#### Scenario: Case-only collision

- GIVEN a tournament named "Torneo 1"
- WHEN an admin creates a tournament named "torneo 1"
- THEN the system returns 409 with "Ya existe un torneo con ese nombre"
- AND no tournament is created

#### Scenario: Whitespace-only collision

- GIVEN a tournament named "Torneo 1"
- WHEN an admin creates a tournament named "Torneo  1" (double internal space)
- THEN the system returns 409

#### Scenario: Distinct names

- GIVEN a tournament named "Torneo 1"
- WHEN an admin creates a tournament named "Torneo 2"
- THEN the tournament is created (201)

### Requirement: Name Uniqueness Migration Safety

The migration MUST first detect colliding rows under the normalized key; if any exist, it MUST abort with a duplicate report (dedupe first) — never creating the index over conflicting data.

#### Scenario: Migration aborts on duplicates

- GIVEN "Torneo 1" and " torneo 1 " exist
- WHEN the migration runs
- THEN it fails with a duplicate report, creating no index

### Requirement: Team Reference Enrichment

Matches MUST store nullable `local_team_id`/`visitor_team_id` foreign keys to the teams registry. A team id is ENRICHMENT only: the free-text `local_team`/`visitor_team` strings remain the source of truth for display and MUST always be populated. Existing matches without team ids MUST keep rendering and editing unchanged (string fallback). Match responses MUST include the team ids so clients can resolve logos.

#### Scenario: Legacy match keeps working

- GIVEN a match with only string teams
- WHEN the match is rendered or edited
- THEN the strings are used for display
- AND the match remains editable with no team id required

#### Scenario: Registry match stores both

- GIVEN a match created from a team selection
- WHEN the match is persisted
- THEN the string equals the team's name
- AND the team id is stored
