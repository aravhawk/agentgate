# AgentGate

**Permission Contracts for AI Agents** — Users sign plain-English behavioral agreements that AI agents must obey, enforced at runtime via Auth0 Token Vault.

Built for the [Auth0 for AI Agents Hackathon](https://auth0-for-ai-agents.devpost.com/).

## What It Does

Today, when you give an AI agent access to your Google Calendar or GitHub, it's all-or-nothing. AgentGate introduces **Permission Contracts**: user-authored, cryptographically-signed behavioral agreements that define exactly what an agent can and cannot do.

Every tool call the agent makes passes through a **Contract Guard** that checks it against the signed contract in real time. Violations are blocked before they reach any API, and every decision is logged to a live audit trail.

### Key Features

- **Visual Contract Builder** — Toggle each action to Allowed, Requires Approval, or Denied
- **SHA-256 Signed Contracts** — Tamper-evident, versioned permission agreements
- **Runtime Contract Guard** — Intercepts every tool call and enforces the contract
- **Live Audit Dashboard** — Real-time feed of allowed actions, violations, and approval requests
- **Inline Violation Rendering** — Chat UI shows red/amber cards when the agent hits a restriction
- **Auth0 Token Vault Integration** — OAuth flows for Google Calendar and GitHub via Auth0's SDK

### Default Contract Rules

| Service | Action | Default |
|---------|--------|---------|
| Google Calendar | Read events | Allowed |
| Google Calendar | Create events | Denied |
| GitHub | List repositories | Allowed |
| GitHub | Read pull requests | Allowed |
| GitHub | Post PR comments | Requires Approval |
| GitHub | Merge pull requests | Denied |

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **Auth0 AI SDK** (`@auth0/ai-vercel`) with Token Vault
- **Vercel AI SDK v6** with GPT-5.4
- **React 19** with Framer Motion
- **Tailwind CSS v4**

## Getting Started

### Prerequisites

- Node.js 18+
- An [Auth0](https://auth0.com) tenant
- An [OpenAI](https://platform.openai.com) API key

### Setup

```bash
npm install
cp .env.example .env.local
```

Copy `.env.example` to `.env.local` and fill in your credentials (see `.env.example` for all required fields).

### Demo Mode

By default, AgentGate runs with **mock data** so you can demo the full Permission Contracts flow without configuring Google or GitHub OAuth apps:

```
# Mock data (default) — no GCP/GitHub setup needed
DEMO_MODE=true

# Real APIs — requires Token Vault social connections for google-oauth2 and github
DEMO_MODE=false
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Real API Mode

To use real Google Calendar and GitHub APIs, set `DEMO_MODE=false` and configure Auth0 Token Vault:

1. In Auth0 Dashboard, go to **Authentication > Social**
2. Add a **Google OAuth2** connection with Calendar scopes and refresh tokens enabled
3. Add a **GitHub** connection with repo scopes and refresh tokens enabled
4. Set `DEMO_MODE=false` in `.env.local`

See [Auth0 Token Vault docs](https://auth0.com/ai/docs/intro/token-vault) for detailed setup.

## Architecture

```
User signs contract (UI)
        │
        ▼
┌─────────────────┐
│ Contract Store   │  SHA-256 hash, versioned, per-user
└────────┬────────┘
         │
  User sends message
         │
         ▼
┌─────────────────┐
│  Chat API Route  │  Wraps ALL tools with Contract Guard
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ Contract Guard   │────▶│  Audit Log   │
│                  │     └──────────────┘
│  ALLOWED ──▶ execute tool
│  DENIED  ──▶ return violation
│  APPROVAL ─▶ return preview
└─────────────────┘
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts        # Main chat endpoint with Contract Guard
│   │   ├── contract/route.ts    # Contract CRUD + signing
│   │   └── audit/route.ts       # Audit log endpoint
│   ├── close/page.tsx           # OAuth popup close handler
│   ├── page.tsx                 # Login gate + app shell
│   └── layout.tsx               # Root layout
├── components/
│   ├── app-shell.tsx            # Main layout with sidebar
│   ├── contract-builder.tsx     # Visual permission editor
│   ├── audit-dashboard.tsx      # Live enforcement feed
│   ├── chat-window.tsx          # Chat UI with violation cards
│   └── token-vault-handler.tsx  # OAuth interrupt handler
└── lib/
    ├── contracts/
    │   ├── types.ts             # Contract types + default rules
    │   ├── store.ts             # In-memory store + SHA-256 signing
    │   └── guard.ts             # Runtime enforcement logic
    ├── tools/
    │   ├── google-calendar.ts   # Calendar tools (real + mock)
    │   └── github.ts            # GitHub tools (real + mock)
    ├── auth0.ts                 # Auth0 client + session helpers
    └── auth0-ai.ts              # Token Vault wrappers
```

## License

MIT
