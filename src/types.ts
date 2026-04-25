export type Phase = "lobby" | "seed" | "question" | "vote" | "results";

export type Role = "host" | "target" | "spectator";

export interface Player {
  id: string;
  name: string;
  role: Role;
  score: number;
  isConnected: boolean;
}

export interface RoundState {
  targetId: string;
  seedQuestions: string[];
  seedAnswers: string[];
  previousAnswers: { q: string; a: string }[];
  questionIndex: number;
  currentQuestion: string;
  targetAnswer: string | null;
  cloneAnswer: string | null;
  cloneStreaming: boolean;
  cloneError: string | null;
  answerAIsTarget: boolean;
  votes: Record<string, "A" | "B">;
}

export interface RoomState {
  phase: Phase;
  players: Record<string, Player>;
  round: RoundState | null;
  roundNumber: number;
  questions: string[];
}

export type ClientMessage =
  | { type: "join"; name: string; asHost?: boolean }
  | { type: "ping"; text: string }
  | { type: "assignTarget"; playerId: string }
  | { type: "submitSeedAnswer"; answer: string; index: number }
  | { type: "submitAnswer"; answer: string }
  | { type: "submitVote"; vote: "A" | "B" }
  | { type: "advancePhase" };

export type ServerMessage =
  | { type: "stateUpdate"; state: RoomState }
  | { type: "cloneToken"; token: string }
  | { type: "broadcast"; from: string; text: string };
