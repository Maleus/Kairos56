# Kairos 56 Site — Troubleshooting Handoff

**Date:** July 15, 2026 · **Owner:** Erik Dominguez (tech chair) · erikjd21@gmail.com

## Project

Rebuild of kairos56.com (Kairos Prison Ministry volunteer site, WTSP chapter) as a
reusable template. Repo: `github.com/Maleus/Kairos56`, branch **v2** (production).
`main` = old site, still live on Netlify at www.kairos56.com — do NOT merge v2
into main until DNS cutover (members page would be exposed unprotected on Netlify).

**Stack:** Hugo static site + Cloudflare Pages (project `kairos56`, kairos56.pages.dev,
builds from v2) + Pages Functions (members-area auth, DocuSeal glue) + Cloudflare KV
+ DocuSeal Cloud Pro (e-signature). Full architecture/design in `PLAN.md`, deployment
guide in `SETUP.md`.

## What's done and verified

- Cloudflare Pages project live, builds green from v2. Build: `hugo --minify`,
  output `public`, `HUGO_VERSION=0.163.0`.
- KV namespace `kairos-site` bound as **KAIROS**.
- Env vars (Production) all set: `SESSION_SECRET` (secret), `ADMIN_SECRET` (secret),
  `DOCUSEAL_API_TOKEN` (secret), `DOCUSEAL_URL=https://docuseal.com`,
  `DOCUSEAL_API_URL=https://api.docuseal.com`, `DOCUSEAL_TEMPLATE_ID=5031712`.
- DocuSeal Cloud **Pro is active** (paid July 15).
- DocuSeal template 5031712 ("Kairos56_team_application"): all fields named to match
  `functions/api/apply.js` (25 text + individual checkboxes incl. gender_male/female,
  role_layperson/clergy/musician). Non-essential fields set to not-required.
  Template verified saved (fresh-reload check). NOTE: the editor has silently lost
  unsaved changes twice — after any template edit, click SAVE and re-verify by
  reloading /templates/5031712/edit.
- Members area: server-side gate works (`functions/members/_middleware.js`,
  cookie signed with SESSION_SECRET). Team password set via `/team-admin/`
  (requires ADMIN_SECRET), stored hashed in KV.

## Current state of troubleshooting

1. **Apply → DocuSeal flow:** was failing 422 "Unknown field: church_name"
   (DocuSeal rejects field names not in the template). Fixed two ways:
   template fields renamed AND commit `87a7237` filters the prefill payload
   against the template's live field list (GET /templates/{id}). Also commit
   `cd32745` fixed submitter role to `First Party` (must match template party name).
   **Status: commits may not all be pushed — check `git log origin/v2..v2`.
   After push, POST a test to `kairos56.pages.dev/api/apply` and confirm a
   `sign_url` comes back and prefill lands on the PDF.**
   `functions/api/apply.js` currently returns DocuSeal error details
   (`docuseal_status`, `detail`) in error responses — REMOVE once verified.

2. **DNS cutover (the active problem):** Erik wants www.kairos56.com moved from
   Netlify to Cloudflare Pages. DNS is currently managed by **Netlify DNS**;
   Netlify's UI has no record "edit" (delete+recreate is normal there) and
   nameservers can't be changed from the Netlify dashboard — **nameservers are
   changed at the domain REGISTRAR, not at Netlify**. Unresolved question: where
   is kairos56.com registered? (If registered through Netlify, custom nameservers
   are under Domains → the domain → Name servers, or require Netlify support.)
   Recommended path:
   a. Cloudflare dashboard → Add a domain → kairos56.com (free plan). Cloudflare
      auto-imports existing records and shows two assigned nameservers.
   b. At the registrar, replace nameservers with Cloudflare's. (Netlify keeps
      serving the site during propagation — zero downtime.)
   c. When the zone is active in Cloudflare: Pages project → Custom domains →
      add www.kairos56.com (+ apex redirect). Remove the old Netlify A/NETLIFY
      records in the Cloudflare zone.
   d. Alternative if nameservers truly can't move: keep Netlify DNS, delete the
      Netlify site records, add `CNAME www → kairos56.pages.dev` and add the
      custom domain in the Pages project. Apex needs ALIAS/flattening support.

## Remaining after DNS

- End-to-end signing test (form → prefilled PDF → sign → email received).
- Remove debug `detail` from apply.js error response.
- TN state document PDFs (Erik obtaining) → new DocuSeal templates, same pattern.
- Update `static/admin/config.yml` `site_url` if needed; Sveltia CMS login test.
- Merge v2 → main only at cutover; retire Netlify site after.
- PLAN.md §10 open items (chair sign-off, completed-application routing, etc.).

## Access notes

- Claude/agent has: repo folder on disk (can commit; CANNOT push — Erik pushes,
  or create a fine-grained GitHub PAT, Contents R/W, repo Maleus/Kairos56).
- Chrome extension available; Erik logged into Cloudflare + DocuSeal in browser.
- Cloudflare account: Info@crusadermunitions.com, Account ID 79681c6b8b44e8c2c62f71f2bad2aac4.
- Never put secrets in the repo; they live in Cloudflare env vars only.
