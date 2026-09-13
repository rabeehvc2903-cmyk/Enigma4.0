import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from '@supabase/supabase-js';

/**
 * Required environment variables:
 *
 * VITE_SUPABASE_URL=https://yhgwbjvgazighzwkuvje.supabase.co
 * VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
 *
 * VITE_SUPABASE_ANON_KEY is supported temporarily for older projects.
 */

const DEFAULT_SUPABASE_URL = 'https://yhgwbjvgazighzwkuvje.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZ3dianZnYXppZ2h6d2t1dmplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTg4ODMsImV4cCI6MjEwNDY5NDg4M30.NylUgBwDbg7oCHvrH9LuuRQeAh76htNqRGKDMP6mHx4';

const SUPABASE_URL = String(
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL || ''
).trim();

const SUPABASE_KEY = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_KEY ||
    ''
).trim();

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_KEY &&
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('placeholder') &&
    !SUPABASE_KEY.includes('placeholder')
);

export const supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_KEY,
};

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
  );
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://invalid.supabase.co',
  SUPABASE_KEY || 'invalid-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        // Applies to client Broadcast messages.
        // Database change subscriptions are controlled by Realtime.
        eventsPerSecond: 20,
      },
    },
  }
);

/**
 * SQL setup script.
 *
 * Important:
 * This intentionally does not create public read/write policies.
 * Your existing public policies allow anonymous users to modify everything.
 *
 * Create secure RLS policies separately according to your user/admin model.
 */
export const SUPABASE_SETUP_SQL = `
CREATE TABLE IF NOT EXISTS public.fest_data (
  collection_name text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_name, id)
);

CREATE INDEX IF NOT EXISTS idx_fest_data_collection
  ON public.fest_data (collection_name);

ALTER TABLE public.fest_data ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'fest_data'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.fest_data';
  END IF;
END $$;
`;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const collectionKeyMap: Record<string, string> = {
  groups: 'groups',
  profiles: 'profiles',
  competitions: 'competitions',
  registrations: 'registrations',
  results: 'results',
  comments: 'comments',
  notifications: 'notifications',
  event_posters: 'eventPosters',
};

function getStoreKey(collectionName: string): string {
  return collectionKeyMap[collectionName] || collectionName;
}

function getChannelId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();

  if (randomUuid) {
    return randomUuid;
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function sanitizeForSupabase<T = any>(value: T): T {
  if (value === null || value === undefined) {
    return null as T;
  }

  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) => {
      return currentValue === undefined ? null : currentValue;
    })
  );
}

function getRowData(row: any): any {
  return sanitizeForSupabase(row?.data || {});
}

function createUpdatedAt(): string {
  return new Date().toISOString();
}

/* -------------------------------------------------------------------------- */
/* Save operations                                                            */
/* -------------------------------------------------------------------------- */

export async function saveDocToModularCloud(
  collectionName: string,
  docId: string,
  data: any
): Promise<void> {
  if (!isSupabaseConfigured || !collectionName || !docId) {
    return;
  }

  try {
    const updatedAt = createUpdatedAt();

    const cleanData = sanitizeForSupabase({
      ...data,
      id: String(docId),
      _updatedAt: updatedAt,
    });

    const { error } = await supabase
      .from('fest_data')
      .upsert(
        {
          collection_name: collectionName,
          id: String(docId),
          data: cleanData,
          updated_at: updatedAt,
        },
        {
          onConflict: 'collection_name,id',
        }
      );

    if (error) {
      console.warn(
        `Supabase upsert failed for ${collectionName}/${docId}:`,
        error.message
      );
    }
  } catch (error) {
    console.warn(
      `Error writing document ${collectionName}/${docId} to Supabase:`,
      error
    );
  }
}

export async function deleteDocFromModularCloud(
  collectionName: string,
  docId: string
): Promise<void> {
  if (!isSupabaseConfigured || !collectionName || !docId) {
    return;
  }

  try {
    const { error } = await supabase
      .from('fest_data')
      .delete()
      .eq('collection_name', collectionName)
      .eq('id', String(docId));

    if (error) {
      console.warn(
        `Supabase delete failed for ${collectionName}/${docId}:`,
        error.message
      );
    }
  } catch (error) {
    console.warn(
      `Error deleting document ${collectionName}/${docId} from Supabase:`,
      error
    );
  }
}

