import type {Language} from './seller-copy';
import type {Listing} from './listings-data';
import {overviewTitle, propertyOverview} from './property-overview';

/** The fact-based overview; the static page has the same text. */
export function PropertyOverview({item, lang}: {item: Listing; lang: Language}) {
  const paragraphs = propertyOverview(lang, item);
  if (!paragraphs.length) return null;
  return <section className="detail-section listing-overview"><h2>{overviewTitle[lang]}</h2>{paragraphs.map(text => <p key={text} className="publication-description">{text}</p>)}</section>;
}
