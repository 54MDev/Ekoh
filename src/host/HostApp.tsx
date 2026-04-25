import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useParty } from "../hooks/useParty";
import type { RoomState, ServerMessage } from "../types";

interface BroadcastEntry {
  id: number;
  from: string;
  text: string;
}

export default function HostApp() {
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
    const name = sessionStorage.getItem("echo:name") || "Host";
    send({ type: "join", name, asHost: true });
  }, [connected, send]);

  const joinUrl = `${window.location.origin}/play/${code}`;
  const players = state ? Object.values(state.players).filter((p) => p.name) : [];

  return (
    <div className="screen screen--host">
      <header className="host-header">
        <div>
          <h1 className="host-room-code">{code}</h1>
          <p className="host-join-url">Join at {joinUrl}</p>
        </div>
        <div className={`pill pill--${connected ? "ok" : "warn"}`}>
          {connected ? "Connected" : "Connecting…"}
        </div>
      </header>

      <section className="host-section">
        <h2>Players ({players.length})</h2>
        {players.length === 0 ? (
          <p className="muted">Waiting for players to join…</p>
        ) : (
          <ul className="player-list">
            {players.map((p) => (
              <li key={p.id} className={p.isConnected ? "" : "player--gone"}>
                <span className="player-name">{p.name}</span>
                <span className="player-role">{p.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="host-section">
        <h2>Broadcast test</h2>
        <div className="broadcast-input">
          <input
            value={pingText}
            onChange={(e) => setPingText(e.target.value)}
            placeholder="Type a message to broadcast to every player"
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
