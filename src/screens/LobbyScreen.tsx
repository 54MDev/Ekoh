import type { Player, RoomState } from "../types";

interface Props {
  state: RoomState;
  me: Player | null;
  code: string;
}

export default function LobbyScreen({ state, me, code }: Props) {
  const players = Object.values(state.players).filter((p) => p.name);
  const target = players.find((p) => p.role === "target");
  const playedAtLeastOneRound = state.roundNumber > 0;

  const sorted = playedAtLeastOneRound
    ? [...players].filter((p) => p.role !== "host").sort((a, b) => b.score - a.score)
    : players;

  return (
    <div className="phase phase--lobby">
      <div className="phase-eyebrow">Room {code}</div>
      <h1 className="phase-title">{playedAtLeastOneRound ? `After round ${state.roundNumber}` : "Lobby"}</h1>
      <p className="phase-subtitle">
        {target
          ? `Target locked: ${target.name}. Waiting for host to start the round.`
          : playedAtLeastOneRound
            ? "Host is picking the next target…"
            : "Waiting for host to pick a target…"}
      </p>

      {playedAtLeastOneRound ? (
        <ul className="leaderboard">
          {sorted.map((p, i) => (
            <li
              key={p.id}
              className={`${p.isConnected ? "" : "player--gone"} ${
                me?.id === p.id ? "player--me" : ""
              }`}
            >
              <span className="leaderboard-rank">{i + 1}</span>
              <span className="leaderboard-name">
                {p.name}
                {me?.id === p.id ? " (you)" : ""}
              </span>
              <span className="leaderboard-score">{p.score}</span>
            </li>
          ))}
        </ul>
      ) : (
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
      )}
    </div>
  );
}
