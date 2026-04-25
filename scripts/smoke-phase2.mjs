// Drives a full state-machine cycle through the Partykit room:
// host + 2 spectators connect, host assigns a target, then advances through
// every phase. Verifies each transition lands where expected.

import WebSocket from "ws";

const ROOM = "ECHO-9991";
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

const host = await client("host");
const p1 = await client("p1");
const p2 = await client("p2");

send(host, { type: "join", name: "Hostie", asHost: true });
send(p1, { type: "join", name: "Alice" });
send(p2, { type: "join", name: "Bob" });
await wait(150);

if (host.state.last?.phase !== "lobby") fail("expected initial phase=lobby");
ok("initial phase is lobby");

const aliceId = Object.values(host.state.last.players).find((p) => p.name === "Alice")?.id;
if (!aliceId) fail("alice not in roster");

// Try to advance without a target — should be a no-op
send(host, { type: "advancePhase" });
await wait(100);
if (host.state.last.phase !== "lobby") fail("advance without target should be ignored");
ok("advance blocked when no target assigned");

// Assign Alice as target
send(host, { type: "assignTarget", playerId: aliceId });
await wait(100);
if (host.state.last.players[aliceId].role !== "target") fail("alice should be target");
ok("alice assigned as target");

// lobby → seed
send(host, { type: "advancePhase" });
await wait(100);
if (host.state.last.phase !== "seed") fail(`expected seed, got ${host.state.last.phase}`);
if (host.state.last.round?.targetId !== aliceId) fail("round.targetId mismatch");
if (host.state.last.roundNumber !== 1) fail("roundNumber should be 1");
ok("lobby → seed (round initialized)");

// seed → question (server picks question from bank)
send(host, { type: "advancePhase" });
await wait(100);
if (host.state.last.phase !== "question") fail(`expected question, got ${host.state.last.phase}`);
if (!host.state.last.round.currentQuestion) fail("currentQuestion should be set");
ok(`seed → question ("${host.state.last.round.currentQuestion}")`);

// Target submits an answer
send(p1, { type: "submitAnswer", answer: "I'd just chill at home tbh" });
await wait(100);
if (host.state.last.round.targetAnswer !== "I'd just chill at home tbh") {
  fail("targetAnswer not stored");
}
ok("target answer recorded");

// Non-target tries to submit — should be ignored
send(p2, { type: "submitAnswer", answer: "hijack attempt" });
await wait(100);
if (host.state.last.round.targetAnswer !== "I'd just chill at home tbh") {
  fail("non-target submitAnswer should be rejected");
}
ok("non-target submitAnswer ignored");

// question → vote
send(host, { type: "advancePhase" });
await wait(100);
if (host.state.last.phase !== "vote") fail(`expected vote, got ${host.state.last.phase}`);
ok("question → vote");

// Spectator votes
send(p2, { type: "submitVote", vote: "A" });
await wait(100);
const bobId = Object.values(host.state.last.players).find((p) => p.name === "Bob")?.id;
if (host.state.last.round.votes[bobId] !== "A") fail("bob's vote not recorded");
ok("spectator vote recorded");

// Target tries to vote — should be ignored
send(p1, { type: "submitVote", vote: "B" });
await wait(100);
if (host.state.last.round.votes[aliceId] != null) fail("target vote should be rejected");
ok("target vote ignored");

// vote → results
send(host, { type: "advancePhase" });
await wait(100);
if (host.state.last.phase !== "results") fail(`expected results, got ${host.state.last.phase}`);
ok("vote → results");

// results → lobby (target role cleared)
send(host, { type: "advancePhase" });
await wait(100);
if (host.state.last.phase !== "lobby") fail(`expected lobby, got ${host.state.last.phase}`);
if (host.state.last.round != null) fail("round should be null after results");
if (Object.values(host.state.last.players).some((p) => p.role === "target")) {
  fail("target role should be cleared");
}
ok("results → lobby (round cleared, target unassigned)");

// Non-host tries to advance — should be ignored
send(p2, { type: "assignTarget", playerId: aliceId });
await wait(100);
if (host.state.last.players[aliceId].role === "target") {
  fail("non-host assignTarget should be rejected");
}
ok("non-host assignTarget ignored");

console.log("\n--- phase 2 smoke: PASS ---");
host.ws.close();
p1.ws.close();
p2.ws.close();
process.exit(0);
