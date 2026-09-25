# Glow Stone — Backend

REST API for Glow Stone.
Serverless Framework v4 · AWS Lambda · API Gateway (HTTP API) · RDS PostgreSQL · Cognito.

## Getting started

```bash
npm install
cp .env.example .env   # fill in the values
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run package` | Build the deployment package without deploying |
| `npm run deploy` | Deploy to the `dev` stage |
| `npm run deploy:prod` | Deploy to the `prod` stage |

## Architecture (MVC)

```
src/
├── controllers/   # Lambda handlers — parse, validate, call a service, respond
├── services/      # Business logic
├── models/        # Data access — all SQL lives here
├── views/         # Response envelope and error translation
├── schemas/       # Zod request validators
├── lib/           # Config, DB pool, auth, request helpers, errors
└── types/         # Shared types
```

Request flow: `serverless.yml route → controller → service → model → view`.

Every response uses the envelope `{ success, data?, error?: { code, message } }`.
