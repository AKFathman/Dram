import { View } from 'react-native';

import { Avatar, Button, Card, Row, Text } from '@/components/ui';
import type { Profile } from '@/lib/api';
import { spacing, useTheme } from '@/theme';

function Count({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 72 }}>
      <Text variant="h3">{n}</Text>
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

  return (
    <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
      <Row gap={spacing.lg} style={{ alignItems: 'flex-start' }}>
        <Avatar uri={profile.avatar_url} name={profile.display_name || profile.username} size={72} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h2" numberOfLines={1}>
            {profile.display_name || profile.username}
          </Text>
          <Text variant="small" muted>
            @{profile.username}
          </Text>
          {profile.bio ? <Text variant="small">{profile.bio}</Text> : null}
        </View>
      </Row>

      <Row style={{ justifyContent: 'space-around' }}>
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
        <Card style={{ backgroundColor: t.accentSoft, borderColor: t.accentSoft }}>
          <Text variant="h3">{match!.agreement_pct}% taste match</Text>
          <Text variant="small" muted>
            {match!.common_count} whiskeys in common
          </Text>
        </Card>
      ) : null}
    </View>
  );
}
