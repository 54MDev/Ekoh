// Verifies the clone holds "answering…" until 5–10s after the target's
// first keystroke (cloneRevealAt). Runs through round 1 of a real game
// and measures elapsed time from typing → clone ready.

import WebSocket from "ws";

const ROOM = `ECHO-${Math.floor(1000 + Math.random() * 9000)}`;
const URL = `ws://localhost:1999/parties/main/${ROOM}`;

function client(label) {
  const ws = new WebSocket(URL);
  const state = { last: null };
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === "stateUpdate") state.last = msg.state;
  });
  ws.on("error", (e) => console.error(`[${label}] error`, e.message));
  return new Promise((r) => ws.on("open", () => r({ ws, state, label })));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (c, msg) => c.ws.send(JSON.stringify(msg));
const fail = (m) => { console.error("✗", m); process.exit(1); };
const ok = (m) => console.log("✓", m);

console.log(`Using room ${ROOM}`);

const host = await client("host");
const alice = await client("alice");
const bob = await client("bob");

send(host, { type: "join", name: "Hostie", asHost: true });
send(alice, { type: "join", name: "Alice" });
send(bob, { type: "join", name: "Bob" });
await wait(150);

const aliceId = Object.values(host.state.last.players).find((p) => p.name === "Alice")?.id;
if (!aliceId) fail("alice missing");

send(host, { type: "assignTarget", playerId: aliceId });
await wait(100);
send(host, { type: "advancePhase" }); // → seed
await wait(150);

// Submit seed answer(s)
const seedQs = host.state.last.round.seedQuestions;
for (let i = 0; i < seedQs.length; i++) {
  send(alice, { type: "submitSeedAnswer", index: i, answer: "lowercase no punctuation lol" });
}
await wait(150);

send(host, { type: "advancePhase" }); // → question
await wait(300);
if (host.state.last.phase !== "question") fail("expected question");
if (host.state.last.round.cloneRevealAt != null) fail("cloneRevealAt should be null until target types");
ok("entered question phase, cloneRevealAt is null (no typing yet)");

// Wait a moment so the OpenAI call can start streaming
await wait(1500);

const typingAt = Date.now();
send(alice, { type: "targetTyping" });
await wait(150);

const revealAt = host.state.last.round.cloneRevealAt;
if (revealAt == null) fail("cloneRevealAt should be set after targetTyping");
const plannedDelta = revealAt - typingAt;
if (plannedDelta < 4900 || plannedDelta > 10100) {
  fail(`cloneRevealAt should be 5–10s after typing, got ${plannedDelta}ms`);
}
ok(`cloneRevealAt set to ${plannedDelta}ms after typing (in 5–10s window)`);

// Repeated targetTyping should be a no-op
const before = host.state.last.round.cloneRevealAt;
send(alice, { type: "targetTyping" });
await wait(100);
if (host.state.last.round.cloneRevealAt !== before) fail("subsequent targetTyping changed cloneRevealAt");
ok("subsequent targetTyping is a no-op");

// Wait for clone to flip to ready, then check actual elapsed time
const deadline = Date.now() + 30_000;
while (host.state.last.round?.cloneStreaming) {
  if (Date.now() > deadline) fail("clone never finished within 30s");
  await wait(100);
}
const finishedAt = Date.now();
const elapsedFromTyping = finishedAt - typingAt;

if (elapsedFromTyping < 4900) {
  fail(`clone finished only ${elapsedFromTyping}ms after typing — should be ≥ 5s`);
}
if (elapsedFromTyping > 12000) {
  fail(`clone took ${elapsedFromTyping}ms after typing — should land within ~10s + small slop`);
}
ok(`clone became ready ${elapsedFromTyping}ms after typing (planned ${plannedDelta}ms)`);

// Submit and finish round
send(alice, { type: "submitAnswer", answer: "literally just chillin" });
await wait(100);

console.log("\n--- typing-timing smoke: PASS ---");
host.ws.close();
alice.ws.close();
bob.ws.close();
process.exit(0);
