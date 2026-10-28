// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';

beforeEach(()=>{
  vi.restoreAllMocks();vi.resetModules();sessionStorage.clear();
  window.history.replaceState(null,'','/fr/');
  vi.spyOn(document,'referrer','get').mockReturnValue('');
});
async function subject(){return import('../src/lib/acquisition-source');}

describe('bounded client acquisition context',()=>{
  it('prefers a finite UTM source and permits only finite medium/campaign slugs',async()=>{
    window.history.replaceState(null,'','/fr/?utm_source=fb&utm_medium=social&utm_campaign=hotel-20261028');
    vi.spyOn(document,'referrer','get').mockReturnValue('https://www.google.ca/search?q=private-query');
    const api=await subject();
    expect(api.captureAcquisitionSource()).toEqual({source:'facebook',medium:'social',campaign:'hotel-20261028'});
    expect(api.readSourceForEvent()).toEqual({source:'facebook',medium:'social',campaign:'hotel-20261028'});
  });
  it('discards arbitrary contact/search text and never stores a URL or identifier',async()=>{
    window.history.replaceState(null,'','/fr/?utm_source=wechat&utm_medium=person%40example.com&utm_campaign=looking-for-two-bedrooms&email=private%40example.com&q=secret');
    vi.spyOn(document,'referrer','get').mockReturnValue('https://facebook.com/private/path?email=private@example.com');
    const api=await subject();
    expect(api.captureAcquisitionSource()).toEqual({source:'wechat',medium:null,campaign:null});
    const stored=sessionStorage.getItem('propriete-en-vente:acquisition:v1')!;
    expect(Object.keys(JSON.parse(stored)).sort()).toEqual(['campaign','createdAt','medium','source']);
    expect(stored).not.toMatch(/example|secret|two-bedrooms|https|private/);
    expect(Object.keys(api.readSourceForEvent()).sort()).toEqual(['campaign','medium','source']);
  });
  it.each([
    ['https://www.google.ca/search?q=private','google'],
    ['https://l.facebook.com/l.php?u=https://private.example/','facebook'],
    ['https://mp.weixin.qq.com/s/private','wechat'],
    ['https://exampleevilgoogle.com/search','other'],
    ['https://google.com.evil.example/search','other'],
    ['https://facebook.com.evil.example/','other'],
    ['https://google.com@evil.example/search','other'],
  ])('classifies only exact or genuine subdomain hosts: %s',async(referrer,source)=>{
    vi.spyOn(document,'referrer','get').mockReturnValue(referrer);
    expect((await subject()).captureAcquisitionSource().source).toBe(source);
  });
  it('rejects invalid/duplicate sources and ignores their unrelated medium and campaign',async()=>{
    window.history.replaceState(null,'','/fr/?utm_source=google&utm_source=facebook&utm_medium=email&utm_campaign=hotel-20261028');
    vi.spyOn(document,'referrer','get').mockReturnValue('https://www.bing.com/search?q=private');
    expect((await subject()).captureAcquisitionSource()).toEqual({source:'bing',medium:'organic',campaign:null});
  });
  it.each(['constructor','__proto__','toString','person@example.com'])('does not accept inherited object keys or free text as source: %s',async(value)=>{
    window.history.replaceState(null,'',`/fr/?utm_source=${encodeURIComponent(value)}`);
    expect((await subject()).captureAcquisitionSource()).toEqual({source:'direct',medium:null,campaign:null});
  });
  it('keeps attribution through internal navigation without extending its fixed thirty-minute lifetime',async()=>{
    const start=Date.now();vi.spyOn(Date,'now').mockReturnValue(start);
    window.history.replaceState(null,'','/fr/?utm_source=wx&utm_medium=qr&utm_campaign=hotel-20261028');
    const api=await subject();api.captureAcquisitionSource();
    window.history.replaceState(null,'','/fr/proprietes/100001/');
    vi.spyOn(document,'referrer','get').mockReturnValue('https://www.proprieteenvente.ca/fr/?q=private');
    vi.mocked(Date.now).mockReturnValue(start+20*60*1000);
    expect(api.captureAcquisitionSource().source).toBe('wechat');
    expect(api.readSourceForEvent().source).toBe('wechat');
    vi.mocked(Date.now).mockReturnValue(start+30*60*1000);
    expect(api.readSourceForEvent()).toEqual({source:'unknown',medium:null,campaign:null});
    expect(sessionStorage.getItem('propriete-en-vente:acquisition:v1')).toBeNull();
  });
  it('accepts a new legitimate tagged entry while an existing attribution is still active',async()=>{
    const api=await subject();window.history.replaceState(null,'','/fr/?utm_source=facebook');api.captureAcquisitionSource();
    window.history.replaceState(null,'','/fr/?utm_source=linkedin&utm_medium=social&utm_campaign=hotel-20261028');
    expect(api.captureAcquisitionSource()).toEqual({source:'linkedin',medium:'social',campaign:'hotel-20261028'});
  });
  it('safely falls back in memory when storage is unavailable and expires that fallback too',async()=>{
    const start=Date.now();vi.spyOn(Date,'now').mockReturnValue(start);
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked');});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
    window.history.replaceState(null,'','/fr/?utm_source=xhs');
    const api=await subject();
    expect(api.captureAcquisitionSource().source).toBe('xiaohongshu');
    expect(api.readSourceForEvent().source).toBe('xiaohongshu');
    vi.mocked(Date.now).mockReturnValue(start+30*60*1000);
    expect(api.readSourceForEvent().source).toBe('unknown');
  });
  it('does not reuse attribution after a new page session when storage could not be written',async()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
    window.history.replaceState(null,'','/fr/?utm_source=facebook');
    const api=await subject();api.captureAcquisitionSource();expect(api.readSourceForEvent().source).toBe('facebook');
    vi.resetModules();
    expect((await subject()).readSourceForEvent().source).toBe('unknown');
  });
  it('uses the newest safe fallback if a failed write leaves an older stored source behind',async()=>{
    const api=await subject();
    window.history.replaceState(null,'','/fr/?utm_source=facebook');api.captureAcquisitionSource();
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});
    window.history.replaceState(null,'','/fr/?utm_source=linkedin');api.captureAcquisitionSource();
    expect(api.readSourceForEvent().source).toBe('linkedin');
    expect(JSON.parse(sessionStorage.getItem('propriete-en-vente:acquisition:v1')!).source).toBe('facebook');
  });
  it('rejects corrupt, expired, future-dated or non-finite stored metadata',async()=>{
    const api=await subject();const key='propriete-en-vente:acquisition:v1';
    for(const raw of ['not json',JSON.stringify({source:'person@example.com',medium:null,campaign:null,createdAt:Date.now()}),JSON.stringify({source:'facebook',medium:null,campaign:null,createdAt:Date.now()+60000}),'x'.repeat(600)]) {
      sessionStorage.setItem(key,raw);
      expect(api.readSourceForEvent()).toEqual({source:'unknown',medium:null,campaign:null});
    }
  });
  it('sanitizes the result even if storage is manually extended with unrelated properties',async()=>{
    sessionStorage.setItem('propriete-en-vente:acquisition:v1',JSON.stringify({source:'google',medium:'organic',campaign:null,createdAt:Date.now(),email:'private@example.com',url:'https://private.example/'}));
    expect((await subject()).readSourceForEvent()).toEqual({source:'google',medium:'organic',campaign:null});
  });
});
