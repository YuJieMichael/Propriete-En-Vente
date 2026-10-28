import {acquisitionCampaigns,acquisitionMedia,acquisitionSources,type AcquisitionCampaign,type AcquisitionMedium,type AcquisitionSource} from './acquisition-source';

export type CampaignLinkOptions={lang:'en'|'fr'|'zh';source:Exclude<AcquisitionSource,'direct'|'unknown'>;medium:AcquisitionMedium;campaign:AcquisitionCampaign};
/** A finite campaign-link builder: no arbitrary destination, query text or contact data. */
export function buildCampaignLink(options:CampaignLinkOptions):string|null {
  if(!options||!['en','fr','zh'].includes(options.lang)||!acquisitionSources.includes(options.source)||['direct','unknown'].includes(options.source)||!acquisitionMedia.includes(options.medium)||!acquisitionCampaigns.includes(options.campaign))return null;
  const url=new URL(`https://proprieteenvente.ca/${options.lang}/proprietes/hotels-motels/`);
  url.searchParams.set('utm_source',options.source);
  url.searchParams.set('utm_medium',options.medium);
  url.searchParams.set('utm_campaign',options.campaign);
  return url.href;
}
