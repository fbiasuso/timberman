# Betting Engine — Specification

## Purpose

Bet placement, validation, pozo (prize pool) calculation, and commission configuration for the timberman betting pool.

## Requirements

### Requirement: Place Bet

The authenticated user MUST be able to place a bet on an open tournament date, selecting one of the available match outcomes.

#### Scenario: Successful bet placement

- GIVEN an authenticated user with sufficient balance and an open tournament date
- WHEN the user submits a bet selecting an outcome for each match
- THEN the system deducts the bet amount from the user's balance
- AND records the bet linked to the user and date
- AND returns a confirmation with bet details

#### Scenario: Bet on closed date rejected

- GIVEN a tournament date that is closed or has results published
- WHEN a user attempts to place a bet on that date
- THEN the system MUST reject with a 422 error indicating the date is not open

### Requirement: Bet Validation

The system MUST validate all bet placement conditions before accepting the bet.

#### Scenario: Insufficient balance rejected

- GIVEN an authenticated user whose balance is less than the bet amount
- WHEN the user attempts to place a bet
- THEN the system MUST reject with a 422 error
- AND MUST NOT deduct any amount

#### Scenario: Duplicate bet per date rejected

- GIVEN the user already has a bet on a specific tournament date
- WHEN the user attempts to place another bet on the same date
- THEN the system MUST reject with a 409 error

### Requirement: Bet Immutability

A placed bet MUST NOT be modifiable or deletable after submission.

#### Scenario: Bet modification rejected

- GIVEN a placed bet on an open date
- WHEN the user sends an update request for that bet
- THEN the system MUST reject with a 405 error

### Requirement: Pozo Calculation

The system MUST calculate the pozo as `(tickets on date × bet amount) − commission`, where `commission = gross × (system-config commission % / 100)`. The applied commission rate MUST be snapshotted on `match_dates.commission` at close; closed dates MUST NEVER be recomputed.

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
