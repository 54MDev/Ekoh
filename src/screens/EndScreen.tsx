import type { Player, RoomState } from "../types";

interface Props {
  state: RoomState;
  me: Player | null;
}

export default function EndScreen({ state, me }: Props) {
  const players = Object.values(state.players)
    .filter((p) => p.name && p.role !== "host")
    .sort((a, b) => b.score - a.score);
  const winner = players[0];
  const myRank = me ? players.findIndex((p) => p.id === me.id) + 1 : 0;

  return (
    <div className="phase phase--end">
      <div className="phase-eyebrow">Game over</div>
      <h1 className="phase-title">Final standings</h1>
      {winner && (
        <p className="phase-subtitle">
          🏆 {winner.name} wins with {winner.score} point{winner.score !== 1 ? "s" : ""}
        </p>
      )}
      {me && myRank > 0 && (
        <p className="phase-subtitle">
          You finished #{myRank} with {me.score} point{me.score !== 1 ? "s" : ""}.
        </p>
      )}
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
      <p className="phase-subtitle muted">Waiting on the host to start a new game…</p>
    </div>
  );
}
