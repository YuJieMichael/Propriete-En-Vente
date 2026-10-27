# Location review — 27 October 2026

The public map audit verified all 24 visible maps and four withheld addresses. Three listings need the targeted changes in `data/location-review-20261027.json`:

- 100006: replace the Centris pin with Google Maps' exact 2300 Rue Wilfrid-Reid address point (45.5177577, -73.7121432). NRCan's OSM address result (45.5178119, -73.7121481) independently supports this location. This verifies the building address, not a particular door or apartment entrance.
- 100012: keep the source pin but identify it as approximate. The sale concerns a portion of 1920, 12e Avenue Nord awaiting cadastral subdivision; do not move the pin to the hotel address or claim a verified parcel boundary. Both map navigation links use the source coordinates.
- 100013: withhold the unverified `11111, Rue des Mulets` address and precise map pending broker confirmation. This does not assert that the source address is fictitious. The source address and coordinates remain in the review record.

The frontend accepts a coordinate provider independently of the listing provider and displays localized location-status notices. The generic publication field allowlist already preserves `source` and `coordinates`; no schema change is required.

Release order: deploy frontend support first, then apply the guarded data transaction to both `listing_submissions` and `published_listings`, then rebuild static pages so the unverified street number disappears from titles, cards and share metadata. Test the transaction with rollback first. Abort if any current property differs from its recorded before value. Keep listing IDs, numbers, prices, photos and publication times unchanged.

Broker confirmation of the subdivision boundary and Mulets address remains outstanding. No broker message was sent.

## Français

Correction du repère de l’adresse Wilfrid-Reid, avertissement de localisation indicative pour le terrain à subdiviser, et masquage de l’adresse et du repère non vérifiés de la rue des Mulets. Les coordonnées d’origine restent conservées. Les limites cadastrales et l’adresse des Mulets doivent encore être confirmées auprès du courtier.
