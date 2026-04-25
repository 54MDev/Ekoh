import { useEffect, useState } from "react";
import type { ClientMessage, Player, RoomState } from "../types";

interface Props {
  state: RoomState;
  me: Player | null;
  send: (msg: ClientMessage) => void;
}

export default function SeedScreen({ state, me, send }: Props) {
  const round = state.round;
  if (!round) return null;
  const isTarget = me?.role === "target";
  const target = Object.values(state.players).find((p) => p.id === round.targetId);

  if (isTarget) {
    return <SeedForm round={round} send={send} />;
  }

  const answered = round.seedAnswers.filter(Boolean).length;
  const total = round.seedQuestions.length;
  return (
    <div className="phase phase--seed">
      <div className="phase-eyebrow">Seed phase</div>
      <h1 className="phase-title">Hang tight…</h1>
      <p className="phase-subtitle">
        {target?.name ?? "The target"} is teaching the AI how they talk.
      </p>
      <p className="phase-progress">
        {answered} / {total} questions answered
      </p>
    </div>
  );
}

function SeedForm({
  round,
  send,
}: {
  round: NonNullable<RoomState["round"]>;
  send: (msg: ClientMessage) => void;
}) {
  const [drafts, setDrafts] = useState<string[]>(() =>
    round.seedQuestions.map((_, i) => round.seedAnswers[i] ?? ""),
  );

  useEffect(() => {
    setDrafts((prev) =>
      round.seedQuestions.map((_, i) => prev[i] ?? round.seedAnswers[i] ?? ""),
    );
  }, [round.seedQuestions.length]);

  const setDraft = (i: number, value: string) => {
    setDrafts((prev) => {
      const next = prev.slice();
      next[i] = value;
      return next;
    });
  };

  const submit = (i: number) => {
    const answer = drafts[i].trim();
    if (!answer) return;
    send({ type: "submitSeedAnswer", index: i, answer });
  };

  const answeredCount = round.seedAnswers.filter(Boolean).length;

  return (
    <div className="phase phase--seed">
      <div className="phase-eyebrow">You're the target</div>
      <h1 className="phase-title">Train your clone</h1>
      <p className="phase-subtitle">
        Answer however you naturally would. Caps, slang, typos — all of it. The
        AI is reading these to imitate you.
      </p>

      <ol className="seed-list">
        {round.seedQuestions.map((q, i) => {
          const submitted = !!round.seedAnswers[i];
          return (
            <li key={i} className={submitted ? "seed-item seed-item--locked" : "seed-item"}>
              <p className="seed-q">{q}</p>
              {submitted ? (
                <p className="seed-a">{round.seedAnswers[i]}</p>
              ) : (
                <>
                  <textarea
                    value={drafts[i]}
                    onChange={(e) => setDraft(i, e.target.value)}
                    placeholder="Answer in your normal voice"
                    maxLength={500}
                    rows={2}
                  />
                  <button
                    className="btn btn--primary"
                    disabled={!drafts[i].trim()}
                    onClick={() => submit(i)}
                  >
                    Lock in
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ol>

      <p className="phase-progress">
        {answeredCount} / {round.seedQuestions.length} locked in
      </p>
    </div>
  );
}
