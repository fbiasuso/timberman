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

The system MUST calculate the pozo as `(total bets on date × bet amount) × commission percentage`.

#### Scenario: Pozo calculated on date close

- GIVEN a tournament date with N confirmed bets at amount A and commission C%
- WHEN the date is closed by an admin
- THEN the system computes pozo = (N × A) × (C / 100)
- AND stores the pozo amount on the date record

#### Scenario: Pozo with zero bets

- GIVEN a tournament date with no bets placed
- WHEN the date is closed
- THEN the pozo MUST be zero

### Requirement: Configurable Commission

The system MUST allow per-tournament configuration of the commission percentage.

#### Scenario: Commission applied per tournament

- GIVEN a tournament with commission set to 15%
- WHEN the pozo is calculated
- THEN the formula uses 15% as the commission rate
- AND the remainder is the house share
