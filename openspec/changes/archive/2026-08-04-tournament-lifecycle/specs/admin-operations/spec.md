# Delta for Admin Operations

## ADDED Requirements

### Requirement: Terminate Tournament Route

The system MUST expose `POST /api/admin/tournaments/:tournamentId/terminate` (admin role required) wired to the TerminateTournamentUseCase. The endpoint MUST return HTTP 409 when the tournament has an open date, MUST transition the tournament to 'finished' with winners persisted, and MUST NOT trigger any prize payment. Non-admin tokens MUST be rejected.

#### Scenario: Terminate from active status

- GIVEN a tournament with status 'active' and no open date
- WHEN an admin posts to the terminate endpoint
- THEN the response succeeds
- AND the tournament's status becomes 'finished'
- AND winners are persisted

#### Scenario: Open date blocks terminate

- GIVEN a tournament with an open date
- WHEN an admin posts to the terminate endpoint
- THEN the system returns HTTP 409
- AND the tournament stays 'active'

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user calls the terminate endpoint
- THEN the system returns 403 Forbidden

### Requirement: Archive Tournament Route

The system MUST expose `POST /api/admin/tournaments/:tournamentId/archive` (admin role required) wired to the ArchiveTournamentUseCase. The endpoint MUST accept only tournaments with status 'finished' (all others rejected), MUST hide the tournament from active flows, and MUST auto-create the next tournament ("Torneo N+1", status 'active', carryover 0). Non-admin tokens MUST be rejected.

#### Scenario: Archive from finished status

- GIVEN a tournament with status 'finished'
- WHEN an admin posts to the archive endpoint
- THEN the tournament's status becomes 'archived'
- AND a next tournament is created with status 'active'

#### Scenario: Archive of active tournament rejected

- GIVEN a tournament with status 'active'
- WHEN an admin posts to the archive endpoint
- THEN the request is rejected
- AND no next tournament is created

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user calls the archive endpoint
- THEN the system returns 403 Forbidden

### Requirement: Tournament Lifecycle UI

The admin tournaments view MUST show each tournament's status (active/finished/archived). The admin `TournamentDTO` MUST include `status` and the persisted winner(s). The view MUST offer "Terminar torneo" on 'active' tournaments and "Archivar" on 'finished' tournaments; archiving MUST invalidate the tournaments query (`['admin','tournaments']`) so the auto-created next tournament appears.

#### Scenario: Status shown per tournament

- GIVEN active and finished tournaments
- WHEN an admin opens the tournaments view
- THEN each row shows its status label

#### Scenario: Lifecycle buttons by status

- GIVEN a tournament with status 'active'
- WHEN the admin views it
- THEN a "Terminar torneo" button is available
- AND "Archivar" appears only once the status is 'finished'

#### Scenario: Archive refreshes the list

- GIVEN a finished tournament
- WHEN the admin archives it
- THEN the tournaments query is invalidated
- AND the new tournament appears in the list

## MODIFIED Requirements

### Requirement: Match Results Entry

Admins MUST be able to enter or update match results for a closed tournament date of the ACTIVE tournament only. Entering results stores the scores; the date remains "closed" until the publish-results action transitions it to "results-published" and distributes points and payouts. Dates of 'finished' or 'archived' tournaments MUST NOT be selectable for results entry.
(Previously: any tournament's closed dates were available)

#### Scenario: Enter match results

- GIVEN a tournament date in "closed" status in the active tournament
- WHEN an admin submits final scores for each match
- THEN the scores are stored
- AND the date stays in "closed" status

#### Scenario: Re-enter results before publish

- GIVEN a closed date with stored results
- WHEN an admin submits corrected results before publishing
- THEN the previous scores are replaced

#### Scenario: Non-active tournament dates hidden

- GIVEN a closed date in a 'finished' tournament
- WHEN the admin opens the results entry view
- THEN that date is not offered for selection

### Requirement: System Configuration

Admins MUST be able to view and update system-wide configuration; updates MUST be persisted to the `system_config` table (see system-config) and take effect immediately. Updating `defaultBetAmount` MUST also propagate the new amount to every open, ticket-free date of the ACTIVE tournament (status 'active') via `findOpenMatchDates()`; ticketed open dates MUST keep their amount and be reported as blocked, never thrown. The response MUST be `{ config, updatedDates, blockedDates }` with `updatedDates` and `blockedDates` always present: `updatedDates` entries are `{ id, dateNumber, betAmount }`, `blockedDates` entries are `{ id, dateNumber }`. User-facing messages use `dateNumber`; the `id` supports programmatic use.
(Previously: propagation ran across all tournaments' open dates)

#### Scenario: Update commission percentage

- GIVEN an authenticated admin
- WHEN the admin updates the commission percentage setting
- THEN all future closes use the new rate
- AND existing closed dates retain their snapshot

#### Scenario: Toggle registration mode

- GIVEN an authenticated admin
- WHEN the admin toggles between self-registration and admin-only
- THEN the change is persisted
- AND registration is blocked or permitted immediately (live)
- AND existing users are unaffected

#### Scenario: Default bet amount propagates to active tournament's ticket-free open dates

- GIVEN open ticket-free dates in the active tournament and an open date in a 'finished' tournament
- WHEN the admin PATCHes key `defaultBetAmount` to 500
- THEN config is persisted
- AND each open ticket-free date of the active tournament becomes 500
- AND `updatedDates` lists them with id, dateNumber, and betAmount
- AND the finished tournament's date is neither updated nor blocked

#### Scenario: Ticketed open date is blocked

- GIVEN an open date with existing tickets
- WHEN the admin PATCHes `defaultBetAmount`
- THEN the date keeps its amount and is listed in `blockedDates`
- AND the response is HTTP 200 with config persisted

### Requirement: Partidos Date Accordion

The admin Partidos view MUST render an accordion of the ACTIVE tournament's dates (from `useAdminTournaments` → TournamentDateDTO) with a "Nueva fecha" button at the top. Dates of 'finished' or 'archived' tournaments MUST NOT be listed. Each date header MUST show the date number, a lock icon for 'closed' dates or a "$" icon for 'results' (paid) dates, and the date's `betAmount` in cents (admin-only). The admin `TournamentDateDTO` MUST include `betAmount`.
(Previously: accordion of ALL tournament dates)

#### Scenario: Accordion lists active tournament dates only

- GIVEN an active tournament with closed and results dates and a finished tournament with dates
- WHEN an admin opens Partidos
- THEN every date of the active tournament appears as an accordion row
- AND no date of the finished tournament appears

#### Scenario: Nueva fecha button creates date

- GIVEN the Partidos accordion with no open date
- WHEN an admin clicks "Nueva fecha"
- THEN the system calls the create-date endpoint
- AND the new date appears in the accordion

#### Scenario: Accordion shows per-date bet amount

- GIVEN a tournament whose open date received a propagated amount
- WHEN an admin opens Partidos
- THEN the date header shows its betAmount next to the date number and status icon
