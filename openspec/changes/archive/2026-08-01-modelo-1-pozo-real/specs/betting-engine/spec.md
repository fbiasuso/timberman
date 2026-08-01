# Delta for Betting Engine

## MODIFIED Requirements

### Requirement: Pozo Calculation

The system MUST calculate the pozo as `(tickets on date × bet amount) − commission`, where `commission = gross × (system-config commission % / 100)`. The applied commission rate MUST be snapshotted on `match_dates.commission` at close; closed dates MUST NEVER be recomputed.
(Previously: documented as `(N × A) × (C / 100)` — commission-multiplied instead of subtracted)

#### Scenario: Pozo calculated on date close

- GIVEN a tournament date with 10 confirmed bets at $5.00 (500 cents) and system commission 10%
- WHEN the date is closed by an admin
- THEN gross = 5000 cents, commission = 500 cents, pozo = 4500 cents
- AND the pozo and applied commission (10%) are stored on the date record

#### Scenario: Pozo with zero bets

- GIVEN a tournament date with no bets placed
- WHEN the date is closed
- THEN gross, commission, and pozo MUST be zero

#### Scenario: Closed date never recomputed

- GIVEN a date closed with pozo 4500 cents and commission snapshot 10%
- WHEN the system config commission later changes to 20%
- THEN the stored pozo and snapshot remain 4500 cents and 10%

### Requirement: Configurable Commission

The system MUST use the system-config commission rate (not `tournament.commission`) for pozo calculation. `tournament.commission` is informational only, set from config at tournament creation.
(Previously: per-tournament commission directly fed the pozo)

#### Scenario: Commission applied from system config

- GIVEN system-config commission 15% and a tournament created with informational commission 15%
- WHEN a date of that tournament is closed
- THEN the formula uses the system-config 15% rate
- AND the commission amount is credited per the close flow (see tournament-management)

#### Scenario: Config change affects only new closes

- GIVEN system-config commission changed from 15% to 20%
- WHEN a NEW date is closed after the change
- THEN the new date uses 20%
- AND previously closed dates retain their snapshots
