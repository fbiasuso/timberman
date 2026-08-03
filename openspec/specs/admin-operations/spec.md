# Admin Operations — Specification

## Purpose

Administrative functions: user management, balance adjustments, match results entry, and system configuration.

## Requirements

### Requirement: Admin Authorization

All admin operations MUST require a JWT with the `admin` role. Non-admin tokens MUST be rejected.

#### Scenario: Admin access granted

- GIVEN a JWT with role "admin"
- WHEN an admin endpoint is called
- THEN the system processes the request

#### Scenario: Non-admin access denied

- GIVEN a JWT with role "user"
- WHEN an admin endpoint is called
- THEN the system returns 403 Forbidden

### Requirement: User Management

Admins MUST be able to list all users, and create user accounts when admin-only registration mode is active.

#### Scenario: List all users

- GIVEN an authenticated admin
- WHEN the admin requests the user list
- THEN the system returns all users with username, role, balance, and registration date
- AND passwords are never included in the response

#### Scenario: Admin creates user

- GIVEN admin-only registration mode is active
- WHEN an admin creates a user account with username and initial balance
- THEN the system creates the user with a temporary password or invite token
- AND the user can log in and change their password

### Requirement: Balance Adjustment

Admins MUST be able to add or subtract balance from any user's account, with an audit trail.

#### Scenario: Admin adjusts user balance

- GIVEN an authenticated admin and a target user
- WHEN the admin submits a balance adjustment with amount and reason
- THEN the target user's balance is updated
- AND the adjustment is recorded in an audit log with admin ID, timestamp, amount, and reason

### Requirement: Match Results Entry

Admins MUST be able to enter or update match results for a closed tournament date. Entering results stores the scores; the date remains "closed" until the publish-results action transitions it to "results-published" and distributes points and payouts.

#### Scenario: Enter match results

- GIVEN a tournament date in "closed" status
- WHEN an admin submits final scores for each match
- THEN the scores are stored
- AND the date stays in "closed" status

#### Scenario: Re-enter results before publish

- GIVEN a closed date with stored results
- WHEN an admin submits corrected results before publishing
- THEN the previous scores are replaced

### Requirement: System Configuration

Admins MUST be able to view and update system-wide configuration; updates MUST be persisted to the `system_config` table (see system-config) and take effect immediately. Updating `defaultBetAmount` MUST also propagate the new amount to every open, ticket-free date across all active tournaments (via `findOpenMatchDates()`); ticketed open dates MUST keep their amount and be reported as blocked, never thrown. The response MUST be `{ config, updatedDates, blockedDates }` with `updatedDates` and `blockedDates` always present: `updatedDates` entries are `{ id, dateNumber, betAmount }`, `blockedDates` entries are `{ id, dateNumber }`. User-facing messages use `dateNumber`; the `id` supports programmatic use.

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

#### Scenario: Default bet amount propagates to ticket-free open dates

- GIVEN open ticket-free dates in two tournaments
- WHEN the admin PATCHes key `defaultBetAmount` to 500
- THEN config is persisted
- AND each open ticket-free date's betAmount becomes 500
- AND `updatedDates` lists them with id, dateNumber, and betAmount

#### Scenario: Ticketed open date is blocked

- GIVEN an open date with existing tickets
- WHEN the admin PATCHes `defaultBetAmount`
- THEN the date keeps its amount and is listed in `blockedDates`
- AND the response is HTTP 200 with config persisted

### Requirement: Publish Results Route

The system MUST expose `POST /api/admin/dates/:dateId/publish-results` (admin role required) wired to the publish-results use case; it pays winners or rolls the pozo into carryover.

#### Scenario: Publish from closed status

- GIVEN a date in "closed" status with stored results
- WHEN an admin posts to the publish-results endpoint
- THEN the date transitions to "results-published"
- AND winners are paid per prize-payouts

#### Scenario: Re-submit is harmless

- GIVEN a date already in "results-published" status
- WHEN an admin posts to publish-results again
- THEN the request is rejected without any duplicate credits

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user calls publish-results
- THEN the system returns 403 Forbidden

### Requirement: Payout Breakdown and Publish Button

After publishing, the admin Resultados view MUST show winners with amounts and the house commission; a "Publish results and pay out" button MUST appear when the date status is "closed".

#### Scenario: Breakdown after publish

- GIVEN a published date with 2 winners and commission 500 cents
- WHEN an admin opens Resultados
- THEN the view lists each winner with their credited amount
- AND shows the house commission

#### Scenario: Publish button on closed dates

- GIVEN a date with status "closed"
- WHEN an admin opens Resultados
- THEN a "Publish results and pay out" button is available

#### Scenario: Button hidden after publish

