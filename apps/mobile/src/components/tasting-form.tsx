/**
 * The tasting note form. Mounted only once its data is loaded, so every field
 * seeds itself from `initial` — no hydration effects.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { ChipRow, Collapsible, Field, Section, StickyFooter, ToggleRow, type Option } from '@/components/log-form';
import { TastingFlavorPicker } from '@/components/tasting-flavor-picker';
import { TastingPhotos } from '@/components/tasting-photos';
import { EMPTY_SCORESHEET, TastingScoresheet, type Scoresheet } from '@/components/tasting-scoresheet';
import { BottleImage, Button, Card, Input, Row, Screen, Spacer, Text } from '@/components/ui';
import { useCreateTasting, useDeleteTasting, useUpdateTasting } from '@/hooks';
import { addTastingPhoto, uploadImage, whiskeySubtitle, type TastingWithWhiskey, type Whiskey } from '@/lib/api';
import type { Enums } from '@/lib/database.types';
import { spacing } from '@/theme';

type Serving = Enums<'serving_style'>;
type Setting = Enums<'tasting_setting'>;

const SERVINGS: Option<Serving>[] = [
  { value: 'neat', label: 'Neat' },
  { value: 'rocks', label: 'Rocks' },
  { value: 'water', label: 'Splash of water' },
  { value: 'highball', label: 'Highball' },
  { value: 'cocktail', label: 'Cocktail' },
  { value: 'other', label: 'Other' },
];

const SETTINGS: Option<Setting>[] = [
  { value: 'home', label: 'Home' },
  { value: 'bar', label: 'Bar' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'event', label: 'Event' },
  { value: 'distillery', label: 'Distillery' },
  { value: 'other', label: 'Other' },
];

const CURRENCIES: Option<string>[] = ['USD', 'GBP', 'EUR', 'JPY', 'CAD'].map((c) => ({ value: c, label: c }));

const trim = (s: string) => (s.trim() ? s.trim() : null);
const num = (s: string) => {
  const v = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  try {
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  } catch {
    return d.toDateString();
  }
}

export function TastingForm({
  tastingId,
  initial,
  whiskey,
  whiskeyId,
  eventId,
}: {
  /** null for a brand new tasting. */
  tastingId: string | null;
  initial: TastingWithWhiskey | null;
  whiskey: Whiskey | null;
  whiskeyId: string;
  eventId?: string;
}) {
  const router = useRouter();
  const create = useCreateTasting();
  const update = useUpdateTasting();
  const destroy = useDeleteTasting();

  const [tastedAt] = useState(() => initial?.tasted_at ?? new Date().toISOString());
  const [note, setNote] = useState(initial?.note ?? '');
  const [nose, setNose] = useState(initial?.nose ?? '');
  const [palate, setPalate] = useState(initial?.palate ?? '');
  const [finish, setFinish] = useState(initial?.finish ?? '');
  const [serving, setServing] = useState<Serving | null>(initial?.serving ?? null);
  const [setting, setSetting] = useState<Setting | null>(initial?.setting ?? (eventId ? 'event' : null));
  const [flavors, setFlavors] = useState<string[]>(() => initial?.flavors.map((f) => f.tag_slug) ?? []);
  const [price, setPrice] = useState(initial?.price_paid != null ? String(initial.price_paid) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
  const [pourSize, setPourSize] = useState(initial?.pour_size_ml != null ? String(initial.pour_size_ml) : '');
  const [batch, setBatch] = useState(initial?.bottle_batch ?? '');
  const [bottleNumber, setBottleNumber] = useState(initial?.bottle_number ?? '');
  const [storePick, setStorePick] = useState(initial?.store_pick ?? '');
  const [isBlind, setIsBlind] = useState(initial?.is_blind ?? false);
  const [expert, setExpert] = useState(
    () =>
      initial != null &&
      [
        initial.score_appearance,
        initial.score_nose,
        initial.score_palate,
        initial.score_finish,
        initial.score_balance,
      ].some((v) => v != null),
  );
  const [scores, setScores] = useState<Scoresheet>(() =>
    initial
      ? {
          appearance: initial.score_appearance ?? 0,
          nose: initial.score_nose ?? 0,
          palate: initial.score_palate ?? 0,
          finish: initial.score_finish ?? 0,
          balance: initial.score_balance ?? 0,
        }
      : EMPTY_SCORESHEET,
  );
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const priceValue = num(price);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const payload = () => ({
    note: trim(note),
    nose: trim(nose),
    palate: trim(palate),
    finish: trim(finish),
    serving,
    setting,
    price_paid: priceValue,
    currency: priceValue != null ? currency : null,
    pour_size_ml: num(pourSize),
    bottle_batch: trim(batch),
    bottle_number: trim(bottleNumber),
    store_pick: trim(storePick),
    is_blind: isBlind,
    score_appearance: expert ? scores.appearance : null,
    score_nose: expert ? scores.nose : null,
    score_palate: expert ? scores.palate : null,
    score_finish: expert ? scores.finish : null,
    score_balance: expert ? scores.balance : null,
    flavors: flavors.map((tag_slug) => ({ tag_slug })),
  });

  const save = async () => {
    setBusy(true);
    try {
      let id = tastingId;
      if (id) {
        await update.mutateAsync({ id, ...payload() });
      } else {
        const created = await create.mutateAsync({
          whiskey_id: whiskeyId,
          event_id: eventId ?? null,
          tasted_at: tastedAt,
          ...payload(),
        });
        id = created.id;
      }
      for (const [i, uri] of pendingPhotos.entries()) {
        const path = await uploadImage('tasting-photos', uri, 'image/jpeg');
        await addTastingPhoto(id, path, i);
      }
      setPendingPhotos([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      goBack();
    } catch (e) {
      Alert.alert('Could not save your note', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this tasting?', 'The note, flavours and photos go with it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          tastingId &&
          destroy.mutate(tastingId, {
            onSuccess: goBack,
            onError: (e) => Alert.alert('Could not delete it', e instanceof Error ? e.message : String(e)),
          }),
      },
    ]);

  return (
    <Screen edges={['bottom']} padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
          keyboardShouldPersistTaps="handled">
          {whiskey ? (
            <Card>
              <Row gap={spacing.lg}>
                <BottleImage uri={whiskey.image_url} size={56} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h3" numberOfLines={2}>
                    {whiskey.name}
                  </Text>
                  <Text variant="small" muted numberOfLines={1}>
                    {whiskeySubtitle(whiskey)}
                  </Text>
                </View>
              </Row>
            </Card>
          ) : null}

          <Section title="Note">
            <Input
              placeholder="What stood out?"
              value={note}
              onChangeText={setNote}
              multiline
              style={{ minHeight: 96, textAlignVertical: 'top' }}
            />
            <Text variant="small" muted>
              Tasted {formatWhen(tastedAt)}
            </Text>
          </Section>

          <Section title="Serving & setting">
            <ChipRow label="Serving" options={SERVINGS} value={serving} onChange={setServing} />
            <ChipRow label="Setting" options={SETTINGS} value={setting} onChange={setSetting} />
          </Section>

          <Section title="Flavors" hint="Tap everything you picked up.">
            <TastingFlavorPicker value={flavors} onChange={setFlavors} />
          </Section>

          <Collapsible title="Go deeper" icon="flask-outline" hint="Nose, palate, finish">
            <Field label="Nose">
              <Input placeholder="Orchard fruit, vanilla…" value={nose} onChangeText={setNose} multiline />
            </Field>
            <Field label="Palate">
              <Input placeholder="Oily, baking spice…" value={palate} onChangeText={setPalate} multiline />
            </Field>
            <Field label="Finish">
              <Input placeholder="Long, drying…" value={finish} onChangeText={setFinish} multiline />
            </Field>
          </Collapsible>

          <Collapsible title="Bottle & price" icon="pricetag-outline" hint="Batch, price, pour size">
            <Field label="Price paid">
              <Input placeholder="0.00" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
            </Field>
            <ChipRow
              label="Currency"
              options={CURRENCIES}
              value={currency}
              onChange={(v) => setCurrency(v ?? 'USD')}
              clearable={false}
            />
            <Field label="Pour size (ml)">
              <Input placeholder="30" keyboardType="number-pad" value={pourSize} onChangeText={setPourSize} />
            </Field>
            <Field label="Batch">
              <Input placeholder="B522" value={batch} onChangeText={setBatch} />
            </Field>
            <Field label="Bottle number">
              <Input placeholder="142 / 260" value={bottleNumber} onChangeText={setBottleNumber} />
            </Field>
            <Field label="Store pick">
              <Input placeholder="Shop or club name" value={storePick} onChangeText={setStorePick} />
            </Field>
            <ToggleRow
              label="Blind tasting"
              hint="You didn't know what it was."
              value={isBlind}
              onValueChange={setIsBlind}
            />
          </Collapsible>

          <Card>
            <ToggleRow
              label="Expert scoresheet"
              hint="Five categories out of 20."
              value={expert}
              onValueChange={setExpert}
            />
            {expert ? (
              <View style={{ marginTop: spacing.lg }}>
                <TastingScoresheet value={scores} onChange={setScores} />
              </View>
            ) : null}
          </Card>

          <Section title="Photos">
            <TastingPhotos tastingId={tastingId} pending={pendingPhotos} onPending={setPendingPhotos} />
          </Section>

          {tastingId ? (
            <>
              <Spacer h={spacing.sm} />
              <Button title="Delete tasting" variant="danger" icon="trash-outline" onPress={confirmDelete} />
            </>
          ) : null}
        </ScrollView>
        <StickyFooter>
          <Button title={tastingId ? 'Save changes' : 'Save tasting note'} loading={busy} onPress={save} />
        </StickyFooter>
      </KeyboardAvoidingView>
    </Screen>
  );
}
