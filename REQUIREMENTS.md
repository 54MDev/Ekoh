# Echo — Requirements

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React (Vite) | Fast setup, component-based screens, good TypeScript support |
| Realtime | Partykit | Purpose-built room multiplayer, minimal config, free tier |
| AI | OpenAI gpt-4o | Streaming support, fast response, team has API key |
| Deployment | Partykit (server) + Vercel (client) | Both free, one-command deploy |

---

## Functional Requirements

### Room & Lobby
- Host creates a room and receives a short room code (e.g. `ECHO-4729`)
- Players join by entering the room code on any phone browser — no app install required
- Host screen displays connected player list in real time
- Host assigns which player is the target for each round from the lobby
- Minimum viable player count: 3 (1 target, 2 spectators)
- Maximum player count: 8

### Seed Phase
- Target sees 5–6 personal questions on their phone (hardcoded for MVP)
- Target answers each question via text input and submits
- All answers are stored server-side in room state
- Answers are used to construct the Clone's initial system prompt

### Question Phase
- A question prompt is displayed to all players simultaneously
- Target types their answer on their phone and taps Send
- Clone generates a response via OpenAI streaming, triggered server-side when the question phase begins
- Streaming tokens are broadcast to the host screen in real time (typing cursor effect)
- Target's answer and clone's answer appear on host screen labeled "A" and "B" (assignment randomized, never labeled "Human" / "AI")

### Vote Phase
- Spectators see A and B buttons on their phone and tap to vote
- Live vote tally updates on host screen as votes arrive
- Host closes voting manually (button) — no timer required for MVP
- Target cannot vote during their own round

### Scoring
- Spectator earns +1 for each correct vote (correctly identifying the human)
- Target earns +2 for each spectator they fool
- Scoring is calculated server-side at end of vote phase
- Scores are stored in room state and accumulate across all rounds
- Scores reset when the room closes (no database persistence)
- Leaderboard displayed on host screen after each round's results

### Results & Round Rotation
- Results screen reveals which answer was A/B, full vote breakdown, and score delta per player
- After results, host selects the next target
- New target goes through a fresh seed phase; their clone prompt starts clean
- If a player is the target a second time, their clone prompt includes all previous answers from prior rounds (clone improves)
- Game supports 4–5 questions per round before rotating target

### AI Clone Behavior
- Clone system prompt is assembled from: seed answers + all previous round answers by the same target
- Prompt instructs the clone to match tone, vocabulary, capitalization, slang, and sentence length
- Clone prompt is updated after every question (accumulates within a round)
- Clone uses OpenAI gpt-4o with streaming enabled
- OpenAI API key is only used server-side — never exposed to the client

---

## Non-Functional Requirements

- Works in mobile Safari (iOS) and Chrome (Android) without any app install
- Host screen is readable from across a room: minimum 24px body text, high contrast
- Clone response begins streaming within 5 seconds of question phase starting
- Room handles up to 8 concurrent WebSocket connections without degradation

---

## Seed Question Bank (hardcoded)

1. "Describe your sense of humor in one sentence."
2. "What's your go-to response when someone cancels plans on you?"
3. "How do you text — long paragraphs or short bursts?"
4. "What's something you say a lot that your friends make fun of you for?"
5. "Describe your vibe at a party in three words."
6. "What's your honest hot take on something everyone else seems to like?"

---

## Out of Scope (MVP)

- Automated AI judge (just human voting)
- Persistent scoring across sessions / user accounts
- Custom seed question editor
- Keystroke dynamics or typing speed analysis
- Spectator chat
- Game replay or history
- Timers / auto-advance
