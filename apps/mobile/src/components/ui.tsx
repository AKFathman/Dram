/**
 * Small set of UI primitives so every screen looks the same. Plain React
 * Native + theme tokens; motion comes from ./motion.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { TIER_META, formatScore, type Tier } from '@/lib/ranking';
import { elevation, font, radius, spacing, useTheme } from '@/theme';

import { Appear, PressableScale } from './motion';

// ---------------------------------------------------------------- text ------
type Variant = keyof typeof font;
export function Text({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: React.ComponentProps<typeof RNText> & { variant?: Variant; muted?: boolean; color?: string }) {
  const t = useTheme();
  return <RNText {...rest} style={[font[variant], { color: color ?? (muted ? t.muted : t.text) }, style]} />;
}

// -------------------------------------------------------------- layout ------
/** Width of the centred content column on web. Roughly a large phone. */
const WEB_COLUMN = { width: '100%', maxWidth: 520, alignSelf: 'center' } as const;

export function Screen({
  children,
  scroll,
  edges = ['top'],
  padded = true,
  style,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const pad = padded ? { paddingHorizontal: spacing.lg } : null;
  // A browser window is many times wider than any phone. Without a cap, every
  // row and button stretches across a desktop monitor; keep a phone-ish column.
  const column = Platform.OS === 'web' ? WEB_COLUMN : null;
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: t.bg }, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, column, { paddingBottom: spacing.xxxl }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, column, pad]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

function useCardStyle(): ViewStyle {
  const t = useTheme();
  return { backgroundColor: t.card, borderRadius: radius.lg, padding: spacing.lg, ...elevation(t) };
}

export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[useCardStyle(), style]} />;
}

/** A card you can tap. Dips slightly under the finger. */
export function PressableCard({
  style,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  return (
    <PressableScale accessibilityRole="button" scaleTo={0.985} {...rest} style={[useCardStyle(), style]}>
      {children}
    </PressableScale>
  );
}

export function Row({ style, gap = spacing.sm, ...rest }: ViewProps & { gap?: number }) {
  return <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]} />;
}

export function Spacer({ h = spacing.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginVertical: spacing.md }} />;
}

// -------------------------------------------------------------- inputs ------
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  style,
  disabled,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** `sm` fits inside a list row. */
  size?: 'md' | 'sm';
  loading?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary'
      ? t.accent
      : variant === 'danger'
        ? t.danger
        : variant === 'secondary'
          ? t.surface
          : 'transparent';
  const fg =
    variant === 'primary'
      ? t.accentText
      : variant === 'danger'
        ? t.onTier
        : variant === 'secondary'
          ? t.text
          : t.accent;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      {...rest}
      style={[
        {
          backgroundColor: bg,
          opacity: disabled ? 0.45 : 1,
          minHeight: size === 'sm' ? 36 : 52,
          paddingHorizontal: size === 'sm' ? spacing.lg : spacing.xl,
          borderRadius: size === 'sm' ? radius.pill : radius.md,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: spacing.sm,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={fg} /> : null}
          <RNText style={[size === 'sm' ? [font.small, { fontWeight: '700' as const }] : font.h3, { color: fg }]}>
            {title}
          </RNText>
        </>
      )}
    </PressableScale>
  );
}

export function IconButton({
  name,
  size = 22,
  color,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      hitSlop={8}
      scaleTo={0.88}
      {...rest}
      style={[{ padding: spacing.sm }, style]}>
      <Ionicons name={name} size={size} color={color ?? t.text} />
    </PressableScale>
  );
}

/** The accent outline shown while a field has focus. */
function useFocusRing() {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return {
    // The border is always there, just transparent, so focusing doesn't shift layout.
    ring: { borderWidth: 1.5, borderColor: focused ? t.accent : 'transparent' },
    handlers: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
  };
}

export function Input({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const t = useTheme();
  const { ring, handlers } = useFocusRing();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...rest}
      onFocus={(e) => {
        handlers.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        handlers.onBlur();
        onBlur?.(e);
      }}
      style={[
        font.body,
        {
          color: t.text,
          backgroundColor: t.surface,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: 14,
        },
        ring,
        style,
      ]}
    />
  );
}

