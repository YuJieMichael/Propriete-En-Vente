import { createClient } from 'npm:@supabase/supabase-js@2.117.0';
import { createListingNoticeHandler } from '../_shared/listing-notice-handler.ts';

Deno.serve(createListingNoticeHandler({
  env: name => Deno.env.get(name),
  createClient,
  fetch,
}));
