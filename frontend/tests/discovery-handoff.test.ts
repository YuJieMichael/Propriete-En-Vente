// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {queueSearchIntent,takeSearchIntent,queuePropertyQuestions,takePropertyQuestions} from '../src/lib/discovery-handoff';
beforeEach(()=>{sessionStorage.clear();vi.restoreAllMocks();});
describe('discovery handoffs',()=>{
  it('keeps a sentence in the tab, consumes it once, and does not change the URL',()=>{
    const url=location.href;
    expect(queueSearchIntent('  Montréal, deux chambres sous 700k  ')).toBe(true);
    expect(takeSearchIntent()).toBe('Montréal, deux chambres sous 700k');
    expect(takeSearchIntent()).toBe('');expect(location.href).toBe(url);
  });
  it('expires a pending sentence instead of reviving an old search',()=>{
    const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now);
    queueSearchIntent('Montréal');vi.mocked(Date.now).mockReturnValue(now+16*60*1000);
    expect(takeSearchIntent()).toBe('');
  });
  it('does not copy questions into a different listing or language',()=>{
    queuePropertyQuestions('100001','fr',['Quel est le montant des frais?']);
    expect(takePropertyQuestions('100002','fr')).toBe('');
    queuePropertyQuestions('100001','fr',['Quel est le montant des frais?']);
    expect(takePropertyQuestions('100001','zh')).toBe('');
    queuePropertyQuestions('100001','fr',['Quel est le montant des frais?']);
    expect(takePropertyQuestions('100001','fr')).toBe('Quel est le montant des frais?');
    expect(takePropertyQuestions('100001','fr')).toBe('');
  });
  it('handles disabled browser storage without navigating or throwing',()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('disabled');});
    expect(queueSearchIntent('Montréal')).toBe(false);
    expect(queuePropertyQuestions('100001','zh',['物业费是多少？'])).toBe(true);
    expect(takePropertyQuestions('100001','zh')).toBe('物业费是多少？');
    expect(takePropertyQuestions('100001','zh')).toBe('');
  });
});
