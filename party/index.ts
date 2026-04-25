import type * as Party from "partykit/server";
import type { ClientMessage, RoomState, ServerMessage } from "../src/types";

const ROOM_CODE_RE = /^ECHO-\d{4}$/;

//question bank for when people guess
const QUESTION_BANK = [
  "What's your go-to comfort food at 1am?",
  "Describe your perfect Sunday in one sentence.",
  "What's a hill you'd die on?",
  "Worst movie you secretly love?",
  "If you could re-live one year of your life, which one?",
  "What's your most irrational fear?",
  "First thing you do when you walk into a hotel room?",
  "What's a small thing that instantly improves your mood?",
];
//question bank for AI data collection
const SEED_QUESTION_BANK = [
  "Where did you grow up, and what was it like?",
  "What's a hobby or interest you're way too into?",
  "What's a phrase or word you say way more than you should?",
  "What did you do last weekend?",
  "What's a strong opinion you hold about food?",
];

const SEED_QUESTION_COUNT = 5;

function shuffled<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

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

export default class EchoServer implements Party.Server {
  state: RoomState = {
    phase: "lobby",
    players: {},
    round: null,
    roundNumber: 0,
    questions: shuffled(QUESTION_BANK),
  };

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

  private advancePhase(): boolean {
    switch (this.state.phase) {
      case "lobby": {
        const target = Object.values(this.state.players).find((p) => p.role === "target");
        if (!target) return false;
        this.state.roundNumber += 1;
        this.state.round = {
          targetId: target.id,
          seedQuestions: shuffled(SEED_QUESTION_BANK).slice(0, SEED_QUESTION_COUNT),
          seedAnswers: [],
          previousAnswers: [],
          questionIndex: 0,
          currentQuestion: "",
          targetAnswer: null,
          cloneAnswer: null,
          cloneStreaming: false,
          cloneError: null,
          answerAIsTarget: false,
          votes: {},
        };
        this.state.phase = "seed";
        return true;
      }
      case "seed": {
        if (!this.state.round) return false;
        const idx = this.state.round.questionIndex;
        this.state.round.currentQuestion =
          this.state.questions[idx] ?? "Placeholder question?";
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
        this.state.phase = "results";
        return true;
      }
      case "results": {
        for (const p of Object.values(this.state.players)) {
          if (p.role === "target") p.role = "spectator";
        }
        this.state.round = null;
        this.state.phase = "lobby";
        return true;
      }
    }
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
