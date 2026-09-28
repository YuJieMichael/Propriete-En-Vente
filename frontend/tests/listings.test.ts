import { describe, expect, it } from "vitest";
import { defaultFilters, filterQuery, invalidPriceRange, listings, readFilters, selectListings } from "../src/listings-data";

describe("property discovery", () => {
  it("combines location, category, inclusive budget, bedrooms and owner filters", () => {
    const found = selectListings(listings, { ...defaultFilters, q: "montreal", type: "condo", min: "549000", max: "619000", beds: "2", mode: "owner" });
    expect(found.map(item => item.id)).toEqual(["demo-01"]);
    expect(selectListings(listings, { ...defaultFilters, q: "蒙特利尔" })).toHaveLength(6);
    expect(selectListings(listings, { ...defaultFilters, q: "H2J 1A1" }).map(item => item.id)).toEqual(["demo-01"]);
  });
  it("applies extra filters and excludes commercial properties from bedroom searches", () => {
    expect(selectListings(listings, { ...defaultFilters, type: "commercial", beds: "1" })).toEqual([]);
    expect(selectListings(listings, { ...defaultFilters, q: "laval", baths: "2", parking: true, outdoor: true }).map(item => item.id)).toEqual(["demo-02"]);
  });
  it("sorts without mutating the catalogue", () => {
    const ids = listings.map(item => item.id);
    expect(selectListings(listings, { ...defaultFilters, sort: "price-asc" })[0].id).toBe("demo-11");
    expect(selectListings(listings, { ...defaultFilters, sort: "price-desc" })[0].id).toBe("demo-12");
    expect(selectListings(listings, { ...defaultFilters, sort: "area-desc" })[0].id).toBe("demo-12");
    expect(listings.map(item => item.id)).toEqual(ids);
  });
  it("shows no results for unmatched queries or reversed price ranges", () => {
    expect(selectListings(listings, { ...defaultFilters, q: "unmatched-place" })).toEqual([]);
    const filters = { ...defaultFilters, min: "800000", max: "500000" };
    expect(invalidPriceRange(filters)).toBe(true);
    expect(selectListings(listings, filters)).toEqual([]);
  });
  it("preserves filters in list and detail links and ignores invalid URL values", () => {
    const filters = { ...defaultFilters, q: "蒙特利尔", max: "800000", type: "condo" as const, outdoor: true, sort: "price-asc" as const };
    expect(readFilters(`#acheter${filterQuery(filters)}`)).toEqual(filters);
    expect(readFilters(`#propriete/demo-01${filterQuery(filters)}`)).toEqual(filters);
    expect(readFilters("#acheter?min=-100&max=Infinity&type=secret&sort=invalid&mode=admin")).toEqual(defaultFilters);
  });
});
