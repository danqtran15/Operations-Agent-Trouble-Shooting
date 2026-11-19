# Agent Workshop chat code review

Reviewed November 18, 2026 (America/Chicago).

## Scope and result

The reviewed application is **`C:\Users\danqt\AgentWorkshop`**, which runs CoordinatorAPP, DeveloperAPP, and Reviewer in Discord. The Expo application in `Operations-Agent-Trouble-Shooting` does not implement this routing. This review covers the current Agent Workshop working tree, including its existing uncommitted changes.

I reviewed message ingestion and mentions, repository selection, task queues, approvals, model transport, timeouts, interruption, review handoffs, status reporting, persistence, attachment handling, and setup/lifecycle code. I also inspected the relevant saved conversation and paused queue without reading saved Discord bot tokens.

**Result: 10 actionable defects.** Eleven isolated reproductions demonstrate them; two exercise different consequences of the attachment race. A separate control verifies that a fresh, explicitly addressed Coordinator request routes correctly without an older task in its queue.

- Existing Agent Workshop suite: **73/73 passed**.
- Additional audit suite: **12/12 passed**, comprising eleven bug reproductions and one control.
- The audit tests deliberately assert the current defective behavior. Passing these reproductions confirms a defect; it does not mean the application has been fixed.
- No live Discord messages or live model turns were sent. Agent Workshop source, configuration, and running processes were not changed. Tests used temporary projects, fake model responses, and fake transports; the existing suite also starts temporary local setup servers.

P1 means a high-priority correctness defect that can run unintended work, misattribute an answer, or bypass the intended review sequence. P2 means a consequential conditional, persistence, or protocol defect.

## Findings

### 1. [P1] A new Coordinator request resumes an older Developer task first

**Locations:** [team.mjs:85](C:/Users/danqt/AgentWorkshop/src/team.mjs:85), [team.mjs:112](C:/Users/danqt/AgentWorkshop/src/team.mjs:112), [team.mjs:152](C:/Users/danqt/AgentWorkshop/src/team.mjs:152).

Stopping an active turn puts its inbox item at the front of the queue. A failed/timed-out turn is likewise put back at the front in the error handler at line 182. A subsequent human message retains **every old item whose `from` is `user`**, clears the pause in workspace mode, and appends the newly addressed request. An interrupted Developer item originating from a user or approval therefore survives ahead of an explicit Coordinator request. The serial scheduler executes that Developer item first and can leave Coordinator waiting for the entire Developer turn.

**Reproduction 1:** Start Developer, stop it, then address Coordinator with a planning-only instruction. The queue becomes `[developer, coordinator]`; the next model call repeats the old Developer task. This does not require a mention parsing failure or any model choosing to delegate.

**Connection to the reported incident:** The saved journal contains the repeated Coordinator requests and stops from the supplied transcript. The saved paused queue also contains a Developer item originating from a user approval. This mechanism closely matches the observed behavior. Intermediate queue snapshots were not journaled, so the audit does not claim to reconstruct every live scheduler transition.

**Fix direction:** Separate explicitly resumable interrupted work from newly received work. A new task or explicitly addressed Coordinator request must not silently replay an interrupted implementation. Preserve history and partial files while retiring obsolete executable inbox entries. Keep deliberate multi-message batching distinct from task replacement.

### 2. [P1] A late timed-out result can be accepted as the response to a later request

**Locations:** [codex.mjs:44](C:/Users/danqt/AgentWorkshop/src/codex.mjs:44), [codex.mjs:94](C:/Users/danqt/AgentWorkshop/src/codex.mjs:94).

Active protocol operations are looked up only by `threadId`. Timeout deletes that entry and sends an interrupt, but does not wait for the old turn to finish. A retry can register another operation under the same thread. Incoming final text and completion notifications never verify their turn ID against the current operation.

**Reproduction 5:** Time out `old-turn`, start `new-turn` on the same thread, then deliver final text and a completion for `old-turn`. The promise for `new-turn` resolves with the old answer and its current handlers are cleaned up. A late interrupted completion could instead reject the new request.

**Impact:** Old answers or structured completion/review fields can be attributed to current work; a valid new reply can later be discarded. The reproduction demonstrates transport misattribution, not an observed live stale reply in the supplied conversation.

**Fix direction:** Validate thread and turn identity for all turn notifications; bind cleanup to the specific operation/generation. Quarantine a timed-out thread until interruption is confirmed, or safely retire its connection/thread before retrying.

### 3. [P1] An approval prefix overrides explicit instructions not to implement

**Locations:** [access.mjs:13](C:/Users/danqt/AgentWorkshop/src/access.mjs:13), [team.mjs:84](C:/Users/danqt/AgentWorkshop/src/team.mjs:84), [team.mjs:98](C:/Users/danqt/AgentWorkshop/src/team.mjs:98).

