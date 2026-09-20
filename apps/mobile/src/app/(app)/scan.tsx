/**
 * Point the camera at a label, let the edge function read it, then jump into
 * the rating flow. Falls back to the photo library and to plain search.
 */
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ScanResults } from '@/components/scan-results';
import { Button, EmptyState, Loading, Screen, Spacer, Text } from '@/components/ui';
import { useIdentifyLabel } from '@/hooks';
import type { IdentifyResult } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

export default function ScanScreen() {
  const t = useTheme();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView | null>(null);
  const identify = useIdentifyLabel();

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);

  const withEvent = <T extends Record<string, string>>(params: T) => ({
    ...params,
    ...(eventId ? { eventId } : {}),
  });

  const run = async (base64: string) => {
    setBusy(true);
    try {
      const res = await identify.mutateAsync({ base64, mediaType: 'image/jpeg' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setResult(res);
    } catch (e) {
      Alert.alert('Could not read that label', e instanceof Error ? e.message : String(e), [
        { text: 'Search by name instead', onPress: () => router.replace('/log') },
        { text: 'Try again', style: 'cancel' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!camera.current || busy) return;
    try {
      const photo = await camera.current.takePictureAsync({ base64: true, quality: 0.6 });
      if (photo?.base64) await run(photo.base64);
      else Alert.alert('No photo', 'The camera did not return an image. Try again.');
    } catch (e) {
      Alert.alert('Camera trouble', e instanceof Error ? e.message : String(e));
    }
  };

  const fromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ['images'] });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    if (asset.base64) await run(asset.base64);
    else Alert.alert('Could not read that photo', 'Pick another one, or search by name.');
  };

  if (result) {
    const e = result.extracted;
    return (
      <Screen scroll edges={['bottom']}>
        <Spacer h={spacing.md} />
        <ScanResults
          result={result}
          onPick={(whiskeyId) => router.replace({ pathname: '/rate/[whiskeyId]', params: withEvent({ whiskeyId }) })}
          onAdd={() =>
            router.replace({
              pathname: '/add-whiskey',
              params: withEvent({
                name: [e.brand, e.expression].filter(Boolean).join(' '),
                ...(e.brand ? { brand: e.brand } : {}),
                ...(e.distillery ? { distillery: e.distillery } : {}),
                ...(e.abv != null ? { abv: String(e.abv) } : {}),
                ...(e.age_years != null ? { age: String(e.age_years) } : {}),
                ...(e.category ? { category: e.category } : {}),
                ...(e.country ? { country: e.country } : {}),
              }),
            })
          }
          onRetry={() => setResult(null)}
        />
      </Screen>
    );
  }

  if (!permission) return <Loading />;

  if (!permission.granted) {
    return (
      <Screen>
        <EmptyState
          icon="camera-outline"
          title="Let Dram use the camera"
          body="Point it at a label and we'll work out what's in the glass. Nothing is stored unless you save it."
          action={
            <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
              <Button title="Allow camera" onPress={() => requestPermission()} />
              <Button title="Choose from library" variant="secondary" onPress={fromLibrary} />
              <Button title="Search by name instead" variant="ghost" onPress={() => router.replace('/log')} />
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={camera} facing="back" style={StyleSheet.absoluteFill} onCameraReady={() => setReady(true)} />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.frame, { borderColor: 'rgba(255,255,255,0.7)' }]} pointerEvents="none" />
        <View style={styles.controls}>
          <Text variant="small" style={{ color: '#fff', textAlign: 'center' }}>
            Fill the frame with the front label.
          </Text>
          <Pressable
            onPress={capture}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel="Take a photo of the label"
            style={({ pressed }) => [styles.shutter, { opacity: !ready || busy ? 0.5 : pressed ? 0.8 : 1 }]}>
            {busy ? <ActivityIndicator color={t.accent} /> : <View style={styles.shutterInner} />}
          </Pressable>
          <Pressable
            onPress={fromLibrary}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo from your library"
            hitSlop={8}
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            })}>
            <Ionicons name="images-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff' }}>Choose from library</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  frame: {
    position: 'absolute',
    top: '14%',
    left: '12%',
    right: '12%',
    bottom: '34%',
    borderWidth: 2,
    borderRadius: radius.lg,
  },
  controls: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
});
