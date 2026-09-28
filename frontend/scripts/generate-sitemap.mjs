import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(frontendDir, "public");
const seoData = JSON.parse(await readFile(resolve(frontendDir, "src/seo-content.json"), "utf8"));

async function loadLocalBuildEnv() {
  for (const file of [".env.production.local", ".env.production", ".env.local", ".env"]) {
    try {
      const source = await readFile(resolve(frontendDir, file), "utf8");
      for (const line of source.split(/\r?\n/)) {
        const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
        if (!match || process.env[match[1]]) continue;
        const value = match[2].replace(/\s+#.*$/, "").replace(/^(['"])(.*)\1$/, "$2");
        process.env[match[1]] = value;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function listingPath(lang, slug) {
  return `/${lang}/${lang === "fr" ? "propriete" : "property"}/${slug}/`;
}

function localePaths(path) {
  const normalized = path.replace(/\/$/, "");
  if (normalized === "/fr") return { fr: "/fr/", en: "/en/", zh: "/zh/" };
  if (normalized === "/fr/proprietes") return { fr: path, en: "/en/properties/", zh: "/zh/properties/" };
  const match = /^\/(fr|en|zh)\/(propriete|property)\/(.+)$/.exec(normalized);
  if (match) return {
    fr: listingPath("fr", match[3]),
    en: listingPath("en", match[3]),
    zh: listingPath("zh", match[3]),
  };
  return { fr: path, en: path.replace(/^\/fr/, "/en"), zh: path.replace(/^\/fr/, "/zh") };
}

function localizedPages(paths, metadataByLanguage) {
  return ["fr", "en", "zh"].map(lang => ({
    path: paths[lang],
    lang,
    title: metadataByLanguage[lang].title,
    description: metadataByLanguage[lang].description,
    alternates: { ...paths, "x-default": paths.fr },
  }));
}

function sitemapEntry(page, lastmod) {
  const alternateLinks = Object.entries(page.alternates)
    .map(([language, path]) => `    <xhtml:link rel="alternate" hreflang="${language === "zh" ? "zh-Hans-CA" : language === "fr" || language === "en" ? `${language}-CA` : language}" href="${escapeXml(origin + path)}"/>`)
    .join("\n");
  const lastmodTag = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : "";
  return `  <url>\n    <loc>${escapeXml(origin + page.path)}</loc>${lastmodTag}\n${alternateLinks}\n  </url>`;
}

function listingMetadata(property, lang) {
  const type = seoData.listingTypes[lang][property.type] || seoData.listingTypes[lang].house;
  const priceValue = Number(property.price);
  const price = new Intl.NumberFormat(lang === "zh" ? "zh-CN" : `${lang}-CA`, {
    style: "currency", currency: "CAD", maximumFractionDigits: 0,
  }).format(priceValue);
  const title = lang === "fr"
    ? `${type} à vendre à ${property.city} | ${property.title} | ${price}`
    : lang === "en"
      ? `${type} for sale in ${property.city}, Québec | ${property.title} | ${price}`
      : `${property.city}待售${type} | ${property.title} | ${price}`;
  const description = (lang === "fr" && property.description) || (lang === "fr"
    ? `${type} à vendre à ${property.city}, Québec : ${property.title}. Prix demandé : ${price}. Consultez les photos et caractéristiques.`
    : lang === "en"
      ? `${type} for sale in ${property.city}, Québec: ${property.title}. Listed at ${price}. View photos and property features.`
      : `魁北克${property.city}待售${type}：${property.title}，挂牌价${price}。查看房源照片和配置。`);
  return { title, description: description.replace(/\s+/g, " ").trim().slice(0, 190) };
}

await loadLocalBuildEnv();
const origin = (process.env.VITE_SITE_URL || "https://proprieteenvente.ca").replace(/\/$/, "");
const projectUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const listingEnabled = process.env.VITE_LISTING_PUBLICATION_ENABLED === "true";
if (listingEnabled && (!projectUrl || !publishableKey)) {
  throw new Error("Public listing sitemap generation needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
}

const pageGroups = [
  { paths: { fr: "/fr/", en: "/en/", zh: "/zh/" }, metadata: seoData.home },
  { paths: { fr: "/fr/proprietes/", en: "/en/properties/", zh: "/zh/properties/" }, metadata: seoData.catalogue },
];
const listingPages = [];
const listingLastmod = new Map();

if (listingEnabled) {
  const endpoint = new URL("/rest/v1/published_listings", projectUrl);
  endpoint.searchParams.set("select", "id,property,published_at");
  endpoint.searchParams.set("order", "published_at.desc");
  let offset = 0;
  const pageSize = 500;
  while (true) {
    const response = await fetch(endpoint, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        Range: `${offset}-${offset + pageSize - 1}`,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Published listings could not be read for the sitemap (HTTP ${response.status}).`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Published listings returned an invalid sitemap response.");
    for (const row of rows) {
      const property = row?.property;
      if (!/^[0-9a-f-]{36}$/i.test(row?.id ?? "") || typeof property?.title !== "string" || typeof property?.city !== "string" || !Number.isFinite(Number(property.price))) continue;
      const slug = `${slugify(`${property.title}-${property.city}`)}-${row.id.toLowerCase()}`;
      const paths = {
        fr: listingPath("fr", slug),
        en: listingPath("en", slug),
        zh: listingPath("zh", slug),
      };
      const metadata = Object.fromEntries(["fr", "en", "zh"].map(lang => [lang, listingMetadata(property, lang)]));
      listingPages.push(...localizedPages(paths, metadata));
      listingLastmod.set(slug, typeof row.published_at === "string" ? row.published_at.slice(0, 10) : undefined);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
}

const pages = [
  ...pageGroups.flatMap(group => localizedPages(group.paths, group.metadata)),
  ...listingPages,
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${pages.map(page => {
  const slug = /\/(?:propriete|property)\/(.+)$/.exec(page.path)?.[1];
  return sitemapEntry(page, slug ? listingLastmod.get(slug) : undefined);
}).join("\n")}\n</urlset>\n`;
await writeFile(resolve(publicDir, "sitemap.xml"), xml, "utf8");
await writeFile(resolve(frontendDir, ".seo-pages.generated.json"), JSON.stringify({ origin, pages }), "utf8");
console.log(`Wrote sitemap.xml with ${pages.length} public URLs.`);
