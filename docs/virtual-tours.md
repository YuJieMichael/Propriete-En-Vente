# Optional virtual tours / Visites virtuelles facultatives

Imported properties may include `property.virtualTourUrl`. This is optional: the
28 published listings checked on 2026-10-28 had no tour URL. No tour or room model
has been invented or attached to them.

Supported source URLs:

- `https://my.matterport.com/show/?m=<11-character model ID>`
- `https://kuula.co/share/<post ID>`
- `https://kuula.co/share/collection/<tour ID>`

Verify the link on the property's Centris/broker source and verify that the tour
shows that property before adding it through the reviewed import/update process.
Keep the public record and corresponding submission synchronized. A Centris
listing URL, video, or ordinary photo is not a virtual tour. Keep source evidence
with the data update; this UI change does not update production records.

The UI normalizes provider URLs and removes tracking/autoplay parameters. It
does not create an iframe until the visitor selects **Start the tour**. A direct
provider link remains available if the tour cannot be embedded. Closing the
tour removes the iframe. Invalid or missing URLs produce no tour entry and do
not break the listing. A provider's valid URL format does not prove that its
underlying tour is still published; check availability during source updates.

Les annonces importées peuvent inclure `property.virtualTourUrl`. Vérifiez la
visite sur la source Centris ou le site du courtier et son association à la
propriété avant de l’ajouter. Sans lien valide, aucune entrée de visite n’est
affichée. Le service externe ne se charge qu’après un clic du visiteur.
