# Kairos WTSP Site Rebuild — Implementation Plan

**Status:** Ready to code · **Date:** July 15, 2026 · **Owner:** Erik Dominguez

---

## 1. Executive Summary

Rebuild kairos56.com as a clean, redeployable template for any Kairos chapter, with three major upgrades:

1. **Open-source e-signature (DocuSeal, self-hosted)** for the team application and Tennessee state documents — replacing download/print/sign as the primary path (kept as fallback).
2. **Admin-editable team dashboard** (roster, schedule, announcements, team password) via Sveltia CMS — no coding required to update the site.
3. **Real server-side team login** — the current password gate is client-side only; all "protected" content ships in the page source today.

**Hosting (final decision):** Cloudflare Pages (site, free) + **DocuSeal Cloud Pro** (~$20/mo + $0.20/API doc) — chosen over self-hosting on DigitalOcean to keep operations to a single Cloudflare account with zero server maintenance. The repo still ships the self-host kit (`deploy/`) so future chapters can pick the $6/mo droplet route instead; the code supports both via env vars.

---

## 2. Current Code Assessment

The existing DeepSeek-generated Hugo site works but has structural problems that justify the redo:

### Security
- **Members page "login" is cosmetic.** The password check runs in the browser; the entire dashboard (roster with names, schedule, contact info) is in the HTML source of `/members/` for anyone who views source. The SHA-256 hash of the password is also published in the page.
- Erik's home address, cell, and email are baked into the public apply page output.

### Code quality
- `apply.html` duplicates the entire base layout (header/footer/head) instead of using Hugo's `baseof.html` block system — nav changes must be made twice.
- Dead code: an unused, broken `sha256()` function in `members/list.html` with a comment admitting it doesn't work, then a second implementation patched over it.
- The generated "application" is print-styled HTML, not the actual Kairos PDF — the chair still receives a nonstandard document.
- Inconsistent/stale content: header says "Western TN SP #55", dates reference a dropped July 25 meeting, apply page and dashboard disagree.
- **Wrong domain in config:** `hugo.toml` sets `baseURL = "https://kairoswtsp.org/"` — this site is **kairos56.com** (a different site). Must be corrected in the rebuild.
- All dashboard content (roster, schedule, announcements) is hardcoded in templates — nothing is editable without editing HTML and redeploying.

### What's worth keeping
- Hugo as the static site generator (fast, free to host, good fit).
- The general page structure (Home, About, Apply, Contact, Members) and CSS look.
- Git + auto-deploy workflow.

**Verdict:** Keep Hugo, rebuild the theme cleanly, move all content into data files, and add the services described below. This is a rewrite of the theme and content model, not a framework change.

---

## 3. Target Architecture

```
                    ┌──────────────────────────────────────────┐
                    │  GitHub repo: kairos-chapter-site         │
                    │  (template — fork per chapter)            │
                    │  Hugo site + data files + CMS config      │
                    └───────────────┬──────────────────────────┘
                          git push / CMS commit
                                    │
     ┌──────────────────────────────▼───────────────────────────┐
     │  CLOUDFLARE PAGES (free)          kairos56.com         │
     │  • Static Hugo site (auto-builds on every commit)        │
     │  • Pages Functions (serverless):                         │
     │     – /members gate: server-side password check,         │
     │       signed cookie; protected content never in          │
     │       public HTML                                        │
     │     – /api/apply: receives web form, calls DocuSeal      │
     │       API to create prefilled signing submission         │
     │     – /api/team-password: admin changes team password    │
     │  • KV storage: team password hash                        │
     │  • sveltia-cms-auth Worker: GitHub OAuth for /admin      │
     └──────────────────────────────┬───────────────────────────┘
                                    │ REST API (token)
     ┌──────────────────────────────▼───────────────────────────┐
     │  DIGITALOCEAN DROPLET ($6–12/mo)  sign.kairos56.com    │
     │  • DocuSeal (Docker Compose, single container)           │
     │  • Caddy reverse proxy — automatic HTTPS                 │
     │  • SQLite (built-in default) + nightly backup to         │
     │    DO Spaces or droplet snapshot                         │
     │  • Templates: Team Application, TN state docs            │
     └───────────────────────────────────────────────────────────┘
```

