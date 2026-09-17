/**
 * The rating flow: tier → head-to-head comparisons → save → where it landed.
 * This file owns the state machine; the two picker UIs live in components/rate-*.
 */
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { RateComparison } from '@/components/rate-comparison';
import { RateTierPicker } from '@/components/rate-tier-picker';
import { BottleImage, Button, Card, ErrorState, Loading, Row, ScoreBadge, Screen, Spacer, Text } from '@/components/ui';
import {
  useCreateTasting,
  useMyEventTastings,
  useMyRankingFor,
  useMyRankings,
  useRemoveRanking,
  useTierCandidates,
  useUpsertRanking,
  useWhiskey,
} from '@/hooks';
import { categoryLabel, whiskeySubtitle, type RankingView, type RankingWithWhiskey } from '@/lib/api';
import { answer, formatScore, maxQuestions, nextCandidate, startSession, type Answer, type Session, type Tier } from '@/lib/ranking';
import { spacing, useTheme } from '@/theme';

type Candidate = RankingWithWhiskey & { score: number; overallRank: number };

export default function RateScreen() {
  const t = useTheme();
  const router = useRouter();
  const { whiskeyId, eventId, preferIds } = useLocalSearchParams<{ whiskeyId: string; eventId?: string; preferIds?: string }>();

  const whiskeyQ = useWhiskey(whiskeyId);
  const rankings = useMyRankings();
  const { ranking: existing } = useMyRankingFor(whiskeyId);
  const eventTastings = useMyEventTastings(eventId);
  const upsert = useUpsertRanking();
  const createTasting = useCreateTasting();
  const removeRanking = useRemoveRanking();

  const preferIdsArray = useMemo(
    () => (preferIds ? preferIds.split(',').map((s) => s.trim()).filter(Boolean) : null),
    [preferIds],
  );

  const [tier, setTier] = useState<Tier | null>(null);
  const [session, setSession] = useState<Session<string> | null>(null);
  const [pool, setPool] = useState<Candidate[]>([]);
  const [history, setHistory] = useState<Session<string>[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<RankingView | null>(null);
  const savingRef = useRef(false);

  const candidates = useTierCandidates(tier, whiskeyId, preferIdsArray);
  const shownTier = tier ?? existing?.tier ?? null;

  // A tier was tapped — freeze the candidate pool and open a session over it.
  useEffect(() => {
    if (!tier || session || result) return;
    setPool(candidates);
    setSession(startSession(candidates.map((c) => c.whiskey_id)));
  }, [tier, session, result, candidates]);

  // The binary search finished — write it to the server.
  useEffect(() => {
    if (!session?.done || !tier || result || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const prev = history[history.length - 1] ?? null;
    void (async () => {
      try {
        const row = await upsert.mutateAsync({
          whiskeyId,
          tier,
          position: session.position,
          eventId,
          comparisons: session.comparisons.map((c) => ({ winner: c.winner, loser: c.loser })),
        });
        if (eventId) {
          const rows = eventTastings.data ?? (await eventTastings.refetch()).data ?? [];
          if (!rows.some((r) => r.whiskey_id === whiskeyId)) {
            await createTasting.mutateAsync({ whiskey_id: whiskeyId, event_id: eventId, setting: 'event' });
          }
        }
        setResult(row);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (e) {
        Alert.alert('Could not save your rating', e instanceof Error ? e.message : String(e));
        setSession(prev);
        setHistory((h) => h.slice(0, -1));
        if (!prev) setTier(null);
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tier, result, whiskeyId, eventId]);

  const whiskey = whiskeyQ.data;
  if (whiskeyQ.isLoading) return <Loading />;
  if (whiskeyQ.isError || !whiskey) {
    return (
      <Screen>
        <ErrorState error={whiskeyQ.error ?? new Error('Whiskey not found')} retry={() => whiskeyQ.refetch()} />
      </Screen>
    );
  }

  const onAnswer = (a: Answer) => {
    if (!session) return;
    setHistory((h) => [...h, session]);
    setSession(answer(session, whiskeyId, a));
  };

  const backToTier = () => {
    setSession(null);
    setPool([]);
    setHistory([]);
    setTier(null);
  };

  const pickTier = (next: Tier) => {
    Haptics.selectionAsync().catch(() => {});
    setTier(next);
  };

  const confirmRemove = () =>
    Alert.alert('Remove from my list?', `${whiskey.name} will be taken off your ranking.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removeRanking.mutate(whiskeyId, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('Could not remove it', e instanceof Error ? e.message : String(e)),
          }),
      },
    ]);

  const rankWithin = (pred: (r: Candidate) => boolean) => {
    const group = rankings.list.filter(pred);
    if (group.length <= 1) return null;
    const i = group.findIndex((r) => r.whiskey_id === whiskeyId);
    return i < 0 ? null : i + 1;
  };

  const currentId = session && !session.done ? nextCandidate(session) : null;
  const currentCandidate = currentId
    ? pool.find((c) => c.whiskey_id === currentId) ?? candidates.find((c) => c.whiskey_id === currentId) ?? null
    : null;
  const categoryRank = rankWithin((r) => r.whiskey.category === whiskey.category);
  const regionRank = whiskey.region ? rankWithin((r) => r.whiskey.region === whiskey.region) : null;

  const step: 'result' | 'saving' | 'compare' | 'lost' | 'tier' = result
    ? 'result'
    : saving || session?.done
      ? 'saving'
      : session && currentCandidate
        ? 'compare'
        : session
          ? 'lost'
          : 'tier';

  return (
    <Screen scroll edges={['bottom']}>
      <Spacer h={spacing.md} />
      <Card>
        <Row gap={spacing.lg}>
          <BottleImage uri={whiskey.image_url} size={64} />
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
      <Spacer h={spacing.lg} />

      {step === 'result' && result ? (
        <View style={{ gap: spacing.lg, alignItems: 'center' }}>
          <ScoreBadge score={result.score} size="lg" />
          <View style={{ gap: spacing.xs, alignItems: 'center' }}>
            <Text variant="h2">Nice — it&apos;s on your list</Text>
            <Text muted>
              #{result.overall_rank} of {result.total} overall
            </Text>
            {categoryRank ? (
              <Text muted>
                #{categoryRank} {categoryLabel(whiskey.category)}
              </Text>
            ) : null}
            {regionRank && whiskey.region ? (
              <Text muted>
                #{regionRank} in {whiskey.region}
              </Text>
            ) : null}
          </View>
          <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md }}>
            <Button
              title="Add tasting notes"
              icon="create-outline"
              onPress={() =>
                router.replace({
                  pathname: '/tasting/[id]',
                  params: { id: 'new', whiskeyId, ...(eventId ? { eventId } : {}) },
                })
              }
            />
            <Button
              title="Done"
              variant="secondary"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          </View>
        </View>
      ) : step === 'saving' ? (
        <View>
          <Loading />
          <Text muted style={{ textAlign: 'center' }}>
            Saving your rating…
          </Text>
        </View>
      ) : step === 'compare' && session && currentCandidate ? (
        <RateComparison
          subject={whiskey}
          candidate={currentCandidate.whiskey}
          candidateScore={currentCandidate.score}
          asked={session.asked}
          total={maxQuestions(session.candidates.length)}
          onAnswer={onAnswer}
          onBack={backToTier}
        />
      ) : step === 'lost' ? (
        <ErrorState error={new Error('That comparison is no longer available.')} retry={backToTier} />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="h2">How was it?</Text>
            {existing ? (
              <Text variant="small" muted>
                Currently #{existing.overallRank} · {formatScore(existing.score)}
              </Text>
            ) : (
              <Text variant="small" muted>
                Pick a gut reaction — we&apos;ll work out the number.
              </Text>
            )}
          </View>
          <RateTierPicker value={shownTier} onSelect={pickTier} />
          {existing ? (
            <Pressable onPress={confirmRemove} accessibilityRole="button" hitSlop={8}>
              <Text variant="small" style={{ textAlign: 'center', color: t.danger }}>
                Remove from my list
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <Spacer h={spacing.xl} />
    </Screen>
  );
}
