import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Card, Input, Loading, Row, Screen, Spacer, Text } from '@/components/ui';
import { useJoinEvent } from '@/hooks';
import { radius, spacing, useTheme } from '@/theme';

const CODE_LENGTH = 6;

/** Accept a bare join code, or any link carrying `code=XXXXXX` (e.g. dram://event/join?code=ABC123). */
function extractJoinCode(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const inUrl = /[?&#]code=([A-Za-z0-9]{4,12})/i.exec(s);
  if (inUrl?.[1]) return inUrl[1].toUpperCase();
  const tail = /\/join\/([A-Za-z0-9]{4,12})\/?$/i.exec(s);
  if (tail?.[1]) return tail[1].toUpperCase();
  if (new RegExp(`^[A-Za-z0-9]{${CODE_LENGTH}}$`).test(s)) return s.toUpperCase();
  return null;
}

export default function JoinEvent() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const join = useJoinEvent();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState(() =>
    (params.code ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, CODE_LENGTH),
  );
  const [scanning, setScanning] = useState(false);
  /** Stops a QR code from firing `join` over and over while the camera keeps seeing it. */
  const busy = useRef(false);

  const submit = async (value: string) => {
    const clean = value.trim().toUpperCase();
    if (clean.length < CODE_LENGTH) {
      busy.current = false;
      return Alert.alert('Check the code', `Join codes are ${CODE_LENGTH} characters.`);
    }
    try {
      const event = await join.mutateAsync(clean);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/event/[id]', params: { id: event.id } });
    } catch (e) {
      busy.current = false;
      Alert.alert('Could not join', e instanceof Error ? e.message : String(e));
    }
  };

  const onBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (busy.current) return;
    const scanned = extractJoinCode(data);
    if (!scanned) return;
    busy.current = true;
    setCode(scanned);
    submit(scanned);
  };

  const startScanning = async () => {
    if (permission?.granted) {
      setScanning(true);
      return;
    }
    const next = await requestPermission();
    if (next.granted) setScanning(true);
    else Alert.alert('Camera access needed', 'Allow camera access to scan an event QR code.');
  };

  return (
    <Screen scroll edges={['bottom']}>
      <Spacer h={spacing.lg} />
      <Text variant="h2">Enter your join code</Text>
      <Text muted>Six characters, from whoever set the tasting up.</Text>
      <Spacer h={spacing.lg} />

      <Input
        placeholder="ABC123"
        value={code}
        onChangeText={(v) =>
          setCode(
            v
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(0, CODE_LENGTH),
          )
        }
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={CODE_LENGTH}
        returnKeyType="go"
        onSubmitEditing={() => submit(code)}
        accessibilityLabel="Event join code"
        style={styles.codeInput}
      />
      <Spacer h={spacing.md} />
      <Button title="Join" loading={join.isPending} disabled={code.length < CODE_LENGTH} onPress={() => submit(code)} />

      <Spacer h={spacing.xl} />
      <Text variant="h3">Or scan the QR code</Text>
      <Spacer h={spacing.sm} />

      {scanning && permission?.granted ? (
        <>
          <View style={[styles.camera, { borderColor: t.border }]}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onBarcodeScanned}
            />
            {join.isPending ? (
              <View style={[StyleSheet.absoluteFill, styles.overlay]}>
                <Loading />
              </View>
            ) : null}
          </View>
          <Spacer h={spacing.sm} />
          <Button title="Stop scanning" variant="ghost" onPress={() => setScanning(false)} />
        </>
      ) : (
        <Card>
          <Row gap={spacing.md}>
            <View style={{ flex: 1 }}>
              <Text variant="h3">Scan to join</Text>
              <Text variant="small" muted>
                {permission && !permission.granted && !permission.canAskAgain
                  ? 'Camera access is off. Turn it on in your device settings.'
                  : 'Point your camera at the event QR code.'}
              </Text>
            </View>
            <Button title="Camera" variant="secondary" icon="qr-code-outline" onPress={startScanning} />
          </Row>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeInput: { textAlign: 'center', letterSpacing: 10, fontSize: 32, fontWeight: '700', paddingVertical: spacing.lg },
  camera: { height: 280, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  overlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
});
