-- Supabase Cron uses UTC time.
-- Beijing time 08:00 / 12:00 / 18:00 equals UTC 00:00 / 04:00 / 10:00.
-- Replace REPLACE_WITH_CRON_SECRET with the same CRON_SECRET configured on the Edge Function.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('wish-health-push-0800');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.unschedule('wish-health-push-1200');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.unschedule('wish-health-push-1800');
exception when others then
  null;
end $$;

select cron.schedule(
  'wish-health-push-0800',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://udgpywjcwhkcabzkewas.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_WITH_CRON_SECRET'
    ),
    body := jsonb_build_object('time', '08:00')
  );
  $$
);

select cron.schedule(
  'wish-health-push-1200',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://udgpywjcwhkcabzkewas.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_WITH_CRON_SECRET'
    ),
    body := jsonb_build_object('time', '12:00')
  );
  $$
);

select cron.schedule(
  'wish-health-push-1800',
  '0 10 * * *',
  $$
  select net.http_post(
    url := 'https://udgpywjcwhkcabzkewas.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_WITH_CRON_SECRET'
    ),
    body := jsonb_build_object('time', '18:00')
  );
  $$
);
