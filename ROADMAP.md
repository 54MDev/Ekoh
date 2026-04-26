# Echo — Development Roadmap

2-person team · Sat 10 AM → Sun 1 PM (~27 hours)

---

## Phase 1: Foundation (Sat 10 AM – 12 PM)
**Goal: Room exists, players can join, OpenAI streaming works in isolation**

- [ ] Init Partykit project + React client (Vite)
- [ ] Room creation → short room code generated (e.g. `ECHO-4729`)
- [ ] Players join via room code on phone browser
- [ ] OpenAI streaming call works in isolation (test in terminal/Postman)
- [ ] Basic Partykit ↔ client connection: broadcast a test message to all players

**Milestone: Two phones connected to the same room, a message typed on one appears on the other.**

---

## Phase 2: Game State Machine (Sat 12 – 3 PM)
**Goal: Game can progress through all states on the server**

- [ ] Define and implement state machine: `lobby → seed → question → vote → results → rotate`
- [ ] Host screen renders the correct view for each state
- [ ] Player screen renders role-appropriate view (target vs spectator)
- [ ] Host can manually advance game state (button for now — no timers yet)
- [ ] Host assigns which player is the target from the lobby

**Milestone: Game cycles through all states with placeholder content. Host screen and two phone screens all update in sync.**

---

## Phase 3: Seed Phase + Clone (Sat 3 – 6 PM)
**Goal: Clone system prompt builds from seed answers; clone responds to questions**

- [ ] Seed screen: 5–6 personal questions shown to target on their phone
- [ ] Answers stored server-side, appended to room state
- [ ] Clone system prompt assembles from seed answers
- [ ] When question phase starts: server fires OpenAI streaming call
- [ ] Streaming tokens broadcast to host screen in real time (typing cursor effect)
- [ ] Target's answer and clone's answer both appear on host screen, labeled A/B (randomized)

**Milestone: Real person answers a question, clone responds, host screen shows both answers streaming in.**

---

## Phase 4: Voting + Scoring (Sat 6 – 9 PM)
**Goal: Spectators vote, scores update correctly**

- [ ] Vote phase: spectators see A/B buttons on their phone, tap to vote
- [ ] Live vote tally updates on host screen as votes come in
- [ ] Host button (or countdown) closes voting
- [ ] Score logic runs server-side:
  - Spectator: +1 for correct guess
  - Target: +2 for each spectator fooled
- [ ] Results screen: reveals who was A/B, vote breakdown, score delta
- [ ] Scores persist in room state across all rounds (reset only when room closes)

**Milestone: Full round plays end-to-end with real scoring. Leaderboard updates between rounds.**

---

## Phase 5: Round Rotation (Sat 9 PM – 12 AM)
**Goal: Multiple rounds with rotating targets, clone gets smarter**

- [ ] After results, host picks the next target
- [ ] New target triggers a fresh seed phase
- [ ] Clone prompt resets for new target (previous target's data cleared)
- [ ] Clone prompt for returning target includes all their previous round answers (gets better)
- [ ] Leaderboard shown on host screen between rounds
- [ ] Handle edge cases: player disconnects, only 2 players, target is the host

**Milestone: 3 full rounds with different targets play through cleanly.**

---

## Phase 6: Polish (Sun 8 – 11 AM)
**Goal: Looks good, feels smooth, demo-ready**

- [ ] Streaming text renders with a blinking cursor
- [ ] Host screen is TV-readable (large text, high contrast, minimal clutter)
- [ ] Phone UI is thumb-friendly (big tap targets, no horizontal scroll)
- [ ] Clear onboarding on join screen (what the game is in 2 sentences)
- [ ] Loading states, disconnection handling, empty states
- [ ] Game over / final leaderboard screen

---

## Phase 6.5: Online Deployment
**Goal: Game is live on the internet — anyone can play from their phone without being on the same network**

- [x] Run `npx partykit deploy` to push the server to PartyKit cloud (gets a `*.partykit.dev` URL)
- [x] Store `OPENAI_API_KEY` as a PartyKit secret: `npx partykit secret put OPENAI_API_KEY`
- [x] Update frontend env var: point `VITE_PARTYKIT_HOST` at the deployed PartyKit URL (not localhost)
- [x] Build and deploy the React frontend to Netlify / Vercel / Cloudflare Pages (free tier)
- [x] Share the frontend URL — players open it on any phone browser, no install needed
- [ ] Smoke test the full flow: join from a phone on a different network → seed → question → vote → results

**Milestone: A player outside your home network joins a room from their phone and plays a full round.**

---

## Phase 8: Host Controls
**Goal: Give the host more control over the room**

- [x] Remove training depth slider — hardcoded at 2 seed questions, no UI needed
- [x] Kick player — host can remove any non-host player from the lobby at any time (handles offline/ghost accounts)

---

## Phase 7: Demo Prep (Sun 11 AM – 1 PM)
- [ ] Run a full live round in the room — find and fix any rough edges
- [ ] Prep 60-second pitch (use the framing from the summary doc)
- [ ] Backup plan if venue WiFi is bad → mobile hotspot
- [ ] Make sure room code flow works on iOS Safari and Chrome Android

---

## Cut list (if behind schedule — in order)
1. Countdown timers — host just presses a button to advance
2. Typing cursor animation — text just appears
3. Live vote tally — show results only after voting closes
4. Seed question customization — hardcoded questions only
5. Game over screen — just refresh to restart
