#!/usr/bin/env node
/* Pull publishable notes out of the Obsidian vault into src/content/posts.
 *
 * The vault stays the place where writing happens; this script is the one
 * crossing point. A note is a candidate when either
 *   - it sits under SOURCE_DIR and is tagged LinkedIn (the field-notes folder), or
 *   - its frontmatter says `Publish: true`, wherever it lives.
 * `Publish: false` opts a note out, `Slug:` overrides the URL, `Description:`
 * overrides the generated summary, `Repo:` names the source repository.
 *
 * For each candidate it rewrites Obsidian syntax into plain Markdown: image
 * embeds are copied under public/writing/<slug>/, wikilinks become text or a
 * link when they point at another published note, callouts become quotes and
 * trailing hashtag lines become tags. A note that mentions an internal name is
 * skipped and reported: the repository is public, so a draft is not enough.
 *
 * Usage: node scripts/sync-posts.mjs [--dry-run] [--vault <dir>]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src/content/posts");
const IMG_DIR = path.join(ROOT, "public/writing");
const SOURCE_DIR = "Tech/LinkedIn Posts";
/* names that must not appear on the public site */
const INTERNAL = [/\bmvue\w*/i, /\bcalfus\b/i];
const SKIP_DIRS = new Set([".obsidian", ".git", ".trash", ".agents", ".claude", "node_modules"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
/* hashtags that read better spelled out */
const TAG_NAMES = {
  cicd: "CI/CD",
  githubactions: "GitHub Actions",
  argoworkflows: "Argo Workflows",
  argocd: "ArgoCD",
  supplychainsecurity: "Supply Chain Security",
  secretsmanagement: "Secrets Management",
  machinelearning: "Machine Learning",
  containersecurity: "Container Security",
  platformengineering: "Platform Engineering",
  cloudsecurity: "Cloud Security",
  awsconfig: "AWS Config",
  eventbridge: "EventBridge",
  cloudwatch: "CloudWatch",
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const vaultArg = args[args.indexOf("--vault") + 1];
const VAULT = path.resolve(
  (args.includes("--vault") && vaultArg) || process.env.VAULT_DIR || path.join(os.homedir(), "personal", "Obsidian Vault"),
);

if (!fs.existsSync(VAULT)) {
  console.error(`vault not found: ${VAULT} (set VAULT_DIR or pass --vault)`);
  process.exit(1);
}

/* ── walk ───────────────────────────────────────────────────── */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(VAULT);
const notes = files.filter((f) => f.endsWith(".md"));
const attachments = new Map();
const ambiguous = new Set();
for (const f of files) {
  if (!IMAGE_EXT.has(path.extname(f).toLowerCase())) continue;
  const name = path.basename(f);
  if (attachments.has(name)) ambiguous.add(name);
  else attachments.set(name, f);
}

/* ── frontmatter: the small YAML subset the vault actually uses ── */
function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return { data: {}, body: text };
  const end = text.indexOf("\n---", 4);
  if (end === -1) return { data: {}, body: text };
  const block = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\r?\n/, "");
  const data = {};
  let key = null;
  for (const line of block.split("\n")) {
    const item = line.match(/^\s+-\s*(.*)$/);
    if (item && key) {
      if (!Array.isArray(data[key])) data[key] = [];
      data[key].push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    const raw = kv[2].trim();
    if (raw === "") data[key] = "";
    else if (raw.startsWith("[") && raw.endsWith("]")) data[key] = raw.slice(1, -1).split(",").map((s) => unquote(s.trim())).filter(Boolean);
    else if (raw === "true" || raw === "false") data[key] = raw === "true";
    else data[key] = unquote(raw);
  }
  return { data, body };
}
const unquote = (s) => s.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
const asList = (v) => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []);

/* ── selection ──────────────────────────────────────────────── */
const candidates = [];
for (const file of notes) {
  const rel = path.relative(VAULT, file);
  const text = fs.readFileSync(file, "utf8");
  const { data, body } = parseFrontmatter(text);
  if (data.Publish === false) continue;
  const inSource = rel.startsWith(SOURCE_DIR + path.sep);
  const tagged = asList(data.Tags).some((t) => String(t).toLowerCase() === "linkedin");
  if (data.Publish === true || (inSource && tagged)) candidates.push({ file, rel, data, body });
}

/* ── naming ─────────────────────────────────────────────────── */
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function splitName(name) {
  const m = name.match(/^(.*?)\s+[-—–]\s+(.*)$/);
  return m ? { title: m[1].trim(), deck: m[2].trim() } : { title: name.trim(), deck: undefined };
}

const bySlug = new Map();
const byNoteName = new Map();
for (const c of candidates) {
  c.name = path.basename(c.file, ".md");
  Object.assign(c, splitName(c.name));
  if (typeof c.data.Title === "string" && c.data.Title) c.title = c.data.Title;
  c.slug = typeof c.data.Slug === "string" && c.data.Slug ? slugify(c.data.Slug) : slugify(c.title);
  if (bySlug.has(c.slug)) {
    console.warn(`! slug clash: ${c.rel} and ${bySlug.get(c.slug).rel} both map to ${c.slug}; skipping the second`);
    continue;
  }
  bySlug.set(c.slug, c);
  byNoteName.set(c.name, c.slug);
}
/* ── body rewriting ─────────────────────────────────────────── */
const HASHTAG_LINE = /^(?:\s*#[A-Za-z0-9_]+)+\s*$/;

function convert(c) {
  const tags = new Map();
  const addTag = (t) => {
    const key = t.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || key === "linkedin" || key === "article") return;
    if (!tags.has(key)) tags.set(key, TAG_NAMES[key] ?? t);
  };
  asList(c.data.Tags).forEach((t) => addTag(String(t)));

  const images = [];
  let body = c.body.replace(/\r\n/g, "\n");
  body = body.replace(/%%[\s\S]*?%%/g, "");
  const lines = body.split("\n").filter((line) => {
    if (HASHTAG_LINE.test(line)) {
      line.match(/#[A-Za-z0-9_]+/g).forEach((h) => addTag(h.slice(1)));
      return false;
    }
    return true;
  });
  body = lines.join("\n");

  /* a leading H1 repeats the title; the page sets it from frontmatter */
  body = body.replace(/^\s*#\s+[^\n]*\n+/, "");

  /* ![[image.png|alt]] -> ![alt](/writing/slug/image.png) */
  body = body.replace(/!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (_, target, alt) => {
    const name = path.basename(target.trim());
    const src = attachments.get(name);
    if (!src) {
      console.warn(`! ${c.rel}: attachment not found: ${name}`);
      return "";
    }
    if (ambiguous.has(name)) console.warn(`! ${c.rel}: several attachments are named ${name}; using ${path.relative(VAULT, src)}`);
    images.push({ name, src });
    const label = (alt ?? "").trim() || path.basename(name, path.extname(name)).replace(/[-_]+/g, " ");
    return `![${label}](/writing/${c.slug}/${encodeURIComponent(name)})`;
  });

  /* [[Note|label]] -> label, or a link when Note is also published */
  body = body.replace(/\[\[([^\]|#]+?)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_, target, label) => {
    const text = (label ?? target).trim();
    const slug = byNoteName.get(target.trim());
    return slug && slug !== c.slug ? `[${text}](/writing/${slug}/)` : text;
  });

  /* > [!note] Title  ->  > **Title** */
  body = body.replace(/^> \[!(\w+)\][+-]?\s*(.*)$/gm, (_, kind, title) => `> **${title.trim() || kind[0].toUpperCase() + kind.slice(1)}**`);

  body = body.replace(/\n{3,}/g, "\n\n").trim() + "\n";

  const firstParagraph = body.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("!") && !p.trim().startsWith("#")) ?? "";
  const description =
    typeof c.data.Description === "string" && c.data.Description
      ? c.data.Description
      : truncate(firstParagraph.replace(/\s+/g, " ").replace(/[*_`>]/g, "").trim(), 180);

  const repo =
    (typeof c.data.Repo === "string" && c.data.Repo) ||
    body.match(/https?:\/\/github\.com\/atkaridarshan04\/[^\s)\]>]+/)?.[0];

  const internal = INTERNAL.find((re) => re.test(c.name) || re.test(body));
  if (internal) {
    console.warn(`! ${c.rel}: mentions "${(internal.exec(c.name) ?? internal.exec(body))[0]}"; skipped`);
    return null;
  }
  const draft = c.data.Draft === true;

  return {
    frontmatter: {
      title: c.title,
      deck: c.deck,
      description,
      date: toDate(c.data.Created, c.file),
      updated: toDate(c.data.Updated),
      tags: [...tags.values()],
      repo,
      linkedin: (typeof c.data.LinkedInUrl === "string" && c.data.LinkedInUrl) || undefined,
      draft: draft || undefined,
      source: c.rel.split(path.sep).join("/"),
    },
    body,
    images,
  };
}

function truncate(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

function toDate(value, file) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  if (file) return fs.statSync(file).mtime.toISOString().slice(0, 10);
  return undefined;
}

/* ── output ─────────────────────────────────────────────────── */
function yaml(frontmatter) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(frontmatter)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.map((x) => JSON.stringify(x)).join(", ")}]`);
    else if (typeof v === "boolean") lines.push(`${k}: ${v}`);
    else if (k === "date" || k === "updated") lines.push(`${k}: ${v}`);
    else lines.push(`${k}: ${JSON.stringify(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function writeIfChanged(file, content) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (existing === content) return "unchanged";
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return existing === null ? "created" : "updated";
}

function copyIfChanged(src, dest) {
  if (fs.existsSync(dest)) {
    const a = fs.statSync(src);
    const b = fs.statSync(dest);
    if (a.size === b.size && a.mtimeMs <= b.mtimeMs) return "unchanged";
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  return "copied";
}

const counts = { created: 0, updated: 0, unchanged: 0, drafts: 0, skipped: 0, images: 0 };
for (const c of bySlug.values()) {
  const converted = convert(c);
  if (!converted) {
    bySlug.delete(c.slug);
    counts.skipped += 1;
    continue;
  }
  const { frontmatter, body, images } = converted;
  const content = `${yaml(frontmatter)}\n\n${body}`;
  const status = writeIfChanged(path.join(OUT_DIR, `${c.slug}.md`), content);
  counts[status] += 1;
  if (frontmatter.draft) counts.drafts += 1;
  /* a draft's images stay in the vault: public/ ships with the site, draft or not */
  for (const img of images) {
    if (frontmatter.draft) continue;
    if (copyIfChanged(img.src, path.join(IMG_DIR, c.slug, img.name)) === "copied") counts.images += 1;
  }
  console.log(`${status.padEnd(9)} ${frontmatter.draft ? "[draft] " : ""}${c.slug}`);
}

/* a synced post whose note is gone stays unless --prune is passed */
if (fs.existsSync(OUT_DIR)) {
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (!f.endsWith(".md")) continue;
    const { data } = parseFrontmatter(fs.readFileSync(path.join(OUT_DIR, f), "utf8"));
    const slug = path.basename(f, ".md");
    if (data.source && !bySlug.has(slug)) {
      if (args.includes("--prune")) {
        if (!dryRun) {
          fs.rmSync(path.join(OUT_DIR, f));
          fs.rmSync(path.join(IMG_DIR, slug), { recursive: true, force: true });
        }
        console.log(`removed   ${slug}`);
      } else console.warn(`! ${slug} was synced from ${data.source}, which is no longer published (pass --prune to remove it)`);
    }
  }
}

console.log(
  `\n${dryRun ? "[dry run] " : ""}${bySlug.size} posts: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged, ${counts.drafts} drafts, ${counts.skipped} skipped, ${counts.images} images copied`,
);
