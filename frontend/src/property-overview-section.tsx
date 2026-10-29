import {useEffect, useState} from 'react';
import type {Language} from './seller-copy';
import type {Listing} from './listings-data';
import {loadNearby, type NearbyFile} from './lib/nearby';
import {overviewTitle, propertyOverview} from './property-overview';

/** The fact-based overview; the static page already has it, so this keeps the hydrated page the same. */
export function PropertyOverview({item, lang}: {item: Listing; lang: Language}) {
  const [nearby, setNearby] = useState<NearbyFile | null>(null);
  useEffect(() => {
    let active = true;
    setNearby(null);
    if (item.reference) loadNearby(item.reference).then(value => { if (active) setNearby(value); }, () => {});
    return () => { active = false; };
  }, [item.reference]);
  const paragraphs = propertyOverview(lang, item, nearby);
  if (!paragraphs.length) return null;
  return <section className="detail-section listing-overview"><h2>{overviewTitle[lang]}</h2>{paragraphs.map(text => <p key={text} className="publication-description">{text}</p>)}</section>;
}
