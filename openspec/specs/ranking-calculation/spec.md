# Ranking Calculation — Specification

## Purpose

Points leaderboard with per-tournament breakdown and historical ranking across all tournaments.

## Requirements

### Requirement: Points Calculation

The system MUST calculate points for each user based on correct match outcome predictions per tournament date.

#### Scenario: Correct prediction awards points

- GIVEN a user who bet on match outcomes for a date
- WHEN the results for that date are published
- THEN the user receives points for each correctly predicted outcome
- AND points accumulate in the user's total score

#### Scenario: Incorrect prediction awards zero

- GIVEN a user who predicted an outcome that did not occur
- WHEN the results are published
- THEN that prediction awards zero points

### Requirement: Global Ranking

The system MUST provide a global leaderboard sorted by total accumulated points across all tournaments.

#### Scenario: Ranking ordered by total points

- GIVEN multiple users with different point totals
- WHEN the global ranking is requested
- THEN results are sorted descending by total points
- AND each entry includes username, total points, and rank position

#### Scenario: Tie-breaking

- GIVEN two users with the same total points
- WHEN the ranking is computed
- THEN the user with fewer bets placed is ranked higher
- AND if still tied, the user who registered earlier is ranked higher

### Requirement: Per-Tournament Breakdown

The system MUST provide a ranking filtered by a specific tournament showing each user's points within that tournament only.

#### Scenario: Tournament-scoped ranking

- GIVEN a specific tournament ID with dates and bets
- WHEN the per-tournament ranking is requested
- THEN only points earned in that tournament are included
- AND the ranking is sorted descending by tournament points

### Requirement: Historical Ranking

The system MUST preserve ranking snapshots so historical leaderboards remain accurate even after new tournaments start.

#### Scenario: Past tournaments retain ranking

- GIVEN a closed tournament with finalized rankings
- WHEN a new tournament is created and users earn new points
- THEN querying the closed tournament's ranking returns the original scores
- AND global ranking includes all historical points
