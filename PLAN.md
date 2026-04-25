# Echo — Technical Plan

---

## Architecture Overview

```
[Phone browsers]  ←WebSocket→  [Partykit Room Server]  ←HTTP→  [OpenAI API]
[Host screen]     ←WebSocket→  [Partykit Room Server]
                                        ↕
                               [In-memory game state]
```

All game state lives on the Partykit server. Clients are intentionally dumb — they render whatever the server broadcasts. The host screen and player screens are the same React app; they render different layouts based on the player's role and the current game phase.

---

## Game State Machine

```
lobby → seed → question → vote → results → (next target: seed | end game)
```

| Phase | Host Screen (TV) | Target Phone | Spectator Phone |
|---|---|---|---|
| `lobby` | Room code + player list, assign target | Waiting, see player list | Waiting, see player list |
| `seed` | "Target is answering..." | 5–6 seed question form | "Hang tight..." |
| `question` | Question + streaming clone response | Answer text input | Question (read only) |
| `vote` | Live A/B vote tally | Read-only results view | A / B tap buttons |
| `results` | Reveal who was A/B, vote breakdown, leaderboard | Score delta | Score delta |

---

## Room State Shape (server-side TypeScript)

```ts
type Phase = "lobby" | "seed" | "question" | "vote" | "results";

interface Player {
  id: string;
  name: string;
  role: "host" | "target" | "spectator";
  score: number;
  isConnected: boolean;
}

interface RoundState {
  targetId: string;
  seedAnswers: string[];           // collected during seed phase
  previousAnswers: { q: string; a: string }[]; // grows each question
  questionIndex: number;
  currentQuestion: string;
  targetAnswer: string | null;
  cloneAnswer: string | null;      // accumulated from stream
  cloneStreaming: boolean;
  answerAIsTarget: boolean;        // randomized, revealed only at results
  votes: Record<string, "A" | "B">;
}

interface RoomState {
  phase: Phase;
  players: Record<string, Player>;
  round: RoundState | null;
  roundNumber: number;
  questions: string[];             // hardcoded bank, shuffled per round
}
```

---

## File Structure

```
echo/
├── party/
│   └── index.ts              # Partykit server — all game logic, OpenAI calls
├── src/
│   ├── App.tsx               # Entry: connects to Partykit, routes to host or player view
│   ├── screens/
│   │   ├── JoinScreen.tsx        # Enter name + room code
│   │   ├── LobbyScreen.tsx       # Waiting room (host assigns target button)
│   │   ├── SeedScreen.tsx        # Target's seed question form
│   │   ├── QuestionScreen.tsx    # Target types answer / spectators see question
│   │   ├── VoteScreen.tsx        # Spectators tap A or B
│   │   └── ResultsScreen.tsx     # Reveal + leaderboard
│   ├── host/
│   │   ├── HostApp.tsx           # TV layout wrapper, always shows full state
│   │   └── StreamingText.tsx     # Renders OpenAI token stream with cursor
│   ├── hooks/
│   │   └── useParty.ts           # Partykit connection + message dispatch
│   └── types.ts              # Shared types (mirrors server RoomState)
├── .env                      # OPENAI_API_KEY (never committed)
├── partykit.json
├── package.json
└── vite.config.ts
```

---

## Key Implementation Details

### Partykit Server (`party/index.ts`)

The server is a single class implementing `Party.Server`. It owns all state and handles three responsibilities:

1. **Connection lifecycle** — player joins, disconnects, name registration
2. **Game state transitions** — receives action messages from clients, validates, mutates state, broadcasts
3. **OpenAI streaming** — fires the API call server-side, streams tokens back to all clients via `room.broadcast()`

Message types (client → server):
```ts
| { type: "join"; name: string }
| { type: "assignTarget"; playerId: string }         // host only
| { type: "submitSeedAnswer"; answer: string; index: number }
| { type: "submitAnswer"; answer: string }            // target only
| { type: "submitVote"; vote: "A" | "B" }             // spectators only
| { type: "advancePhase" }                            // host only
```

Message types (server → client):
```ts
| { type: "stateUpdate"; state: RoomState }           // full state sync
| { type: "cloneToken"; token: string }               // streaming chunk
```

### OpenAI Streaming (server-side only)

