import { describe, expect, it } from "vitest";
import { defaultFilters, filterQuery, invalidPriceRange, listingSearchPrice, listings, readFilters, selectListings, type Listing } from "../src/listings-data";

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
  const dual:Listing={...listings[0],id:'dual',transaction:'sale-rent',price:900000,rentPrice:2500};
  const rentOnly:Listing={...listings[0],id:'rent-only',transaction:'rent',price:2200};
  const saleOnly:Listing={...listings[0],id:'sale-only',transaction:'sale',price:600000};
  const unknownRent:Listing={...dual,id:'unknown-rent',rentPrice:null};
  it('uses monthly rent for dual-transaction listings while preserving unfiltered sale prices',()=>{
    expect(listingSearchPrice(dual,'rent')).toBe(2500);
    expect(listingSearchPrice(dual,'sale')).toBe(900000);
    expect(listingSearchPrice(dual)).toBe(900000);
    expect(listingSearchPrice(rentOnly,'rent')).toBe(2200);
    expect(listingSearchPrice(saleOnly,'rent')).toBeNull();
    const found=selectListings([dual,rentOnly,saleOnly],{...defaultFilters,transaction:'rent',min:'2000',max:'3000'});
    expect(found.map(item=>item.id)).toEqual(['dual','rent-only']);
    expect(selectListings([dual,rentOnly,saleOnly],{...defaultFilters,transaction:'sale',max:'700000'}).map(item=>item.id)).toEqual(['sale-only']);
  });
  it('never treats an absent or invalid rent as the sale price, and only excludes it when budget is bounded',()=>{
    for(const rentPrice of [null,undefined,0,-10,NaN,Infinity])expect(listingSearchPrice({...dual,rentPrice},'rent')).toBeNull();
    expect(selectListings([unknownRent],{...defaultFilters,transaction:'rent'})).toEqual([unknownRent]);
    expect(selectListings([unknownRent],{...defaultFilters,transaction:'rent',max:'1000000'})).toEqual([]);
    expect(selectListings([unknownRent],{...defaultFilters,transaction:'rent',min:'1'})).toEqual([]);
  });
  it('sorts by the selected transaction price, keeps unknown rents last in either direction, and does not mutate input',()=>{
    const items=[unknownRent,dual,rentOnly,saleOnly];
    const original=items.map(item=>item.id);
    expect(selectListings(items,{...defaultFilters,transaction:'rent',sort:'price-asc'}).map(item=>item.id)).toEqual(['rent-only','dual','unknown-rent']);
    expect(selectListings(items,{...defaultFilters,transaction:'rent',sort:'price-desc'}).map(item=>item.id)).toEqual(['dual','rent-only','unknown-rent']);
    expect(selectListings(items,{...defaultFilters,sort:'price-asc'}).map(item=>item.id)).toEqual(['rent-only','sale-only','dual','unknown-rent']);
    expect(items.map(item=>item.id)).toEqual(original);
  });
});
