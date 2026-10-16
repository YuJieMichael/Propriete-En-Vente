import { enquiriesCsv, RECIPIENT } from './enquiry.ts';

type Runtime = {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options: any) => any;
  fetch: typeof fetch;
};

export function createEnquiryNotificationHandler(runtime: Runtime) {
  return async (request: Request): Promise<Response> => {
    const token=runtime.env('ENQUIRY_CRON_TOKEN');
    if(!token || request.headers.get('authorization') !== `Bearer ${token}`) return Response.json({error:'unauthorized'},{status:401});
    if(request.method!=='POST') return Response.json({error:'method'},{status:405});
    const key=runtime.env('RESEND_API_KEY'), from=runtime.env('ENQUIRY_EMAIL_FROM');
    if(!key || !from) return Response.json({error:'email_not_configured'},{status:503});
    try {
      const db=runtime.createClient(runtime.env('SUPABASE_URL')!,runtime.env('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
      const {data:batch,error}=await db.rpc('claim_enquiry_batch');
      if(error) throw error;
      if(!batch) return Response.json({ok:true,batches:0});
      if(!Array.isArray(batch.rows) || batch.rows.length!==1) throw Error('batch_size');
      const content=btoa(Array.from(new TextEncoder().encode(enquiriesCsv(batch.rows)),b=>String.fromCharCode(b)).join(''));
      const response=await runtime.fetch('https://api.resend.com/emails',{
        method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`enquiry-batch/${batch.id}`},
        body:JSON.stringify({from,to:[RECIPIENT],subject:`Propriété En Vente — Nouvelle demande / New enquiry — ${batch.id}`,
          text:`A new buyer/seller enquiry is attached as a CSV spreadsheet.\nUne nouvelle demande d’achat/vente est jointe au format CSV.\n附件是 1 条新的买卖需求，可用 Excel 打开。\nReference: ${batch.id}`,
          attachments:[{filename:`Propriété En Vente-${batch.id}.csv`,content}]}),signal:AbortSignal.timeout(15000),
      });
      if(!response.ok) throw Error('provider_error');
      const result=await response.json();
      if(typeof result.id!=='string' || !result.id) throw Error('provider_response');
      const completed=await db.rpc('complete_enquiry_batch',{p_id:batch.id,p_provider_id:result.id});
      if(completed.error) throw completed.error;
      return Response.json({ok:true,batches:1});
    } catch { return Response.json({error:'batch_pending_retry'},{status:503}); }
  };
}
