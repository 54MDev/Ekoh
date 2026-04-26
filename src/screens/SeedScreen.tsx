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
  return (
    <div className="phase phase--seed">
      <div className="phase-eyebrow">Seed phase</div>
      <h1 className="phase-title">Hang tight…</h1>
      <p className="phase-subtitle">
        {target?.name ?? "The target"} is teaching the clone how they talk.
      </p>
      <p className="phase-progress">{answered === 0 ? "Answering…" : "Locked in ✓"}</p>
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
    <div className="seed-clipboard">
      <div className="seed-clipboard-clip">
        <span className="seed-clipboard-clip-rivet" />
      </div>
      <div className="seed-clipboard-paper">
        <p className="seed-clipboard-header">SEED PROTOCOL · TRAINING DATA</p>
        <h1 className="seed-clipboard-title">Train your clone</h1>
        <p className="seed-clipboard-subtitle">
          One question per round. The clone keeps everything you said in earlier
          rounds, caps, slang, typos and all, so it gets sharper each time
          you're picked.
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

        {answeredCount > 0 && (
          <p className="phase-progress">Locked in ✓. Host will reveal the question.</p>
        )}
      </div>
    </div>
  );
}
