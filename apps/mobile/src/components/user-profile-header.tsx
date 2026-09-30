import { View } from 'react-native';

import { specialtyLine } from '@/components/expert-card';
import { Appear } from '@/components/motion';
import { Avatar, Button, Card, ExpertBadge, Row, Text } from '@/components/ui';
import type { Profile } from '@/lib/api';
import { compactCount } from '@/lib/format';
import { spacing, useTheme } from '@/theme';

function Count({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text variant="h2">{compactCount(n)}</Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

/** Avatar, names, counts, follow button and the taste-match card. */
export function UserProfileHeader({
  profile,
  isFollowing,
  isPending,
  busy,
  onToggleFollow,
  match,
}: {
  profile: Profile;
  isFollowing: boolean;
  isPending: boolean;
  busy?: boolean;
  onToggleFollow: () => void;
  match?: { common_count: number | null; agreement_pct: number | null } | null;
}) {
  const t = useTheme();
  const showMatch = !!match && (match.common_count ?? 0) >= 2 && match.agreement_pct != null;

  const name = profile.display_name || profile.username;
  const expert = !!profile.expert_since;

  return (
    <View style={{ gap: spacing.lg, paddingTop: spacing.lg }}>
      <Appear style={{ alignItems: 'center', gap: spacing.sm }}>
        <View>
          <Avatar uri={profile.avatar_url} name={name} size={88} />
          {expert ? (
            <ExpertBadge
              compact
              title={profile.expert_title}
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                backgroundColor: t.card,
                borderRadius: 14,
                padding: 4,
              }}
            />
          ) : null}
        </View>
        <Text variant="h2" numberOfLines={1} style={{ marginTop: spacing.xs }}>
          {name}
        </Text>
        <Text variant="small" muted>
          @{profile.username}
        </Text>
        {expert ? (
          <>
            <ExpertBadge title={profile.expert_title} style={{ alignSelf: 'center' }} />
            {profile.expert_specialties.length ? (
              <Text variant="small" muted style={{ textAlign: 'center' }}>
                {specialtyLine(profile.expert_specialties, 6)}
              </Text>
            ) : null}
          </>
        ) : null}
        {profile.bio ? <Text style={{ textAlign: 'center', maxWidth: 340 }}>{profile.bio}</Text> : null}
      </Appear>

      <Row>
        <Count n={profile.rankings_count} label="ranked" />
        <Count n={profile.followers_count} label="followers" />
        <Count n={profile.following_count} label="following" />
      </Row>

      <Button
        title={isFollowing ? 'Following' : isPending ? 'Requested' : 'Follow'}
        variant={isFollowing || isPending ? 'secondary' : 'primary'}
        loading={busy}
        onPress={onToggleFollow}
      />

      {showMatch ? (
        <Card style={{ backgroundColor: t.accentSoft, shadowOpacity: 0, elevation: 0, borderWidth: 0 }}>
          <Text variant="h3">{match!.agreement_pct}% taste match</Text>
          <Text variant="small" muted>
            {match!.common_count} whiskeys in common
          </Text>
        </Card>
      ) : null}
    </View>
  );
}
