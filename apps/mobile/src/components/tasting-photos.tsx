/**
 * Photo strip for a tasting note. An existing tasting uploads straight away; a
 * new one holds the local URIs until the tasting row exists.
 */
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Row, Text } from '@/components/ui';
import { useTastingPhotos, tastingPhotoKey } from '@/hooks/tastings';
import { addTastingPhoto, uploadImage } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

const PICK = { quality: 0.7, mediaTypes: ['images'] as ImagePicker.MediaType[] };

export function TastingPhotos({
  tastingId,
  pending,
  onPending,
}: {
  tastingId: string | null;
  pending: string[];
  onPending: (next: string[]) => void;
}) {
  const t = useTheme();
  const qc = useQueryClient();
  const photos = useTastingPhotos(tastingId ?? undefined);
  const [busy, setBusy] = useState(false);

  const accept = async (uri: string) => {
    if (!tastingId) {
      onPending([...pending, uri]);
      return;
    }
    setBusy(true);
    try {
      const path = await uploadImage('tasting-photos', uri, 'image/jpeg');
      await addTastingPhoto(tastingId, path, (photos.data?.length ?? 0) + pending.length);
      await qc.invalidateQueries({ queryKey: tastingPhotoKey(tastingId) });
    } catch (e) {
      Alert.alert('Could not add that photo', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const take = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in Settings to take a photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync(PICK);
    if (!res.canceled && res.assets[0]) await accept(res.assets[0].uri);
  };

  const choose = async () => {
    const res = await ImagePicker.launchImageLibraryAsync(PICK);
    if (!res.canceled && res.assets[0]) await accept(res.assets[0].uri);
  };

  const existing = photos.data ?? [];
  const hasAny = existing.length > 0 || pending.length > 0;

  return (
    <View style={{ gap: spacing.md }}>
      {hasAny ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {existing.map((p) =>
            p.url ? (
              <Image key={p.id} source={{ uri: p.url }} style={styles.thumb} contentFit="cover" transition={150} />
            ) : (
              <View key={p.id} style={[styles.thumb, styles.placeholder, { backgroundColor: t.accentSoft }]}>
                <Ionicons name="image-outline" size={20} color={t.accent} />
              </View>
            ),
          )}
          {pending.map((uri) => (
            <View key={uri}>
              <Image source={{ uri }} style={styles.thumb} contentFit="cover" transition={150} />
              <Pressable
                onPress={() => onPending(pending.filter((u) => u !== uri))}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                hitSlop={6}
                style={[styles.remove, { backgroundColor: t.card, borderColor: t.border }]}>
                <Ionicons name="close" size={14} color={t.text} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <Row gap={spacing.sm}>
        <Button
          title="Take photo"
          icon="camera-outline"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={busy}
          onPress={take}
        />
        <Button
          title="Choose photo"
          icon="images-outline"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={busy}
          onPress={choose}
        />
      </Row>
      {pending.length && !tastingId ? (
        <Text variant="small" muted>
          {pending.length} photo{pending.length === 1 ? '' : 's'} will upload when you save.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 84, height: 84, borderRadius: radius.md },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
