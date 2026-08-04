# Delta for Ranking Calculation

## ADDED Requirements

### Requirement: Persisted Points Reads

Ranking MUST read points exclusively from persisted `tournament_points` rows (per user+tournament+date), written when a date is published; ranking MUST NOT recompute points on-the-fly from tickets. Points exist only for paid ('results') dates; results set on open or closed dates MUST NOT contribute points. The migration MUST backfill `tournament_points` for every existing 'results' date so historical rankings match PointsCalculator output.

#### Scenario: Ranking reflects only persisted points

- GIVEN a published date whose points were persisted
- WHEN the tournament ranking is requested
- THEN each entry's points come from tournament_points rows
- AND no ticket recomputation happens

#### Scenario: Unpaid dates contribute no points

- GIVEN a date with match results but status 'closed'
- WHEN the ranking is requested
- THEN that date contributes zero points to every user

## RENAMED Requirements

### Requirement: Global Ranking → Tournament Ranking

(Reason: ranking is now per-tournament over persisted points; the global on-the-fly aggregation across all tournaments is no longer the ranking behavior)
(Migration: tests and docs referencing the global leaderboard MUST target the per-tournament ranking, defaulting to the active tournament)

## MODIFIED Requirements

### Requirement: Tournament Ranking

The system MUST provide a ranking for a specific tournament, read from persisted `tournament_points`. The endpoint MUST accept `tournamentId`; when omitted, it MUST default to the active tournament. When no tournament has status 'active', the response MUST be an empty list. Results MUST be sorted descending by tournament points; each entry MUST include username, tournament points, and rank position. Users with equal points MUST share the same rank position; the "fewer bets placed" tie-break MUST NOT be applied (pre-existing drift, never implemented, out of scope).
(Previously: a global leaderboard sorted by total accumulated points across all tournaments, with a ticket-count tie-break)

#### Scenario: Ranking ordered by total points

- GIVEN multiple users with different point totals in a tournament
- WHEN the ranking is requested with that tournamentId
- THEN results are sorted descending by points
- AND each entry includes username, points, and rank position

#### Scenario: Defaults to active tournament

- GIVEN no tournamentId in the request
- WHEN the ranking is requested
- THEN the active tournament's ranking is returned

#### Scenario: Tie shows shared rank

- GIVEN two users with the same total points
- WHEN the ranking is computed
- THEN both share the same rank position
- AND no ticket-count tie-break is applied

#### Scenario: Empty when no active tournament

- GIVEN no tournament with status 'active'
- WHEN the ranking is requested without tournamentId
- THEN the response is an empty list

### Requirement: Per-Tournament Breakdown

The system MUST provide a ranking filtered by a specific tournament showing each user's points within that tournament only, read from persisted `tournament_points` (see Tournament Ranking). The client MUST send `tournamentId` when requesting a non-default tournament.
(Previously: on-the-fly recomputation filtered by tournament)

#### Scenario: Tournament-scoped ranking

- GIVEN a specific tournament ID with published dates
- WHEN the per-tournament ranking is requested
- THEN only points persisted for that tournament are included
- AND the ranking is sorted descending by tournament points

### Requirement: Points Calculation

The system MUST calculate points for each user based on correct match outcome predictions per tournament date. Points MUST be calculated only when a date transitions to 'results' (publish-results) and MUST be persisted per user+tournament+date at that moment (see prize-payouts). Match results set on dates that are not yet published MUST NOT affect any user's points.
(Previously: points were computed on-the-fly from any ticket whose match had a result, including open dates)

#### Scenario: Correct prediction awards points at publish

- GIVEN a user who bet on match outcomes for a closed date
- WHEN results for that date are published
- THEN the user receives points for each correctly predicted outcome
- AND the points are persisted for user+tournament+date

#### Scenario: Incorrect prediction awards zero

- GIVEN a user who predicted an outcome that did not occur
- WHEN the results are published
- THEN that prediction awards zero points

#### Scenario: Open date results award nothing

- GIVEN a match result set while the date is still 'open'
- WHEN the user's points are checked
- THEN no points are awarded or accumulated

### Requirement: Historical Ranking

The system MUST preserve ranking accuracy through persisted `tournament_points` rows: once a date is published its points never change, and archived tournaments remain queryable by explicit `tournamentId`. The "Histórico" UI section (all-tournament listing) is out of scope; only per-tournament views are surfaced.
(Previously: ranking snapshots preserved by recomputation; historical leaderboards via global ranking)

#### Scenario: Past tournaments retain ranking

- GIVEN an archived tournament with persisted points
- WHEN its ranking is requested by tournamentId
- THEN the ranking returns the original persisted scores
- AND no on-the-fly recomputation occurs
