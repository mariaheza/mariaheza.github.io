import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const require = createRequire(import.meta.url);
let marked;
try {
  ({ marked } = await import(pathToFileURL(require.resolve('marked')).href));
} catch (error) {
  const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!runtimeModules) throw new Error('Install dependencies first with npm install.', { cause: error });
  ({ marked } = await import(pathToFileURL(path.join(runtimeModules, 'marked/lib/marked.esm.js')).href));
}
const profile = JSON.parse(await fs.readFile(path.join(root, 'content/profile.json'), 'utf8'));
const projects = JSON.parse(await fs.readFile(path.join(root, 'content/projects.json'), 'utf8'));
const resources = JSON.parse(await fs.readFile(path.join(root, 'content/resources.json'), 'utf8'));
const precisionComponents = JSON.parse(await fs.readFile(path.join(root, 'content/precision-components.json'), 'utf8'));
const publications = JSON.parse(await fs.readFile(path.join(root, 'content/publications.json'), 'utf8'));
const established = projects.filter(p => !p.featured);
const programme = projects.find(p => p.featured);
const pubIds = new Set();
for (const pub of publications) {
  if (pubIds.has(pub.id)) throw new Error(`Duplicate publication: ${pub.id}`);
  pubIds.add(pub.id);
  if (!established.some(p => p.slug === pub.area)) throw new Error(`Unknown publication area: ${pub.area}`);
  if (!/^https:\/\//.test(pub.url)) throw new Error(`Invalid publication URL: ${pub.id}`);
}
for (const p of projects) for (const id of p.publicationIds || []) {
  if (!pubIds.has(id)) throw new Error(`Missing publication ${id} for ${p.slug}`);
}
const siteUrl = (process.env.SITE_URL || profile.siteUrl).replace(/\/$/, '');
if (!/^https?:\/\/[^/]+$/.test(siteUrl)) throw new Error('SITE_URL must be an origin without a path.');
const preview = siteUrl !== profile.siteUrl.replace(/\/$/, '');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = '<span class="arrow" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 13 13 3M3 3h10v10"/></svg></span>';
const book = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M20 10C14 6 8 6 3 8v25c5-2 11-2 17 2 6-4 12-4 17-2V8c-5-2-11-2-17 2ZM20 10v25M8 14c3-1 6 0 8 1M8 20c3-1 6 0 8 1M25 15c2-1 5-2 8-1M25 21c2-1 5-2 8-1"/></svg>';
const prettyDate = d => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(d + 'T12:00:00Z'));

