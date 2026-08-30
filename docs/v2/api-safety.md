# PlayStation API Safety

## Intent

Trophy Backlog uses `psn-api` to read trophy information for one personal target account through a separate reader account.

The integration is deliberately conservative. It does not perform gameplay, social, messaging, account-management, purchase, or profile-write actions.

Sony does not provide this application with a formally approved public trophy API contract. No implementation can promise zero account risk. The controls below minimize accidental abuse, credential exposure, and unnecessary request volume; they do not create permission from Sony.

## Account model

Use two different PSN accounts:

- **Reader account:** authenticates requests and should be dedicated to this application.
- **Target account:** the real account whose trophies are being tracked.

The reader account should not be used for ordinary play, purchases, messaging, automation, or unrelated tools. Keeping it separate limits the impact if Sony invalidates its session or objects to automated access.

The reader and target online IDs must be different. Trophy privacy on the target account must allow the reader to see the relevant data. A public target profile normally satisfies that requirement without a friend relationship.

## NPSSO acquisition

1. Sign in to [PlayStation](https://www.playstation.com/) in the browser as the dedicated reader account.
2. Open the [NPSSO cookie endpoint](https://ca.account.sony.com/api/v1/ssocookie) in the same browser session.
3. Copy only the returned 64-character NPSSO value.
4. Paste it into Trophy Backlog Settings and save.
5. Run a connection test before starting a title preview or synchronization.

The Settings page provides shortcuts to both pages.

Do not post, screenshot, log, commit, or paste the NPSSO into documentation or issue reports. Treat it like a password-equivalent session credential.

## Local credential protection

The preferred configuration path is Settings, not `.env`.

When saved:

- The reader and target IDs are stored in SQLite.
- The NPSSO is encrypted using AES-256-GCM.
- A random 32-byte key is stored separately as `credentials.key` in the runtime directory.
- The API returns only `hasNpsso` and renewal metadata, never the saved NPSSO.
- Newly typed text is visible while the field is focused and masked after focus leaves.

The encryption protects the value from casual inspection of the database. It is not a defense against an attacker who can read both the database and `credentials.key` under the same Windows account.

Back up the database and key together if preserving the stored credential matters. Never commit either file.

Optional `PSN_*` environment variables remain as a fallback when no local PlayStation settings exist. They should not be used simultaneously as a second independent configuration.

## NPSSO renewal reminder

When a new NPSSO is saved, Trophy Backlog records the entry time and calculates an expected renewal date 60 days later. The default reminder begins 7 days beforehand and is configurable.

This is an operational estimate, not a promise about Sony's actual session lifetime. Sony may invalidate an NPSSO earlier, later, or immediately for reasons outside the application.

If authentication fails:

1. Stop retrying repeatedly.
2. Confirm the browser is signed into the reader account, not the target account.
3. Obtain a fresh NPSSO.
4. Replace it in Settings.
5. Run one connection test.

## Request controls

### Serialized provider requests

All PlayStation operations share one request gate. Only one provider operation is issued at a time, with at least 1,000 milliseconds between starts.

This is intentionally slower than maximum throughput.

### Bounded retries

Retry policy:

- At most two attempts for one retryable request.
- At most five retries across one synchronization.

The application does not retry indefinitely.

### Throttling behavior

Errors that appear to be rate limiting or throttling are converted into `playstation_throttled`. The application stops and tells the user to wait rather than trying to overpower the provider.

### One synchronization at a time

A process-local lock rejects a second synchronization while another is active. The rejected request does not start another provider workflow or consume another cooldown.

### User-configurable cooldown

Synchronization starts are protected by a database-backed cooldown:

- Enabled by default.
- Default duration: 300 seconds.
- Configurable from 1 second through 24 hours.
- May be disabled deliberately in Settings.

Disabling the cooldown does not disable one-at-a-time locking, request serialization, one-second spacing, or retry budgets.

Keep the default unless actively diagnosing a specific problem.

### Authorization caching

Access and refresh tokens are cached in memory and reused until close to expiration. Concurrent consumers share one in-flight authorization request. Changing the stored NPSSO invalidates the cached authorization generation.

Tokens are not persisted to the database or exposed to the browser.

## User-action boundaries

Provider-triggering routes require a specific `x-trophy-backlog-action` header. This prevents an ordinary page load or generic POST from accidentally starting a provider operation.

Explicit actions include:

- connection test
- title preview
- title linking
- title import
- linked-games progress synchronization
- full trophy synchronization

The UI sends these headers only from deliberate controls.

## Sync modes and expected load

### Connection test

Authenticates the reader, resolves the reader and target identities, and reads the target trophy summary. Use it to diagnose configuration; do not spam it as a health monitor.

### Title preview

Reads the target's trophy-title pages, excludes unsupported platforms, reconciles titles with the local Library, and caches title icons.

### Progress sync

Targets already linked Library games. It updates detailed trophy earnings, snapshots, alerts, and profile progression without returning the full import/reconciliation workflow.

This is the normal Library-page synchronization.

### Full sync

Runs title preview/reconciliation, synchronizes linked detailed trophies, stores snapshots and alerts, updates profile progression, and refreshes linked IGDB metadata.

Use full sync when importing or reviewing PSN titles, not merely because a progress bar is available.

### First detailed sync

The first detailed synchronization may be slow because it must fetch trophy groups, definitions, earnings, and artwork across every linked title. Later synchronizations reuse stored definitions and local artwork where the planner determines that a full refetch is unnecessary.

A long run is not itself evidence of throttling. Follow the on-screen phase, current title, title count, and artwork progress. Do not restart merely because the initial cache takes many minutes.

## Safe response to problems

| Symptom | Response |
| --- | --- |
| `playstation_authentication_failed` | Replace the reader NPSSO, then test once. |
| `playstation_account_not_found` | Verify the online ID exactly, including capitalization and current name. |
| `playstation_throttled` | Stop and wait; do not immediately retry. |
| `playstation_sync_cooldown_active` | Wait for `nextAllowedAt`; do not disable protection casually. |
| `playstation_sync_in_progress` | Let the current sync finish; inspect progress. Restart the local API only if the process is genuinely stale. |
| malformed provider response | Stop and inspect provider/library compatibility before changing parsers. |
| partial sync | Preserve completed local work and investigate the failed titles before another full run. |

## Account-risk guidance

The behavior most likely to increase risk is deliberate misuse, not ordinary single-user reading. Avoid:

- parallelizing PlayStation calls
- reducing the request interval to chase speed
- repeatedly refreshing while a sync is running
- looping connection tests or previews
- running multiple copies of the API against the same account
- using the reader account with several automation tools
- scraping unrelated PSN surfaces
- adding write actions
- attempting to evade a throttle or suspension

If Sony suspends or blocks the reader account, stop using that credential. Do not switch rapidly through accounts or attempt to bypass the restriction. Existing local Library and trophy data remain usable without provider access.

## Network exposure

The API must remain on loopback. Trophy Backlog contains mutation endpoints and has no application password.

For private phone access:

- Use Tailscale Serve.
- Keep the phone and host PC in a trusted tailnet.
- Apply restrictive tailnet access rules if the tailnet includes other people or devices.
- Never use Tailscale Funnel.
- Never forward port `47831` from the router.
- Never change `BACKLOG_HOST` to `0.0.0.0`; startup intentionally rejects it.

## Logging and diagnostics

Do not add raw provider headers, NPSSO, access tokens, refresh tokens, or complete credential objects to logs or error responses.

Safe diagnostics include:

- stable error code
- operation phase
- request count
- retry count
- provider title count
- supported/linked title count
- current title name
- local record IDs

Production logs are local but should still be treated as sensitive operational data.

## Provider independence

The rest of the application must remain useful without live PlayStation access:

- Library and ordering
- Collections and Saved Views
- cached game/trophy details
- local images
- unobtainable overrides
- trophy and backlog history
- alerts already stored
- portable export and SQLite backups
- IGDB features when IGDB remains available

PlayStation access enriches and refreshes local data; it is not required to open the app.
