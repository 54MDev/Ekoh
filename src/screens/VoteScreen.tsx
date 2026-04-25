import type { ClientMessage, Player, RoomState } from "../types";

interface Props {
  state: RoomState;
  me: Player | null;
  send: (msg: ClientMessage) => void;
}

export default function VoteScreen({ state, me, send }: Props) {
  const round = state.round;
  if (!round) return null;

  const isTarget = me?.role === "target";
  const myVote = me ? round.votes[me.id] : undefined;

  if (isTarget) {
    return (
      <div className="phase phase--vote">
        <div className="phase-eyebrow">Voting</div>
        <h1 className="phase-title">The room is voting.</h1>
        <p className="phase-subtitle">
          You can't vote on your own round — watch the host screen.
        </p>
      </div>
    );
  }

  return (
    <div className="phase phase--vote">
      <div className="phase-eyebrow">Which one is real?</div>
      <h1 className="phase-question">{round.currentQuestion}</h1>

      <div className="vote-buttons">
        <button
          className={`btn btn--vote ${myVote === "A" ? "btn--vote-on" : ""}`}
          onClick={() => send({ type: "submitVote", vote: "A" })}
        >
          A
        </button>
        <button
          className={`btn btn--vote ${myVote === "B" ? "btn--vote-on" : ""}`}
          onClick={() => send({ type: "submitVote", vote: "B" })}
        >
          B
        </button>
      </div>

      <p className="phase-subtitle">
        {myVote ? `Locked in: ${myVote}. Tap the other to change.` : "Tap A or B."}
      </p>
    </div>
  );
}
