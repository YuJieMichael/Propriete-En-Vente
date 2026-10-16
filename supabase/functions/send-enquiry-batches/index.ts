import { createClient } from 'npm:@supabase/supabase-js@2.117.0';
import { createEnquiryNotificationHandler } from '../_shared/enquiry-notification-handler.ts';

Deno.serve(createEnquiryNotificationHandler({
  env: name => Deno.env.get(name),
  createClient,
  fetch,
}));
