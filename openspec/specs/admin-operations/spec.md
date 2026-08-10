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

Admins MUST be able to enter or update match results for a closed tournament date of the ACTIVE tournament only. Entering results stores the scores; the date remains "closed" until the publish-results action transitions it to "results-published" and distributes points and payouts. Dates of 'finished' or 'archived' tournaments MUST NOT be selectable for results entry.

The result-entry payload MUST be `{ localScore, visitorScore }` (both strings). The server MUST derive the match result (L/E/V) and compose the score string `"l-v"` from the two raw inputs and MUST NOT accept a client-computed result or score — the server is the source of truth.

Derivation rules: `'x'`/`'X'` on both sides MUST derive result E with score null; `'x'` on the local side MUST derive L (visitor value ignored); `'x'` on the visitor side MUST derive V (local value ignored). Non-`'x'` inputs MUST match `^(0|[1-9]\d{0,1})$` and be within 0..20 after whitespace trimming; equal numbers MUST derive E; one side empty without `'x'` MUST be rejected. Both inputs empty/whitespace MUST clear the result and score to null via PATCH.

Semantic payload violations MUST return HTTP 422 via `InvalidMatchResultError` (Spanish message); missing or wrong-typed fields MUST return HTTP 400 (zod).

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

#### Scenario: Derives local win and composes score

- GIVEN a closed date match without a result
- WHEN an admin PATCHes `{ localScore: "3", visitorScore: "2" }`
- THEN the match stores result "L" and score "3-2"

#### Scenario: Equal numbers derive draw

- GIVEN a match being entered
- WHEN an admin PATCHes `{ localScore: "2", visitorScore: "2" }`
- THEN the match stores result "E" and score "2-2"

#### Scenario: 'x' on both sides derives draw without score

- GIVEN a match being entered
- WHEN an admin PATCHes `{ localScore: "x", visitorScore: "X" }`
- THEN the match stores result "E" and score null

#### Scenario: 'x' on one side derives winner without score

- GIVEN a match being entered
- WHEN an admin PATCHes `{ localScore: "x", visitorScore: "4" }`
- THEN the match stores result "L" and score null, ignoring "4"

#### Scenario: 'x' on visitor side derives visitor win

- GIVEN a match being entered
- WHEN an admin PATCHes `{ localScore: "4", visitorScore: "x" }`
- THEN the match stores result "V" and score null, ignoring "4"

#### Scenario: Invalid score rejected

- GIVEN a match being entered
- WHEN an admin PATCHes `{ localScore: "a", visitorScore: "2" }` (also "03", "-1", "2.5")
- THEN the system returns 422 and no value is stored

#### Scenario: Out-of-range score rejected

- GIVEN a match being entered
- WHEN an admin PATCHes `{ localScore: "21", visitorScore: "2" }`
- THEN the system returns 422 and no value is stored
- AND `{ localScore: "0", visitorScore: "20" }` is accepted (result "V", score "0-20")

#### Scenario: One side empty without 'x' rejected

- GIVEN a match being entered
- WHEN an admin PATCHes `{ localScore: "", visitorScore: "2" }` or `{ localScore: "  ", visitorScore: "2" }`
- THEN the system returns 422 and no value is stored

#### Scenario: Both inputs empty clears the result

- GIVEN a match with a stored result and score
- WHEN an admin PATCHes `{ localScore: "", visitorScore: "" }` (or whitespace only)
- THEN the match stores result null and score null

#### Scenario: Wrong payload shape rejected with 400

- GIVEN a match being entered
- WHEN an admin PATCHes the old `{ result: "L", score: "2-1" }` payload or a wrong-typed field (e.g. `localScore: 3`)
- THEN the system returns 400 and no value is stored

### Requirement: System Configuration

Admins MUST be able to view and update system-wide configuration; updates MUST be persisted to the `system_config` table (see system-config) and take effect immediately. Updating `defaultBetAmount` MUST also propagate the new amount to every open, ticket-free date of the ACTIVE tournament (status 'active') via `findOpenMatchDates()`; ticketed open dates MUST keep their amount and be reported as blocked, never thrown. The response MUST be `{ config, updatedDates, blockedDates }` with `updatedDates` and `blockedDates` always present: `updatedDates` entries are `{ id, dateNumber, betAmount }`, `blockedDates` entries are `{ id, dateNumber }`. User-facing messages use `dateNumber`; the `id` supports programmatic use.

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

The admin Partidos view MUST render an accordion of the ACTIVE tournament's dates (from `useAdminTournaments` → TournamentDateDTO) with a "Nueva fecha" button at the top. Dates of 'finished' or 'archived' tournaments MUST NOT be listed. Each date header MUST show the date number, a lock icon for 'closed' dates or a "$" icon for 'results' (paid) dates, and the date's `betAmount` in cents (admin-only). The admin `TournamentDateDTO` MUST include `betAmount`.

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

### Requirement: Open Date Match Editing

In Partidos, expanding a date in 'open' status MUST render editable match fields with a real save via PATCH match details, plus an "Agregar partido" form that creates matches via POST. Expanding 'closed' or 'results' dates MUST render matches and results as view-only. Team fields in both the editable row and the "Agregar partido" form MUST use the team-selection controls defined in Match Team Selection UI and MUST submit the chosen team ids.

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

#### Scenario: Team fields use registry selection

- GIVEN the accordion expanded on the open date
- WHEN an admin opens the add-match form or the editable row
- THEN team fields render the league selector and autocomplete
- AND no free-text team input is available

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

### Requirement: Results Entry Input Controls

