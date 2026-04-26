import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useParty } from "../hooks/useParty";
import StreamingText from "./StreamingText";
import { useTypewriter } from "./useTypewriter";
import MusicPlayer from "./MusicPlayer";
import RoundProgress, { MAX_ROUNDS } from "../RoundProgress";
import Chat from "../Chat";
import type { Phase, Player, RoomState, ServerMessage } from "../types";

const PHASE_LABELS: Record<Phase, string> = {
  lobby: "Lobby",
  seed: "Seed",
  question: "Question",
  vote: "Vote",
  results: "Results",
  end: "Game over",
};

const TYPEWRITER_CPS = 28;

function advanceLabel(phase: Phase, roundNumber: number): string {
  switch (phase) {
    case "lobby":
      return "Start round";
    case "seed":
      return "Reveal question";
    case "question":
      return "Open voting";
    case "vote":
      return "Close voting";
    case "results":
      return roundNumber >= MAX_ROUNDS ? "Final standings" : "Next round";
    case "end":
      return "";
  }
}

export default function HostApp() {
  const { code = "" } = useParams();
  const [state, setState] = useState<RoomState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  const { send, connected, socket } = useParty({
    room: code,
    onMessage: (msg: ServerMessage) => {
      if (msg.type === "stateUpdate") setState(msg.state);
    },
  });

  useEffect(() => {
    if (socket) setMyId(socket.id ?? null);
  }, [socket]);

  useEffect(() => {
    if (!connected) return;
    const name = sessionStorage.getItem("echo:name") || "Host";
    send({ type: "join", name, asHost: true });
  }, [connected, send]);

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
      <div className="host-main">
      {!connected && (
        <div className="disconnect-banner">Reconnecting…</div>
      )}
      <header className="host-control-strip">
        <span className="steel-wall-screw steel-wall-screw--tl" aria-hidden="true" />
        <span className="steel-wall-screw steel-wall-screw--tr" aria-hidden="true" />
        <span className="steel-wall-screw steel-wall-screw--bl" aria-hidden="true" />
        <span className="steel-wall-screw steel-wall-screw--br" aria-hidden="true" />
        <span className="steel-wall-plate" aria-hidden="true">
          CONTROL · OPERATOR TERMINAL
        </span>
        <div className="host-header">
          <div className="host-id-display">
            <span className="host-id-label">CHAMBER · ID</span>
            <h1 className="host-room-code">{code}</h1>
            <p className="host-join-url">Join at echo-azd.pages.dev</p>
          </div>
          <div className="host-header-right">
            <div className="host-phase-display">
              <span className="host-phase-led" />
              <div>
                <div className="phase-eyebrow">Phase</div>
                <div className="host-phase">{PHASE_LABELS[phase]}</div>
              </div>
            </div>
            <div className={`pill pill--${connected ? "ok" : "warn"}`}>
              {connected ? "Connected" : "Connecting…"}
            </div>
          </div>
        </div>
      </header>

      <RoundProgress phase={phase} roundNumber={state?.roundNumber ?? 0} maxRounds={MAX_ROUNDS} />

      <MusicPlayer />

      {!state ? (
        <p className="muted syncing">Syncing<span className="dot-1">.</span><span className="dot-2">.</span><span className="dot-3">.</span></p>
      ) : (
        <>
          {phase === "lobby" && (
            <HostLobby
              players={nonHost}
              target={target}
              roundNumber={state.roundNumber}
              onAssign={(id) => send({ type: "assignTarget", playerId: id })}
              onKick={(id) => send({ type: "kickPlayer", playerId: id })}
            />
          )}
          {phase === "seed" && <HostSeed state={state} />}
          {phase === "question" && <HostQuestion state={state} />}
          {phase === "vote" && <HostVote state={state} players={nonHost} />}
          {phase === "results" && <HostResults state={state} players={nonHost} />}
          {phase === "end" && <HostEnd players={nonHost} />}

          <div className="host-advance">
            {phase === "end" ? (
              <button
                className="btn btn--primary btn--big"
                onClick={() => send({ type: "newGame" })}
              >
                New game
              </button>
            ) : (
              <button
                className="btn btn--primary btn--big"
                disabled={!canAdvance}
                onClick={() => send({ type: "advancePhase" })}
              >
                {advanceLabel(phase, state.roundNumber)}
              </button>
            )}
            {advanceHint && <p className="muted">{advanceHint}</p>}
            {phase !== "lobby" && phase !== "end" && (
              <button
                className="btn btn--ghost btn--abort"
                onClick={() => send({ type: "abortRound" })}
              >
                Abort round
              </button>
            )}
          </div>
        </>
      )}
      </div>
      <Chat
        messages={state?.chat ?? []}
        myId={myId}
        send={send}
        variant="rail"
      />
    </div>
  );
}

