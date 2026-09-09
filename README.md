# AquaShield site

A production-style landing page based on the attached AquaShield 2026 pitch deck, with a small Express + SQLite analytics layer. 

Catchup at --------> https://aquashield-4nvt.onrender.com/

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000

Traction dashboard: http://localhost:3000/admin

Default demo key: `aquashield-demo`

## Tracking

The landing page calls `POST /api/track` and records total visits, unique visitor hashes, page path, source, campaign and referrer. It also records waitlist signups.

Campaign URLs look like:

`/?source=instagram&campaign=launch`

Referral links generated from the page use `?source=share&campaign=launch&ref=...`.

## Deployment

Deploy on a Node host such as Railway, Render, Fly.io or a VM. Set `ADMIN_KEY` to a private value in the environment. The SQLite file lives in `data/aquashield.db`, so use a persistent volume or move analytics to Postgres/Supabase for serverless deployments.

For stronger production analytics, add GA4/Plausible/PostHog alongside this first-party counter.
