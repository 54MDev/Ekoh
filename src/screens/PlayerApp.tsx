import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useParty } from "../hooks/useParty";
import type { RoomState, ServerMessage } from "../types";
import LobbyScreen from "./LobbyScreen";
import SeedScreen from "./SeedScreen";
import QuestionScreen from "./QuestionScreen";
import VoteScreen from "./VoteScreen";
import ResultsScreen from "./ResultsScreen";
import EndScreen from "./EndScreen";

export default function PlayerApp() {
  const { code = "" } = useParams();
  const [state, setState] = useState<RoomState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  const { send, connected, socket } = useParty({
    room: code,
    onMessage: (msg: ServerMessage) => {
      if (msg.type === "stateUpdate") setState(msg.state);
    },
  });

  useEffect(() => {
    if (!connected || !socket) return;
    setMyId(socket.id ?? null);
    const name = sessionStorage.getItem("echo:name") || "Guest";
    send({ type: "join", name });
  }, [connected, socket, send]);

  const me = useMemo(
    () => (state && myId ? state.players[myId] ?? null : null),
    [state, myId],
  );

  return (
    <div className="screen screen--player">
      <header className="player-header">
        <div className="room-code-small">{code}</div>
        <div className={`pill pill--${connected ? "ok" : "warn"}`}>
          {connected ? me?.name || "Connected" : "Connecting…"}
        </div>
      </header>

      {!state ? (
        <p className="muted">Syncing room state…</p>
      ) : state.phase === "lobby" ? (
        <LobbyScreen state={state} me={me} code={code} />
      ) : state.phase === "seed" ? (
        <SeedScreen state={state} me={me} send={send} />
      ) : state.phase === "question" ? (
        <QuestionScreen state={state} me={me} send={send} />
      ) : state.phase === "vote" ? (
        <VoteScreen state={state} me={me} send={send} />
      ) : state.phase === "results" ? (
        <ResultsScreen state={state} me={me} />
      ) : (
        <EndScreen state={state} me={me} />
      )}
    </div>
  );
}
