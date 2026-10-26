# Daylight

A private personal work assistant built from the supplied `Personal_AI_Assistant_Functional_Spec.docx`. Meeting preparation, saved preferences, editable follow-up drafts, explicit email approvals, reusable workflows, and schedule controls share one responsive workspace.

## Run locally

Requires Node.js 24 or later. No package-install step is needed. PDF.js is vendored with its Apache 2.0 license.

```sh
npm run build
npm test
npm run dev
```

Open `http://127.0.0.1:4317`. The local adapter binds only to loopback and uses a development identity. Do not expose it to the internet. Local data persists in the ignored `.local.sqlite` file. Local and hosted databases are separate.

Choose **Try the demo** on Home. This explicit action creates an isolated session with fictional sources. Demo email delivery is simulated. Without Nebius credentials, generation uses labeled deterministic templates. Demo sessions expire after 24 hours and cannot connect real accounts.

## Walkthrough

1. Enter the demo or connect a consenting Google account in Settings.
2. Prepare **Product direction with Maya**, inspect selected sources and memory, and open the saved brief.
3. Create a follow-up, supply meeting outcomes, and edit the app draft.
4. Request approval and inspect the exact recipient, subject, body, action version, and expiry.
5. Approve once or deny. Inspect the provider or clearly simulated receipt.
6. Save a personal skill, test it without external writes, then activate it.
7. Create a schedule. Schedules start paused. Check next occurrences and worker health before enabling.

## Live service setup

Store production values in Sites runtime secrets. Use ignored `.env.local` only for local development. Never paste secrets into Chat, Memory, or source documents.

| Variable | Purpose |
| --- | --- |
| `NEBIUS_API_KEY` | Nebius Token Factory credential |
| `NEBIUS_MODEL` | Verified available NVIDIA Nemotron model ID for your region |
| `NEBIUS_BASE_URL` | Optional regional URL; default `https://api.tokenfactory.nebius.com/v1` |
| `GOOGLE_CLIENT_ID` | Google web OAuth client |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_TOKEN_KEY` | High-entropy secret for encrypting stored Google tokens |
| `SCHEDULER_SECRET` | Bearer secret for the unattended `/api/tick` endpoint |

Enable Gmail and Calendar APIs, configure OAuth consent for a consenting test account, and register `https://YOUR-SITE/oauth/google` as the exact redirect URI. Identity uses private Sites sign-in; Google source access is granted separately. Google identity sign-in from the spec is not implemented in this hosting variant.

Accept the processing disclosure before live generation. The request includes the current task, selected source text, and eligible active memories. No alternate model provider is used as a fallback. Inspect Settings > Deployment after an actual inference for sanitized model evidence. Verify the exact available model ID in your Nebius account; no real inference credential was available during development.

Official references: [Nebius API](https://api.tokenfactory.nebius.com/docs), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending).

## Hosting and background work

The build emits a Cloudflare Worker ESM export in `dist/server/index.js`, with embedded UI and PDF parsing assets. `.openai/hosting.json` declares `DB`. The migration in `drizzle/0000_workspace.sql` is packaged under `dist/.openai/drizzle`. Append migrations for schema changes; request handlers do not create tables.

The Worker exports `scheduled(controller, env, ctx)`. Provision a minute cron trigger on a compatible host, or configure an external durable scheduler to call:

```http
POST /api/tick
Authorization: Bearer <SCHEDULER_SECRET>
```

Private Sites access may also require platform service authorization. Both boundaries must be configured on the unattended caller. The scheduled export alone does not provision a hosted trigger. This build does not create a recurring Codex chat as an application scheduler.

The first tick records a heartbeat. Age over five minutes is degraded. Occurrences more than two minutes late are marked missed and not replayed. Run now leaves the next occurrence unchanged. Timezone recurrence handles DST gaps at the next valid minute and runs once in a repeated hour. One active run blocks overlap; unresolved approvals count as active.

Scheduled generation currently uses saved permitted source snapshots, without automatically refreshing Google content. Add and validate fresh retrieval before relying on live morning coverage.

## Implementation

- `src/client.js`, `src/style.css`, `src/index.html`: responsive UI, keyboard access, dialogs, error/empty states, and unsaved-editor handling.
- `src/server.js`: owner checks, fixed action catalog, encrypted Google credentials, model requests, approvals, receipts, and scheduler.
- `src/core.js`: records, built-in declarative skills, demo templates, and timezone recurrence.
- `scripts/build.mjs`: embedded Worker build. Optional Google Fonts is the only external frontend asset request.
- `scripts/dev.mjs`: loopback Node adapter with SQLite.
- `tests/acceptance.mjs`: integration checks against SQLite and mocked external providers.

Every workspace read/write includes its owner. Mutations use compare-and-swap revisions. An approval claim is persisted before dispatch, preventing duplicate claims. Editing invalidates prior previews. A timeout after dispatch remains Outcome unknown, blocking repeat sends until reconciliation. Model output cannot execute tools, save memories, or approve writes. Retrieved text is evidence only.

## Validation and release limits

Thirty automated checks pass: isolation, encrypted credentials, duplicate approval prevention, stale/denied/paused actions, deleted memory/source exclusion, OAuth owner binding, mocked model evidence, uncertain send reconciliation, authenticated scheduler execution, and DST recurrence. Browser checks covered explicit demo entry, meeting preparation, approval receipts, and desktop/mobile layout. No real email was sent during development.

The full AC01–AC20 release gate has not passed. Remaining work includes:

- Real Nebius inference, Google OAuth/read/send, received-message proof, and deployed closed-browser scheduling.
- Google identity sign-in; complete email-thread retrieval and reply-thread sends. Current retrieval uses selected-label snippets and upcoming calendar events.
- Conversation-only source permissions. Uploads currently produce explicitly workspace-scoped sources, capped at 1 million extracted characters, five files per batch, and 10 MB per file.
- Full typed custom-skill input/output schemas, and meeting/follow-up input editors for schedules. The current automation editor is intended for Daily brief or personal text-generation skills.
- Monthly budget resets/reservations, monetary estimates, execution-duration limits, and tool-call ceilings. The current enforced token ceiling is cumulative per workspace.
- Fresh-auth export, queued archives, and expiring links. Current export is an authenticated immediate JSON snapshot without credentials.
- Complete source-to-derived-memory deletion graphs. Source deletion removes retrieval text immediately; optional associated-document deletion removes citing outputs.
- Hosting-wide session revocation, provider-side token revocation, automatic retention expiry, active-store deletion SLA, and backup erasure verification. Workspace deletion removes active app records and credentials; external sent email is unaffected.
- Quiet-hours editor and deferred delivery. Attention suppression uses saved defaults of 22:00–08:00. Notifications stay in-app.

Voice, multiple accounts, calendar writes, standing authority, event monitors, and shared packages remain excluded as specified for later release. Preserve the private hosting audience unless the owner asks to share it.
