# Daylight background worker

The private Site exposes two authenticated MCP operations:

- `scheduler_status`: read the current visitor's live workspace schedule counts and the worker heartbeat.
- `run_due_work`: evaluate due schedules in that visitor's workspace, record missed occurrences, skip overlap, and persist internal outputs. It never dispatches email or approves actions.

Sites authenticates the MCP caller and supplies the Site-scoped owner identity. The code scopes scheduler reads and writes to that identity. A demo workspace cannot be targeted through these tools. Retrieved source text cannot select an owner or expand permissions.

For the linked background task, call `run_due_work`, then `scheduler_status`. Remain quiet for routine checks and unchanged/non-actionable states. Notify only when an actionable failure prevents work. Do not send messages or approve email. Keep timing in the schedule rather than in its prompt. Credentials stay in the deployment environment and encrypted Google credential storage.

The legacy `POST /api/tick` path remains available for an external scheduler with `SCHEDULER_SECRET`, plus Sites service authorization when required. Do not put either credential in task prompts or source code.

## Private Sites service caller

For the confirmed owner-private deployment, `SCHEDULER_MODE=private-sites` enables `POST /api/scheduler-tick`. A cloud task retrieves the current Site service authorization from `get_site`, sends it only to this Site using `OAI-Sites-Authorization`, and invokes this endpoint. Sites validates and consumes that credential before forwarding the request.

The endpoint accepts no owner input. It requires exactly one live owner workspace in the database, rejects a different signed-in visitor, and processes only that owner's schedules. Demo sessions are excluded. It returns only persisted heartbeat time and trigger count. Use the database's `service_state` heartbeat for readback verification. Keep the audience owner-private and disable this service mode before changing access to public/shared. The independent owner-scoped MCP tools remain available for visitor-authenticated callers.
