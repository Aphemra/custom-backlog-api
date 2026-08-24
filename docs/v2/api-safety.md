# External API safety policy

No third-party integration may be enabled until it follows this policy.

Absolute protection from third-party enforcement cannot be guaranteed.
The application therefore minimizes credentials, request volume, writable
behavior, automation, and exposure.

## PlayStation account boundary

The application must authenticate only with a dedicated disposable reader
account.

The user's primary PlayStation account credentials, cookies, tokens, and
NPSSO value must never be entered into or stored by Trophy Backlog.

The reader account may query only trophy information that the primary account
makes visible to it through ordinary PlayStation privacy settings.

## Allowed PlayStation behavior

- Resolve the configured target account.
- Read the target account's visible trophy titles.
- Read visible trophy definitions and earned progress when required.
- Store normalized local snapshots.
- Perform synchronization only after an explicit user action.
- Optionally skip requests when the most recent successful sync is still
  considered fresh.

## Prohibited PlayStation behavior

- Sending messages
- Modifying profiles
- Managing friends
- Creating or joining sessions
- Launching games or altering presence
- Earning, unlocking, or modifying trophies
- Purchasing or modifying store content
- Reading unrelated social data
- Background polling
- Concurrent request floods
- Automatic retries without a strict limit
- Attempting to bypass privacy settings, authentication challenges,
  throttling, or access denial

## Request controls

The PlayStation adapter must have one centralized request queue.

Initial safety defaults:

- One request at a time
- At least one second between requests
- No more than five retry attempts across an entire sync
- No more than two attempts for an individual failed request
- A minimum six-hour cooldown between successful full syncs
- A manual force-sync action may bypass freshness, but not rate or retry
  limits
- Stop immediately on authentication or authorization failures
- Stop on throttling and require a later manual retry
- Never loop until success

If a legitimate synchronization cannot operate within the current request
budget, development must stop and the budget must be reviewed explicitly.
Code must not silently increase it.

## Failure behavior

A failed synchronization must preserve the last successful local snapshot.

Partial data must not replace a complete snapshot. Errors should be presented
as local application status, not hidden behind repeated requests.

The application must distinguish:

- authentication failure
- privacy or authorization denial
- throttling
- network failure
- unexpected response shape
- incomplete synchronization

## Credentials

Credentials belong only in ignored local environment files or an appropriate
operating-system credential store.

Credentials must never appear in:

- frontend code
- API responses
- logs
- exported backlog backups
- Git history
- screenshots or diagnostics

## Metadata providers

Metadata integrations such as IGDB must remain separate from trophy
synchronization.

Metadata failures must not prevent access to locally stored games or trophy
history. Provider identifiers must not become the application's only game
identity.

## Required tests before enabling PlayStation access

- The configured account is the dedicated reader account.
- The target account is separate from the reader account.
- Every exposed adapter operation is read-only.
- Request concurrency is one.
- Retry and cooldown limits are enforced.
- Authentication failures stop the sync.
- Throttling stops the sync.
- Partial results cannot overwrite the last complete snapshot.
- Secrets are absent from logs, API responses, exports, and frontend bundles.
- No synchronization begins automatically on page load.
