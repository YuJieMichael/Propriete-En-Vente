import type { Language } from "./seller-copy";
import type { Listing } from "./listings-data";
import seoContent from "./seo-content.json";

export const siteOrigin = (import.meta.env.VITE_SITE_URL || "https://proprieteenvente.ca").replace(/\/$/, "");

export type PublicRoute = {
  lang: Language;
  kind: "home" | "catalogue" | "listing" | "unknown";
  slug?: string;
  canonicalPath: string;
};

const catalogueSegments: Record<Language, string> = {
  fr: "proprietes",
  en: "properties",
  zh: "properties",
};
const listingSegments: Record<Language, string> = {
  fr: "propriete",
  en: "property",
  zh: "property",
};

export function languageFromPath(pathname: string): Language {
  const match = /^\/(fr|en|zh)(?:\/|$)/.exec(pathname);
  return (match?.[1] as Language | undefined) ?? "fr";
}

export function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function listingSlug(item: Pick<Listing, "district" | "city" | "id">): string {
  return `${slugify(`${item.district}-${item.city}`)}-${item.id.toLowerCase()}`;
}

export function listingPath(lang: Language, item: Pick<Listing, "district" | "city" | "id">): string {
  return `/${lang}/${listingSegments[lang]}/${listingSlug(item)}/`;
}

export function cataloguePath(lang: Language): string {
  return `/${lang}/${catalogueSegments[lang]}/`;
}

export function publicRoute(pathname: string): PublicRoute {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/") return { lang: "fr", kind: "home", canonicalPath: "/fr/" };
  const langMatch = /^\/(fr|en|zh)(?:\/(.*))?$/.exec(path);
  if (!langMatch) return { lang: "fr", kind: "unknown", canonicalPath: "/fr" };
  const lang = langMatch[1] as Language;
  const segment = langMatch[2] ?? "";
  if (!segment) return { lang, kind: "home", canonicalPath: `/${lang}/` };
  if (segment === catalogueSegments[lang]) return { lang, kind: "catalogue", canonicalPath: `/${lang}/${segment}/` };
  const listingPrefix = `${listingSegments[lang]}/`;
  if (segment.startsWith(listingPrefix)) {
    try {
      const slug = decodeURIComponent(segment.slice(listingPrefix.length));
      if (slug && !slug.includes("/")) return { lang, kind: "listing", slug, canonicalPath: `/${lang}/${segment}/` };
    } catch { /* Invalid percent-encoding is an unknown route. */ }
  }
  return { lang, kind: "unknown", canonicalPath: `/${lang}/` };
}

export function localizedPublicPath(lang: Language, route: PublicRoute): string {
  if (route.kind === "catalogue") return cataloguePath(lang);
  if (route.kind === "listing" && route.slug) return `/${lang}/${listingSegments[lang]}/${route.slug}/`;
  return `/${lang}/`;
}

export type SeoMetadata = { title: string; description: string; kind?: "website" | "product" };

export function homeMetadata(lang: Language): SeoMetadata {
  return seoContent.home[lang];
}

export function catalogueMetadata(lang: Language): SeoMetadata {
  return seoContent.catalogue[lang];
}

export function listingMetadata(item: Listing, lang: Language): SeoMetadata {
  const type = seoContent.listingTypes[lang][item.type];
  const price = new Intl.NumberFormat(lang === "zh" ? "zh-CN" : `${lang}-CA`, {
    style: "currency", currency: "CAD", maximumFractionDigits: 0,
  }).format(item.price);
  return {
    title: lang === "fr"
      ? `${type} à vendre à ${item.city} | ${item.district} | ${price}`
      : lang === "en"
        ? `${type} for sale in ${item.city}, Québec | ${item.district} | ${price}`
        : `${item.city}待售${type} | ${item.district} | ${price}`,
    description: (lang === "fr" && item.description) || (lang === "fr"
      ? `${type} à vendre à ${item.city}, Québec : ${item.district}. Prix demandé : ${price}. Consultez les photos et caractéristiques.`
      : lang === "en"
        ? `${type} for sale in ${item.city}, Québec: ${item.district}. Listed at ${price}. View photos and property features.`
        : `魁北克${item.city}待售${type}：${item.district}，挂牌价${price}。查看房源照片和配置。`).replace(/\s+/g, " ").trim().slice(0, 190),
    kind: "product",
  };
}

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`;
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    if (hreflang) element.hreflang = hreflang;
    document.head.append(element);
  }
  element.href = href;
}

export function applySeo(metadata: SeoMetadata, route: PublicRoute, noindex = false) {
  const canonical = `${siteOrigin}${route.canonicalPath}`;
  const preview = location.hostname !== "proprieteenvente.ca";
  document.title = metadata.title;
  document.documentElement.lang = route.lang === "zh" ? "zh-Hans" : route.lang;
  upsertMeta("name", "description", metadata.description);
  upsertMeta("property", "og:title", metadata.title);
  upsertMeta("property", "og:description", metadata.description);
  upsertMeta("property", "og:type", metadata.kind ?? "website");
  upsertMeta("property", "og:url", canonical);
  if (noindex || preview) upsertMeta("name", "robots", "noindex,follow");
  else document.head.querySelector('meta[name="robots"]')?.remove();
  upsertLink("canonical", canonical);
  for (const lang of ["fr", "en", "zh"] as const) {
    const localized = localizedPublicPath(lang, route);
    const hreflang = lang === "zh" ? "zh-Hans-CA" : `${lang}-CA`;
    upsertLink("alternate", `${siteOrigin}${localized}`, hreflang);
  }
  upsertLink("alternate", `${siteOrigin}${localizedPublicPath("fr", route)}`, "x-default");
}
