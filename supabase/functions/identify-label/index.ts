/**
 * identify-label — photograph a bottle, get catalog matches.
 *
 * POST { image_base64: string, media_type: 'image/jpeg' | 'image/png' | 'image/webp' }
 *  → { extracted: LabelExtraction, query: string, matches: Whiskey[] }
 *
 * 1. Claude (vision + structured output) reads the label into a fixed schema.
 * 2. We build a search string from what it found and run the same
 *    `search_whiskeys` RPC the app uses, under the caller's JWT/RLS.
 *
 * Secrets: ANTHROPIC_API_KEY (supabase secrets set). SUPABASE_URL and
 * SUPABASE_ANON_KEY are injected by the platform.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const CATEGORIES = [
  'bourbon', 'rye', 'wheat', 'tennessee', 'american_single_malt', 'american_other',
  'scotch_single_malt', 'scotch_blended', 'scotch_blended_malt', 'scotch_grain',
  'irish', 'japanese', 'canadian', 'world', 'other',
] as const;

const LabelSchema = z.object({
  brand: z.string().nullable().describe('Brand or distillery name as printed most prominently, e.g. "Blanton\'s", "Lagavulin"'),
  expression: z.string().nullable().describe('The specific bottling, e.g. "Original Single Barrel", "16 Year", "Double Oaked". Null if only the brand is visible.'),
  distillery: z.string().nullable().describe('Distillery if stated and different from brand, e.g. "Buffalo Trace Distillery"'),
  category: z.enum(CATEGORIES).nullable(),
  country: z.string().nullable().describe('ISO 3166-1 alpha-2, e.g. US, GB, IE, JP, CA, TW, IN'),
  age_years: z.number().nullable().describe('Age statement in years, null if none'),
  abv: z.number().nullable().describe('Alcohol by volume percentage; convert proof to ABV (proof / 2 for US labels)'),
  confidence: z.enum(['high', 'medium', 'low']).describe('How sure you are this identifies a specific bottling'),
  raw_text: z.string().describe('All legible label text, in reading order'),
});
type Label = z.infer<typeof LabelSchema>;

const MAX_BYTES = 6 * 1024 * 1024;
const MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp']);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

async function readLabel(imageBase64: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<Label> {
  const response = await anthropic.beta.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 1024,
    // Reading a label is routine work; low effort keeps this fast and cheap.
    output_config: { effort: 'low', format: betaZodOutputFormat(LabelSchema) },
    // If a safety classifier declines the request, re-run it on Anthropic's
    // recommended fallback model instead of failing the scan.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system:
      'You identify whiskey bottles from label photos for a tasting-log app. Extract only what is printed or unambiguously implied by the label. Never invent an age statement or ABV that is not visible. Use the brand as printed, without trademark symbols.',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Identify this whiskey.' },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The image could not be processed.');
  }
  if (!response.parsed_output) {
    throw new Error('Could not read a whiskey label in this photo.');
  }
  return response.parsed_output;
}

function buildQueries(l: Label): string[] {
  const age = l.age_years != null ? String(Math.round(l.age_years)) : '';
  const q = [
    [l.brand, l.expression, age].filter(Boolean).join(' '),
    [l.brand, l.expression].filter(Boolean).join(' '),
    [l.distillery, l.expression, age].filter(Boolean).join(' '),
    l.brand ?? '',
  ]
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  return [...new Set(q)];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Missing Authorization header' }, 401);

  let body: { image_base64?: string; media_type?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { image_base64, media_type } = body;
  if (!image_base64 || typeof image_base64 !== 'string') return json({ error: 'image_base64 is required' }, 400);
  if (!media_type || !MEDIA.has(media_type)) return json({ error: 'media_type must be image/jpeg, image/png or image/webp' }, 400);
  if (image_base64.length * 0.75 > MAX_BYTES) return json({ error: 'Image too large (max 6 MB)' }, 413);

  // Search as the calling user so RLS (and their pending submissions) apply.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Not signed in' }, 401);

  let extracted: Label;
  try {
    extracted = await readLabel(image_base64, media_type as 'image/jpeg' | 'image/png' | 'image/webp');
  } catch (e) {
    console.error('identify-label: model error', e);
    return json({ error: e instanceof Error ? e.message : 'Label recognition failed' }, 502);
  }

  let matches: unknown[] = [];
  let query = '';
  for (const q of buildQueries(extracted)) {
    const { data, error } = await supabase.rpc('search_whiskeys', { q, p_limit: 8 });
    if (error) {
      console.error('identify-label: search error', error);
      continue;
    }
    if (data && data.length) {
      matches = data;
      query = q;
      break;
    }
    if (!query) query = q;
  }

  return json({ extracted, query, matches });
});
