import type { Player, RoomState } from "../types";

interface Props {
  state: RoomState;
  me: Player | null;
  code: string;
}

export default function LobbyScreen({ state, me, code }: Props) {
  const players = Object.values(state.players).filter((p) => p.name);
  const target = players.find((p) => p.role === "target");

  return (
    <div className="phase phase--lobby">
      <div className="phase-eyebrow">Room {code}</div>
      <h1 className="phase-title">Lobby</h1>
      <p className="phase-subtitle">
        {target
          ? `Target locked: ${target.name}. Waiting for host to start the round.`
          : "Waiting for host to pick a target…"}
      </p>

      <ul className="player-list">
        {players.map((p) => (
          <li
            key={p.id}
            className={`${p.isConnected ? "" : "player--gone"} ${
              me?.id === p.id ? "player--me" : ""
            }`}
          >
            <span className="player-name">
              {p.name}
              {me?.id === p.id ? " (you)" : ""}
            </span>
            <span className="player-role">{p.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
