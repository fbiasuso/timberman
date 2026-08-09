# Delta for Admin Operations

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Open Date Match Editing

In Partidos, expanding a date in 'open' status MUST render editable match fields with a real save via PATCH match details, plus an "Agregar partido" form that creates matches via POST. Expanding 'closed' or 'results' dates MUST render matches and results as view-only. Team fields in both the editable row and the "Agregar partido" form MUST use the team-selection controls defined in Match Team Selection UI and MUST submit the chosen team ids.
(Previously: team fields were free-text inputs with plain shield URLs)

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