const posts = [];
for (const filename of (await fs.readdir(path.join(root, 'content/posts'))).sort()) {
  if (!filename.endsWith('.md') || filename.startsWith('_')) continue;
  const text = await fs.readFile(path.join(root, 'content/posts', filename), 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`Missing front matter in ${filename}`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const field = line.match(/^([a-z]+):\s*(.*?)\s*$/);
    if (!field) throw new Error(`Invalid metadata line in ${filename}: ${line}`);
    let value = field[2];
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replaceAll("''", "'");
    if (Object.hasOwn(meta, field[1])) throw new Error(`Duplicate metadata field in ${filename}: ${field[1]}`);
    meta[field[1]] = value;
  }
  if (meta.published !== 'true') continue;
  for (const key of ['title','date','excerpt','category']) {
    if (!meta[key]) throw new Error(`Missing ${key} in ${filename}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || Number.isNaN(Date.parse(meta.date)) || new Date(meta.date).toISOString().slice(0,10) !== meta.date) throw new Error(`Invalid date in ${filename}`);
  if (meta.date > today) continue;
  const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Use a lowercase, hyphen-separated filename: ${filename}`);
  if (posts.some(p => p.slug === slug)) throw new Error(`Duplicate post slug: ${slug}`);
  if (!match[2].trim()) throw new Error(`Empty post: ${filename}`);
  posts.push({...meta, slug, url:`/writing/${slug}/`, html:marked.parse(match[2]), minutes:Math.max(1, Math.ceil(match[2].split(/\s+/).length/220))});
}
posts.sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

function layout({title, description=profile.description, url='/', active='', body, article=false}) {
  const nav = [['/research/','Research','research'],['/publications/','Publications','publications'],['/about/','About','about'],['/writing/','Writing','writing']].map(([href,label,key]) => `<a href="${href}"${active===key?' aria-current="page"':''}>${label}</a>`).join('');
  const structured = article ? '' : `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Person',name:profile.name,description:profile.description,url:siteUrl,sameAs:[profile.github,profile.orcid],affiliation:{'@type':'Organization',name:profile.affiliation}}).replaceAll('<','\\u003c')}</script>`;
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · ${esc(profile.name)}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#481d0b">${preview?'<meta name="robots" content="noindex,nofollow">':''}<link rel="canonical" href="${esc(siteUrl+url)}"><meta property="og:title" content="${esc(title)} · ${esc(profile.name)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${article?'article':'website'}"><meta property="og:url" content="${esc(siteUrl+url)}"><meta property="og:image" content="${esc(siteUrl)}/assets/social.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/style.css"><link rel="alternate" type="application/rss+xml" title="${esc(profile.name)} — Writing" href="/feed.xml">${structured}<script defer src="/assets/main.js"></script></head>
<body><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="container header-inner"><a class="wordmark" href="/" aria-label="Maria Herrero-Zazo, home">Maria Herrero-Zazo<span>.</span></a><button class="menu-toggle" aria-expanded="false" aria-controls="main-nav">Menu <span aria-hidden="true">＋</span></button><nav class="main-nav" id="main-nav" aria-label="Main navigation">${nav}<a class="nav-contact" href="mailto:${esc(profile.email)}">Get in touch ${arrow}</a></nav></div></header>
<main id="main">${body}</main>
<section class="contact-band" aria-labelledby="contact-title"><div class="container contact-inner"><div><h2 id="contact-title">Good questions start conversations.</h2><p>For research, collaboration and scientific exchange.</p></div><a class="button light" href="mailto:${esc(profile.email)}">Let’s get in touch ${arrow}</a></div></section>
<footer class="site-footer"><div class="container footer-inner"><div><div class="footer-name">Maria Herrero-Zazo</div><div class="footer-small">Understanding medicines and differences in patient response.<br>© ${new Date().getFullYear()} Maria Herrero-Zazo</div></div><div class="footer-links"><a href="${esc(profile.orcid)}">ORCID ${arrow}</a><a href="${esc(profile.github)}">GitHub ${arrow}</a><a href="mailto:${esc(profile.email)}">Email ${arrow}</a><a href="/feed.xml">RSS ${arrow}</a></div></div></footer></body></html>`;
}

function projectArt(p) {
  const shapes = {
    'treatment-trajectories': '<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M60 45h75m16 0h100m18 0h80m-215 25h60m18 0h110m-95 25h60m18 0h110"/><path d="M60 70h55M60 95h107" opacity=".5"/></g><g fill="currentColor"><circle cx="135" cy="45" r="5"/><circle cx="194" cy="70" r="5"/><circle cx="287" cy="95" r="5"/></g>',
    'ai-precision-pharmacology': '<g stroke="currentColor" fill="none" stroke-width="1.2"><path d="M80 48L175 35L265 60L355 40M80 48L175 92L265 60L355 100M175 35v57M265 60L355 40v60M80 48v48l95-4M80 96L175 35" opacity=".65"/></g><g fill="currentColor"><circle cx="80" cy="48" r="5"/><circle cx="80" cy="96" r="5"/><circle cx="175" cy="35" r="5"/><circle cx="175" cy="92" r="5"/><circle cx="265" cy="60" r="7"/><circle cx="355" cy="40" r="5"/><circle cx="355" cy="100" r="5"/></g>',
    'pharmacological-knowledge': '<g stroke="currentColor" fill="none" stroke-width="1.6"><path d="M110 62l40-24 42 24v47l-42 24-40-24ZM192 62l42-24 42 24v47l-42 24-42-24M276 62l42-24 42 24v47l-42 24-42-24" transform="translate(0,-10)"/><path d="M150 28V14m84 14V14m84 14V14"/></g><g fill="currentColor"><circle cx="110" cy="52" r="4"/><circle cx="234" cy="123" r="4"/><circle cx="360" cy="52" r="4"/></g>',
    'reusable-health-data': '<g stroke="currentColor" fill="none" stroke-width="1.4"><rect x="80" y="28" width="76" height="65" rx="3"/><path d="M80 48h76m-76 20h76m-50-40v65m25-65v65M174 60h63m-9-8 9 8-9 8"/><rect x="256" y="28" width="76" height="65" rx="3"/><path d="M256 48h76m-76 20h76m-50-40v65m25-65v65"/></g><path d="m349 66 10 10 19-25" fill="none" stroke="currentColor" stroke-width="3"/>'
  };
  return `<div class="project-art ${p.colour}"><svg viewBox="0 0 480 158" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${shapes[p.art || p.slug]}</svg><span class="art-num">${p.number}</span><span class="art-label">${esc(p.artLabel || 'From source to insight')}</span></div>`;
}
function projectCard(p) {
  const group = p.slug;
  return `<article class="project-card" data-project data-group="${group}">${projectArt(p)}<div class="project-copy"><div class="eyebrow">${esc(p.category)}</div><h3><a href="/research/${p.slug}/">${esc(p.title)}</a></h3><p>${esc(p.summary)}</p><div class="card-bottom"><span>${p.publicationIds ? `${p.publicationIds.length} linked publications & preprints` : esc(p.status)}</span><a href="/research/${p.slug}/" aria-label="Explore ${esc(p.title)}">${arrow}</a></div></div></article>`;
}

function programmeFeature() {
  return `<section class="programme-feature"><div class="container"><div class="programme-grid"><div><div class="eyebrow">Current research programme</div><h2>AI for<br><em>precision pharmacology.</em></h2><p>${esc(programme.summary)}</p><a class="button" href="/research/${programme.slug}/">Explore the programme ${arrow}</a><div class="programme-status">In development · Antidepressant treatment as the initial focus</div></div><div class="programme-question"><div class="eyebrow">A question driving the work</div><p>Does pharmacological knowledge improve how we model treatment?</p><div class="programme-layers"><span>Treatment histories</span><span>Pharmacological knowledge</span><span>Patient information</span></div><a class="text-link" href="/publications/">Explore the research foundations ${arrow}</a></div></div></div></section>`;
}

function precisionComponentsSection() {
  return `<section class="precision-components" id="precision-pharmacology-components" aria-label="Components of precision pharmacology"><div class="container"><div class="section-heading"><div><div class="eyebrow">The scope of precision pharmacology</div><h2>Matching treatment to biology.<br><em>And to the person.</em></h2></div><p>Connecting biological aetiology, individual variation and treatment over time.</p></div><div class="components-grid">${precisionComponents.map(c=>`<article class="precision-component${c.id==='prescribing'?' prescribing-component':''}"><span class="component-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${c.icon}</svg></span><div><h3>${esc(c.label)}</h3><p>${esc(c.description)}</p></div></article>`).join('')}</div><p class="components-ai-note"><strong>The role of AI:</strong> connecting pharmacological knowledge with patient data to model treatment variation, anticipate outcomes and generate testable hypotheses.</p></div></section>`;
}

function publicationOrder(a,b) {
  const difference=established.findIndex(p=>p.slug===a.area)-established.findIndex(p=>p.slug===b.area);
  if(difference) return difference;
  const ids=established.find(p=>p.slug===a.area).publicationIds;
  return ids.indexOf(a.id)-ids.indexOf(b.id);
}
function publicationCard(pub, filterable = false) {
  const area = established.find(p => p.slug === pub.area);
  return `<article class="publication" id="${esc(pub.id)}"${filterable ? ` data-project data-group="${esc([pub.area,...(pub.secondaryAreas || [])].join(' '))}"` : ''}><div class="publication-body"><p class="publication-meta"><span class="publication-type${pub.type==='Preprint'?' preprint':''}">${esc(pub.type)}</span><span>${pub.year}</span></p><h3><a href="${esc(pub.url)}">${esc(pub.title)}</a></h3><p class="publication-authors">${esc(pub.authors)}</p><p class="publication-venue">${esc(pub.venue)}</p>${pub.note?`<p class="publication-note">${esc(pub.note)}</p>`:''}<div class="publication-links"><a href="${esc(pub.url)}">${pub.type==='Preprint'?'Read preprint':'Read publication'} ${arrow}</a><a href="/research/${area.slug}/">${esc(area.shortTitle || area.title)}</a>${(pub.secondaryAreas || []).map(slug=>{ const other=established.find(p=>p.slug===slug); return `<a href="/research/${slug}/">${esc(other.shortTitle || other.title)}</a>`; }).join('')}</div>${pub.versions?.length?`<details class="publication-versions"><summary>Earlier versions (${pub.versions.length})</summary><ul>${pub.versions.map(v=>`<li><a href="${esc(v.url)}">${esc(v.label)}</a></li>`).join('')}</ul></details>`:''}</div></article>`;
}
function areaPublications(p) {
  if (!p.publicationIds?.length) return '';
  const selected = publications.filter(pub=>p.publicationIds.includes(pub.id)).sort(publicationOrder);
  return `<section class="area-publications" aria-labelledby="publication-heading"><div class="publication-section-heading"><div><div class="eyebrow">${p.featured?'Building on established work':'Related research outputs'}</div><h2 id="publication-heading">${esc(p.publicationHeading || 'Publications & preprints')}</h2></div><a class="text-link" href="/publications/">View all ${arrow}</a></div>${selected.map(pub=>publicationCard(pub)).join('')}${p.slug==='biomedical-nlp'?`<div class="supporting-resources" id="data-foundations"><h3>Supporting data foundations</h3><p>Current medication-processing and harmonisation workflows support reliable reuse of survey and prescription data.</p><a class="text-link" href="/research/reusable-health-data/">Explore the data workflow ${arrow}</a></div>`:''}</section>`;
}

function postRow(p) {
  return `<article class="post-row"><div class="eyebrow"><time datetime="${p.date}">${prettyDate(p.date)}</time><br>${esc(p.category)}</div><div><h2><a href="${p.url}">${esc(p.title)}</a></h2><p>${esc(p.excerpt)}</p></div><a href="${p.url}" aria-label="Read ${esc(p.title)}">${arrow}</a></article>`;
}
async function write(url, text) {
  const target = path.join(output, url==='/'?'index.html':url.endsWith('/')?url.slice(1)+'index.html':url.slice(1));
  await fs.mkdir(path.dirname(target), {recursive:true});
  await fs.writeFile(target, text);
}
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(output,{recursive:true});
await fs.cp(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});
await fs.writeFile(path.join(output,'.nojekyll'),'');

await write('/',layout({title:'Understanding medicines & patient response',body:`
<section class="hero"><div class="container hero-grid"><div><div class="eyebrow">AI for Precision Pharmacology</div><h1>Understanding how<br>drugs work.<br><em>And why patients<br>respond differently.</em></h1><p class="lead">My research explores how AI can connect what we know about medicines with what we observe in patients, advancing precision pharmacology.</p><div class="actions"><a class="button" href="/research/">Explore my research ${arrow}</a><a class="text-link" href="/about/">A little about me <span aria-hidden="true">→</span></a></div><p class="identity"><strong>Maria Herrero-Zazo, PhD</strong><br>${esc(profile.affiliation)} · SGDP Centre</p></div><div class="hero-art"><figure><img src="/assets/research-map.svg" alt="Conceptual illustration connecting treatment histories, pharmacological knowledge and AI models." width="560" height="520" fetchpriority="high"><figcaption><span>A research focus in three connected layers</span><span>01 — RESEARCH MAP</span></figcaption></figure></div></div></section>
<div class="container"><div class="focus-strip"><div class="eyebrow">At the intersection</div><div class="focus-terms"><span>Human health data</span><span>Pharmacological knowledge</span><span>Machine learning</span></div></div></div>
${programmeFeature()}${precisionComponentsSection()}<section class="section"><div class="container"><div class="section-heading"><div><div class="eyebrow">Established research</div><h2>A research direction,<br><em>built across disciplines.</em></h2></div><p>Five areas connecting longitudinal patient data, real-world medication studies, pharmacological knowledge, genetics and biomedical information extraction.</p></div><div class="project-grid">${established.map(projectCard).join('')}</div><div class="section-end-link"><a class="text-link" href="/publications/">Browse publications & preprints ${arrow}</a></div></div></section>
<section class="about-band"><div class="container"><div><div class="eyebrow">A perspective shaped by two disciplines</div><h2>A pharmacist’s questions.<br><em>A computational approach.</em></h2></div><div><p>My background spans pharmacy, computer science and public health. I work at the SGDP Centre at King’s College London, following research at EMBL-EBI in Ewan Birney’s group.</p><p>I’m interested in what happens between prescribing a treatment and understanding a person’s experience of it — and how data and models can help us ask better questions.</p><a class="text-link" href="/about/">More about my background ${arrow}</a></div></div></section>
<section class="section"><div class="container writing-home"><div><div class="eyebrow">From the notebook</div><h2>Ideas worth<br><em>working through.</em></h2><p>Research notes on AI, treatment data and pharmacology. A place for methods, questions and work in progress.</p><a class="text-link" href="/writing/">Visit the notebook ${arrow}</a></div><div>${posts.length?posts.slice(0,2).map(postRow).join(''):`<div class="notebook-note">${book}<div class="eyebrow">Writing, in preparation</div><h3>A space for the questions<br>behind the research.</h3><p>The first notes are on their way. Expect thoughts on treatment trajectories, representing drugs and evaluating AI in health research.</p></div>`}</div></div></section>`}));

await write('/research/',layout({title:'Research',active:'research',url:'/research/',body:`<section class="page-intro"><div class="container"><div class="eyebrow">Research & projects</div><h1>How drugs work.<br><em>Why responses differ.</em></h1><p class="lead">My research centres on understanding how drugs work and why patients respond differently. Five research areas bring complementary perspectives to this question, and inform my current programme in AI for precision pharmacology.</p></div></section>${programmeFeature()}${precisionComponentsSection()}<section class="section"><div class="container"><div class="section-heading"><div><div class="eyebrow">Five research areas</div><h2>Explore the established work.</h2></div><p>Each area brings together its research questions, methods and related publications.</p></div><div class="project-grid">${established.map(projectCard).join('')}</div></div></section>`}));

const areaNames = {'biomedical-nlp':'Biomedical NLP','pharmacological-knowledge':'Knowledge & reasoning','medication-safety':'Medication effects & safety','treatment-trajectories':'Longitudinal modelling','genetics-pharmacogenomics':'Genetics & pharmacogenomics'};
await write('/publications/',layout({title:'Publications & preprints',active:'publications',url:'/publications/',description:'Publications and preprints by Maria Herrero-Zazo, organised by longitudinal patient modelling, medication safety, pharmacological knowledge and biomedical NLP.',body:`<section class="page-intro"><div class="container"><div class="eyebrow">Publications & preprints</div><h1>The work,<br><em>in context.</em></h1><p class="lead">Journal articles, conference papers and preprints grouped by research discipline. Earlier versions are linked beneath their published articles.</p><p class="publication-catalogue-note">${publications.length} distinct research outputs · Records reviewed October 2026 · <a href="${esc(profile.orcid)}">ORCID ${arrow}</a></p></div></section><section class="publications-section"><div class="container"><div class="filters" role="group" aria-label="Filter publications by research area"><button class="filter" data-filter="all" aria-pressed="true">All research</button>${established.map(p=>`<button class="filter" data-filter="${p.slug}" aria-pressed="false">${areaNames[p.slug]}</button>`).join('')}</div><p class="publication-count" id="filter-status" data-kind="publications" role="status" aria-live="polite">${publications.length} publications shown</p><div class="publications-list">${established.map(area=>`<section class="publication-discipline" data-area-section="${area.slug}" aria-labelledby="discipline-${area.slug}"><div class="discipline-heading"><span class="eyebrow">${area.number} / RESEARCH AREA</span><h2 id="discipline-${area.slug}">${esc(area.disciplineTitle)}</h2></div>${publications.filter(pub=>pub.area===area.slug).sort(publicationOrder).map(pub=>publicationCard(pub,true)).join('')}</section>`).join('')}</div><p class="publication-catalogue-note">Preprints have not been peer reviewed. Dates follow journal issues where applicable; online publication differences are noted. Earlier versions are not counted as separate research outputs.</p></div></section>`}));

for (const p of [...projects, ...resources]) {
  const next = projects[(projects.indexOf(p)+1)%projects.length];
  await write(`/research/${p.slug}/`,layout({title:p.title,description:p.summary,url:`/research/${p.slug}/`,active:'research',body:`<div class="container"><section class="detail-hero"><a class="back-link" href="/research/"><span aria-hidden="true">←</span> All research</a><div class="eyebrow">${esc(p.category)}</div><h1>${esc(p.title)}</h1><p class="lead">${esc(p.summary)}</p><div class="tags">${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></section><div class="detail-body"><div class="prose"><div class="question-box"><div class="eyebrow">The research question</div><p>${esc(p.question)}</p></div>${p.body.map(t=>`<p>${esc(t)}</p>`).join('')}<h2>The approach</h2><ol>${p.approach.map(t=>`<li>${esc(t)}</li>`).join('')}</ol><h2>A point of perspective</h2><p>${esc(p.perspective)}</p></div><aside class="detail-aside"><div class="eyebrow">${p.featured ? 'Programme status' : 'Research area'}</div><p>${esc(p.status)}</p><div class="eyebrow">Researcher</div><p>${esc(profile.name)}<br>${esc(profile.affiliation)}</p><a class="text-link" href="mailto:${esc(profile.email)}">Discuss this work ${arrow}</a></aside></div>${p.featured?precisionComponentsSection():''}${areaPublications(p)}</div><section class="related"><div class="container related-inner"><div><div class="eyebrow">Continue exploring</div><h2>${esc(next.title)}</h2></div><a class="text-link" href="/research/${next.slug}/">Next research area ${arrow}</a></div></section>`}));
}

await write('/about/',layout({title:'About',url:'/about/',active:'about',body:`<section class="page-intro"><div class="container"><div class="eyebrow">About Maria</div><h1>Pharmacist by training.<br><em>Researcher by curiosity.</em></h1><p class="lead">I’m Maria Herrero-Zazo, a pharmacist and computational researcher interested in understanding how drugs work and why patients respond differently.</p></div></section><div class="container"><div class="about-grid"><div class="prose"><p>I work at the Social, Genetic & Developmental Psychiatry (SGDP) Centre at King’s College London, with Prof. Gerome Breen. My work includes data analysis for the GLAD-MHG Omics Cohort and research at the intersection of treatment, genetics and machine learning.</p><p>My background brings together pharmacy, a PhD in computer science and training in public health research. That combination shapes the questions I ask: how treatments differ, what their histories reveal, and how models can incorporate the knowledge we already have about drugs.</p><h2>From language and knowledge to patient trajectories</h2><p>My earlier research developed resources and methods for extracting pharmacological information from biomedical text. I also worked on formal representations of drug–drug interactions, including the DINTO ontology and rule-based reasoning about interaction mechanisms.</p><p>Pharmacoepidemiological studies of minocycline and anticholinergic burden brought medication exposure and real-world clinical outcomes into this work.</p><p>At EMBL-EBI, in Ewan Birney’s group, I studied longitudinal antidepressant prescribing using machine learning and genetic analysis. This work examined whether treatment-derived patterns could reveal reproducible clinical heterogeneity across cohorts.</p><p>My current programme in AI for precision pharmacology brings these research foundations together. I am exploring how to combine quantitative treatment histories, patient information and pharmacological knowledge in models that help us study treatment over time.</p><h2>Research as a shared practice</h2><p>I value transparent methods, careful evaluation and collaboration across disciplines. Alongside analysis and model development, my work includes reproducible data workflows, teaching and supervision, and bringing researchers together around precision treatment in psychiatry.</p><p>I’m interested in exchanging ideas with people working on clinical AI, drug representations, pharmacogenomics and longitudinal health data.</p><a class="text-link" href="/research/">Explore the research ${arrow}</a></div><aside class="profile-aside"><h2>A few milestones</h2><div class="timeline-item"><div class="eyebrow">2026 — present</div><h3>King’s College London</h3><p>SGDP Centre<br>Treatment, genetics & computational research</p></div><div class="timeline-item"><div class="eyebrow">2018 — 2025</div><h3>EMBL-EBI</h3><p>Ewan Birney’s group<br>Longitudinal prescribing & genetics</p></div><div class="timeline-item"><div class="eyebrow">2015 — 2017</div><h3>King’s College London</h3><p>Postdoctoral research<br>Teaching & supervision</p></div><div class="timeline-item"><div class="eyebrow">Education</div><h3>Pharmacy · Computer science · Public health</h3><p>PhD, Universidad Carlos III de Madrid<br>Master of Research, Public Health Research</p></div><div class="aside-links"><a class="text-link" href="mailto:${esc(profile.email)}">Email Maria ${arrow}</a><a class="text-link" href="${esc(profile.orcid)}">View my ORCID record ${arrow}</a><a class="text-link" href="${esc(profile.github)}">Find me on GitHub ${arrow}</a></div></aside></div></div>`}));

await write('/writing/',layout({title:'Writing',url:'/writing/',active:'writing',description:'Research notes on AI, treatment data, pharmacological knowledge and the methods connecting them.',body:`<section class="page-intro"><div class="container"><div class="eyebrow">From the notebook</div><h1>Methods, questions<br><em>and ideas in progress.</em></h1><p class="lead">Notes on AI, pharmacology and human health data. A place to think through the work, share approaches and explore what comes next.</p></div></section><section class="writing-content"><div class="container">${posts.length?posts.map(postRow).join(''):`<div class="writing-empty">${book}<div><h2>The first pages are taking shape.</h2><p>I’m preparing the first notes for this space. They will explore the questions behind the research: what treatment histories capture, how we represent drugs and how we decide whether a model is useful.</p><p>In the meantime, <a href="/research/">explore my research</a> or <a href="mailto:${esc(profile.email)}">get in touch</a>.</p></div></div><div class="writing-topics"><div><div class="topic-num">01 / TREATMENT & DATA</div><h3>The patterns we observe</h3><p>Interpreting treatment histories and the limits of what prescribing records can tell us.</p></div><div><div class="topic-num">02 / KNOWLEDGE & MODELS</div><h3>What a model knows</h3><p>Drug representations, pharmacological knowledge and the case for testing their value.</p></div><div><div class="topic-num">03 / RESEARCH PRACTICE</div><h3>Behind the analysis</h3><p>Methods, reproducible workflows and the decisions that shape a research result.</p></div></div>`}<p class="rss-note">Follow future posts with the <a href="/feed.xml">RSS feed</a>.</p></div></section>`}));

for (const post of posts) {
  await write(post.url,layout({title:post.title,description:post.excerpt,url:post.url,active:'writing',article:true,body:`<article class="article"><div class="container narrow"><a class="back-link" href="/writing/"><span aria-hidden="true">←</span> All writing</a><div class="eyebrow">${esc(post.category)}</div><h1>${esc(post.title)}</h1><div class="post-meta"><time datetime="${post.date}">${prettyDate(post.date)}</time><span>${post.minutes} min read</span></div><div class="prose article-body">${post.html}</div><div class="article-footer">Written by ${esc(profile.name)}. <a href="mailto:${esc(profile.email)}">Share a thought by email</a>.</div></div></article>`}));
}
await write('/404.html',layout({title:'Page not found',url:'/404.html',body:`<section class="section"><div class="container narrow"><div class="eyebrow">404 / A small detour</div><h1>This page isn’t here.</h1><p class="muted" style="margin-top:25px">The link may have changed. The research is still here to explore.</p><div class="actions"><a class="button" href="/">Back to the home page ${arrow}</a><a class="text-link" href="/research/">Explore the research</a></div></div></section>`}));
const urls=['/','/about/','/research/','/publications/','/writing/',...[...projects,...resources].map(p=>`/research/${p.slug}/`),...posts.map(p=>p.url)];
await write('/sitemap.xml',`<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${esc(siteUrl+url)}</loc></url>`).join('')}</urlset>`);
await write('/robots.txt',preview?'User-agent: *\nDisallow: /\n':`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
await write('/feed.xml',`<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(profile.name)} — Writing</title><link>${esc(siteUrl)}/writing/</link><description>Notes on AI, pharmacology and human health data.</description><language>en-gb</language><atom:link href="${esc(siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/>${posts.map(p=>`<item><title>${esc(p.title)}</title><link>${esc(siteUrl+p.url)}</link><guid isPermaLink="true">${esc(siteUrl+p.url)}</guid><pubDate>${new Date(p.date+'T12:00:00Z').toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`).join('')}</channel></rss>`);
console.log(`Built ${urls.length+1} pages, ${posts.length} published posts. Origin: ${siteUrl}${preview?' (noindex preview)':''}`);
