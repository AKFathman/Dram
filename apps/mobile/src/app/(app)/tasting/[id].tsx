/**
 * Tasting note editor. `/tasting/new?whiskeyId=` creates; `/tasting/<uuid>`
 * edits. This file only resolves the data — the form itself is a component so
 * every field can seed from the loaded row on mount.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { TastingForm } from '@/components/tasting-form';
import { ErrorState, Loading, Screen } from '@/components/ui';
import { useTasting, useWhiskey } from '@/hooks';

export default function TastingEditorScreen() {
  const router = useRouter();
  const { id, whiskeyId, eventId } = useLocalSearchParams<{ id: string; whiskeyId?: string; eventId?: string }>();
  const isNew = id === 'new';

  const tastingQ = useTasting(isNew ? undefined : id);
  const tasting = tastingQ.data ?? null;
  const targetWhiskeyId = whiskeyId ?? tasting?.whiskey_id;
  const whiskeyQ = useWhiskey(targetWhiskeyId);

  if (isNew && !targetWhiskeyId) {
    return (
      <Screen>
        <ErrorState error={new Error('Pick a whiskey first.')} retry={() => router.replace('/log')} />
      </Screen>
    );
  }
  if (!isNew) {
    if (tastingQ.isLoading) return <Loading />;
    if (tastingQ.isError || !tasting) {
      return (
        <Screen>
          <ErrorState error={tastingQ.error ?? new Error('Tasting not found')} retry={() => tastingQ.refetch()} />
        </Screen>
      );
    }
  }

  return (
    <TastingForm
      tastingId={isNew ? null : id}
      initial={tasting}
      whiskey={whiskeyQ.data ?? tasting?.whiskey ?? null}
      whiskeyId={targetWhiskeyId!}
      eventId={eventId}
    />
  );
}
