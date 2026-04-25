import type * as Party from "partykit/server";
import type { ClientMessage, RoomState, ServerMessage } from "../src/types";

const ROOM_CODE_RE = /^ECHO-\d{4}$/;
 //bank for people who guess
const QUESTION_BANK = [
  "What's your go-to comfort food at 1am?",
  "Describe your perfect Sunday in one sentence.",
  "What's a hill you'd die on?",
  "Worst movie you secretly love?",
  "If you could re-live one year of your life, which one?",
  "What's your most irrational fear?",
  "First thing you do when you walk into a hotel room?",
  "What's a small thing that instantly improves your mood?",
  "What are your political views"
];
//question bank for AI data collection
const SEED_QUESTION_BANK = [
  "Where did you grow up, and what was it like?",
  "What's a hobby or interest you're way too into?",
  "What's a phrase or word you say way more than you should?",
  "What did you do last weekend?",
  "What's a strong opinion you hold about food?",
  "Describe a typical morning for you.",
  "What's a TV show or movie you've rewatched too many times?",
  "How do you usually procrastinate?",
  "What's something you complain about way too much?",
  "How would your friends describe you in three words?",

];

const MAX_ROUNDS = 5;

function shuffled<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// this one was a bit hard to get... So we used calude on this to help
function buildClonePrompt(
  seedQuestions: string[],
  seedAnswers: string[],
  previousAnswers: { q: string; a: string }[],
): string {
  const seedPairs = seedQuestions
    .map((q, i) => {
      const a = seedAnswers[i];
      return a ? `Q: ${q}\nA: ${a}` : null;
    })
    .filter(Boolean)
    .join("\n\n");

  const previousBlock =
    previousAnswers.length > 0
      ? `\n\nFrom previous rounds in this game:\n${previousAnswers
          .map(({ q, a }) => `Q: ${q}\nA: ${a}`)
          .join("\n\n")}`
      : "";

  return `You are mimicking a specific person. Here is everything they have told you about themselves and how they talk:

${seedPairs}${previousBlock}

Match their tone, vocabulary, capitalization, slang, and sentence length exactly. If they texted in lowercase with no punctuation, you do too. If they used a specific phrase, reuse it.
When asked a question, answer as them. Keep it short and casual — one to three sentences max.
Do not explain yourself, do not break character, do not mention being an AI. Just answer the question.`;
}

//This was basically all us since it was just implimenting the partykit server
export default class EchoServer implements Party.Server {
  state: RoomState = {
    phase: "lobby",
    players: {},
    round: null,
    roundNumber: 0,
    questions: shuffled(QUESTION_BANK),
  };

  // Q&A pairs from prior rounds, keyed by player id. Lets the clone get
  // smarter when the same player is targeted again.
  private playerHistory: Record<string, { q: string; a: string }[]> = {};

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    if (!ROOM_CODE_RE.test(this.room.id)) {
      conn.close(1008, `Invalid room code: ${this.room.id}`);
      return;
    }

