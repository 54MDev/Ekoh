import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useParty } from "../hooks/useParty";
import StreamingText from "./StreamingText";
import { useTypewriter } from "./useTypewriter";
import type { Phase, Player, RoomState, ServerMessage } from "../types";

const PHASE_LABELS: Record<Phase, string> = {
  lobby: "Lobby",
  seed: "Seed",
  question: "Question",
  vote: "Vote",
  results: "Results",
};

const ADVANCE_LABELS: Record<Phase, string> = {
  lobby: "Start round",
  seed: "Reveal question",
  question: "Open voting",
  vote: "Close voting",
  results: "Back to lobby",
};

const TYPEWRITER_CPS = 28;

export default function HostApp() {
  const { code = "" } = useParams();
  const [state, setState] = useState<RoomState | null>(null);

  const { send, connected } = useParty({
    room: code,
    onMessage: (msg: ServerMessage) => {
      if (msg.type === "stateUpdate") setState(msg.state);
    },
  });

  useEffect(() => {
    if (!connected) return;
    const name = sessionStorage.getItem("echo:name") || "Host";
    send({ type: "join", name, asHost: true });
  }, [connected, send]);

  const joinUrl = `${window.location.origin}/play/${code}`;
  const players = useMemo(
    () => (state ? Object.values(state.players).filter((p) => p.name) : []),
    [state],
  );
  const nonHost = players.filter((p) => p.role !== "host");
  const target = nonHost.find((p) => p.role === "target") ?? null;

  const phase = state?.phase ?? "lobby";
  const round = state?.round ?? null;

  let canAdvance = true;
  let advanceHint: string | null = null;
  if (phase === "lobby") {
    canAdvance = target != null;
    if (!canAdvance) advanceHint = "Tap a player above to assign them as target.";
  } else if (phase === "seed" && round) {
    const allAnswered =
      round.seedAnswers.filter(Boolean).length >= round.seedQuestions.length;
    canAdvance = allAnswered;
    if (!canAdvance) advanceHint = "Waiting on the target to finish seeding.";
  } else if (phase === "question" && round) {
    canAdvance = round.targetAnswer != null && !round.cloneStreaming;
    if (round.targetAnswer == null) advanceHint = "Waiting on target's answer.";
    else if (round.cloneStreaming) advanceHint = "Clone is finishing up…";
  }

  return (
    <div className="screen screen--host">
      <header className="host-header">
        <div>
          <h1 className="host-room-code">{code}</h1>
          <p className="host-join-url">Join at {joinUrl}</p>
        </div>
        <div className="host-header-right">
          <div className="phase-eyebrow">Phase</div>
          <div className="host-phase">{PHASE_LABELS[phase]}</div>
          <div className={`pill pill--${connected ? "ok" : "warn"}`}>
            {connected ? "Connected" : "Connecting…"}
          </div>
        </div>
      </header>

      {!state ? (
        <p className="muted">Syncing…</p>
      ) : (
        <>
          {phase === "lobby" && (
            <HostLobby
              players={nonHost}
              target={target}
              onAssign={(id) => send({ type: "assignTarget", playerId: id })}
            />
          )}
          {phase === "seed" && <HostSeed state={state} />}
          {phase === "question" && <HostQuestion state={state} />}
          {phase === "vote" && <HostVote state={state} players={nonHost} />}
          {phase === "results" && <HostResults state={state} players={nonHost} />}

          <div className="host-advance">
            <button
              className="btn btn--primary btn--big"
              disabled={!canAdvance}
              onClick={() => send({ type: "advancePhase" })}
            >
              {ADVANCE_LABELS[phase]}
            </button>
            {advanceHint && <p className="muted">{advanceHint}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function HostLobby({
  players,
  target,
  onAssign,
}: {
  players: Player[];
  target: Player | null;
  onAssign: (id: string) => void;
}) {
  return (
    <section className="host-section">
      <h2>Players ({players.length})</h2>
      {players.length === 0 ? (
        <p className="muted">Waiting for players to join…</p>
      ) : (
        <ul className="player-list">
          {players.map((p) => {
            const isTarget = target?.id === p.id;
            return (
              <li
                key={p.id}
                className={`player-row ${p.isConnected ? "" : "player--gone"} ${
                  isTarget ? "player--target" : ""
                }`}
              >
                <span className="player-name">{p.name}</span>
                <button
                  className={`btn ${isTarget ? "btn--primary" : "btn--ghost"}`}
                  onClick={() => onAssign(p.id)}
                  disabled={!p.isConnected}
                >
                  {isTarget ? "Target ✓" : "Make target"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function HostSeed({ state }: { state: RoomState }) {
  const round = state.round;
  if (!round) return null;
  const target = Object.values(state.players).find((p) => p.id === round.targetId);
  const answered = round.seedAnswers.filter(Boolean).length;
  const total = round.seedQuestions.length;
  return (
    <section className="host-section">
      <h2>Seed phase</h2>
      <p className="host-big">{target?.name ?? "Target"} is being seeded…</p>
      <p className="muted">
        {answered} / {total} questions answered
      </p>
    </section>
  );
}

function HostQuestion({ state }: { state: RoomState }) {
  const round = state.round;
  if (!round) return null;
  const targetReady = round.targetAnswer != null;
  const cloneReady = !round.cloneStreaming;
  return (
    <section className="host-section">
      <h2>Question</h2>
      <p className="host-question">{round.currentQuestion}</p>

      {round.cloneError && <p className="error">Clone failed: {round.cloneError}</p>}

      <div className="answers-grid">
        <PendingAnswerCard label="A" ready={round.answerAIsTarget ? targetReady : cloneReady} />
        <PendingAnswerCard label="B" ready={round.answerAIsTarget ? cloneReady : targetReady} />
      </div>
      <p className="muted host-pending-hint">
        Both answers will be revealed at the same time.
      </p>
    </section>
  );
}

function PendingAnswerCard({ label, ready }: { label: "A" | "B"; ready: boolean }) {
  return (
    <div className={`answer-card answer-card--${label.toLowerCase()}`}>
      <div className="answer-card-label">{label}</div>
      <div className={`answer-pending ${ready ? "answer-pending--ready" : ""}`}>
        {ready ? "Ready ✓" : (
          <>
            answering<span className="dot-1">.</span>
            <span className="dot-2">.</span>
            <span className="dot-3">.</span>
          </>
        )}
      </div>
    </div>
  );
}

function TypingAnswers({ state }: { state: RoomState }) {
  const round = state.round!;
  const aIsTarget = round.answerAIsTarget;
  const targetText = round.targetAnswer ?? "";
  const cloneText = round.cloneAnswer ?? "";
  const aText = aIsTarget ? targetText : cloneText;
  const bText = aIsTarget ? cloneText : targetText;

  const resetKey = `${state.roundNumber}:${round.questionIndex}`;
  const aTyped = useTypewriter(aText, TYPEWRITER_CPS, resetKey);
  const bTyped = useTypewriter(bText, TYPEWRITER_CPS, resetKey);

  return (
    <div className="answers-grid">
      <RevealedAnswerCard
        label="A"
        text={aTyped.text}
        streaming={!aTyped.done}
        reveal={false}
        source={aIsTarget ? "target" : "clone"}
      />
      <RevealedAnswerCard
        label="B"
        text={bTyped.text}
        streaming={!bTyped.done}
        reveal={false}
        source={aIsTarget ? "clone" : "target"}
      />
    </div>
  );
}

function FinalAnswers({ state }: { state: RoomState }) {
  const round = state.round!;
  const aIsTarget = round.answerAIsTarget;
  const targetText = round.targetAnswer ?? "";
  const cloneText = round.cloneAnswer ?? "";
  return (
    <div className="answers-grid">
      <RevealedAnswerCard
        label="A"
        text={aIsTarget ? targetText : cloneText}
        streaming={false}
        reveal={true}
        source={aIsTarget ? "target" : "clone"}
      />
      <RevealedAnswerCard
        label="B"
        text={aIsTarget ? cloneText : targetText}
        streaming={false}
        reveal={true}
        source={aIsTarget ? "clone" : "target"}
      />
    </div>
  );
}

function RevealedAnswerCard({
  label,
  text,
  streaming,
  reveal,
  source,
}: {
  label: "A" | "B";
  text: string;
  streaming: boolean;
  reveal: boolean;
  source: "target" | "clone";
}) {
  const sourceLabel = source === "target" ? "👤 Real answer" : "🤖 Clone answer";
  return (
    <div className={`answer-card answer-card--${label.toLowerCase()}`}>
      <div className="answer-card-label">{label}</div>
      <StreamingText text={text} streaming={streaming} />
      {reveal && <div className="answer-card-source">{sourceLabel}</div>}
    </div>
  );
}

function HostVote({ state, players }: { state: RoomState; players: Player[] }) {
  const round = state.round;
  if (!round) return null;
  const spectators = players.filter((p) => p.role === "spectator");
  const aCount = Object.values(round.votes).filter((v) => v === "A").length;
  const bCount = Object.values(round.votes).filter((v) => v === "B").length;
  const voted = aCount + bCount;

  return (
    <section className="host-section">
      <h2>Vote</h2>
      <p className="host-question">{round.currentQuestion}</p>
      <TypingAnswers state={state} />
      <div className="vote-tally">
        <div className="vote-tally-cell">
          <div className="vote-tally-label">A</div>
          <div className="vote-tally-count">{aCount}</div>
        </div>
        <div className="vote-tally-cell">
          <div className="vote-tally-label">B</div>
          <div className="vote-tally-count">{bCount}</div>
        </div>
      </div>
      <p className="muted">
        {voted} / {spectators.length} spectators voted
      </p>
    </section>
  );
}

function HostResults({ state, players }: { state: RoomState; players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <section className="host-section">
      <h2>Round {state.roundNumber} results</h2>
      <p className="host-question">{state.round?.currentQuestion}</p>
      <FinalAnswers state={state} />
      <p className="muted">Scoring lands in phase 4.</p>
      <ul className="leaderboard leaderboard--big">
        {sorted.map((p, i) => (
          <li key={p.id}>
            <span className="leaderboard-rank">{i + 1}</span>
            <span className="leaderboard-name">{p.name}</span>
            <span className="leaderboard-score">{p.score}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
