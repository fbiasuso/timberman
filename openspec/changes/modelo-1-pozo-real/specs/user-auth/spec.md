# Delta for User Authentication

## MODIFIED Requirements

### Requirement: Admin Registration Toggle

The system MUST support a configuration toggle (persisted `allowRegistration` in system-config) that switches between self-registration and admin-only registration. Registration MUST read the live config by reference at request time — no restart or code change needed.
(Previously: SHOULD support a toggle; registration used a hardcoded constant)

#### Scenario: Toggle blocks registration immediately

- GIVEN the system is in self-registration mode (allowRegistration true)
- WHEN an admin updates config to admin-only (allowRegistration false)
- THEN the next self-registration attempt is rejected with 403 Forbidden
- AND existing users remain unaffected

#### Scenario: Toggle re-enables registration

- GIVEN the system is in admin-only mode
- WHEN an admin sets allowRegistration true
- THEN self-registration works again without restart

#### Scenario: Live read across restarts

- GIVEN allowRegistration false persisted in the table
- WHEN the server restarts and a user attempts to register
- THEN registration is still blocked (config loaded from DB at boot)
