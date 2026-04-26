import { useRef, useState } from "react";
import type { ClientMessage, Player, RoomState } from "../types";

interface Props {
  state: RoomState;
  me: Player | null;
  send: (msg: ClientMessage) => void;
}

export default function QuestionScreen({ state, me, send }: Props) {
  const [draft, setDraft] = useState("");
  const sentTypingRef = useRef(false);
  const round = state.round;
  if (!round) return null;

  const isTarget = me?.role === "target";
  const submitted = round.targetAnswer != null;

  return (
    <div className="phase phase--question">
      <div className="phase-eyebrow">Question</div>
      <h1 className="phase-question">{round.currentQuestion}</h1>

      {isTarget ? (
        submitted ? (
          <p className="phase-subtitle">
            Answer locked. Host will reveal both answers shortly.
          </p>
        ) : (
          <div className="answer-form">
            <textarea
              value={draft}
              onChange={(e) => {
                const value = e.target.value;
                setDraft(value);
                if (!sentTypingRef.current && value.trim().length > 0) {
                  sentTypingRef.current = true;
                  send({ type: "targetTyping" });
                }
              }}
              placeholder="Answer in your normal voice. 1–3 sentences."
              maxLength={500}
              rows={4}
            />
            <button
              className="btn btn--primary"
              disabled={!draft.trim()}
              onClick={() => send({ type: "submitAnswer", answer: draft.trim() })}
            >
              Lock in answer
            </button>
          </div>
        )
      ) : (
        <p className="phase-subtitle muted">
          Spectator: sit tight while the target and their clone both answer.
          You'll vote when the host opens voting.
        </p>
      )}
    </div>
  );
}
