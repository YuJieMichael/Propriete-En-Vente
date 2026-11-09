-- Run once after applying 20261109153000_free_first_month_listings.sql and
-- deploying the send-listing-notices function. Reuses the enquiry_cron_token
-- Vault secret and the existing RESEND_API_KEY / ENQUIRY_EMAIL_FROM settings.
-- Hourly: unpublish free listings whose 30 days have ended (no payment is taken).
select cron.schedule('propriete-free-listing-expiry', '7 * * * *', $$ select private.expire_free_listings(); $$);
-- Hourly: send 7-day reminders and one expiry notice per listing.
select cron.schedule('propriete-free-listing-notices', '17 * * * *', $$
  select net.http_post(
    url := 'https://usngcexxobcpjncuwaxo.supabase.co/functions/v1/send-listing-notices',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='enquiry_cron_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
