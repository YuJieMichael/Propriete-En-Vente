-- Run only after deploying the worker and adding enquiry_cron_token in Vault.
-- Enable pg_cron and pg_net in the Dashboard first. No secret is committed here.
select cron.schedule('propriete-enquiry-batches', '* * * * *', $$
  select net.http_post(
    url := 'https://usngcexxobcpjncuwaxo.supabase.co/functions/v1/send-enquiry-batches',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='enquiry_cron_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
