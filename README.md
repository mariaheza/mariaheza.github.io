# Maria Herrero-Zazo — personal website

Central research interest: **Understanding how drugs work and why patients respond differently.** AI, pharmacology, genetics and health data are complementary approaches to this question.

A responsive professional website with an About page, a featured current programme, four established research areas, a publications catalogue and supporting resources and a static Markdown blog. No database, tracking scripts or paid services are required.

## Publish to GitHub Pages

1. Create an empty repository named **mariaheza.github.io** in the **mariaheza** account. A public repository is the simplest option for GitHub Pages.
2. Add this source tree to the repository's `main` branch. Do not upload `node_modules`, `dist`, `.git` or `.openai`.
3. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
4. Run **Actions → Publish website to GitHub Pages → Run workflow**, or push a change to `main`.
5. Once deployment succeeds, open https://mariaheza.github.io.

The `.openai` folder is used only by the private Sites preview. It is not required on GitHub Pages. The source is ready for a root-level user site; a project site under a subpath would need adjusted asset URLs.

## Write a blog post

Add a file to `content/posts/`, for example `2026-11-05-my-first-post.md`:

```markdown
---
title: My first post
date: 2026-11-05
excerpt: A short description for the writing page.
category: Research notes
published: true
---

Start writing here. Use normal Markdown.

## A section heading

More text, with **bold**, *italics*, lists and links.
```

Commit the file to `main`. The website rebuilds automatically. The post appears on the Writing page, the home page, the RSS feed and the sitemap.

This repository is public: keep private drafts outside it. Only posts with `published: true` are built. Files beginning with `_` and posts dated in the future are excluded. Dates use Europe/London time.

The front matter intentionally uses simple `key: value` lines. Supported keys are `title`, `date`, `excerpt`, `category` and `published`. Dates use YYYY-MM-DD. Posts must have unique URL slugs and complete metadata. Content is trusted author-written Markdown and may include HTML; do not accept untrusted contributors without adding sanitisation.

## Update your profile or projects

- Edit `content/profile.json` for name, affiliation, contact links and public website URL.
- Edit `content/projects.json` for the current programme and four research areas.
- Edit `content/publications.json` for publication titles, dates, links and earlier versions. Each output has one primary area; earlier versions are not counted separately.
- Edit `content/resources.json` for supporting data-workflow resources.
- The catalogue was reviewed on 30 October 2026 using ORCID, Europe PMC, Crossref and ACL Anthology records. Preserve explicit preprint labels; update status and link earlier versions when an article is published.
- Edit `scripts/build.mjs` for the About-page biography or site layout.
- Edit `assets/style.css` to change the design.

The biography and projects are a first editorial draft based on supplied professional information. Project stages are stated explicitly; starter drafts are excluded from this public repository. Review wording before public launch.

## Build locally

Requires Node.js 22 or later.

```bash
npm install
npm run build
npm run check
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. All output is generated in `dist/`. RSS, sitemap, metadata, social preview artwork and a custom 404 page are generated automatically.

For a preview on another domain, set `SITE_URL` at build time. For example: `SITE_URL=https://example.com npm run build`. No analytics or cookie banner is included because the site uses no tracking or cookies.

Research areas and publications are presented in this order: longitudinal patient modelling; real-world medication studies; knowledge representation; biomedical NLP/data. Publication years are secondary metadata, not the basis for ordering. Within each discipline, `publicationIds` defines the editorial order.

The five research areas now include Genetics & Pharmacogenomics fourth, with biomedical NLP last. Each publication has one primary area and optional `secondaryAreas`; filters include both without duplicating catalogue entries.
