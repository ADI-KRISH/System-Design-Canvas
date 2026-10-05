# System-Design-Canvas

Learn system design by completing case studies on a whiteboard.

Each case gives you a real-world scenario and a whiteboard that already contains part of the architecture.
Those **fixed (🔒) blocks can't be moved or deleted, but you can connect to them**. You drag the missing pieces
(cache, load balancer, S3, queue, CDN, …) from the palette, wire them in, and press **Check my design**.

- **Predefined, deterministic grading.** Every case ships with its question, answer key, forbidden shortcuts and
  explanations in [`public/cases.js`](public/cases.js). [`public/evaluator.js`](public/evaluator.js) grades a board
  against that key. No LLM is involved in scoring, so the same board always gets the same result.
- **Wrong choices are explained.** Distractor components (e.g. a graph DB for photo uploads) and bad wiring
  (e.g. clients talking straight to the database) are flagged with the reason.
- **AI tutor for doubts.** The "Ask the tutor" box sends your question, the scenario and your current board to an LLM that
  explains the concepts and nudges you, without revealing the whole solution or changing your score.
  Without an API key it falls back to the built-in explanation for the case.
- **Levels.** Beginner (one idea added to a working system) → Intermediate (several components combined; unlocks after
  passing 3 beginner cases). Advanced is a placeholder for later.

| Level | Cases |
|---|---|
| Beginner | Blog under read load (cache) · Profile photo uploads (S3 + CDN) · Black Friday spike (load balancer) · Slow signup emails (queue) |
| Intermediate | URL shortener at 10k RPS (LB + cache + replica) · Reliable order notifications (queue + workers + DLQ) · Video upload & streaming (S3 + queue + CDN) · Public API platform (gateway + rate limiter + Redis) |

## Run

```bash
npm start            # http://localhost:3000, no dependencies to install (Node 18+)
npm test             # validates every case and grades its reference solution
```

Optional LLM tutor (any OpenRouter model):

```bash
OPENROUTER_API_KEY=sk-... TUTOR_MODEL=anthropic/claude-sonnet-4.5 npm start
```

The front end is static, so `public/` also works on any static host; the tutor then uses the built-in explanations.

## Adding a case

Add an object to `CASES` in `public/cases.js`: `fixed` blocks + `fixedEdges` (the pre-built system), `palette`,
`required` connections, `forbidden` connections, `wrong` components, `hints`, `explanation` and a reference `solution`.
`npm test` fails if the key is inconsistent or the reference solution doesn't score 100.

Refs in `required`/`forbidden` are either a fixed node id (`"web1"`) or a component type (`"cache"`).
Connections are undirected.
