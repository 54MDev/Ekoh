import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useParty } from "../hooks/useParty";
import type { RoomState, ServerMessage } from "../types";

interface BroadcastEntry {
  id: number;
  from: string;
  text: string;
}

export default function PlayerApp() {
  const { code = "" } = useParams();
  const [state, setState] = useState<RoomState | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastEntry[]>([]);
  const [pingText, setPingText] = useState("");

  const { send, connected } = useParty({
    room: code,
    onMessage: (msg: ServerMessage) => {
      if (msg.type === "stateUpdate") setState(msg.state);
      if (msg.type === "broadcast") {
        setBroadcasts((prev) =>
          [...prev, { id: Date.now() + Math.random(), from: msg.from, text: msg.text }].slice(-20),
        );
      }
    },
  });

  useEffect(() => {
    if (!connected) return;
    const name = sessionStorage.getItem("echo:name") || "Guest";
    send({ type: "join", name });
  }, [connected, send]);

  const players = state ? Object.values(state.players).filter((p) => p.name) : [];

  return (
    <div className="screen screen--player">
      <header className="player-header">
        <div className="room-code-small">{code}</div>
        <div className={`pill pill--${connected ? "ok" : "warn"}`}>
          {connected ? "Connected" : "Connecting…"}
        </div>
      </header>

      <section>
        <h2>In the room</h2>
        <ul className="player-list">
          {players.map((p) => (
            <li key={p.id}>
              <span className="player-name">{p.name}</span>
              <span className="player-role">{p.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Send a test ping</h2>
        <div className="broadcast-input">
          <input
            value={pingText}
            onChange={(e) => setPingText(e.target.value)}
            placeholder="Hello, room"
          />
          <button
            className="btn btn--primary"
            onClick={() => {
              if (!pingText.trim()) return;
              send({ type: "ping", text: pingText.trim() });
              setPingText("");
            }}
          >
            Send
          </button>
        </div>
        <ul className="broadcast-log">
          {broadcasts.map((b) => (
            <li key={b.id}>
              <strong>{b.from}:</strong> {b.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
