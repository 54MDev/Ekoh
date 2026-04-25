import type * as Party from "partykit/server";
import type { ClientMessage, RoomState, ServerMessage } from "../src/types";

const ROOM_CODE_RE = /^ECHO-\d{4}$/;

export default class EchoServer implements Party.Server {
  state: RoomState = {
    phase: "lobby",
    players: {},
    round: null,
    roundNumber: 0,
    questions: [],
  };

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    if (!ROOM_CODE_RE.test(this.room.id)) {
      conn.close(1008, `Invalid room code: ${this.room.id}`);
      return;
    }

    const existing = this.state.players[conn.id];
    if (existing) {
      existing.isConnected = true;
    } else {
      this.state.players[conn.id] = {
        id: conn.id,
        name: "",
        role: "spectator",
        score: 0,
        isConnected: true,
      };
    }
    this.send(conn, { type: "stateUpdate", state: this.state });
    this.broadcastState();
  }

  onClose(conn: Party.Connection) {
    const player = this.state.players[conn.id];
    if (!player) return;
    if (!player.name) {
      delete this.state.players[conn.id];
    } else {
      player.isConnected = false;
    }
    this.broadcastState();
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "join": {
        const player = this.state.players[sender.id];
        if (!player) return;
        player.name = msg.name.trim().slice(0, 24) || "Guest";
        if (msg.asHost && !this.hasHost()) {
          player.role = "host";
        }
        this.broadcastState();
        return;
      }
      case "ping": {
        const from = this.state.players[sender.id]?.name || "anon";
        this.broadcast({ type: "broadcast", from, text: msg.text.slice(0, 280) });
        return;
      }
      default:
        return;
    }
  }

  private hasHost(): boolean {
    return Object.values(this.state.players).some((p) => p.role === "host");
  }

  private broadcastState() {
    this.broadcast({ type: "stateUpdate", state: this.state });
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }
}