`workApproval` accepts a leading phrase such as `go ahead` and ignores conflicting text after it. The approval branch runs before ordinary role addressing and immediately creates an editing grant and queues Developer.

**Reproduction 3:** With a published proposal, send Coordinator: `go ahead but do not implement; only explain the risks`. The controller records this as approval and queues implementation despite the explicit restriction.

**Fix direction:** Do not convert a qualified or conflicting message into unconditional approval. Route it for clarification or planning without activating implementation. Keep the user's full constraints attached to any accepted approval.

### 4. [P1] A completion containing a proposal loses the independent review handoff

**Locations:** [team.mjs:263](C:/Users/danqt/AgentWorkshop/src/team.mjs:263), [team.mjs:274](C:/Users/danqt/AgentWorkshop/src/team.mjs:274).

The response schema permits `workComplete: true` together with a non-null `proposal`. `accept` handles the proposal first: it clears the editing grant and queue and forces recipients to `user`. The subsequent automatic Reviewer handoff requires the grant still to be in the editing phase, so it never runs. Approving the resulting review proposal queues Developer again.

**Reproduction 4:** Developer returns a completed implementation addressed to Reviewer, along with a proposal to review it. No Reviewer turn is scheduled; approval creates another Developer task.

**Live corroboration:** The journal contains a Developer message saying implementation and checks were complete and it was handing work to Reviewer. The controller appended a proposal titled to review those changes. The next approval announced that Developer was starting the proposed change. This is an independent instance of the reproduced state-machine problem.

**Fix direction:** Enforce role- and phase-specific response invariants. A completed implementation must transition to independent review; a proposal field must not erase that transition. Review requests should not be treated as new implementation approvals.

### 5. [P2] An old proposal can be approved after the conversation changes topics

**Locations:** [team.mjs:98](C:/Users/danqt/AgentWorkshop/src/team.mjs:98), [team.mjs:112](C:/Users/danqt/AgentWorkshop/src/team.mjs:112), [team.mjs:271](C:/Users/danqt/AgentWorkshop/src/team.mjs:271).

A revised human message clears `pending`, but leaves `lastProposal` intact. In workspace mode, the next approval falls back to that historical proposal even if the user has explicitly moved to another topic. A short `yes` addressed to Coordinator can consequently approve an unrelated old implementation.

**Reproduction 2:** Publish a feature plan, explicitly switch to explaining a different topic with no implementation, then say `yes`. Developer is queued with the original feature plan.

The existing refinement test intentionally preserves a proposal across changes to the same task. The missing distinction is between a refinement and a replacement task.

**Fix direction:** Bind proposals to a current task generation and intended confirmation. Carry a proposal across a deliberate refinement, but retire it when its task is superseded. Do not treat any later affirmative answer as approval of a historical plan.

### 6. [P2] Slow uploads can reverse instructions and let work start without required files

**Locations:** [team.mjs:118](C:/Users/danqt/AgentWorkshop/src/team.mjs:118), [team.mjs:152](C:/Users/danqt/AgentWorkshop/src/team.mjs:152), [discord.mjs:34](C:/Users/danqt/AgentWorkshop/src/discord.mjs:34).

Discord message callbacks can overlap. `receiveProject` awaits attachment downloads before persisting and queuing the human message. A later text-only message can finish first, and its debounce can expire while the earlier download is still pending. The epoch check after download only controls debounce updates; it does not enforce ingestion order or stop stale insertion.

**Reproduction 6:** Hold the upload for `First instruction: use blue`, receive `Correction: use green instead`, then finish the upload. The queued prompt and conversation journal put the correction first and the obsolete blue instruction last.

**Reproduction 7:** Hold an attached specification, receive a follow-up asking to implement it, and advance past debounce. A model turn runs with no attachments. Another turn runs when the original upload completes.

**Fix direction:** Persist message order immediately and track outstanding ingestion. Prepare attachments asynchronously, but do not schedule a later dependent message ahead of an earlier unfinished one. Allow stop/status controls to bypass upload preparation without reordering task instructions.

### 7. [P2] A passed review can schedule another writable Developer turn

**Locations:** [team.mjs:273](C:/Users/danqt/AgentWorkshop/src/team.mjs:273), [team.mjs:284](C:/Users/danqt/AgentWorkshop/src/team.mjs:284), [team.mjs:195](C:/Users/danqt/AgentWorkshop/src/team.mjs:195).

Recipients are queued before the controller interprets the review result. A valid Reviewer response with `review: passed` and `to: [developer]` queues Developer, then clears the grant and also schedules Coordinator. In workspace mode, the next Developer turn creates a new editing grant automatically. A passed review therefore does not reliably close the implementation cycle.

**Reproduction 9:** Accept such a passed review. The queue is `[developer, coordinator]` even though there are no requested changes and the prior grant is closed. Writable access on that Developer turn follows from the unconditional workspace grant creation; actual unintended file edits were not performed in this audit.

