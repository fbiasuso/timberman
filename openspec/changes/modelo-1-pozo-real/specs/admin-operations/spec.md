# Delta for Admin Operations

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Match Results Entry

Admins MUST be able to enter or update match results for a closed tournament date. Entering results stores the scores; the date remains "closed" until the publish-results action transitions it to "results-published" and distributes points and payouts.
(Previously: entering results directly transitioned the date and distributed points)

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

Admins MUST be able to view and update system-wide configuration; updates MUST be persisted to the `system_config` table (see system-config) and take effect immediately.

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
