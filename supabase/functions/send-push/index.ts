/**
 * send-push — fan a `notifications` row out to the user's devices via Expo Push.
 *
 * Wired up by the Deploy Supabase workflow as a trigger on public.notifications
 * that POSTs here with `Authorization: Bearer <service_role key>`. A custom
 * WEBHOOK_SECRET (supabase secrets set) is accepted as well.
 *
 * Uses the service role (injected as SUPABASE_SERVICE_ROLE_KEY) because it
 * reads other users' push tokens.
 */
import { createClient } from '@supabase/supabase-js';

type Kind =
  | 'new_follower' | 'follow_request' | 'follow_accepted' | 'like' | 'comment'
  | 'event_starting' | 'event_lineup_updated' | 'whiskey_approved' | 'whiskey_merged';

interface NotificationRow {
  id: number;
  user_id: string;
  kind: Kind;
  actor_id: string | null;
  tasting_id: string | null;
  event_id: string | null;
  whiskey_id: string | null;
  payload: Record<string, unknown>;
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function describe(n: NotificationRow): Promise<{ title: string; body: string; url: string }> {
  const actor = n.actor_id
    ? (await supabase.from('profiles').select('display_name, username').eq('id', n.actor_id).maybeSingle()).data
    : null;
  const who = actor?.display_name || (actor?.username ? `@${actor.username}` : 'Someone');
  const event = n.event_id ? (await supabase.from('events').select('name').eq('id', n.event_id).maybeSingle()).data : null;
  const whiskey = n.whiskey_id ? (await supabase.from('whiskeys').select('name').eq('id', n.whiskey_id).maybeSingle()).data : null;

  switch (n.kind) {
    case 'new_follower':     return { title: 'New follower', body: `${who} started following you`, url: `dram://user/${n.actor_id}` };
    case 'follow_request':   return { title: 'Follow request', body: `${who} wants to follow you`, url: 'dram://notifications' };
    case 'follow_accepted':  return { title: 'Request accepted', body: `${who} accepted your follow request`, url: `dram://user/${n.actor_id}` };
    case 'like':             return { title: 'New like', body: `${who} liked your tasting note`, url: n.tasting_id ? `dram://tasting/${n.tasting_id}` : 'dram://notifications' };
    case 'comment':          return { title: 'New comment', body: `${who}: ${String(n.payload?.preview ?? '')}`.slice(0, 140), url: n.tasting_id ? `dram://tasting/${n.tasting_id}` : 'dram://notifications' };
    case 'event_starting':   return { title: event?.name ?? 'Your event', body: 'Starting soon — open the lineup', url: `dram://event/${n.event_id}` };
    case 'event_lineup_updated': return { title: event?.name ?? 'Your event', body: 'The lineup was updated', url: `dram://event/${n.event_id}` };
    case 'whiskey_approved': return { title: 'Whiskey approved', body: `${whiskey?.name ?? 'Your submission'} is now in the catalog`, url: `dram://whiskey/${n.whiskey_id}` };
    case 'whiskey_merged':   return { title: 'Whiskey merged', body: `${String(n.payload?.merged_name ?? 'Your submission')} was merged into ${whiskey?.name ?? 'an existing entry'}`, url: `dram://whiskey/${n.whiskey_id}` };
    default:                 return { title: 'Dram', body: 'You have a new notification', url: 'dram://notifications' };
  }
}

Deno.serve(async (req) => {
  const accepted = [Deno.env.get('WEBHOOK_SECRET'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter(Boolean);
  const auth = req.headers.get('authorization') ?? '';
  if (!accepted.some((s) => auth === `Bearer ${s}`)) {
    return new Response('unauthorized', { status: 401 });
  }
  const { record } = (await req.json()) as { record?: NotificationRow };
  if (!record?.user_id) return new Response('no record', { status: 400 });

  const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', record.user_id);
  if (!tokens?.length) return Response.json({ sent: 0 });

  const msg = await describe(record);
  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: msg.title,
    body: msg.body,
    data: { url: msg.url, notification_id: record.id },
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  const result = await res.json().catch(() => ({}));

  // Drop tokens Expo reports as dead so we stop retrying them.
  const tickets: { status: string; details?: { error?: string } }[] = result?.data ?? [];
  const dead = tokens.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered').map((t) => t.token);
  if (dead.length) await supabase.from('push_tokens').delete().in('token', dead);

  return Response.json({ sent: messages.length, dropped: dead.length });
});
