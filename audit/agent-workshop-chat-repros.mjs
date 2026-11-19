// Read-only audit reproductions. These assert the CURRENT buggy behavior;
// they are evidence, not a passing acceptance suite for a future fix.
// All projects, transports, and model replies are local test fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const workshop = process.env.AGENT_WORKSHOP_AUDIT_ROOT ?? 'C:/Users/danqt/AgentWorkshop';
const load = relative => import(pathToFileURL(path.join(workshop, relative)).href);
const { harness, answer } = await load('test/helpers.mjs');
const { Codex } = await load('src/codex.mjs');
const { Store } = await load('src/store.mjs');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const context = args => JSON.parse(args.input[0].text);
const wide = h => { h.config.developerAccess = { mode: 'workspace', networkAccess: true }; };

test('CONTROL: a fresh explicit Coordinator request routes correctly without an older inbox', async t => {
  const h = harness(t, [answer('Coordinator responds directly.')]);
  wide(h);
  await h.receive('Coordinator discuss the plan only', { roles: ['coordinator'] });
  await h.drain();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].model, h.config.roles.coordinator.model);
  assert(h.activity.every(event => event.role === 'coordinator'));
});

test('REPRO 1: stopped Developer task runs before a new explicit Coordinator request', async t => {
  const began = deferred();
  const h = harness(t, [args => new Promise((resolve, reject) => {
    args.signal.addEventListener('abort', () => reject(new Error('Stopped fixture')), { once: true });
    began.resolve();
  }), answer('Old Developer task replayed.'), answer('Coordinator finally responds.')]);
  wide(h);
  await h.receive('Developer implement the old task', { roles: ['developer'] });
  h.team.debounce.clear();
  const running = h.team.pump();
  await began.promise;
  await h.receive('stop');
  await running;
  assert.equal(h.p().paused, true);
  assert.equal(h.p().queue[0].role, 'developer');
  await h.receive('Coordinator discuss a new plan only; do not start Developer', { roles: ['coordinator'] });
  assert.deepEqual(h.p().queue.map(item => item.role), ['developer', 'coordinator']);
  await h.drain();
  assert.match(context(h.calls[1]).inbox.text, /old task/);
  assert.match(context(h.calls[2]).inbox.text, /new plan only/);
});

test('REPRO 2: a stale proposal survives a new topic and an unrelated yes approves it', async t => {
  const proposal = { summary: 'Implement the old feature', files: ['old-feature.txt'], checks: [] };
  const h = harness(t, [answer('Old plan.', ['user'], { proposal }), answer('Explaining the new topic.')]);
  wide(h);
  await h.receive('Coordinator plan the old feature');
  await h.drain();
  await h.receive('Coordinator explain a different topic only; no implementation');
  await h.drain();
  assert.equal(h.p().pending, null);
  assert.equal(h.p().lastProposal.summary, proposal.summary);
  h.team.closed = true; // Freeze the scheduler so the routing decision can be inspected.
  await h.receive('yes', { roles: ['coordinator'] });
  assert.equal(h.p().queue[0].role, 'developer');
  assert.match(h.p().queue[0].text, /Implement the old feature/);
});

test('REPRO 3: an approval prefix overrides explicit instructions not to implement', async t => {
  const h = harness(t, [answer('Plan.', ['user'], {
    proposal: { summary: 'Implement a feature', files: ['feature.txt'], checks: [] }
  })]);
  wide(h);
  await h.receive('Coordinator propose the feature');
  await h.drain();
  h.team.closed = true;
  await h.receive('go ahead but do not implement; only explain the risks', { roles: ['coordinator'] });
  assert.equal(h.p().grant.phase, 'editing');
  assert.equal(h.p().queue[0].role, 'developer');
  assert.match(h.p().queue[0].text, /The user approved this change/);
});

test('REPRO 4: completion plus a review proposal loses the independent Reviewer handoff', async t => {
  const h = harness(t, [answer('Implementation complete; please review it.', ['reviewer'], {
    workComplete: true,
    proposal: { summary: 'Review the completed changes', files: ['app.js'], checks: ['Inspect changes'] }
  })]);
  wide(h);
  await h.receive('Developer implement the requested feature', { roles: ['developer'] });
  await h.drain();
  assert.equal(h.calls.length, 1);
  assert.equal(h.p().queue.length, 0);
  assert.equal(h.p().grant, null);
  assert.equal(h.p().pending.summary, 'Review the completed changes');
  assert.deepEqual(h.p().events.filter(e => e.kind === 'agent').at(-1).to, ['user']);
  h.team.closed = true;
  await h.receive('go ahead');
  assert.equal(h.p().queue[0].role, 'developer');
});