export async function batchSaveDocsToModularCloud(
  collectionName: string,
  items: any[]
): Promise<void> {
  if (
    !isSupabaseConfigured ||
    !collectionName ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return;
  }

  const chunkSize = 200;

  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    const updatedAt = createUpdatedAt();

    const rows = chunk
      .filter((item) => item?.id !== undefined && item?.id !== null)
      .map((item) => {
        const itemUpdatedAt =
          item._updatedAt ||
          item.updatedAt ||
          item.updated_at ||
          updatedAt;

        return {
          collection_name: collectionName,
          id: String(item.id),
          data: sanitizeForSupabase({
            ...item,
            id: String(item.id),
            _updatedAt: itemUpdatedAt,
          }),
          updated_at: itemUpdatedAt,
        };
      });

    if (rows.length === 0) {
      continue;
    }

    try {
      const { error } = await supabase
        .from('fest_data')
        .upsert(rows, {
          onConflict: 'collection_name,id',
        });

      if (error) {
        console.warn(
          `Supabase batch upsert failed for ${collectionName}:`,
          error.message
        );
      }
    } catch (error) {
      console.warn(
        `Batch write exception for collection ${collectionName}:`,
        error
      );
    }
  }
}

export async function batchDeleteDocsFromModularCloud(
  collectionName: string,
  docIds: string[]
): Promise<void> {
  if (
    !isSupabaseConfigured ||
    !collectionName ||
    !Array.isArray(docIds) ||
    docIds.length === 0
  ) {
    return;
  }

  try {
    const { error } = await supabase
      .from('fest_data')
      .delete()
      .eq('collection_name', collectionName)
      .in('id', docIds.map(String));

    if (error) {
      console.warn(
        `Supabase batch delete failed for ${collectionName}:`,
        error.message
      );
    }
  } catch (error) {
    console.warn(
      `Batch delete exception for ${collectionName}:`,
      error
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export async function saveSettingsToModularCloud(
  settingsData: any
): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  try {
    const updatedAt = createUpdatedAt();

    const cleanSettings = sanitizeForSupabase({
      ...settingsData,
      updatedAt,
      _updatedAt: updatedAt,
    });

    const { error } = await supabase
      .from('fest_data')
      .upsert(
        {
          collection_name: 'fest_settings',
          id: 'general',
          data: cleanSettings,
          updated_at: updatedAt,
        },
        {
          onConflict: 'collection_name,id',
        }
      );

    if (error) {
      console.warn(
        'Error saving fest_settings to Supabase:',
        error.message
      );
    }
  } catch (error) {
    console.warn('Error saving fest_settings to Supabase:', error);
  }
}

/* -------------------------------------------------------------------------- */
/* Full state                                                                  */
/* -------------------------------------------------------------------------- */

export async function pushFullStateToModularCloud(
  state: any
): Promise<void> {
  if (!isSupabaseConfigured || !state) {
    return;
  }

  try {
    const settingsPayload = {
      categories: state.categories,
      stages: state.stages,
      levels: state.levels,
      festivalDays: state.festivalDays,
      brandingConfig: state.brandingConfig,
      countdownConfig: state.countdownConfig,
      socialLinks: state.socialLinks,
      limitRules: state.limitRules,
      participantIdConfig: state.participantIdConfig,
      posterTemplateConfig: state.posterTemplateConfig,
      performancePointConfig: state.performancePointConfig,
      calculateWithPerformancePoints: state.calculateWithPerformancePoints,
      showGroupPointStatus: state.showGroupPointStatus,
      commentSettings: state.commentSettings,
      activeValuationCompIds: state.activeValuationCompIds,
      activeValuationCompId: state.activeValuationCompId,
      updatedAt: state.updatedAt || createUpdatedAt(),
    };

    await saveSettingsToModularCloud(settingsPayload);

    const collections = [
      'groups',
      'profiles',
      'competitions',
      'registrations',
      'results',
      'comments',
      'notifications',
      'eventPosters',
    ];

    for (const collection of collections) {
      const items = Array.isArray(state[collection])
        ? state[collection]
        : [];

      if (items.length > 0) {
        const databaseCollection =
          collection === 'eventPosters'
            ? 'event_posters'
            : collection;

        await batchSaveDocsToModularCloud(
          databaseCollection,
          items
        );
      }
    }
  } catch (error) {
    console.warn('Error pushing full state to Supabase:', error);
  }
}

/* -------------------------------------------------------------------------- */
/* Initial state                                                               */
/* -------------------------------------------------------------------------- */

export async function fetchInitialModularCloudState(): Promise<any | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const { data: rows, error } = await supabase
      .from('fest_data')
      .select('collection_name, id, data, updated_at');

    if (error) {
      console.warn(
        'Supabase initial state fetch error:',
        error.message
      );
      return null;
    }

    if (!rows || rows.length === 0) {
      return null;
    }

    const state: any = {
      groups: [],
      profiles: [],
      competitions: [],
      registrations: [],
      results: [],
      comments: [],
      notifications: [],
      eventPosters: [],
      categories: undefined,
      stages: undefined,
      levels: undefined,
      festivalDays: undefined,
      brandingConfig: undefined,
      countdownConfig: undefined,
      socialLinks: undefined,
      limitRules: undefined,
      participantIdConfig: undefined,
      posterTemplateConfig: undefined,
      performancePointConfig: undefined,
      calculateWithPerformancePoints: undefined,
      showGroupPointStatus: undefined,
      commentSettings: undefined,
      activeValuationCompIds: undefined,
      activeValuationCompId: undefined,
      updatedAt: undefined,
    };

    for (const row of rows) {
      const item = getRowData(row);

      switch (row.collection_name) {
        case 'fest_settings':
          if (row.id === 'general') {
            Object.assign(state, item);
            state.updatedAt =
              item.updatedAt || row.updated_at;
          }
          break;

        case 'groups':
        case 'profiles':
        case 'competitions':
        case 'registrations':
        case 'results':
        case 'comments':
        case 'notifications':
          state[row.collection_name].push(item);
          break;

        case 'event_posters':
          state.eventPosters.push(item);
          break;
      }
    }

    return state;
  } catch (error) {
    console.warn(
      'Failed to fetch state from Supabase:',
      error
    );
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Realtime synchronization                                                     */
/* -------------------------------------------------------------------------- */

let realtimeChannel: RealtimeChannel | null = null;

export function subscribeToModularCloudCollections(
  onUpdate: (type: string, data: any) => void,
  onError?: (error: Error) => void,
  onConnected?: () => void
): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  const channel = supabase
    .channel(`fest_realtime_sync:${getChannelId()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'fest_data',
      },
      (payload) => {
        const eventType = payload.eventType;
        const newRow = payload.new as any;
        const oldRow = payload.old as any;

        if (
          eventType === 'INSERT' ||
          eventType === 'UPDATE'
        ) {
          const collectionName = newRow?.collection_name;

          if (!collectionName) {
            return;
          }

          if (collectionName === 'fest_settings') {
            onUpdate('settings', getRowData(newRow));
            return;
          }

          onUpdate(`single_${getStoreKey(collectionName)}`, {
            action: 'upsert',
            item: getRowData(newRow),
            id: newRow.id,
            updatedAt: newRow.updated_at,
          });

          return;
        }

        if (eventType === 'DELETE') {
          const collectionName = oldRow?.collection_name;

          if (!collectionName) {
            return;
          }

          onUpdate(`single_${getStoreKey(collectionName)}`, {
            action: 'delete',
            id: oldRow.id,
          });
        }
      }
    )
    .subscribe((status, error) => {
      console.log('Supabase Realtime status:', status);

      if (status === 'SUBSCRIBED') {
        onConnected?.();
      }

      if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        onError?.(
          error instanceof Error
            ? error
            : new Error(
                `Realtime connection status: ${status}`
              )
        );
      }
    });

  realtimeChannel = channel;

  return () => {
    if (realtimeChannel === channel) {
      supabase.removeChannel(channel);
      realtimeChannel = null;
    }
  };
}

/**
 * Starts synchronization and refreshes the full state after reconnects.
 */
export async function startSupabaseSync(
  replaceFullState: (state: any) => void,
  applyRealtimeUpdate: (type: string, data: any) => void,
  onError?: (error: Error) => void
): Promise<() => void> {
  const refreshFromDatabase = async () => {
    const freshState =
      await fetchInitialModularCloudState();

    if (freshState) {
      replaceFullState(freshState);
    }
  };

  const unsubscribe =
    subscribeToModularCloudCollections(
      applyRealtimeUpdate,
      onError,
      async () => {
        // Refresh after reconnect to recover missed events.
        await refreshFromDatabase();
      }
    );

  // Initial application load.
  await refreshFromDatabase();

  return unsubscribe;
}

/* -------------------------------------------------------------------------- */
/* Destructive operations                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Deletes every row from fest_data.
 *
 * This is irreversible without a backup.
 */
export async function clearAllModularCloudData(
  confirmation: string
): Promise<void> {
  if (confirmation !== 'DELETE_ALL_FEST_DATA') {
    throw new Error(
      'Deletion blocked. Pass DELETE_ALL_FEST_DATA to confirm.'
    );
  }

  if (!isSupabaseConfigured) {
    return;
  }

  const { error } = await supabase
    .from('fest_data')
    .delete()
    .neq('collection_name', '__never_matches__');

  if (error) {
    throw new Error(
      `Failed to delete all Supabase data: ${error.message}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Compatibility helpers                                                       */
/* -------------------------------------------------------------------------- */

export function isCloudQuotaExhausted(): boolean {
  return false;
}

export function markCloudQuotaExhausted(): void {
  // Supabase does not use the old Firestore quota flag.
}

export function resetCloudQuotaFlag(): void {
  // Supabase does not use the old Firestore quota flag.
}
