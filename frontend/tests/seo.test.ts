// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { applySeo, homeMetadata, listingPath, listingSlug, localizedPublicPath, publicRoute } from "../src/seo";

beforeEach(() => {
  document.head.innerHTML = "";
  history.replaceState({}, "", "/");
});

it("maps each language and catalogue to a separate crawlable path", () => {
  expect(publicRoute("/fr").kind).toBe("home");
  expect(publicRoute("/en").lang).toBe("en");
  expect(publicRoute("/zh").lang).toBe("zh");
  expect(publicRoute("/fr/proprietes").kind).toBe("catalogue");
  expect(publicRoute("/en/properties").kind).toBe("catalogue");
  expect(publicRoute("/zh/properties").kind).toBe("catalogue");
});

it("creates stable localized listing URLs and resolves direct visits", () => {
  const item = { district: "Ville-Marie, Montréal", city: "Montréal", id: "7d695ff4-bd03-580b-8d84-f0897a16e779" };
  const slug = listingSlug(item);
  expect(slug).toBe("ville-marie-montreal-montreal-7d695ff4-bd03-580b-8d84-f0897a16e779");
  expect(publicRoute(listingPath("fr", item))).toMatchObject({ kind: "listing", slug, lang: "fr" });
  expect(localizedPublicPath("en", publicRoute(listingPath("fr", item)))).toBe(`/en/property/${slug}/`);
});

it("sets a unique title, description, canonical, language alternates and preview noindex", () => {
  const route = publicRoute("/en");
  applySeo(homeMetadata("en"), route);
  expect(document.title).toContain("Québec Real Estate Broker");
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toContain("Buy or sell");
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://proprieteenvente.ca/en/");
  expect(document.querySelector('link[hreflang="fr-CA"]')?.getAttribute("href")).toBe("https://proprieteenvente.ca/fr/");
  expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex,follow");
});

it("does not silently decode malformed listing routes", () => {
  expect(publicRoute("/fr/propriete/%E0%A4%A").kind).toBe("unknown");
});
