# Centris catalogue reconciliation — 27 October 2026

Source: Tian Shu Lu, RE/MAX PLATINE, Centris broker `e6356`. All three
pages of the broker catalogue were checked: 28 active sale/rental listings.

- Add 11078212, 14236984, 25586801 and 26059437.
- Replace source 9964476 with 11809271, preserving the existing website ID
  and public reference for 3893 Rue Mance. Rent changes to CAD 1,950/month.
- Withdraw 20951381, 24200846, 27831614 and 28733627 from the public catalogue.
  Each original URL redirects with `listingnotfound`; retain submissions,
  historical details and photos. Do not label these properties sold or rented.
- Verify the other 23 source IDs and retain their current prices and details.

The JSON manifest records the exact active IDs and translated new records.
148 WebP photos accompany the five new source IDs. Unknown measurements and
amenities remain null; the Chambly house has two bathrooms plus a powder room.

Release assets first, then apply the audited database transaction, then rebuild
the static SEO pages from the updated public catalogue. Verify source-ID set
equality, the preserved Mance reference, photo availability and multilingual
pages. This is a one-time reconciliation, not a recurring synchronization job.

Validation: 239 frontend tests, transactional SQL dry-run with rollback, and
production build with 102 public pages. A snapshot of public records is retained
in the task outputs before applying changes.

## Français

Synchronisation ponctuelle des 28 annonces actives de Tian Shu Lu : quatre
nouvelles propriétés, une nouvelle référence Centris pour la rue Mance avec
un loyer de 1 950 $/mois, et retrait de quatre annonces indisponibles. Les
archives sont conservées. Les descriptions sont disponibles en français,
anglais et chinois; 148 photos accompagnent les nouvelles références.
