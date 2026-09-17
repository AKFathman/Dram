import { useColorScheme } from 'react-native';

import type { Tier } from '@/lib/ranking';

export const palette = {
  amber: '#C8792A',
  amberDark: '#A8621F',
  amberSoft: '#F3E3CF',
  gold: '#D9A441',
  green: '#5E9E4C',
  grey: '#8E8E93',
  red: '#B84A3A',
  cream: '#FBF7F1',
  creamCard: '#FFFFFF',
  creamBorder: '#E9E0D3',
  ink: '#1E170F',
  inkMuted: '#6E6255',
  night: '#14100C',
  nightCard: '#211A14',
  nightBorder: '#33291F',
  nightText: '#F3EBE0',
  nightMuted: '#A99B8A',
} as const;

export interface Theme {
  scheme: 'light' | 'dark';
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  danger: string;
  success: string;
  tier: Record<Tier, string>;
}

export const light: Theme = {
  scheme: 'light',
  bg: palette.cream,
  card: palette.creamCard,
  border: palette.creamBorder,
  text: palette.ink,
  muted: palette.inkMuted,
  accent: palette.amber,
  accentText: '#FFFFFF',
  accentSoft: palette.amberSoft,
  danger: palette.red,
  success: palette.green,
  tier: { loved: palette.gold, liked: palette.green, fine: palette.grey, disliked: palette.red },
};

export const dark: Theme = {
  ...light,
  scheme: 'dark',
  bg: palette.night,
  card: palette.nightCard,
  border: palette.nightBorder,
  text: palette.nightText,
  muted: palette.nightMuted,
  accentSoft: '#3A2A18',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = {
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
