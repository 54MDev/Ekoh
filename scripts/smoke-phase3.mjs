// Drives a full round end-to-end including a real OpenAI clone stream.
// Uses a unique room so it doesn't share state with smoke-phase2.
//
// Requires: partykit dev running, OPENAI_API_KEY set in .env.

import WebSocket from "ws";

const ROOM = `ECHO-${Math.floor(1000 + Math.random() * 9000)}`;
const URL = `ws://localhost:1999/parties/main/${ROOM}`;

function client(label) {
  const ws = new WebSocket(URL);
  const state = { last: null, all: [], tokens: [] };
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    state.all.push(msg);
    if (msg.type === "stateUpdate") state.last = msg.state;
    if (msg.type === "cloneToken") state.tokens.push(msg.token);
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

console.log(`Using room ${ROOM}`);

const host = await client("host");
const target = await client("target");
const spec = await client("spec");

send(host, { type: "join", name: "Hostie", asHost: true });
send(target, { type: "join", name: "Tara" });
send(spec, { type: "join", name: "Sam" });
await wait(150);

const targetId = Object.values(host.state.last.players).find((p) => p.name === "Tara")?.id;
if (!targetId) fail("target not found");

send(host, { type: "assignTarget", playerId: targetId });
await wait(100);

// lobby → seed
send(host, { type: "advancePhase" });
await wait(150);
if (host.state.last.phase !== "seed") fail("expected seed");
const seedQs = host.state.last.round.seedQuestions;
if (!Array.isArray(seedQs) || seedQs.length < 4) fail("seedQuestions not populated");
ok(`seed phase started with ${seedQs.length} seed questions`);

// Target submits all seed answers
const seedAnswers = [
  "Grew up in a small beach town in California, real chill vibes.",
  "Way too into board games. I own like 40.",
  "lowercase no punctuation usually. lots of 'lol' and 'idk' tbh",
  "i say 'tbh' and 'literally' a stupid amount",
  "went to a friends bbq, watched some f1, slept in",
  "ranch goes on everything. fight me.",
];
for (let i = 0; i < seedQs.length; i++) {
  send(target, { type: "submitSeedAnswer", index: i, answer: seedAnswers[i] || "idk really" });
}
await wait(150);

const answered = host.state.last.round.seedAnswers.filter(Boolean).length;
if (answered !== seedQs.length) fail(`expected ${seedQs.length} answers, got ${answered}`);
ok("all seed answers recorded");

// seed → question (this kicks off the OpenAI stream)
send(host, { type: "advancePhase" });
await wait(300);
if (host.state.last.phase !== "question") fail("expected question");
if (host.state.last.round.cloneError) {
  fail(`clone errored before streaming: ${host.state.last.round.cloneError}`);
}
if (!host.state.last.round.cloneStreaming) {
  fail(`cloneStreaming should be true (state=${JSON.stringify(host.state.last.round)})`);
}
if (host.state.last.round.answerAIsTarget == null) fail("answerAIsTarget should be set");
ok(`seed → question, clone streaming started (answerAIsTarget=${host.state.last.round.answerAIsTarget})`);

console.log(`  question: "${host.state.last.round.currentQuestion}"`);

// Wait for clone to finish (with timeout)
const start = Date.now();
const deadline = start + 30_000;
while (host.state.last?.round?.cloneStreaming) {
  if (Date.now() > deadline) fail("clone stream timed out after 30s");
  await wait(200);
}

const elapsed = Date.now() - start;
const cloneAnswer = host.state.last.round.cloneAnswer ?? "";
const cloneError = host.state.last.round.cloneError;
if (cloneError) fail(`clone errored: ${cloneError}`);
if (!cloneAnswer.trim()) fail("clone returned empty");
ok(`clone finished in ${elapsed}ms (${cloneAnswer.length} chars)`);
console.log(`  clone said: "${cloneAnswer}"`);

// Spectator sees the final answer in their state too
if ((spec.state.last?.round?.cloneAnswer ?? "") !== cloneAnswer) {
  fail("spectator state.cloneAnswer should match host's");
}
ok("spectator state mirrors final cloneAnswer");

// Target submits their answer
send(target, { type: "submitAnswer", answer: "tbh just chillin watching f1, you?" });
await wait(100);
if (host.state.last.round.targetAnswer !== "tbh just chillin watching f1, you?") {
  fail("target answer not recorded");
}
ok("target answer locked in");

// question → vote
send(host, { type: "advancePhase" });
await wait(100);
if (host.state.last.phase !== "vote") fail("expected vote");
ok("question → vote");

// Spectator votes
send(spec, { type: "submitVote", vote: "A" });
await wait(100);

// vote → results
send(host, { type: "advancePhase" });
await wait(100);
if (host.state.last.phase !== "results") fail("expected results");
ok("vote → results");

// results → lobby
send(host, { type: "advancePhase" });
await wait(100);
if (host.state.last.phase !== "lobby") fail("expected lobby");
if (host.state.last.round != null) fail("round should be cleared");
ok("results → lobby (round reset)");

console.log("\n--- phase 3 smoke: PASS ---");
host.ws.close();
target.ws.close();
spec.ws.close();
process.exit(0);
