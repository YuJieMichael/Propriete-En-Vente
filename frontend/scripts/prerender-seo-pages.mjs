import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(frontendDir, "..", "dist");
const manifestPath = resolve(frontendDir, ".seo-pages.generated.json");
const [template, manifestText] = await Promise.all([
  readFile(resolve(distDir, "index.html"), "utf8"),
  readFile(manifestPath, "utf8"),
]);
const manifest = JSON.parse(manifestText);
const pages = manifest.pages;
const siteOrigin = manifest.origin || (process.env.VITE_SITE_URL || "https://proprieteenvente.ca").replace(/\/$/, "");
const noindex = new URL(siteOrigin).hostname !== "proprieteenvente.ca";

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

for (const page of pages) {
  if (!page || typeof page.path !== "string" || !page.path.startsWith("/")) throw new Error("Invalid SEO page path in generated manifest.");
  const hreflang = Object.entries(page.alternates).map(([language, path]) => {
    const tag = language === "zh" ? "zh-Hans-CA" : language === "fr" || language === "en" ? `${language}-CA` : language;
    return `<link rel="alternate" hreflang="${tag}" href="${siteOrigin}${escapeHtml(path)}" />`;
  }).join("\n    ");
  const langTag = page.lang === "zh" ? "zh-Hans" : page.lang;
  const contentType = /\/(?:propriete|property)\//.test(page.path) ? "product" : "website";
  const noindexTag = noindex ? '\n    <meta name="robots" content="noindex,follow" />' : "";
  const seoTags = `\n    <title>${escapeHtml(page.title)}</title>\n    <meta name="description" content="${escapeHtml(page.description)}" />\n    <link rel="canonical" href="${siteOrigin}${escapeHtml(page.path)}" />\n    ${hreflang}\n    <meta property="og:type" content="${contentType}" />\n    <meta property="og:title" content="${escapeHtml(page.title)}" />\n    <meta property="og:description" content="${escapeHtml(page.description)}" />\n    <meta property="og:url" content="${siteOrigin}${escapeHtml(page.path)}" />${noindexTag}`;
  const html = template
    .replace(/<html lang="[^"]*">/, `<html lang="${langTag}">`)
    .replace(/<title>[\s\S]*?<\/title>\s*/g, "")
    .replace(/<meta\s+name="description"[^>]*\/?\s*>\s*/g, "")
    .replace(/<link\s+rel="canonical"[^>]*\/?\s*>\s*/g, "")
    .replace(/<link\s+rel="alternate"[^>]*\/?\s*>\s*/g, "")
    .replace(/<meta\s+property="og:[^"]+"[^>]*\/?\s*>\s*/g, "")
    .replace("</head>", `${seoTags}\n  </head>`);
  const outputPath = resolve(distDir, ...page.path.split("/").filter(Boolean), "index.html");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");
}

await rm(manifestPath, { force: true });
console.log(`Generated static HTML metadata for ${pages.length} public routes.`);
