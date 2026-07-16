# Kairos Chapter Site Template

Website template for Kairos Prison Ministry chapters — currently powering
**Kairos 56** at West Tennessee State Penitentiary ([kairos56.com](https://www.kairos56.com)).

What it provides:

- Public site (home, about, apply, contact) — all wording driven by
  `data/chapter.yaml`, adaptable to any Kairos ministry (men's, women's,
  Kairos Outside, Torch) without code changes
- **Online team application** with e-signature: web form → prefilled official
  PDF → signed electronically via self-hosted [DocuSeal](https://github.com/docusealco/docuseal)
  (print-and-sign fallback included)
- **Team dashboard** (`/members/`) — roster, schedule, announcements —
  protected by a real server-side login
- **No-code content admin** (`/admin/`) via Sveltia CMS
- Admin-changeable team password (`/team-admin/`), no redeploy needed

**Deploying for your chapter:** see [SETUP.md](SETUP.md). Runs on
Cloudflare Pages (free) + one $6/mo server for signing.

**Architecture and design decisions:** see [PLAN.md](PLAN.md).

## Local development

```bash
hugo server          # site only (Functions require `wrangler pages dev`)
```

## License

Apache-2.0 (site code). DocuSeal is AGPL-3.0, self-hosted separately.
