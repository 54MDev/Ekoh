// Plays a 5-round single-target game:
//   - Host manually picks Alice as the target.
//   - All 5 rounds use Alice as the target — clone learns from her stack of
//     answers across the game. Bob is a spectator who votes each round.
//   - After round 5, advance lands on phase="end" with final standings.
//   - "newGame" then resets scores and returns to lobby.

import WebSocket from "ws";

const ROOM = `ECHO-${Math.floor(1000 + Math.random() * 9000)}`;
const URL = `ws://localhost:1999/parties/main/${ROOM}`;

function client(label) {
  const ws = new WebSocket(URL);
  const state = { last: null, all: [] };
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    state.all.push(msg);
    if (msg.type === "stateUpdate") state.last = msg.state;
  });
  ws.on("error", (e) => console.error(`[${label}] error`, e.message));
  return new Promise((resolve) => {
    ws.on("open", () => resolve({ ws, state, label }));
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (c, msg) => c.ws.send(JSON.stringify(msg));
const fail = (msg) => {
  console.error("✗", msg);
  process.exit(1);
};
const ok = (msg) => console.log("✓", msg);

async function waitForCloneDone(c, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (c.state.last?.round?.cloneStreaming) {
    if (Date.now() > deadline) fail("clone stream timed out");
    await wait(200);
  }
}

console.log(`Using room ${ROOM}`);

const host = await client("host");
const alice = await client("alice");
const bob = await client("bob");

send(host, { type: "join", name: "Hostie", asHost: true });
send(alice, { type: "join", name: "Alice" });
send(bob, { type: "join", name: "Bob" });
await wait(150);

const aliceId = Object.values(host.state.last.players).find((p) => p.name === "Alice")?.id;
const bobId = Object.values(host.state.last.players).find((p) => p.name === "Bob")?.id;
if (!aliceId || !bobId) fail("missing alice/bob in roster");

const aliceSeedAnswers = [
  "grew up in vancouver, lots of rain",
  "way too into bouldering",
  "i say 'literally' constantly",
  "hiked a bunch and watched movies",
  "pineapple on pizza is fine, fight me",
];
let seedCursor = 0;

async function playRoundOnceCurrentTarget() {
  const round = host.state.last.round;
  if (!round) fail("expected a round to be active");
  const targetId = round.targetId;
  const targetPlayer = host.state.last.players[targetId];
  if (targetId !== aliceId) fail(`expected Alice, got ${targetPlayer.name}`);

  const seedQs = round.seedQuestions;
  if (seedQs.length !== 1) fail(`expected exactly 1 seed question, got ${seedQs.length}`);
  send(alice, {
    type: "submitSeedAnswer",
    index: 0,
    answer: aliceSeedAnswers[seedCursor] ?? "shrug",
  });
  seedCursor += 1;
  await wait(150);

  send(host, { type: "advancePhase" }); // seed → question
  await wait(300);
  const q = host.state.last.round.currentQuestion;
  const previousAnswers = host.state.last.round.previousAnswers;
  console.log(`  round ${host.state.last.roundNumber}: q="${q.slice(0, 50)}…", prev=${previousAnswers.length}`);

  send(alice, { type: "submitAnswer", answer: "literally couldnt tell you tbh" });
  await waitForCloneDone(host);

  send(host, { type: "advancePhase" }); // question → vote
  await wait(100);
  send(bob, { type: "submitVote", vote: Math.random() > 0.5 ? "A" : "B" });
  await wait(100);

  send(host, { type: "advancePhase" }); // vote → results
  await wait(150);

  return { previousAnswers, q, seedQ: seedQs[0] };
}

// Manual setup for round 1
send(host, { type: "assignTarget", playerId: aliceId });
await wait(100);
send(host, { type: "advancePhase" }); // lobby → seed (round 1)
await wait(150);
if (host.state.last.phase !== "seed") fail("expected seed for round 1");

const rounds = [];
rounds.push(await playRoundOnceCurrentTarget());
ok("round 1: Alice targeted manually");

// Auto-progress through rounds 2-5 — should always come back to Alice
for (let i = 2; i <= 5; i++) {
  send(host, { type: "advancePhase" });
  await wait(200);
  if (host.state.last.phase !== "seed") {
    fail(`round ${i}: expected seed after auto-progress, got ${host.state.last.phase}`);
  }
  if (host.state.last.roundNumber !== i) {
    fail(`round ${i}: expected roundNumber=${i}, got ${host.state.last.roundNumber}`);
  }
  if (host.state.last.round.targetId !== aliceId) {
    fail(`round ${i}: expected Alice as target, got someone else`);
  }
  rounds.push(await playRoundOnceCurrentTarget());
  ok(`round ${i}: target stayed Alice, previousAnswers grew to ${rounds[i - 1].previousAnswers.length}`);
}

// previousAnswers should grow 0 → 1 → 2 → 3 → 4 across the 5 rounds
const prevCounts = rounds.map((r) => r.previousAnswers.length);
if (JSON.stringify(prevCounts) !== JSON.stringify([0, 1, 2, 3, 4])) {
  fail(`expected previousAnswers progression [0,1,2,3,4], got ${JSON.stringify(prevCounts)}`);
}
ok(`Alice's previousAnswers grew 0 → 1 → 2 → 3 → 4 across the 5 rounds`);

// Seed Qs all distinct
const seedQs = rounds.map((r) => r.seedQ);
if (new Set(seedQs).size !== seedQs.length) fail(`seed Q repeated: ${seedQs.join(" | ")}`);
ok(`all 5 seed questions distinct (${seedQs.length} unique)`);

// Main Qs all distinct
const mainQs = rounds.map((r) => r.q);
if (new Set(mainQs).size !== mainQs.length) fail(`main Q repeated: ${mainQs.join(" | ")}`);
ok(`all 5 main questions distinct`);

// Advance from final results → end phase
send(host, { type: "advancePhase" });
await wait(150);
if (host.state.last.phase !== "end") fail(`expected end phase, got ${host.state.last.phase}`);
if (host.state.last.round != null) fail("round should be cleared at end");
ok("results → end after MAX_ROUNDS");

// newGame resets
send(host, { type: "newGame" });
await wait(100);
if (host.state.last.phase !== "lobby") fail("newGame should return to lobby");
if (host.state.last.roundNumber !== 0) fail("newGame should reset roundNumber");
const allZero = Object.values(host.state.last.players)
  .filter((p) => p.role !== "host")
  .every((p) => p.score === 0);
if (!allZero) fail("newGame should reset all scores to 0");
ok("newGame → lobby with cleared scores + roundNumber");

console.log("\n--- single-target 5-round smoke: PASS ---");
host.ws.close();
alice.ws.close();
bob.ws.close();
process.exit(0);
