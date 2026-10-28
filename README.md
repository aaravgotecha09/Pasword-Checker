# LogicLock: Password Policy Simulator (Innovation Edition)

Discrete Mathematics, Unit 2 (Propositional Logic, Truth Tables, Tautologies), CO2, Cybersecurity.
Policy: **A = p ∧ q ∧ r ∧ s ∧ t** (length, uppercase, digit, special, not-on-blocklist).

- **backend/**: Node + Express API (Render). Own tokenizer/parser/evaluator, no `eval()`.
- **frontend/**: Vite static site (Vercel). Policy validator, truth-table/tautology lab, equivalence checker, operator playground, executed test cases.

## Run locally
```
cd backend  && npm install && npm start      # http://localhost:3001
cd frontend && npm install && cp .env.example .env && npm run dev   # http://localhost:5173
cd backend && npm test                       # logic unit tests
```

## Deploy
1. Push this folder to a GitHub repo.
2. **Render**: New → Web Service (or Blueprint, it reads `render.yaml`). Root dir `backend`, build `npm install`, start `npm start`. Copy the URL, e.g. `https://password-policy-api.onrender.com`.
3. **Vercel**: Import the repo, set **Root Directory = `frontend`**, add env var `VITE_API_URL` = your Render URL (no trailing slash), Deploy.
4. Back on Render, set `ALLOWED_ORIGINS` to your Vercel URL (e.g. `https://your-app.vercel.app`) and redeploy.

Free Render sleeps after inactivity: open the site 1 minute before presenting (the UI shows a "waking up" banner).

## API
`GET /api/health` · `POST /api/check {password, policy}` · `POST /api/truth-table {expression}` · `POST /api/equivalence {a,b}` · `POST /api/evaluate {expression, values}` · `GET /api/test-cases`

Passwords are evaluated in memory only: never logged, stored, or returned. Teaching model: NIST SP 800-63B-4 advises against forced composition rules.

## Innovations (new)
1. **Live logic-gate circuit**: five inputs flow through an animated AND gate to the output bulb A, plus the De Morgan form ¬A ≡ ¬p ∨ ¬q ∨ ¬r ∨ ¬s ∨ ¬t explaining each rejection.
2. **Counting-principle lab**: product rule for the search space, entropy in bits, average crack time on three attacker models, one-click "Fix it" and "Generate strong".
3. **Break the Gate puzzle game**: hit a target truth row with a real password. Level 6 is provably impossible (t = F forces s = F, an implication).
4. **Inclusion–exclusion counter**: exact count of strings satisfying q ∧ r ∧ s, with every term of the formula shown.

New endpoints: `POST /api/strength` · `POST /api/counting` · `POST /api/generate` · `POST /api/fix` · `GET /api/puzzles`.
**Redeploy the backend on Render** after pushing (the new tabs need these endpoints). `VITE_API_URL` must be the plain URL: `https://pasword-checker.onrender.com`.
