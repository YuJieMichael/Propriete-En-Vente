const searchKey='propriete-en-vente:search-intent:v1';
const questionsKey='propriete-en-vente:property-questions:v1';
const lifetime=15*60*1000;
let questionMemory:Record<string,unknown>|null=null;
type TimedValue={created:number};
function write(key:string,value:object){
  try{sessionStorage.setItem(key,JSON.stringify({...value,created:Date.now()}));return true;}catch{return false;}
}
function take(key:string):Record<string,unknown>|null{
  try{
    const raw=sessionStorage.getItem(key);sessionStorage.removeItem(key);
    if(!raw)return null;
    const value=JSON.parse(raw) as TimedValue;
    if(!value||typeof value.created!=='number'||!Number.isFinite(value.created)||Date.now()-value.created>lifetime||value.created>Date.now()+1000)return null;
    return value;
  }catch{return null;}
}
// Sentences and questions stay in this tab rather than being placed in URLs.
export function queueSearchIntent(input:string){return write(searchKey,{input:input.trim().slice(0,300)});}
export function takeSearchIntent(){const value=take(searchKey);return typeof value?.input==='string'?value.input.slice(0,300):'';}
export function queuePropertyQuestions(reference:string,lang:string,questions:readonly string[]){
  const value={reference,lang,questions:questions.filter(q=>typeof q==='string'&&q.trim()).slice(0,12).map(q=>q.trim().slice(0,250))};
  // This handoff uses a hash navigation within the same app. Keep a memory
  // fallback when browser storage is disabled or full.
  questionMemory={...value,created:Date.now()};
  write(questionsKey,value);
  return true;
}
export function takePropertyQuestions(reference:string,lang:string){
  const cached=questionMemory;questionMemory=null;
  const recent=cached&&typeof cached.created==='number'&&Date.now()-cached.created<=lifetime&&cached.created<=Date.now()+1000;
  const value=take(questionsKey)||(recent?cached:null);
  if(!reference||value?.reference!==reference||value?.lang!==lang||!Array.isArray(value?.questions))return '';
  return value.questions.filter((q):q is string=>typeof q==='string').slice(0,12).map(q=>q.slice(0,250)).join('\n').slice(0,3000);
}
