# PlayStation API Safety

## Goal

PlayStation access must remain conservative, read-only, deliberate, and easy to disable. The integration exists to read trophy information for a personal local app—not to imitate a PlayStation client or automate account activity.

No unofficial integration can promise zero enforcement risk. These rules minimize exposure and make accidental abuse materially less likely.

## Account model

- Use a dedicated reader PSN account.
- Keep `PSN_READER_ONLINE_ID` different from `PSN_TARGET_ONLINE_ID`; the API rejects identical configured IDs.
- Keep the target account's trophy visibility accessible to the reader account.
- Do not play games, earn trophies, make purchases, message users, change settings, or perform other normal activity with the reader account.
- Never use the primary account's NPSSO as a convenience substitute.

## Credential handling

- Store `PSN_READER_NPSSO` only in `apps/api/.env` or the local process environment.
- The token must contain exactly 64 characters.
- Never commit `.env`, paste the token into client code, logs, screenshots, portable exports, or documentation.
- The browser receives only configured/not-configured status and non-secret account results.
- If the reader account is no longer dedicated or a token may have leaked, sign out/revoke the session and generate a replacement.

Logging into `playstation.com` with the reader account before retrieving the NPSSO is valid. The NPSSO must come from that same active reader-account session.

## Current enforced protections

The current API provides these protections:

- **Local binding:** the API starts only on `127.0.0.1` or `localhost`.
- **Server-only credentials:** PlayStation secrets never need to enter the React app.
- **Explicit actions:** connection test, title preview, title linking, title import, and synchronization require exact `x-trophy-backlog-action` values.
- **Serialized calls:** all PlayStation operations share one request queue.
- **Minimum spacing:** the default request gate leaves at least 1,000 ms between provider calls.
- **Bounded retrying:** each provider request permits at most two attempts, and one synchronization may consume at most five retries total.
- **Limited platform scope:** preview processing keeps supported PS3, PS4, and PS5 trophy titles.
- **No background polling:** current PlayStation requests occur only after an explicit user action.
- **Read-oriented operations:** implemented provider calls resolve accounts and read trophy/profile/title data.

These limits are process-local. Restarting the API resets the in-memory request queue and retry accounting.

## Planned protections

Checkpoint 3 adds persisted typed sync policy:

- A Library sync cooldown enabled by default at 300 seconds.
- A deliberate toggle that can disable the cooldown.
- API rejection with remaining-wait information when the cooldown has not elapsed.
- A single in-flight synchronization lock so double-clicks or multiple browser tabs cannot overlap a sync.
- Settings UI that explains the safety tradeoff instead of encouraging a zero-second interval.

Checkpoint 4 separates fast Library progress sync from PSN import/reconciliation. Fast sync will touch only existing PSN links; it will not search IGDB, create Library games, or wade through unlinked titles in the interface.

## Safe development rules

1. Use fixtures or mocked operations for automated tests. Tests must never consume live NPSSO credentials.
2. Run one small manual connection test before testing a broader sync.
3. Do not add automatic sync-on-page-load or a recurring polling timer.
4. Do not parallelize PlayStation calls to reduce waiting time.
5. Do not retry authentication failures in a tight loop.
6. Stop after repeated authorization, rate-limit, or provider-shape failures and inspect the response before trying again.
7. Prefer stored snapshots for UI development instead of repeatedly fetching live data.
8. Treat a provider library upgrade as integration-risk work: review changed operations, run mocked tests, then perform one controlled live test.

## Expected failures

An expired or rejected NPSSO should produce a clear failure and require manual replacement. A missing target account should not trigger username guessing. Provider response-shape changes should fail validation instead of writing partial or malformed trophy records.

Rate limiting or transient provider errors may use the bounded retry budget. Authentication failures, validation failures, and permanent lookup failures should not be blindly retried.

## Incident response

If unexpected requests, account security notices, or repeated failures occur:

1. Stop the local API.
2. Sign the reader account out of active sessions and replace the NPSSO.
3. Confirm the target ID and privacy visibility manually.
4. Inspect local logs without sharing credentials.
5. Use stored Library and snapshot data while the integration is disabled.
6. Resume with one connection test only after the cause is understood.

The rest of the app must remain useful while PSN access is unavailable. Library organization, Collections, Saved Views, cached metadata, backups, and existing snapshots are local features, not contingent on a live reader session.
