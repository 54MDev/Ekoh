import type { Player, RoomState } from "../types";

interface Props {
  state: RoomState;
  me: Player | null;
}

export default function ResultsScreen({ state, me }: Props) {
  const round = state.round;
  const players = Object.values(state.players)
    .filter((p) => p.name && p.role !== "host")
    .sort((a, b) => b.score - a.score);

  const myDelta = me && round ? (round.scoreDeltas[me.id] ?? 0) : 0;
  const myVote = me && round ? round.votes[me.id] : undefined;
  const correctVote = round ? (round.answerAIsTarget ? "A" : "B") : null;
  const votedCorrectly = myVote != null && myVote === correctVote;

  const aCount = round ? Object.values(round.votes).filter((v) => v === "A").length : 0;
  const bCount = round ? Object.values(round.votes).filter((v) => v === "B").length : 0;

  return (
    <div className="phase phase--results">
      <div className="phase-eyebrow">Results</div>
      <h1 className="phase-title">Round {state.roundNumber}</h1>

      {round && (
        <>
          <div className="results-reveal">
            <div className="results-reveal-row">
              <span className="results-label">A</span>
              <span>{round.answerAIsTarget ? "👤 Real answer" : "🤖 Clone answer"}</span>
            </div>
            <div className="results-reveal-row">
              <span className="results-label">B</span>
              <span>{round.answerAIsTarget ? "🤖 Clone answer" : "👤 Real answer"}</span>
            </div>
          </div>

          <div className="vote-tally">
            <div className={`vote-tally-cell ${correctVote === "A" ? "vote-tally-cell--correct" : ""}`}>
              <div className="vote-tally-label">A</div>
              <div className="vote-tally-count">{aCount}</div>
            </div>
            <div className={`vote-tally-cell ${correctVote === "B" ? "vote-tally-cell--correct" : ""}`}>
              <div className="vote-tally-label">B</div>
              <div className="vote-tally-count">{bCount}</div>
            </div>
          </div>

          {myVote != null && (
            <p className="phase-subtitle">
              You voted {myVote} —{" "}
              {votedCorrectly ? "correct! +1 point" : "fooled by the clone."}
            </p>
          )}

          {myDelta > 0 && me?.role === "target" && (
            <p className="phase-subtitle">You fooled {myDelta / 2} player{myDelta / 2 !== 1 ? "s" : ""} — +{myDelta} points!</p>
          )}
        </>
      )}

      <ul className="leaderboard">
        {players.map((p, i) => {
          const delta = round?.scoreDeltas[p.id] ?? 0;
          return (
            <li key={p.id} className={me?.id === p.id ? "player--me" : ""}>
              <span className="leaderboard-rank">{i + 1}</span>
              <span className="leaderboard-name">
                {p.name}
                {me?.id === p.id ? " (you)" : ""}
              </span>
              <span className="leaderboard-score">
                {p.score}
                {delta > 0 ? <span className="score-delta"> +{delta}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
