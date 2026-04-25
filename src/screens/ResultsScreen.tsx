import type { Player, RoomState } from "../types";

interface Props {
  state: RoomState;
  me: Player | null;
}

export default function ResultsScreen({ state, me }: Props) {
  const players = Object.values(state.players)
    .filter((p) => p.name && p.role !== "host")
    .sort((a, b) => b.score - a.score);

  return (
    <div className="phase phase--results">
      <div className="phase-eyebrow">Results</div>
      <h1 className="phase-title">Round {state.roundNumber}</h1>
      <p className="phase-subtitle">
        Scoring goes live in phase 4. For now, host can advance back to lobby.
      </p>

      <ul className="leaderboard">
        {players.map((p, i) => (
          <li key={p.id} className={me?.id === p.id ? "player--me" : ""}>
            <span className="leaderboard-rank">{i + 1}</span>
            <span className="leaderboard-name">
              {p.name}
              {me?.id === p.id ? " (you)" : ""}
            </span>
            <span className="leaderboard-score">{p.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
