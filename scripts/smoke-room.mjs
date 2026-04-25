// Connects two WebSocket clients to the same Partykit room, joins as host + player,
// sends a ping from the host, asserts both clients see it. Used as a phase-1 smoke test.

import WebSocket from "ws";

const ROOM = "ECHO-9999";
const URL = `ws://localhost:1999/parties/main/${ROOM}`;

function client(label) {
  const ws = new WebSocket(URL);
  const received = [];
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    received.push(msg);
    console.log(`[${label}] <-`, msg.type, msg.type === "broadcast" ? `${msg.from}: ${msg.text}` : "");
  });
  ws.on("error", (e) => console.error(`[${label}] error`, e.message));
  return new Promise((resolve) => {
    ws.on("open", () => {
      console.log(`[${label}] connected`);
      resolve({ ws, received });
    });
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const host = await client("host");
const player = await client("player");

host.ws.send(JSON.stringify({ type: "join", name: "Hostie", asHost: true }));
player.ws.send(JSON.stringify({ type: "join", name: "Patty" }));
await wait(200);

host.ws.send(JSON.stringify({ type: "ping", text: "hello room" }));
await wait(200);

const hostGotBroadcast = host.received.some((m) => m.type === "broadcast" && m.text === "hello room");
const playerGotBroadcast = player.received.some((m) => m.type === "broadcast" && m.text === "hello room");
const lastState = [...player.received].reverse().find((m) => m.type === "stateUpdate");
const playerNames = lastState ? Object.values(lastState.state.players).map((p) => p.name) : [];

console.log("\n--- assertions ---");
console.log("host saw broadcast:    ", hostGotBroadcast);
console.log("player saw broadcast:  ", playerGotBroadcast);
console.log("player names in state: ", playerNames);

host.ws.close();
player.ws.close();

if (!hostGotBroadcast || !playerGotBroadcast || !playerNames.includes("Hostie") || !playerNames.includes("Patty")) {
  process.exit(1);
}