function HostEnd({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  return (
    <section className="host-section">
      <h2>Final standings</h2>
      {winner && (
        <p className="host-big">🏆 {winner.name} wins with {winner.score}</p>
      )}
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

function HostLobby({
  players,
  target,
  roundNumber,
  onAssign,
  onKick,
}: {
  players: Player[];
  target: Player | null;
  roundNumber: number;
  onAssign: (id: string) => void;
  onKick: (id: string) => void;
}) {
  const sortedByScore = [...players].sort((a, b) => b.score - a.score);
  const showLeaderboard = roundNumber > 0;
  return (
    <section className="host-section">
      <h2>{showLeaderboard ? `Leaderboard after round ${roundNumber}` : `Players (${players.length})`}</h2>
      {!showLeaderboard && players.length > 0 && (
        <p className="muted">
          Pick one player to be the target. They'll answer all 5 rounds and the clone learns from their answers.
        </p>
      )}
      {players.length === 0 ? (
        <p className="muted">Waiting for players to join…</p>
      ) : (
        <ul className="player-list">
          {sortedByScore.map((p, i) => {
            const isTarget = target?.id === p.id;
            return (
              <li
                key={p.id}
                className={`player-row ${p.isConnected ? "" : "player--gone"} ${
                  isTarget ? "player--target" : ""
                }`}
              >
                <span className="player-name">
                  {showLeaderboard && (
                    <span className="leaderboard-rank">{i + 1}.</span>
                  )}{" "}
                  {p.name}
                  {showLeaderboard && (
                    <span className="leaderboard-score"> {p.score}</span>
                  )}
                </span>
                <div className="player-row-actions">
                  <button
                    className={`btn ${isTarget ? "btn--primary" : "btn--ghost"}`}
                    onClick={() => onAssign(p.id)}
                    disabled={!p.isConnected}
                  >
                    {isTarget ? "Target ✓" : "Make target"}
                  </button>
                  <button
                    className="btn btn--ghost btn--kick"
                    onClick={() => onKick(p.id)}
                  >
                    Kick
                  </button>
                </div>
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
  const allDone = answered >= total;
  return (
    <section className="host-section">
      <h2>Seed phase · Round {state.roundNumber}</h2>
      <p className="host-big">{target?.name ?? "Target"} is teaching the clone…</p>
      <p className={`host-seed-progress ${allDone ? "host-seed-progress--done" : ""}`}>
        {allDone
          ? `All ${total} answer${total !== 1 ? "s" : ""} locked in ✓`
          : `${answered} / ${total} answered…`}
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
  const round = state.round;
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const aCount = round ? Object.values(round.votes).filter((v) => v === "A").length : 0;
  const bCount = round ? Object.values(round.votes).filter((v) => v === "B").length : 0;
  const correctVote = round ? (round.answerAIsTarget ? "A" : "B") : null;

  return (
    <section className="host-section">
      <h2>Round {state.roundNumber} results</h2>
      <p className="host-question">{round?.currentQuestion}</p>
      <FinalAnswers state={state} />
      {round && (
        <div className="vote-tally">
          <div className={`vote-tally-cell ${correctVote === "A" ? "vote-tally-cell--correct" : ""}`}>
            <div className="vote-tally-label">A {correctVote === "A" ? "✓ Real" : "✗ Clone"}</div>
            <div className="vote-tally-count">{aCount}</div>
          </div>
          <div className={`vote-tally-cell ${correctVote === "B" ? "vote-tally-cell--correct" : ""}`}>
            <div className="vote-tally-label">B {correctVote === "B" ? "✓ Real" : "✗ Clone"}</div>
            <div className="vote-tally-count">{bCount}</div>
          </div>
        </div>
      )}
      <ul className="leaderboard leaderboard--big">
        {sorted.map((p, i) => {
          const delta = round?.scoreDeltas[p.id] ?? 0;
          return (
            <li key={p.id}>
              <span className="leaderboard-rank">{i + 1}</span>
              <span className="leaderboard-name">{p.name}</span>
              <span className="leaderboard-score">
                {p.score}
                {delta > 0 ? <span className="score-delta"> +{delta}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
