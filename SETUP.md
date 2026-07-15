# Kairos Chapter Site — Deployment Guide

This repo is a reusable template for Kairos ministry chapter sites (men's,
women's, Kairos Outside, Torch). It provides a public site, an online
prefilled-and-e-signed team application, a password-protected team dashboard,
and a no-code content admin.

**Stack:** Hugo (static site) · Cloudflare Pages + Functions + KV (hosting,
auth, API glue) · DocuSeal (self-hosted e-signature, one small server) ·
Sveltia CMS (content editing at `/admin/`).

**Monthly cost:** ~$6–13 (one small DigitalOcean droplet; everything else free).

---

## 1. Fork / copy the repo

1. On GitHub: **Use this template** (or fork) → your account/org.
2. Edit `data/chapter.yaml` — chapter name, facility, event, contacts, donate
   link, terminology. This file drives all wording on the site.
3. Edit `hugo.toml` — set `baseURL` to your domain and `title`.
4. Edit `static/admin/config.yml` — set `repo:` to your GitHub repo slug and
   `site_url` to your domain.
5. Replace `static/TeamApplication.pdf` with your ministry's blank application.

## 2. Cloudflare Pages (the website)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**
   → pick your repo.
2. Build settings: framework **Hugo**, build command `hugo --minify`, output
   dir `public`. Add env var `HUGO_VERSION` = `0.163.0` (or newer).
3. Add your domain under **Custom domains** (Cloudflare walks you through DNS).
4. Create a KV namespace: **Workers & Pages → KV → Create** — name it anything
   (e.g. `kairos-site`). Then in your Pages project → **Settings → Bindings →
   Add → KV namespace**, variable name **`KAIROS`**, select the namespace.
5. Pages project → **Settings → Environment variables**, add (Production):

   | Variable | Value |
   |---|---|
   | `SESSION_SECRET` | long random string (e.g. `openssl rand -hex 32`) |
   | `ADMIN_SECRET` | long random string — this is your admin key for /team-admin/ |
   | `DOCUSEAL_URL` | `https://sign.yourdomain.org` (after step 3) |
   | `DOCUSEAL_API_TOKEN` | from DocuSeal → Settings → API (after step 3) |
   | `DOCUSEAL_TEMPLATE_ID` | numeric template id (after step 4) |

6. Set the team password: visit `https://yourdomain/team-admin/`, enter your
   `ADMIN_SECRET` and the new team password. (Stored as a hash in KV; the
   admin key never leaves Cloudflare env vars.)

## 3. DocuSeal (the signing server)

1. Create a DigitalOcean droplet: **Ubuntu 24.04, Basic, $6/mo (1GB)**.
2. DNS: add an `A` record `sign` → droplet IP (in Cloudflare DNS; set it to
   **DNS only / grey cloud** so Caddy can issue its own certificate).
3. Copy `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/setup.sh`
   to the droplet (`scp` or paste), then:

   ```bash
   mkdir -p /opt/docuseal && cd /opt/docuseal
   # (put the three files here)
   bash setup.sh sign.yourdomain.org
   ```

4. Open `https://sign.yourdomain.org`, create the admin account.
5. **Settings → SMTP**: add email credentials (a Gmail app password works, or
   free Brevo SMTP) so DocuSeal can email signing links and completed PDFs.
6. **Settings → API**: copy the token into the Cloudflare env var above.

## 4. Build the application template in DocuSeal

1. DocuSeal → **New Template → Upload** your blank application PDF.
2. Drag fields onto the PDF. **Name each field exactly** as listed in
   `functions/api/apply.js` (`TEXT_FIELDS` and `CHECKBOX_FIELDS`) — e.g.
   `first_name`, `last_name`, `dob`, `church_name`, `agree_statement` … —
   plus a **Signature** field and a **Date** field for the applicant.
   Field names are how the web form's answers prefill the PDF.
3. Note the template ID (in the URL: `/templates/<id>`), set it as
   `DOCUSEAL_TEMPLATE_ID` in Cloudflare.
4. Set `signing.enabled: true` in `data/chapter.yaml` (or via `/admin/`).
   The Apply page now sends applicants straight into review-and-sign.
5. **State documents** (e.g. Tennessee volunteer forms): create additional
   templates the same way. They can be added to the same submission flow in
   `functions/api/apply.js` or sent separately from DocuSeal.

## 5. Content admin (/admin/)

- Go to `https://yourdomain/admin/` and sign in with GitHub.
  - If you're the repo owner, Sveltia's token sign-in works immediately.
  - For non-technical admins, deploy
    [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) (a free
    Cloudflare Worker, ~5 min) and set `base_url` in `static/admin/config.yml`.
- Everything is editable: chapter settings, roster, schedule, announcements,
  tasks, supplies, and the About/Contact pages. Saving commits to GitHub and
  the site rebuilds automatically (~1 min).

## 6. Security model (what protects what)

- **Team dashboard** (`/members/`): gated server-side by a Cloudflare Pages
  Function. Content is never served without a valid signed session cookie.
  Password is checked against a hash in KV; change it anytime at `/team-admin/`.
- **Content admin** (`/admin/`): GitHub authentication — only people with
  write access to the repo can edit.
- **Password admin** (`/team-admin/`): requires `ADMIN_SECRET`.
- **Signing** (`sign.` subdomain): DocuSeal's own admin login; API token only
  lives in Cloudflare env vars.
- Secrets are never stored in this repo.

## 7. Ongoing maintenance

- **DocuSeal updates:** `cd /opt/docuseal && docker compose pull && docker compose up -d`
  (every month or two).
- **Backups:** nightly automatic to `/opt/docuseal/backups` (14-day rotation).
  Optionally enable DigitalOcean droplet snapshots (~$1/mo) for full-server backup.
- **Hugo/site:** no maintenance required; Cloudflare builds from git.

## Troubleshooting

- *Apply page says "Online signing is not configured"* — one of the three
  `DOCUSEAL_*` env vars is missing, or `signing.enabled` is false.
- *Prefill fields empty on the PDF* — field names in the DocuSeal template
  don't match the names in `functions/api/apply.js`.
- *Team login always rejects* — set the password once via `/team-admin/`
  (there is no default password).
- *CMS won't save* — the GitHub user needs write access to the repo.