test('REPRO 5: a timed-out turn can complete a later turn on the same Codex thread', async () => {
  const codex = new Codex();
  let starts = 0;
  codex.rpc = async method => method === 'turn/start'
    ? { turn: { id: ++starts === 1 ? 'old-turn' : 'new-turn' } }
    : {};
  const args = { threadId: 'same-thread', input: [], tools: async () => [], timeoutMs: 20 };
  await assert.rejects(codex.run(args), /Agent took too long/);
  const second = codex.run({ ...args, timeoutMs: 1000 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(codex.turns.get('same-thread').turnId, 'new-turn');
  codex.receive({ method: 'item/completed', params: {
    threadId: 'same-thread', turnId: 'old-turn',
    item: { type: 'agentMessage', phase: 'final_answer', text: 'Old timed-out result' }
  } });
  codex.receive({ method: 'turn/completed', params: {
    threadId: 'same-thread', turn: { id: 'old-turn', status: 'completed' }
  } });
  assert.equal((await second).text, 'Old timed-out result');
});

test('REPRO 6: slow attachment downloads reverse the order of a correction and its original request', async t => {
  const began = deferred(), downloaded = deferred();
  const h = harness(t, [answer('Received the reversed instructions.')]);
  h.media.save = async () => { began.resolve(); return downloaded.promise; };
  const older = h.receive('First instruction: use blue', { attachments: [{ id: 'image' }] });
  await began.promise;
  await h.receive('Correction: use green instead');
  downloaded.resolve({ id: 'image', type: 'image/png', original: 'C:/fixture.png' });
  await older;
  await h.drain();
  assert.match(context(h.calls[0]).inbox.text, /Correction: use green instead[\s\S]*First instruction: use blue/);
  assert.deepEqual(h.p().events.filter(e => e.kind === 'user').map(e => e.text), [
    'Correction: use green instead', 'First instruction: use blue'
  ]);
});

test('REPRO 7: a newer message can trigger work before an earlier attachment finishes', async t => {
  const began = deferred(), downloaded = deferred();
  const h = harness(t, [answer('Ran without the pending attachment.'), answer('Ran again after download.')]);
  h.media.save = async () => { began.resolve(); return downloaded.promise; };
  const older = h.receive('Read this attached specification first', { attachments: [{ id: 'spec' }] });
  await began.promise;
  await h.receive('Then implement the feature described in it');
  // drain advances past the production debounce without waiting on the download.
  await h.drain();
  assert.equal(h.calls.length, 1);
  assert.deepEqual(context(h.calls[0]).attachments, []);
  downloaded.resolve({ id: 'spec', type: 'text/plain', original: 'C:/fixture.txt' });
  await older;
  await h.drain();
  assert.equal(h.calls.length, 2);
});

test('REPRO 8: a permission request is caught by the wrong generic approval branch', async () => {
  const codex = new Codex();
  const sent = [];
  codex.send = message => sent.push(message);
  await codex.serverRequest({ id: 7, method: 'item/permissions/requestApproval', params: {} });
  assert.deepEqual(sent[0].result, { decision: 'decline' });
  assert.equal('permissions' in sent[0].result, false);
});

test('REPRO 9: a passed review can schedule a new writable Developer turn', async t => {
  const h = harness(t);
  wide(h);
  h.p().grant = { phase: 'reviewing', cycles: 0, changedFiles: [] };
  const project = h.team.projects()[0];
  await h.team.accept(project, { role: 'reviewer' }, answer('Review passed.', ['developer'], { review: 'passed' }));
  assert.equal(h.p().grant, null);
  assert.deepEqual(h.p().queue.map(item => item.role), ['developer', 'coordinator']);
});

test('REPRO 10: deduplication is persisted before an uploading message is durably queued', async t => {
  const began = deferred(), downloaded = deferred();
  const h = harness(t);
  h.team.closed = true;
  h.media.save = async () => { began.resolve(); return downloaded.promise; };
  const receiving = h.receive('Important instructions and attachment', { attachments: [{ id: 'spec' }] });
  await began.promise;
  // A separate directory restores exactly the state durable at this crash point.
  const crashCopy = path.join(h.root, 'crash-copy');
  fs.mkdirSync(crashCopy);
  fs.copyFileSync(h.store.file, path.join(crashCopy, 'state.json'));
  const restored = new Store(crashCopy);
  try {
    assert.equal(restored.seen('1'), true);
    assert.deepEqual(restored.project('cs6440').queue, []);
    assert.equal(restored.project('cs6440').events.some(e => e.kind === 'user'), false);
  } finally {
    restored.close();
    downloaded.resolve({ id: 'spec', type: 'text/plain', original: 'C:/fixture.txt' });
    await receiving;
  }
});

test('REPRO 11: an acknowledged interrupt without a completion event leaves the turn pending', async () => {
  const codex = new Codex(), abort = new AbortController();
  let interrupts = 0, settled = false;
  codex.rpc = async method => {
    if (method === 'turn/start') return { turn: { id: 'active-turn' } };
    if (method === 'turn/interrupt') interrupts++;
    return {};
  };
  const work = codex.run({ threadId: 'thread', input: [], tools: async () => [], signal: abort.signal, timeoutMs: 1000 });
  const outcome = work.then(value => { settled = true; return value; }, error => { settled = true; return error; });
  await new Promise(resolve => setImmediate(resolve));
  abort.abort();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(interrupts, 1);
  assert.equal(settled, false);
  assert.equal(codex.turns.has('thread'), true);
  codex.receive({ method: 'turn/completed', params: {
    threadId: 'thread', turn: { id: 'active-turn', status: 'interrupted' }
  } });
  assert.match((await outcome).message, /Work stopped/);
});