export function SearchBar({ onFocus, onBlur, ...props }: TextInputProps) {
  const t = useTheme();
  const { ring, handlers } = useFocusRing();
  return (
    <Row style={[{ backgroundColor: t.surface, borderRadius: radius.pill, paddingHorizontal: spacing.lg }, ring]}>
      <Ionicons name="search" size={18} color={t.muted} />
      <TextInput
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        {...props}
        onFocus={(e) => {
          handlers.onFocus();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          handlers.onBlur();
          onBlur?.(e);
        }}
        style={[font.body, { flex: 1, color: t.text, paddingVertical: 12 }]}
      />
    </Row>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** A tier or other semantic colour for the selected state; text uses onTier. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = selected ? (color ?? t.accent) : t.surface;
  const fg = selected ? (color ? t.onTier : t.accentText) : t.text;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      scaleTo={0.94}
      style={[
        { paddingHorizontal: spacing.md + 2, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: bg },
        style,
      ]}>
      <RNText style={[font.small, { color: fg, fontWeight: '600' }]}>{label}</RNText>
    </PressableScale>
  );
}

// ------------------------------------------------------------- whiskey ------
/** The tier colour a 0–10 score falls in; a quiet fill when there's no score. */
export function scoreColor(t: ReturnType<typeof useTheme>, s: number | null): string {
  if (s === null) return t.surface;
  return s >= 8 ? t.tier.loved : s >= 6 ? t.tier.liked : s >= 4 ? t.tier.fine : t.tier.disliked;
}

export function ScoreBadge({
  score,
  size = 'md',
  style,
}: {
  score: number | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const dim = size === 'lg' ? 56 : size === 'md' ? 44 : 34;
  const fs = size === 'lg' ? 20 : size === 'md' ? 16 : 13;
  const s = score ?? null;
  const bg = scoreColor(t, s);
  return (
    <View
      style={[
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <RNText style={{ color: s === null ? t.muted : t.onTier, fontWeight: '800', fontSize: fs, letterSpacing: -0.3 }}>
        {formatScore(s)}
      </RNText>
    </View>
  );
}

export function TierPill({ tier, style }: { tier: Tier; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        { backgroundColor: t.tier[tier], paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
        style,
      ]}>
      <RNText style={[font.caption, { color: t.onTier }]}>
        {TIER_META[tier].emoji} {TIER_META[tier].short}
      </RNText>
    </View>
  );
}

export function BottleImage({
  uri,
  size = 56,
  style,
}: {
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: t.surface,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={200} />
      ) : (
        <Ionicons name="wine-outline" size={size * 0.46} color={t.muted} />
      )}
    </View>
  );
}

export function Avatar({
  uri,
  name,
  size = 40,
  style,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const initials = (name ?? '?').trim().slice(0, 1).toUpperCase();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.surface,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={200} />
      ) : (
        <RNText style={{ color: t.muted, fontWeight: '700', fontSize: size * 0.4 }}>{initials}</RNText>
      )}
    </View>
  );
}

// -------------------------------------------------------------- experts -----
/**
 * Marks a taste expert. `compact` is the seal alone, for sitting beside a
 * name; the full form spells out their title.
 */
export function ExpertBadge({
  title,
  compact,
  style,
}: {
  title?: string | null;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const label = title ? `Taste expert, ${title}` : 'Taste expert';
  if (compact) {
    return (
      <View accessible accessibilityLabel={label} style={style}>
        <Ionicons name="ribbon" size={15} color={t.expert} />
      </View>
    );
  }
  return (
    <Row
      gap={6}
      accessible
      accessibilityLabel={label}
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: t.accentSoft,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: radius.pill,
          maxWidth: '100%',
        },
        style,
      ]}>
      <Ionicons name="ribbon" size={14} color={t.expert} />
      <RNText numberOfLines={1} style={[font.caption, { color: t.expert, flexShrink: 1 }]}>
        {title ?? 'Taste expert'}
      </RNText>
    </Row>
  );
}

// --------------------------------------------------------------- states -----
export function Loading({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ padding: spacing.xxl, alignItems: 'center' }, style]}>
      <ActivityIndicator color={t.accent} />
    </View>
  );
}

export function EmptyState({
  icon = 'wine-outline',
  title,
  body,
  action,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Appear
      style={{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: t.surface,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.sm,
        }}>
        <Ionicons name={icon} size={32} color={t.muted} />
      </View>
      <Text variant="h3" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text muted style={{ textAlign: 'center', maxWidth: 320 }}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.md, alignSelf: 'stretch' }}>{action}</View> : null}
    </Appear>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error ?? 'Something went wrong');
  return (
    <EmptyState
      icon="alert-circle-outline"
      title="Something went wrong"
      body={message}
      action={retry ? <Button title="Try again" variant="secondary" onPress={retry} /> : undefined}
    />
  );
}

export const textStyles: Record<string, TextStyle> = StyleSheet.create({});
