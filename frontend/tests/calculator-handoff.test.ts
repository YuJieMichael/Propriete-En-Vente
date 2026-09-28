import {it,expect} from 'vitest';
import {calculatorHref,readCalculatorAmount} from '../src/lib/calculator-handoff';
it.each(['seller','buyer'] as const)('carries the %s amount to the matching enquiry field',kind=>{
 const href=calculatorHref(kind,'825000');
 expect(readCalculatorAmount(href,kind)).toBe('825000');
 expect(readCalculatorAmount(href,kind==='seller'?'buyer':'seller')).toBe('');
});
it.each(['','0','-500','NaN','1e6','1000000001','123abc'])('ignores an invalid amount %s',value=>{
 expect(calculatorHref('buyer',value)).toBe('#acheter');
});