**Fix direction:** Normalize recipients according to the review phase. A passing review should close the implementation and report results; non-actionable colleague messages should not create a new writable implementation turn. Keep requested fixes associated with the existing review cycle.

### 8. [P2] The dedicated permission-request response is unreachable

**Location:** [codex.mjs:65](C:/Users/danqt/AgentWorkshop/src/codex.mjs:65).

The generic `endsWith('/requestApproval')` branch catches `item/permissions/requestApproval` before its dedicated handler. The app sends `{ decision: 'decline' }` instead of its intended `{ permissions: {}, scope: 'turn' }` response. The more specific branch is dead code.

**Reproduction 8:** Call the server-request handler with that exact method and inspect the outgoing response. It contains `decision`, with no `permissions` field.

**Impact:** Permission requests receive the wrong response shape and can produce protocol errors or failed turns. This request path was tested with a fake protocol transport; live server handling was not exercised.

**Fix direction:** Dispatch exact request types before generic suffix matching, and test the result schema for each supported approval request.

### 9. [P2] A crash during attachment ingestion can permanently lose a message

**Locations:** [team.mjs:60](C:/Users/danqt/AgentWorkshop/src/team.mjs:60), [store.mjs:35](C:/Users/danqt/AgentWorkshop/src/store.mjs:35), [team.mjs:119](C:/Users/danqt/AgentWorkshop/src/team.mjs:119).

`Store.seen` durably records the Discord message ID before the body is stored as a user event or inbox item. During an attachment download, a crash can leave only the deduplication marker. On restart, a replay with that ID is discarded even though no recoverable copy of the request exists.

**Reproduction 10:** Hold a download, restore the state file as it exists at that point into a separate temporary Store, and retry the message ID. It is already seen, with no queued task or user event.

**Fix direction:** Persist the raw accepted message and its ingestion state atomically with deduplication. Recover unfinished preparation after restart; mark a request fully processed only when its durable continuation exists.

### 10. [P2] A missing interrupt-completion event can block the whole team's scheduler

**Locations:** [codex.mjs:94](C:/Users/danqt/AgentWorkshop/src/codex.mjs:94), [team.mjs:172](C:/Users/danqt/AgentWorkshop/src/team.mjs:172), [access.mjs:17](C:/Users/danqt/AgentWorkshop/src/access.mjs:17).

Aborting a turn only sends an interrupt RPC. It does not settle the active turn when the interrupt is acknowledged. The promise still depends on a later `turn/completed` event or the original task timeout. If that completion event does not arrive, the global serial pump remains inside the old turn, potentially for the remainder of the 15-minute Developer limit. New Coordinator requests cannot get a model turn during that interval.

**Reproduction 11:** Have the fake server acknowledge an interrupt but withhold completion. The operation remains registered and its promise remains pending. Injecting the completion finally releases it.

Waiting for confirmed termination is necessary to avoid overlapping writable work. The defect is the lack of a bounded interruption/recovery state, rather than the decision to serialize work.

**Fix direction:** Use a short bounded shutdown handshake and an explicit stopping/recovery state. If termination cannot be confirmed, retire the owned connection safely and keep implementation paused. Do not solve this by merely starting another writable turn while the old one could still be active.

## Repair order and verification

1. Fix task replacement/resumption and retire obsolete approvals. Add regression cases for explicit Coordinator mentions after timeout/stop, including planning-only requests.
2. Bind protocol results to their turn identity and implement bounded interrupt recovery. Inject delayed completion, delayed start, failed interrupt, and disconnected-server events.
3. Enforce completion/review transitions independent of conflicting model fields and non-actionable recipients.
4. Preserve input order and pending attachments, and persist a recoverable incoming message before deduplication can discard it.
5. Correct permission-request dispatch and validate each response shape.

Convert each audit reproduction into a desired-behavior regression test as its corresponding defect is repaired. Run those alongside the existing 73 tests. Then perform a deliberately controlled live Discord check: normal Coordinator mention; stop during Developer work; a fresh planning-only Coordinator request; a genuine approval; completion through Reviewer; and a two-message upload sequence. Live sending was outside this review.

## Reproduction command and limits

From `C:\Users\danqt\Projects\Operations-Agent-Trouble-Shooting`:

```powershell
node --test audit/agent-workshop-chat-repros.mjs
```

The script imports the current Agent Workshop modules using their absolute local path. Set `AGENT_WORKSHOP_AUDIT_ROOT` if that folder moves. It modifies temporary fixture projects, not the real repositories being served by the Discord bots.

This is a source review with deterministic failure injections, not proof that every interleaving is covered or that every possible defect has been identified. No live Discord reconnect, live Codex failure, or production message delivery was exercised. The existing tests mock incoming routing roles and much of the transport; their passing result does not cover these omitted interleavings. The original bug was reproducible without changing bot identity mappings, so changing Discord names or repeatedly re-mentioning Coordinator is not an adequate repair.
