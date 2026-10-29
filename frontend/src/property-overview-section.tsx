import type {Language} from './seller-copy';
import type {Listing} from './listings-data';
import {overviewTitle, propertyOverview} from './property-overview';
import {WelcomeTaxCard} from './welcome-tax';
import {NearbyPlaces} from './nearby-places';

/** The fact-based overview (the static page has the same text), with the welcome tax and nearby places in boxes opened on request. */
export function PropertyOverview({item, lang}: {item: Listing; lang: Language}) {
  const paragraphs = propertyOverview(lang, item);
  const located = !!item.reference && !!item.coordinates && item.source?.locationStatus !== 'unverified';
  return <section className="detail-section listing-overview"><h2>{overviewTitle[lang]}</h2>
    {paragraphs.map(text => <p key={text} className="publication-description">{text}</p>)}
    <div className="overview-boxes">
      <WelcomeTaxCard item={item} lang={lang}/>
      {located && <NearbyPlaces reference={item.reference!} approximate={item.source?.locationStatus === 'approximate'} lang={lang}/>}
    </div>
  </section>;
}