### Key repos / components

| Component | Repo | License | Why |
|---|---|---|---|
| E-signature | [docusealco/docuseal](https://github.com/docusealco/docuseal) | AGPL-3.0 | 16.6k★, active (v2.5.3, May 2026). Single Docker container, SQLite default, free self-hosted tier includes **API + webhooks + field prefill** — everything we need. ESIGN/UETA-valid signatures, audit trail, PDF signature verification. |
| Admin CMS | [sveltia/sveltia-cms](https://github.com/sveltia/sveltia-cms) | MIT | Successor to Netlify/Decap CMS, active, mobile-friendly. Single `<script>` include + YAML config. Admin edits data files through friendly forms; commits trigger rebuild. |
| CMS auth | [sveltia/sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) | MIT | Official Cloudflare Worker for GitHub OAuth — free, ~5 min setup. (If Erik is the only admin, Sveltia's simpler GitHub access-token login works with zero setup; the Worker matters when non-technical admins take over.) |
| Site | Hugo (existing) | Apache-2.0 | Already in use; free builds on Cloudflare Pages. |

### Why DocuSeal over the alternatives

- **Documenso** (AGPL, TypeScript/Next.js): polished, but heavier to self-host (Postgres required, more moving parts) and its free self-hosted API is less turnkey for PDF-template prefill.
- **OpenSign** (AGPL, Node/MongoDB): smaller feature set, MongoDB dependency.
- **DocuSeal**: one container, SQLite, one-line deploy, WYSIWYG PDF field builder (upload the actual Kairos Team Application PDF and drag fields onto it), documented [prefill API](https://www.docuseal.com/guides/pre-fill-pdf-document-form-fields-with-api), multiple submitters per document, automated email via SMTP. Note: *embedded* in-page signing is a paid Pro feature — we avoid it by redirecting the applicant to the DocuSeal-hosted signing page (free) instead, which looks professional anyway.

---

## 4. Hosting Recommendation

**Recommended: Cloudflare Pages (site) + DigitalOcean droplet (DocuSeal).**

| Option | Cost | Pros | Cons |
|---|---|---|---|
| **A. Cloudflare Pages + DO droplet** ✅ | $6–12/mo | Site hosting free forever; Functions/KV free tier is ample; droplet does one job (DocuSeal); each chapter can replicate cheaply | Two dashboards to know about |
| B. Everything on one DO droplet | $12/mo | Single server | You maintain the web server, deploys, TLS for the site too; loses free CI rebuilds that the CMS depends on |
| C. Stay on Netlify + DocuSeal cloud Pro | $20+/mo | No server maintenance | Recurring per-seat cost; API/embed docs billed $0.20 each; less redeployable for future chapters |

Droplet sizing: start with the **$6/mo Basic (1 GB RAM)** + 2 GB swap file; DocuSeal (Rails) runs fine at this scale (a team of ~40 signers is tiny load). If it feels sluggish, resize to $12/mo (2 GB) in one click. Add weekly droplet snapshots (~$0.72/mo) or nightly SQLite backup.

DNS moves to Cloudflare (free): `kairos56.com` → Pages, `sign.kairos56.com` → droplet IP.

---

## 5. Signing Workflows

### 5.1 Team Application (prepopulated)

1. Applicant fills the web form at `/apply/` (rebuilt, same fields as today).
2. Form POSTs to `/api/apply` (Cloudflare Pages Function).
3. Function calls DocuSeal `POST /submissions` with `template_id` for the Team Application and `fields[]` carrying every answer as `default_value` (prefill).
4. Function responds with the DocuSeal signing URL → browser redirects. Applicant reviews the **actual Kairos PDF**, prefilled, and signs on any device.
5. On completion, DocuSeal emails the signed PDF to the applicant and the team leader (configurable), and a webhook can notify/track.
6. **Fallback preserved:** "Download blank PDF to print and sign" link stays on the page for anyone who prefers paper.

Template setup is one-time, in DocuSeal's UI: upload `TeamApplication.pdf`, drag fields (text, date, checkbox, signature) onto it, note the field names so the web form maps 1:1.

### 5.2 Tennessee State Documents (placeholder)

- **PH:** `static/TN-Volunteer-Docs.pdf` placeholder until Erik obtains the real PDFs (expected this weekend).
- Same pattern: each TN document becomes a DocuSeal template. A single submission can include multiple documents, so applicant signs Team Application + TN docs in one flow, or the TN docs can be a second link on the members dashboard (some state docs may only apply after acceptance — decide when we see them).
- If a document needs a countersignature (e.g., team leader or chaplain), DocuSeal's multiple-submitter support handles ordered signing (applicant first, leader second) automatically by email.

### 5.3 Compliance note

DocuSeal signatures are ESIGN/UETA-valid with an audit trail. Worth a one-line confirmation from the Kairos chair/state committee that e-signature is acceptable for the TN documents specifically — some DOC forms require wet ink. (Not legal advice; the download-print-sign fallback covers any that do.)

---

## 6. Admin-Editable Content (Sveltia CMS)

All dashboard and site content moves out of templates into `data/` and `content/` files:

```
data/
  chapter.yaml        # chapter name, prison, mission/vision, donate URL,
                      # leader contact, return address  ← the "fork & edit" file
  roster.yaml         # name, role, email, phone per member
  schedule.yaml       # meetings: date, label, notes
  announcements.yaml  # dated announcements
  supplies.yaml       # supply list items
  tasks.yaml          # assignments (cookie goals, etc.)
```

`/admin/` serves Sveltia CMS. The admin logs in with GitHub, edits roster/schedule/announcements in form fields, hits Save → commit → Cloudflare Pages rebuilds (~1 min). No code, no terminal.

Team password: admin sets it from a small protected page; a Pages Function stores the new hash in Cloudflare KV. Immediate effect, no rebuild, and never stored in git.

---

## 7. Members Area — Done Right

- `/members/` content is **excluded from the public build output** (rendered but stored where only the gate Function can fetch it, or fetched as a Function-served fragment).
- Login POSTs the shared password to a Pages Function → compares against the KV hash → sets a signed, HTTP-only cookie (30-day expiry).
- Middleware on `/members/*` checks the cookie server-side before serving content. View-source shows nothing without auth.
- Rate-limited login attempts (Cloudflare free tier includes basic rate limiting).
- Dashboard content itself comes from the same `data/*.yaml` files the CMS edits.

---

## 8. Redeployability for Future Kairos Chapters

The repo becomes a **GitHub template repository** (`kairos-chapter-site`). A new chapter's setup:

1. Click "Use this template" on GitHub.
2. Edit `data/chapter.yaml` (chapter name, prison, contacts, donate link).
3. Connect repo to Cloudflare Pages (guided, ~5 min).
4. Deploy DocuSeal: one `docker compose up` on any $6 droplet (a `deploy/` folder in the repo ships the compose file, Caddyfile, and a setup script).
5. Follow `SETUP.md` — a step-by-step guide written for a non-developer volunteer, covering DNS, the CMS login, uploading their chapter's PDFs to DocuSeal, and setting the team password.

Everything chapter-specific lives in `data/chapter.yaml` + environment variables. Nothing hardcoded.

---

## 9. Build Plan (Phases)

### Phase 0 — Prep (½ day)
- [ ] Create Cloudflare account; add kairos56.com zone. Site is currently on Netlify — if DNS is managed by Netlify DNS, switch nameservers at the registrar to Cloudflare (Cloudflare auto-imports records); if DNS is at the registrar, just repoint nameservers. Netlify keeps serving the site until the Phase 5 cutover, so zero downtime.
- [ ] Create DO droplet ($6 Basic, Ubuntu 24.04), point `sign.kairos56.com` at it.
- [ ] New GitHub repo `kairos-chapter-site` (or restructure this one in a `v2` branch).

### Phase 1 — DocuSeal up (½ day)
- [ ] Docker Compose + Caddy on droplet; HTTPS live at sign.kairos56.com.
- [ ] SMTP config (Gmail app password or free Brevo SMTP) so DocuSeal can email signing links/completed docs.
- [ ] Upload Team Application PDF, build the field template, record field names + template ID.
- [ ] Placeholder TN docs template.
- [ ] Nightly backup cron (SQLite file → DO Spaces or local + snapshot).

### Phase 2 — Site rebuild (1–2 days)
- [ ] Clean Hugo theme: proper `baseof.html` blocks everywhere, one nav/footer, CSS consolidated, current-year content fixes.
- [ ] Move all content to `data/` + `content/` per §6.
- [ ] Rebuilt `/apply/` form (same fields) posting to `/api/apply`.
- [ ] Cloudflare Pages project connected to repo; site live in parallel with Netlify until cutover.

### Phase 3 — Functions & members area (1 day)
- [ ] `/api/apply` Function → DocuSeal prefilled submission → redirect to signing URL.
- [ ] Members gate: KV password hash, signed cookie, middleware, rate limit.
- [ ] Admin password-change endpoint + page.
- [ ] DocuSeal webhook → (optional) commit a status note or email Erik on each completed application.

### Phase 4 — CMS + polish (1 day)
- [ ] Sveltia CMS config for all data files; sveltia-cms-auth Worker; GitHub OAuth app.
- [ ] `SETUP.md` deployment guide for future chapters; mark repo as template.
- [ ] Privacy policy update (e-signature data handling on our DocuSeal instance).

### Phase 5 — Cutover & real TN docs
- [ ] DNS cutover from Netlify → Cloudflare Pages; retire Netlify site.
- [ ] Swap placeholder TN docs for real PDFs (after this weekend), build their DocuSeal templates, wire into flow.
- [ ] End-to-end test: submit application on a phone, sign, verify emails + PDF output; test wrong-password, view-source, and print fallback paths.

**Estimated total: 4–5 working days of build time.**

---

## 9b. Phase 2 (post-launch, agreed July 15)

**Non-technical leader editing:** move team-dashboard data (roster, schedule,
announcements, supplies, tasks) from git data files into Cloudflare KV, with a
custom password-gated "Leader Edit" page (same auth pattern as team login —
leader password, plain HTML forms, instant updates, no GitHub accounts).
Sveltia CMS remains for rarely-changed site text. ~1 day build; also ships in
the template for other chapters.

## 10. Open Items / Decisions Needed

1. **TN state document PDFs** — Erik obtaining this weekend. Determines whether they join the applicant flow or live behind the members login, and whether any require wet ink or countersignature.
2. **Chair sign-off** on the DocuSeal-hosted signing page look/flow (send them a test link from Phase 1).
3. **Where completed applications go** — email to Erik only, or also a shared folder? (DocuSeal stores them; webhook can push copies anywhere.)
4. **GitHub org?** Consider a `kairos-wtsp` GitHub org rather than a personal account, so future volunteers can take over ownership cleanly.
5. Remove Erik's home address from the public site (return address only on generated/authorized documents).

---

## 11. Cost Summary

| Item | Monthly |
|---|---|
| Cloudflare Pages, Functions, KV, Workers, DNS | $0 |
| DigitalOcean droplet (DocuSeal) | $6 (resize to $12 if needed) |
| Droplet snapshots/backup | ~$1 |
| DocuSeal self-hosted community, Sveltia CMS, Hugo | $0 |
| Domain (existing) | — |
| **Total** | **~$7–13/mo** |

---

## Sources

- DocuSeal repo & features: https://github.com/docusealco/docuseal
- DocuSeal prefill API guide: https://www.docuseal.com/guides/pre-fill-pdf-document-form-fields-with-api
- DocuSeal pricing (cloud/Pro tiers): https://www.docuseal.com/pricing
- Documenso / OpenSign comparison: https://openalternative.co/alternatives/docusign · https://sliplane.io/blog/5-open-source-docusign-alternatives
- Sveltia CMS: https://github.com/sveltia/sveltia-cms · https://sveltiacms.app/en/
- DigitalOcean droplet pricing: https://www.digitalocean.com/pricing/droplets