The results entry view MUST render per-match local and visitor score inputs prefilled from the persisted result/score (score `"3-2"` → `"3"`/`"2"`; result "L" with null score → local `"x"`; result "E" with null score → both `"x"`). The view MUST validate in real time mirroring the server derivation and MUST hide the Guardar button unless the inputs are both dirty (differ from persisted) and valid. A successful save MUST replace Guardar with a green checkmark; editing the inputs afterwards MUST restore it. A Limpiar button MUST appear only when a result is saved and MUST revert the match to Pendiente (both inputs empty). Inline validation messages MUST appear on interaction and MUST use the exact Spanish copy `"Ingresá un marcador válido (0 a 20)"` and `"Usá números o 'x' para ganador sin marcador"`. Server errors MUST surface in the existing error box.

#### Scenario: Inputs prefilled from persisted result

- GIVEN a match with result "L" and score "3-2"
- WHEN the results entry view renders
- THEN the local input shows "3" and the visitor input shows "2"

#### Scenario: Prefill for winner without score

- GIVEN a match with result "L" and score null
- WHEN the results entry view renders
- THEN the local input shows "x" and the visitor input is empty

#### Scenario: Guardar hidden until dirty and valid

- GIVEN a match without a result
- WHEN the admin types "3" in local and "2" in visitor
- THEN Guardar appears
- AND while any input is invalid or empty the button stays hidden

#### Scenario: Invalid input shows Spanish message

- GIVEN the admin types "21" in the local input
- WHEN the input loses focus
- THEN Guardar is hidden and "Ingresá un marcador válido (0 a 20)" is shown

#### Scenario: Partial input shows 'x' hint

- GIVEN the admin types "3" in local and leaves visitor empty
- WHEN the inputs are interacted with
- THEN Guardar is hidden and "Usá números o 'x' para ganador sin marcador" is shown

#### Scenario: Checkmark replaces Guardar after save

- GIVEN a dirty and valid result
- WHEN the admin saves and the PATCH succeeds
- THEN a green checkmark replaces Guardar
- AND editing an input brings Guardar back

#### Scenario: Limpiar reverts to Pendiente

- GIVEN a match with a saved result and score
- WHEN the admin clicks Limpiar
- THEN the PATCH clears the result and the inputs show Pendiente state

#### Scenario: Server error surfaces in error box

- GIVEN a match whose PATCH returns 422
- WHEN the save fails
- THEN the server message appears in the error box and the match stays editable

### Requirement: Equipos Admin Tab

The admin panel MUST include an "Equipos" tab listing leagues and their teams, with create/edit/delete controls wired to the team-registry endpoints. Delete attempts blocked by the reference guards MUST surface the server error without corrupting the list state.

#### Scenario: Tab lists leagues and teams

- GIVEN leagues with teams exist
- WHEN an admin opens Equipos
- THEN each league is listed with its teams

#### Scenario: Create team from tab

- GIVEN a league selected in Equipos
- WHEN an admin submits the create-team form
- THEN the team is created
- AND the list refreshes

#### Scenario: Blocked delete shows the error

- GIVEN a team referenced by a match
- WHEN an admin tries to delete it from Equipos
- THEN the server error is shown
- AND the team remains in the list

### Requirement: Match Team Selection UI

The admin match forms (AddMatchForm and the MatchRow editable row) MUST render a per-match league selector and a team autocomplete filtered by the selected league (ordered by name, per team-registry). Choosing a team MUST set the team name from the registry record, auto-fill the shield from the team's logo, and submit the team id. Free-text team input MUST be removed from match create/edit flows; the manual shield URL fallback MAY remain per team-image-hosting. Matches without team ids MUST keep rendering their stored strings.

#### Scenario: Pick team from registry

- GIVEN the add-match form with a league selected
- WHEN an admin types and picks a team from the autocomplete
- THEN the team name is filled from the registry record
- AND the shield auto-fills from the team's logo
- AND the form submits the team id

#### Scenario: Autocomplete filtered by league

- GIVEN teams in two leagues
- WHEN an admin selects league A in the match form
- THEN the autocomplete offers only league A teams, ordered by name

#### Scenario: Legacy match renders and edits

- GIVEN a match with stored team strings and no team ids
- WHEN an admin opens it for editing
- THEN the stored strings are shown
- AND the admin can replace them via the autocomplete, which then submits team ids

### Requirement: Team Logo Upload UI

The TeamForm in the Equipos tab MUST render the shield input as a native file picker accepting only PNG, JPEG, and WebP (`accept="image/png,image/jpeg,image/webp"`) with a live preview via `URL.createObjectURL`. The client MUST validate file type and size (1 MiB cap) before upload; an invalid selection MUST show an inline error and block save. On save, the file MUST be uploaded as multipart FormData to the logo endpoint. Teams without a logo MUST be able to add one, and teams with a logo MUST be able to replace it; the server keeping the replaced file orphaned is acceptable.

#### Scenario: Valid selection previews

- GIVEN an admin editing a team
- WHEN a PNG under 1 MiB is selected
- THEN a live preview renders and save is enabled

#### Scenario: Invalid type blocked

- GIVEN an admin editing a team
- WHEN a non-image file is selected
- THEN an inline error is shown and save is blocked

#### Scenario: Oversized file blocked

- GIVEN an admin editing a team
- WHEN a file over 1 MiB is selected
- THEN an inline error is shown and save is blocked

#### Scenario: Save uploads via FormData

- GIVEN a valid selected file
- WHEN the admin saves the team
- THEN the file is posted as multipart/form-data
- AND the updated logo renders after the list refreshes

#### Scenario: Team without logo adds one

- GIVEN a team with logo null
- WHEN the admin picks a valid file and saves
- THEN the team gains the uploaded logo

#### Scenario: Logo replacement

- GIVEN a team with an existing logo
- WHEN the admin picks a valid file and saves
- THEN the logo is replaced
- AND the old file may remain orphaned
