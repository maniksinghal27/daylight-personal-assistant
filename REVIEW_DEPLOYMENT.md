# Public review deployment

The public review app runs as a separate Cloudflare Worker and database in the
project owner's account. The GitHub repository belongs to `maniksinghal27`.
The earlier private Sites deployment is not the judging URL and is not being
transferred or made public.

## Deploy from the owner's Cloudflare account

Use Node.js 24 or later and the official Wrangler CLI. Sign in as the intended
owner and confirm the account before creating any resources.

```sh
npm run build
npx wrangler login
npx wrangler whoami
npx wrangler d1 create daylight-review
```

Set the returned database ID in `wrangler.jsonc`'s `DB` binding. Do not substitute
an existing private database. Apply the migration and configure a random session
signing secret of at least 32 characters using Wrangler's hidden secret prompt.

```sh
npx wrangler d1 migrations apply DB --remote
npx wrangler secret put REVIEW_SESSION_KEY
npx wrangler deploy
```

The configuration has no cron trigger. Keep background schedules disabled.
Do not add Google credentials to this review deployment. The public wrapper
does not pass Google credentials or scheduler secrets to the application.

For live NVIDIA inference, first verify the owner's Nebius key and available
model using `node scripts/check-config.mjs`. Then configure `NEBIUS_API_KEY` as
a Worker secret and `NEBIUS_MODEL` as the exact verified model ID. Never commit
these values. Until configured, the interface identifies template generation.

## Reviewer access

The published `workers.dev` URL opens without a ChatGPT account or allowlist.
Each visitor receives a signed, HttpOnly session for an isolated fictional
workspace. Email delivery is simulated. Real account connections, uploads, and
background scheduling are blocked at the public entrypoint. Visitors can inspect
the supplied sources, generate a brief, edit memory, draft a follow-up, review
its exact approval, and inspect the simulated receipt.

If live inference is configured, the wrapper caps new run requests at 20 per
session and 200 across the deployment. Resetting a demo does not reset those
counts. A new deployment/database or explicit operator allowance adjustment is
needed after the total allowance is used. Monitor the provider's own usage
limits as well.

Before submission, open the final URL as a new visitor, verify session isolation,
run the full workflow, check the actual model evidence, and update the Devpost
demo URL. A prepared configuration alone is not a deployed or verified demo.