- GIVEN a date with status "results-published"
- WHEN an admin opens Resultados
- THEN the publish button is not shown

### Requirement: Partidos Date Accordion

The admin Partidos view MUST render an accordion of ALL tournament dates (from `useAdminTournaments` → TournamentDateDTO) with a "Nueva fecha" button at the top. Each date header MUST show the date number, a lock icon for 'closed' dates or a "$" icon for 'results' (paid) dates, and the date's `betAmount` in cents (admin-only). The admin `TournamentDateDTO` MUST include `betAmount`.

#### Scenario: Accordion lists all dates

- GIVEN a tournament with closed and results dates
- WHEN an admin opens Partidos
- THEN every date appears as an accordion row
- AND each header shows the date number with its status icon

#### Scenario: Nueva fecha button creates date

- GIVEN the Partidos accordion with no open date
- WHEN an admin clicks "Nueva fecha"
- THEN the system calls the create-date endpoint
- AND the new date appears in the accordion

#### Scenario: Accordion shows per-date bet amount

- GIVEN a tournament whose open date received a propagated amount
- WHEN an admin opens Partidos
- THEN the date header shows its betAmount next to the date number and status icon

### Requirement: Open Date Match Editing

In Partidos, expanding a date in 'open' status MUST render editable match fields with a real save via PATCH match details, plus an "Agregar partido" form that creates matches via POST. Expanding 'closed' or 'results' dates MUST render matches and results as view-only.

#### Scenario: Edit open-date match and save

- GIVEN the accordion expanded on the open date
- WHEN an admin edits a match field and saves
- THEN the system calls the match-details PATCH endpoint
- AND the updated value persists

#### Scenario: Add match to open date

- GIVEN the accordion expanded on the open date
- WHEN an admin submits the "Agregar partido" form
- THEN the system calls the create-match endpoint
- AND the new match appears in the expanded date

#### Scenario: Closed date is view-only

- GIVEN the accordion expanded on a 'closed' date
- WHEN an admin views its matches
- THEN matches render read-only with results
- AND no edit or add controls appear

### Requirement: Propagation Results Feedback

When a `defaultBetAmount` update completes, ConfigPanel MUST render grouped results: one green success group with the default-save confirmation line plus one line per updated date, and one red error group with one line per blocked date. Messages MUST reference dates by `dateNumber` ("fecha N") and use the exact Spanish (Rioplatense neutral) copy: `"Éxito: se guardó el nuevo monto de apuesta ($5,00) para futuras fechas."`, `"Éxito: se modificó correctamente el monto de la apuesta en la fecha 46."`, `"Error: no se pudo cambiar el monto de la apuesta en la fecha 45 porque ya existen jugadas para esa fecha."`. The default-save line MUST appear whenever the config persisted, even if every date is blocked. After a successful save, ConfigPanel MUST invalidate the tournaments query (`['admin','tournaments']`) in addition to config so Partidos refreshes.

#### Scenario: All ticket-free dates updated

- GIVEN open ticket-free dates 46 and 47
- WHEN the admin saves defaultBetAmount 500
- THEN one green group shows the default-save line and the "fecha 46" and "fecha 47" lines
- AND no red group appears

#### Scenario: Mixed update and block

- GIVEN open date 46 without tickets and open date 45 with tickets
- WHEN the admin saves defaultBetAmount 500
- THEN the green group shows the default-save line and the "fecha 46" line
- AND the red group shows the "fecha 45" line with the exact blocked-date copy

#### Scenario: All dates blocked still confirms the save

- GIVEN only ticketed open dates
- WHEN the admin saves defaultBetAmount
- THEN the green group still shows the default-save line
- AND the red group lists each blocked date

### Requirement: Propagation Audit Trail

Each `defaultBetAmount` update MUST write exactly two `audit_log` rows: a config entry with `action: 'default_bet_amount_update'` and `amount` = new amount in cents, and an aggregate propagation entry with `action: 'default_bet_amount_propagation'`, `amount` = new amount in cents, and `reason` = JSON `{"changed":[<date ids>],"blocked":[<date ids>]}` (both keys always present). Both rows MUST record the admin ID from the JWT.

#### Scenario: Config and propagation rows written

- GIVEN an update that changes date 46 and blocks date 45
- WHEN the request completes
- THEN the `default_bet_amount_update` and `default_bet_amount_propagation` rows exist
- AND the propagation row reason is `{"changed":[46],"blocked":[45]}`

#### Scenario: No open dates

- GIVEN no open dates exist
- WHEN the admin updates defaultBetAmount
- THEN the propagation row reason is `{"changed":[],"blocked":[]}`
- AND the config row is still written
