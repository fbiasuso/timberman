# Delta for Admin Operations

## ADDED Requirements

### Requirement: Partidos Date Accordion

The admin Partidos view MUST render an accordion of ALL tournament dates (from `useAdminTournaments` → TournamentDateDTO) with a "Nueva fecha" button at the top. Each date header MUST show the date number and a lock icon for 'closed' dates or a "$" icon for 'results' (paid) dates.

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
