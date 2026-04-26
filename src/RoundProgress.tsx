import type { Phase } from "./types";

export const MAX_ROUNDS = 5;

function stageLabel(phase: Phase, roundNumber: number): string {
  if (phase === "end") return "Game over";
  if (phase === "lobby") return roundNumber > 0 ? `After round ${roundNumber}` : "Lobby";
  const map: Record<string, string> = {
    seed: "Train",
    question: "Question",
    vote: "Vote",
    results: "Results",
  };
  return `Round ${roundNumber} — ${map[phase] ?? phase}`;
}

export default function RoundProgress({
  phase,
  roundNumber,
  maxRounds = MAX_ROUNDS,
}: {
  phase: Phase;
  roundNumber: number;
  maxRounds?: number;
}) {
  const isInRound = phase !== "lobby" && phase !== "end";
  const completedCount = phase === "end" ? maxRounds : isInRound ? roundNumber - 1 : roundNumber;
  const activeIndex = isInRound ? roundNumber - 1 : -1;

  return (
    <div className="round-progress">
      <div className="round-progress-label">{stageLabel(phase, roundNumber)}</div>
      <div className="round-progress-track">
        {Array.from({ length: maxRounds }, (_, i) => (
          <div
            key={i}
            className={`round-progress-seg${
              i < completedCount
                ? " round-progress-seg--done"
                : i === activeIndex
                  ? " round-progress-seg--active"
                  : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}
