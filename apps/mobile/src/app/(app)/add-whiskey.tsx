/**
 * Add a whiskey the catalog is missing. Everything except name, category and
 * country is optional; a moderator verifies the entry later.
 */
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ChipRow, Field, Section, StickyFooter, type Option } from '@/components/log-form';
import { BottleImage, Button, Card, Chip, Input, Row, Screen, Text } from '@/components/ui';
import { WhiskeyRow } from '@/components/whiskey-row';
import { useCreateWhiskey, useSearch } from '@/hooks';
import { CATEGORY_GROUPS, CATEGORY_LABELS, uploadImage, type WhiskeyCategory } from '@/lib/api';
import { publicUrl } from '@/lib/supabase';
import { spacing, useTheme } from '@/theme';

const COUNTRIES: Option<string>[] = [
  { value: 'US', label: 'USA' },
  { value: 'GB', label: 'Scotland / UK' },
  { value: 'IE', label: 'Ireland' },
  { value: 'JP', label: 'Japan' },
  { value: 'CA', label: 'Canada' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'IN', label: 'India' },
  { value: 'AU', label: 'Australia' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
];

const SUBCATEGORIES = [
  'Single barrel',
  'Small batch',
  'Bottled in bond',
  'Cask strength',
  'Single pot still',
  'Store pick',
  'Limited release',
];

const trim = (s: string) => (s.trim() ? s.trim() : null);
const num = (s: string) => {
  const v = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

export default function AddWhiskeyScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    eventId?: string;
    brand?: string;
    distillery?: string;
    abv?: string;
    age?: string;
    category?: string;
    country?: string;
    region?: string;
  }>();
  const { eventId } = params;

  const [name, setName] = useState(params.name ?? '');
  const [category, setCategory] = useState<WhiskeyCategory | null>(
    params.category && params.category in CATEGORY_LABELS ? (params.category as WhiskeyCategory) : null,
  );
  const paramCountry = params.country?.toUpperCase() ?? '';
  const paramIsListed = COUNTRIES.some((c) => c.value === paramCountry);
  const [country, setCountry] = useState(paramIsListed ? paramCountry : 'US');
  const [useOther, setUseOther] = useState(!!paramCountry && !paramIsListed);
  const [otherCountry, setOtherCountry] = useState(paramIsListed ? '' : paramCountry);
  const [region, setRegion] = useState(params.region ?? '');
  const [brand, setBrand] = useState(params.brand ?? '');
  const [distillery, setDistillery] = useState(params.distillery ?? '');
  const [age, setAge] = useState(params.age ?? '');
  const [abv, setAbv] = useState(params.abv ?? '');
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [cask, setCask] = useState('');
  const [finish, setFinish] = useState('');
  const [description, setDescription] = useState('');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const create = useCreateWhiskey();

  // Duplicate guard: search the catalog as they type the name.
  const [debounced, setDebounced] = useState(name);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(name), 300);
    return () => clearTimeout(h);
  }, [name]);
  const dupes = useSearch(debounced);
  const suggestions = (dupes.data ?? []).slice(0, 3);

  const imageUrl = imagePath ? publicUrl('whiskey-images', imagePath) : null;

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    try {
      setImagePath(await uploadImage('whiskey-images', res.assets[0].uri, 'image/jpeg'));
    } catch (e) {
      Alert.alert('Could not upload that photo', e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const goRate = (whiskeyId: string) =>
    router.replace({ pathname: '/rate/[whiskeyId]', params: { whiskeyId, ...(eventId ? { eventId } : {}) } });

  const submit = async () => {
    const finalName = name.trim();
    if (!finalName) return Alert.alert('Name it', 'At least give the bottle a name.');
    if (!category) return Alert.alert('Pick a category', 'Bourbon, Scotch single malt, Irish…');
    const code = (useOther ? otherCountry : country).trim().toUpperCase();
    if (code.length !== 2) return Alert.alert('Where is it from?', 'Use a 2-letter country code, e.g. MX.');
    try {
      const created = await create.mutateAsync({
        name: finalName,
        category,
        country: code,
        region: trim(region),
        brand: trim(brand),
        distillery_name: trim(distillery),
        age_years: age.trim() ? num(age) : null,
        abv: num(abv),
        subcategory: subcategory ? subcategory.toLowerCase() : null,
        cask_type: trim(cask),
        finish: trim(finish),
        description: trim(description),
        image_url: imageUrl,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace({
        pathname: '/rate/[whiskeyId]',
        params: { whiskeyId: created.id, ...(eventId ? { eventId } : {}) },
      });
    } catch (e) {
      Alert.alert('Could not add it', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen edges={['bottom']} padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
          keyboardShouldPersistTaps="handled">
          <Section title="The bottle">
            <Field label="Name">
              <Input
                placeholder="e.g. Redbreast 12 Cask Strength"
                value={name}
                onChangeText={setName}
                autoFocus={!params.name}
              />
            </Field>
            <Field label="Brand">
              <Input placeholder="Redbreast" value={brand} onChangeText={setBrand} />
            </Field>
            <Field label="Distillery">
              <Input placeholder="Midleton" value={distillery} onChangeText={setDistillery} />
            </Field>
          </Section>

          {suggestions.length ? (
            <Card style={{ borderColor: t.accent }}>
              <Text variant="caption" muted>
                DID YOU MEAN?
              </Text>
              <Text variant="small" muted style={{ marginBottom: spacing.sm }}>
                Already in the catalog — tap to rate it instead.
              </Text>
              {suggestions.map((w) => (
                <WhiskeyRow key={w.id} whiskey={w} compact onPress={() => goRate(w.id)} />
              ))}
            </Card>
          ) : null}

          <Section title="Category">
            <View style={{ gap: spacing.md }}>
              {CATEGORY_GROUPS.map((group) => (
                <View key={group.label} style={{ gap: spacing.sm }}>
                  <Text variant="caption" muted>
                    {group.label.toUpperCase()}
                  </Text>
                  <View style={styles.wrap}>
                    {group.categories.map((c) => (
                      <Chip
                        key={c}
                        label={CATEGORY_LABELS[c]}
                        selected={category === c}
                        onPress={() => setCategory(category === c ? null : c)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </Section>

          <Section title="Where it's from">
            <Field label="Country">
              <View style={styles.wrap}>
                {COUNTRIES.map((c) => (
                  <Chip
                    key={c.value}
                    label={c.label}
                    selected={!useOther && country === c.value}
                    onPress={() => {
                      setUseOther(false);
                      setCountry(c.value);
                    }}
                  />
                ))}
                <Chip label="Other" selected={useOther} onPress={() => setUseOther(true)} />
              </View>
            </Field>
            {useOther ? (
              <Field label="Country code" hint="Two letters, e.g. MX.">
                <Input
                  placeholder="MX"
                  autoCapitalize="characters"
                  maxLength={2}
                  value={otherCountry}
                  onChangeText={(v) => setOtherCountry(v.toUpperCase())}
                />
              </Field>
            ) : null}
            <Field label="Region">
              <Input placeholder="Islay, Kentucky, Speyside…" value={region} onChangeText={setRegion} />
            </Field>
          </Section>

          <Section title="Specs">
            <Row gap={spacing.md}>
              <View style={{ flex: 1 }}>
                <Field label="Age (years)" hint="Blank = no age statement.">
                  <Input placeholder="12" keyboardType="number-pad" value={age} onChangeText={setAge} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="ABV %">
                  <Input placeholder="46" keyboardType="decimal-pad" value={abv} onChangeText={setAbv} />
                </Field>
              </View>
            </Row>
            <ChipRow
              label="Type"
              options={SUBCATEGORIES.map((s) => ({ value: s, label: s }))}
              value={subcategory}
              onChange={setSubcategory}
            />
            <Field label="Cask type">
              <Input placeholder="First-fill bourbon" value={cask} onChangeText={setCask} />
            </Field>
            <Field label="Finish">
              <Input placeholder="Oloroso sherry" value={finish} onChangeText={setFinish} />
            </Field>
            <Field label="Description">
              <Input
                placeholder="Anything worth knowing"
                value={description}
                onChangeText={setDescription}
                multiline
                style={{ minHeight: 72, textAlignVertical: 'top' }}
              />
            </Field>
          </Section>

          <Section title="Photo">
            <Row gap={spacing.lg}>
              <BottleImage uri={imageUrl} size={72} />
              <Button
                title={imagePath ? 'Replace photo' : 'Add a photo'}
                icon="image-outline"
                variant="secondary"
                loading={uploading}
                style={{ flex: 1 }}
                onPress={pickPhoto}
              />
            </Row>
          </Section>

          <Text variant="small" muted>
            New whiskeys are marked “unverified” until a moderator reviews them. You can rate it and add notes right
            away.
          </Text>
        </ScrollView>
        <StickyFooter>
          <Button title="Add and rate it" loading={create.isPending} onPress={submit} />
        </StickyFooter>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
