import { createClient } from 'npm:@supabase/supabase-js@2.117.0';
import { createTrafficMetricsHandler } from '../_shared/traffic-metrics.ts';

Deno.serve(createTrafficMetricsHandler({
  env: name => Deno.env.get(name),
  createClient: (url, key) => createClient(url, key, { auth: { persistSession: false } }),
}));
