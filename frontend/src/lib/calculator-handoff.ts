export function validCalculatorAmount(value:string){
  if(!/^\d{1,10}$/.test(value))return '';
  const amount=Number(value);
  return amount>0&&amount<=1_000_000_000?String(amount):'';
}
export function calculatorHref(kind:'seller'|'buyer',value:string){
  const route=kind==='seller'?'#vendre':'#acheter';
  const amount=validCalculatorAmount(value);
  return amount?`${route}?${kind==='seller'?'expectedPrice':'budgetMax'}=${amount}`:route;
}
export function readCalculatorAmount(hash:string,kind:'seller'|'buyer'){
  return validCalculatorAmount(new URLSearchParams(hash.split('?')[1]||'').get(kind==='seller'?'expectedPrice':'budgetMax')||'');
}