When the question phase begins, the server:
1. Builds the clone prompt from seed answers + previous round answers
2. Calls `openai.chat.completions.create({ stream: true, ... })`
3. Iterates the stream and for each token: appends to `round.cloneAnswer` and broadcasts `{ type: "cloneToken", token }`
4. Sets `round.cloneStreaming = false` when done, broadcasts a final state update

The client accumulates tokens in local state and renders them with a blinking cursor via `StreamingText.tsx`.

### Clone System Prompt Template

```
You are mimicking a specific person. Here is everything they have said so far:

Seed answers:
${seedAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n")}

${previousAnswers.length > 0 ? `Previous round answers:\n${previousAnswers.map(({ q, a }) => `Q: ${q}\nA: ${a}`).join("\n\n")}` : ""}

Match their tone, vocabulary, capitalization, slang, and sentence length exactly.
When asked a question, answer as them. Keep it short and casual — one to three sentences max.
Do not explain yourself. Just answer.
```

### Answer Randomization

At the start of vote phase:
- Server randomly sets `round.answerAIsTarget = Math.random() > 0.5`
- Host screen renders: A = target answer if true, else clone answer
- This field is included in `stateUpdate` but only matters at results phase when the reveal happens
- Spectators vote on A/B labels only — no hints about which is human

### Scoring Logic (server-side)

```ts
function calculateScores(round: RoundState, players: Record<string, Player>) {
  const correctVote = round.answerAIsTarget ? "A" : "B";
  let targetFooledCount = 0;

  for (const [playerId, vote] of Object.entries(round.votes)) {
    if (vote === correctVote) {
      players[playerId].score += 1;  // spectator correct
    } else {
      targetFooledCount += 1;         // target fooled this spectator
    }
  }

  players[round.targetId].score += targetFooledCount * 2;
}
```

### Host vs Player Routing

`App.tsx` checks a `role` field stored in `sessionStorage` (set at join time):
- If `role === "host"`: render `HostApp` — always displays the full room state, TV layout
- Otherwise: render the appropriate `screen` component based on `state.phase` and `player.role`

The host screen is loaded when the room is first created. Player screens load when they join via room code.

---

## Environment Setup

```bash
# Install
npm create partykit@latest echo
cd echo
npm install openai

# .env
OPENAI_API_KEY=sk-...

# Dev
npx partykit dev

# Deploy
npx partykit deploy
```

---

## Phase 6.5: Online Deployment

### Overview

PartyKit has first-class deployment built in. The server deploys to PartyKit's cloud infrastructure (Cloudflare Workers under the hood); the frontend deploys as a static site to any free host.

### Steps

**1. Deploy the PartyKit server**
```bash
npx partykit deploy
# Outputs: https://echo.<username>.partykit.dev
```

**2. Store the OpenAI key as a secret (never hardcoded)**
```bash
npx partykit secret put OPENAI_API_KEY
# Prompts for the value — stored encrypted, injected at runtime
```

**3. Point the frontend at the deployed server**

In `vite.config.ts` or a `.env.production` file:
```
VITE_PARTYKIT_HOST=echo.<username>.partykit.dev
```

Anywhere `localhost:1999` or the dev host is hardcoded in the React app, replace it with:
```ts
const host = import.meta.env.VITE_PARTYKIT_HOST ?? "localhost:1999";
```

**4. Deploy the frontend**

Recommended: Netlify (drag-and-drop or CLI)
```bash
npm run build        # outputs to dist/
# Drag dist/ onto netlify.com/drop, or:
npx netlify-cli deploy --prod --dir dist
```

Alternatively: Vercel (`npx vercel --prod`) or Cloudflare Pages — all free.

**5. Smoke test off-network**

Open the frontend URL on a phone with WiFi off (LTE only). Join a room, run a full round. This confirms there are no localhost references remaining.

### What Players Need

Just the frontend URL in any phone browser. No app install. Room codes work exactly as in local dev.

---

## Division of Work (suggested)

| Person A (backend-leaning) | Person B (frontend-leaning) |
|---|---|
| Partykit server + state machine | React screen components |
| OpenAI streaming integration | Host screen layout (TV) |
| Scoring logic | Phone UI (join, seed, vote) |
| Room code generation | StreamingText component |
| Message protocol types | Routing + useParty hook |

Both work from `types.ts` — agree on the message protocol first so you can build in parallel without blocking each other.
