/**
 * Small set of UI primitives so every screen looks the same. Nothing fancy:
 * plain React Native + theme tokens.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { font, radius, spacing, useTheme } from '@/theme';

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
  return (
    <RNText
      {...rest}
      style={[font[variant], { color: color ?? (muted ? t.muted : t.text) }, style]}
    />
  );
}

// -------------------------------------------------------------- layout ------
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
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: t.bg }, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, { paddingBottom: spacing.xxl }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ style, ...rest }: ViewProps) {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg },
        style,
      ]}
    />
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
  loading,
  icon,
  style,
  disabled,
  ...rest
}: PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.accent : variant === 'danger' ? t.danger : variant === 'secondary' ? t.accentSoft : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? t.accentText : variant === 'secondary' ? t.text : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      {...rest}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          paddingVertical: 14,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.md,
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
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <RNText style={[font.h3, { color: fg }]}>{title}</RNText>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  size = 22,
  color,
  style,
  ...rest
}: PressableProps & { name: React.ComponentProps<typeof Ionicons>['name']; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      {...rest}
      style={({ pressed }) => [{ padding: spacing.sm, opacity: pressed ? 0.6 : 1 }, style]}>
      <Ionicons name={name} size={size} color={color ?? t.text} />
    </Pressable>
  );
}

export function Input({ style, ...rest }: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...rest}
      style={[
        font.body,
        {
          color: t.text,
          backgroundColor: t.card,
          borderColor: t.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: 12,
        },
        style,
      ]}
    />
  );
}

export function SearchBar(props: TextInputProps) {
  const t = useTheme();
  return (
    <Row style={{ backgroundColor: t.card, borderRadius: radius.md, paddingHorizontal: spacing.md, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth }}>
      <Ionicons name="search" size={18} color={t.muted} />
      <TextInput
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        {...props}
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
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const c = color ?? t.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        {
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: selected ? c : t.border,
          backgroundColor: selected ? c : t.card,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}>
      <RNText style={[font.small, { color: selected ? '#fff' : t.text, fontWeight: '600' }]}>{label}</RNText>
    </Pressable>
  );
}

// ------------------------------------------------------------- whiskey ------
export function ScoreBadge({ score, size = 'md', style }: { score: number | null | undefined; size?: 'sm' | 'md' | 'lg'; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const dim = size === 'lg' ? 56 : size === 'md' ? 44 : 34;
  const fs = size === 'lg' ? 20 : size === 'md' ? 16 : 13;
  const s = score ?? null;
  const bg = s === null ? t.border : s >= 8 ? t.tier.loved : s >= 6 ? t.tier.liked : s >= 4 ? t.tier.fine : t.tier.disliked;
  return (
    <View style={[{ width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <RNText style={{ color: '#fff', fontWeight: '700', fontSize: fs }}>{formatScore(s)}</RNText>
    </View>
  );
}

export function TierPill({ tier, style }: { tier: Tier; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.tier[tier], paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill }, style]}>
      <RNText style={[font.caption, { color: '#fff' }]}>
        {TIER_META[tier].emoji} {TIER_META[tier].short}
      </RNText>
    </View>
  );
}

export function BottleImage({ uri, size = 56, style }: { uri?: string | null; size?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ width: size, height: size, borderRadius: radius.md, backgroundColor: t.accentSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      ) : (
        <Ionicons name="wine-outline" size={size * 0.5} color={t.accent} />
      )}
    </View>
  );
}

export function Avatar({ uri, name, size = 40, style }: { uri?: string | null; name?: string | null; size?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const initials = (name ?? '?').trim().slice(0, 1).toUpperCase();
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.accentSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <RNText style={{ color: t.accent, fontWeight: '700', fontSize: size * 0.42 }}>{initials}</RNText>
      )}
    </View>
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
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.sm }}>
      <Ionicons name={icon} size={40} color={t.muted} />
      <Text variant="h3" style={{ textAlign: 'center' }}>{title}</Text>
      {body ? (
        <Text muted style={{ textAlign: 'center' }}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
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
