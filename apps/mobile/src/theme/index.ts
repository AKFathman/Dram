import { Platform, useColorScheme, type ViewStyle } from 'react-native';

import type { Tier } from '@/lib/ranking';

export interface Theme {
  scheme: 'light' | 'dark';
  /** Screen background. */
  bg: string;
  /** Raised content: cards, sheets, the tab bar. */
  card: string;
  /** Quiet fills: inputs, secondary buttons, unselected chips, placeholders. */
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  /** Text and icons drawn on `accent`. */
  accentText: string;
  /** A faint wash of the accent, for selected rows and highlights. */
  accentSoft: string;
  danger: string;
  success: string;
  tier: Record<Tier, string>;
  /** Text drawn on any `tier` colour. */
  onTier: string;
  /** The taste-expert badge. */
  expert: string;
}

/**
 * Three directions for the look. Every pairing clears WCAG AA in both
 * schemes (text 4.5:1, including score numbers on tier colours) — checked
 * numerically, not by eye. Switching the whole app is the one line below.
 */
// prettier-ignore -- kept as compact colour tables so the options read side by side.
const palettes = {
  // Clean white, a bottle-glass green accent, gold kept for "Loved".
  glass: {
    light: {
      bg: '#F8F8F7',
      card: '#FFFFFF',
      surface: '#EFEFED',
      border: '#E4E4E1',
      text: '#141413',
      muted: '#62625E',
      accent: '#0A6B58',
      accentText: '#FFFFFF',
      accentSoft: '#E2EFEB',
      tier: { loved: '#9E6410', liked: '#0A6B58', fine: '#6E6E69', disliked: '#B23A31' },
      onTier: '#FFFFFF',
    },
    dark: {
      bg: '#0C0C0B',
      card: '#171716',
      surface: '#222220',
      border: '#2C2C29',
      text: '#F4F4F2',
      muted: '#A3A39E',
      accent: '#43C4A5',
      accentText: '#03211A',
      accentSoft: '#12302A',
      tier: { loved: '#E3A845', liked: '#43C4A5', fine: '#9A9A94', disliked: '#EA7268' },
      onTier: '#111110',
    },
  },
  // Monochrome: black and white, colour only where it carries meaning.
  ink: {
    light: {
      bg: '#FFFFFF',
      card: '#FFFFFF',
      surface: '#F1F1F1',
      border: '#E6E6E6',
      text: '#0A0A0A',
      muted: '#636363',
      accent: '#111111',
      accentText: '#FFFFFF',
      accentSoft: '#F1F1F1',
      tier: { loved: '#98600E', liked: '#2C6A4B', fine: '#6E6E6E', disliked: '#A93B31' },
      onTier: '#FFFFFF',
    },
    dark: {
      bg: '#0A0A0A',
      card: '#151515',
      surface: '#202020',
      border: '#2A2A2A',
      text: '#FAFAFA',
      muted: '#A3A3A3',
      accent: '#F5F5F5',
      accentText: '#0A0A0A',
      accentSoft: '#202020',
      tier: { loved: '#E3A845', liked: '#6CC79A', fine: '#A0A0A0', disliked: '#EA7268' },
      onTier: '#0A0A0A',
    },
  },
  // Warm stone with an oxblood accent — warmth without the old orange.
  oak: {
    light: {
      bg: '#FAF9F7',
      card: '#FFFFFF',
      surface: '#F0EDE8',
      border: '#E6E1DA',
      text: '#1A1614',
      muted: '#665D57',
      accent: '#86372A',
      accentText: '#FFFFFF',
      accentSoft: '#F5E7E3',
      tier: { loved: '#98600E', liked: '#3F6B3C', fine: '#716A63', disliked: '#A93B31' },
      onTier: '#FFFFFF',
    },
    dark: {
      bg: '#12100E',
      card: '#1D1A17',
      surface: '#28231F',
      border: '#342E28',
      text: '#F5F1EC',
      muted: '#ABA197',
      accent: '#E8917A',
      accentText: '#2A0D07',
      accentSoft: '#3A1E17',
      tier: { loved: '#E3A845', liked: '#86C080', fine: '#A39B92', disliked: '#EA7268' },
      onTier: '#16110E',
    },
  },
} as const;

export type PaletteName = keyof typeof palettes;

/** The live palette. EXPO_PUBLIC_DRAM_PALETTE overrides it for previews. */
const ACTIVE: PaletteName = 'glass';

function resolvePalette(): PaletteName {
  const requested = process.env.EXPO_PUBLIC_DRAM_PALETTE;
  return requested && requested in palettes ? (requested as PaletteName) : ACTIVE;
}

function build(scheme: 'light' | 'dark'): Theme {
  const p = palettes[resolvePalette()][scheme];
  return {
    scheme,
    ...p,
    tier: { ...p.tier },
    danger: p.tier.disliked,
    success: p.tier.liked,
    expert: p.accent,
  };
}

export const light: Theme = build('light');
export const dark: Theme = build('dark');

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
export const font = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.9 },
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.6 },
  h2: { fontSize: 21, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.1 },
  body: { fontSize: 16, fontWeight: '400' as const },
  small: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.2 },
};

/**
 * Soft elevation for cards. Shadows read as depth on a light background and
 * vanish on a dark one, so dark mode uses a hairline border instead.
 */
export function elevation(t: Theme): ViewStyle {
  if (t.scheme === 'dark') return { borderWidth: 1, borderColor: t.border };
  return Platform.select<ViewStyle>({
    android: { elevation: 1 },
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
    },
  });
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
