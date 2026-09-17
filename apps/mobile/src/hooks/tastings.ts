/**
 * Extra tasting-editor queries that don't exist in src/hooks/index.ts.
 * Photos aren't embedded in `useTasting`, so the editor fetches them here and
 * resolves a signed URL per row (the bucket is private).
 */
import { useQuery } from '@tanstack/react-query';

import { signedUrl } from '@/lib/api';
import { keys } from '@/lib/query';
import { supabase } from '@/lib/supabase';

export interface TastingPhoto {
  id: string;
  storage_path: string;
  sort: number;
  url: string | null;
}

export const tastingPhotoKey = (tastingId: string) => [...keys.tasting(tastingId), 'photos'] as const;

export function useTastingPhotos(tastingId: string | undefined) {
  return useQuery({
    queryKey: tastingPhotoKey(tastingId ?? ''),
    enabled: !!tastingId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TastingPhoto[]> => {
      const { data, error } = await supabase
        .from('tasting_photos')
        .select('id, storage_path, sort')
        .eq('tasting_id', tastingId!)
        .order('sort');
      if (error) throw new Error(error.message);
      return Promise.all(
        (data ?? []).map(async (row) => ({
          ...row,
          url: await signedUrl('tasting-photos', row.storage_path).catch(() => null),
        })),
      );
    },
  });
}
