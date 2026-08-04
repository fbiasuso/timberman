# Delta for Date History

## MODIFIED Requirements

### Requirement: Cartelera Fechas Anteriores Section

The user Cartelera MUST render a "Fechas anteriores" section below the active date content, or below the "No hay cartelera disponible" message when no active date exists. The section MUST list ONLY dates of the ACTIVE tournament; dates of 'finished' or 'archived' tournaments MUST NOT appear. Each row MUST show "Fecha N" with a lock icon for 'closed' dates and a "$" / "Resultados" marker for 'results' dates. Expanding a row MUST fetch the history endpoint and render read-only match rows; results MUST be hidden for 'closed' dates per sanitization.
(Previously: the section listed dates across all tournaments)

#### Scenario: Section below active date content

- GIVEN an active date with content
- WHEN the Cartelera renders
- THEN the active date content appears
- AND "Fechas anteriores" rows appear below it

#### Scenario: Section below no-cartelera message

- GIVEN no active (open) date
- WHEN the Cartelera renders
- THEN "No hay cartelera disponible" appears
- AND "Fechas anteriores" rows appear below it

#### Scenario: Only active tournament dates listed

- GIVEN an active tournament with past dates and an archived tournament with dates
- WHEN the Cartelera renders "Fechas anteriores"
- THEN only the active tournament's dates appear
- AND no archived tournament date is listed

#### Scenario: Expand closed date row

- GIVEN a 'closed' date row in Fechas anteriores
- WHEN the user expands it
- THEN the system fetches the history endpoint
- AND read-only match rows render with teams only, no results

#### Scenario: Expand results date row

- GIVEN a 'results' date row in Fechas anteriores
- WHEN the user expands it
- THEN the system fetches the history endpoint
- AND read-only match rows render with teams and results
