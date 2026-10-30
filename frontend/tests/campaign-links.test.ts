import {expect,it} from 'vitest';
import {buildCampaignLink,type CampaignLinkOptions} from '../src/lib/campaign-links';

it('generates only official hotel category links with finite tracking values',()=>{
  expect(buildCampaignLink({lang:'fr',source:'facebook',medium:'social',campaign:'hotel-20261028'})).toBe('https://proprieteenvente.ca/fr/proprietes/hotels-motels/?utm_source=facebook&utm_medium=social&utm_campaign=hotel-20261028');
  expect(new URL(buildCampaignLink({lang:'zh',source:'wechat',medium:'qr',campaign:'hotel-20261028'})!).pathname).toBe('/zh/proprietes/hotels-motels/');
});
it('rejects free-form slugs or non-channel values at runtime',()=>{
  const valid:CampaignLinkOptions={lang:'fr',source:'facebook',medium:'social',campaign:'hotel-20261028'};
  for(const patch of [{lang:'other'},{source:'person@example.com'},{source:'direct'},{medium:'private search'},{campaign:'person@example.com'}])expect(buildCampaignLink({...valid,...patch} as CampaignLinkOptions)).toBeNull();
});