    const existing = this.state.players[conn.id];
    if (existing) {
      existing.isConnected = true;
    } else {
      this.state.players[conn.id] = {
        id: conn.id,
        name: "",
        role: "spectator",
        score: 0,
        isConnected: true,
      };
    }
    this.send(conn, { type: "stateUpdate", state: this.state });
    this.broadcastState();
  }

  onClose(conn: Party.Connection) {
    const player = this.state.players[conn.id];
    if (!player) return;
    if (!player.name) {
      delete this.state.players[conn.id];
    } else {
      player.isConnected = false;
    }
    this.broadcastState();
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "join": {
        const player = this.state.players[sender.id];
        if (!player) return;
        player.name = msg.name.trim().slice(0, 24) || "Guest";
        if (msg.asHost && !this.hasHost()) {
          player.role = "host";
        }
        this.broadcastState();
        return;
      }
      case "ping": {
        const from = this.state.players[sender.id]?.name || "anon";
        this.broadcast({ type: "broadcast", from, text: msg.text.slice(0, 280) });
        return;
      }
      case "assignTarget": {
        if (!this.isHost(sender)) return;
        if (this.state.phase !== "lobby") return;
        const target = this.state.players[msg.playerId];
        if (!target || target.role === "host") return;
        for (const p of Object.values(this.state.players)) {
          if (p.role === "target") p.role = "spectator";
        }
        target.role = "target";
        this.broadcastState();
        return;
      }
      case "advancePhase": {
        if (!this.isHost(sender)) return;
        if (this.advancePhase()) this.broadcastState();
        return;
      }
      case "abortRound": {
        if (!this.isHost(sender)) return;
        if (this.state.phase === "lobby" || this.state.phase === "end") return;
        for (const p of Object.values(this.state.players)) {
          if (p.role === "target") p.role = "spectator";
        }
        this.state.round = null;
        this.state.phase = "lobby";
        this.broadcastState();
        return;
      }
      case "newGame": {
        if (!this.isHost(sender)) return;
        if (this.state.phase !== "end") return;
        for (const p of Object.values(this.state.players)) {
          p.score = 0;
          if (p.role === "target") p.role = "spectator";
        }
        this.playerHistory = {};
        this.state.roundNumber = 0;
        this.state.round = null;
        this.state.questions = shuffled(QUESTION_BANK);
        this.state.phase = "lobby";
        this.broadcastState();
        return;
      }
      case "submitAnswer": {
        if (this.state.phase !== "question" || !this.state.round) return;
        if (sender.id !== this.state.round.targetId) return;
        this.state.round.targetAnswer = msg.answer.slice(0, 500);
        this.broadcastState();
        return;
      }
      case "submitVote": {
        if (this.state.phase !== "vote" || !this.state.round) return;
        const voter = this.state.players[sender.id];
        if (!voter || voter.role !== "spectator") return;
        this.state.round.votes[sender.id] = msg.vote;
        this.broadcastState();
        return;
      }
      case "submitSeedAnswer": {
        if (this.state.phase !== "seed" || !this.state.round) return;
        if (sender.id !== this.state.round.targetId) return;
        if (msg.index < 0 || msg.index >= this.state.round.seedQuestions.length) return;
        this.state.round.seedAnswers[msg.index] = msg.answer.slice(0, 500);
        this.broadcastState();
        return;
      }
      default:
        return;
    }
  }

  private calculateScores() {
    const round = this.state.round;
    if (!round) return;
    const correctVote = round.answerAIsTarget ? "A" : "B";
    let targetFooledCount = 0;

    for (const [playerId, vote] of Object.entries(round.votes)) {
      if (vote === correctVote) {
        this.state.players[playerId].score += 1;
        round.scoreDeltas[playerId] = (round.scoreDeltas[playerId] ?? 0) + 1;
      } else {
        targetFooledCount += 1;
      }
    }

    if (targetFooledCount > 0) {
      this.state.players[round.targetId].score += targetFooledCount * 2;
      round.scoreDeltas[round.targetId] =
        (round.scoreDeltas[round.targetId] ?? 0) + targetFooledCount * 2;
    }

    if (round.targetAnswer) {
      const history = this.playerHistory[round.targetId] ?? [];
      history.push({ q: round.currentQuestion, a: round.targetAnswer });
      this.playerHistory[round.targetId] = history;
    }
  }

  private advancePhase(): boolean {
    switch (this.state.phase) {
      case "lobby": {
        const target = Object.values(this.state.players).find((p) => p.role === "target");
        if (!target) return false;
        this.startRoundFor(target.id);
        return true;
      }
      case "seed": {
        if (!this.state.round) return false;
        const seenQs = new Set(this.state.round.previousAnswers.map((p) => p.q));
        const fresh = this.state.questions.find((q) => !seenQs.has(q));
        const fallback = this.state.questions[this.state.round.questionIndex] ?? this.state.questions[0];
        this.state.round.currentQuestion = fresh ?? fallback ?? "Placeholder question?";
        this.state.round.answerAIsTarget = Math.random() > 0.5;
        this.state.round.cloneAnswer = "";
        this.state.round.cloneStreaming = true;
        this.state.round.cloneError = null;
        this.state.phase = "question";
        this.startCloneStream();
        return true;
      }
      case "question": {
        if (!this.state.round) return false;
        this.state.phase = "vote";
        return true;
      }
      case "vote": {
        this.calculateScores();
        this.state.phase = "results";
        return true;
      }
      case "results": {
        const previousTargetId = this.state.round?.targetId ?? null;
        for (const p of Object.values(this.state.players)) {
          if (p.role === "target") p.role = "spectator";
        }
        this.state.round = null;

        if (this.state.roundNumber >= MAX_ROUNDS) {
          this.state.phase = "end";
          return true;
        }

        const next = this.pickNextTarget(previousTargetId);
        if (!next) {
          // No eligible players (e.g. everyone disconnected) — fall back to lobby
          this.state.phase = "lobby";
          return true;
        }
        next.role = "target";
        this.startRoundFor(next.id);
        return true;
      }
      case "end": {
        return false;
      }
    }
  }

  private startRoundFor(targetId: string) {
    this.state.roundNumber += 1;
    const history = this.playerHistory[targetId] ?? [];
    this.state.round = {
      targetId,
      seedQuestions: shuffled(SEED_QUESTION_BANK).slice(0, SEED_QUESTION_COUNT),
      seedAnswers: [],
      previousAnswers: history.slice(),
      questionIndex: 0,
      currentQuestion: "",
      targetAnswer: null,
      cloneAnswer: null,
      cloneStreaming: false,
      cloneError: null,
      answerAIsTarget: false,
      votes: {},
      scoreDeltas: {},
    };
    this.state.phase = "seed";
  }

  private pickNextTarget(previousTargetId: string | null): RoomState["players"][string] | null {
    const eligible = Object.values(this.state.players).filter(
      (p) => p.role !== "host" && p.isConnected && p.name,
    );
    if (eligible.length === 0) return null;
    if (!previousTargetId) return eligible[0];
    const lastIdx = eligible.findIndex((p) => p.id === previousTargetId);
    const nextIdx = lastIdx >= 0 ? (lastIdx + 1) % eligible.length : 0;
    return eligible[nextIdx];
  }

  private startCloneStream() {
    const round = this.state.round;
    if (!round) return;

    const apiKey =
      (this.room.env.OPENAI_API_KEY as string | undefined) ??
      (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : undefined);
    if (!apiKey) {
      round.cloneStreaming = false;
      round.cloneError = "OPENAI_API_KEY not set on server (check .env)";
      this.broadcastState();
      return;
    }

    const systemPrompt = buildClonePrompt(
      round.seedQuestions,
      round.seedAnswers,
      round.previousAnswers,
    );
    const userPrompt = round.currentQuestion;
    const roundNumber = this.state.roundNumber;
    const questionIndex = round.questionIndex;

    void this.runCloneStream(apiKey, systemPrompt, userPrompt, roundNumber, questionIndex);
  }

  private async runCloneStream(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    roundNumber: number,
    questionIndex: number,
  ) {
    const stillCurrent = () =>
      this.state.round != null &&
      this.state.roundNumber === roundNumber &&
      this.state.round.questionIndex === questionIndex &&
      (this.state.phase === "question" || this.state.phase === "vote" || this.state.phase === "results");

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        if (!stillCurrent()) {
          await reader.cancel().catch(() => {});
          return;
        }
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const token: string | undefined = json.choices?.[0]?.delta?.content;
            if (!token) continue;
            this.state.round!.cloneAnswer = (this.state.round!.cloneAnswer ?? "") + token;
          } catch {
            // skip malformed chunk
          }
        }
      }

      if (!stillCurrent()) return;
      // Hold the "answering…" state a beat longer so the clone doesn't pop
      // "Ready" the instant OpenAI finishes — that timing was a giveaway.
      const answerLen = this.state.round!.cloneAnswer?.length ?? 0;
      const padMs = Math.min(8000, 2000 + answerLen * 40);
      await new Promise((r) => setTimeout(r, padMs));
      if (!stillCurrent()) return;
      this.state.round!.cloneStreaming = false;
      this.broadcastState();
    } catch (err) {
      if (!stillCurrent()) return;
      this.state.round!.cloneStreaming = false;
      this.state.round!.cloneError =
        err instanceof Error ? err.message : "Unknown OpenAI error";
      this.broadcastState();
    }
  }

  private isHost(conn: Party.Connection): boolean {
    return this.state.players[conn.id]?.role === "host";
  }

  private hasHost(): boolean {
    return Object.values(this.state.players).some((p) => p.role === "host");
  }

  private broadcastState() {
    this.broadcast({ type: "stateUpdate", state: this.state });
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }
}
