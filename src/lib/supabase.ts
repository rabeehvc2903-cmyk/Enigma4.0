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
-- =========================================================================
-- SUPABASE DATABASE SCHEMA & REALTIME CONFIGURATION
-- Madani Art Festival Management System (v2 Clean)
-- =========================================================================

-- 1. Unified festival data table
CREATE TABLE IF NOT EXISTS public.fest_data (
  collection_name text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_name, id)
);

-- 2. Performance index for collection retrieval
CREATE INDEX IF NOT EXISTS idx_fest_data_collection
  ON public.fest_data (collection_name);

-- 3. Replica identity for real-time delete event replication
-- CRITICAL: Without FULL replica identity, PostgreSQL cannot broadcast old row values on DELETE
ALTER TABLE public.fest_data REPLICA IDENTITY FULL;

-- 4. Realtime Publication
-- Enables live WebSocket event streaming across all connected devices
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

-- 5. Row Level Security (RLS) Configuration
-- Grants full SELECT, INSERT, UPDATE, and DELETE permissions to public
ALTER TABLE public.fest_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access to fest_data" ON public.fest_data;

CREATE POLICY "Allow public full access to fest_data"
  ON public.fest_data
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
`;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export const GLOBAL_REALTIME_CHANNEL = 'fest_realtime_global_sync_v2';

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
  state: any,
  providedPushId?: string
): Promise<{ success: boolean; deletedObsolete: number; upserted: number; message: string }> {
  if (!isSupabaseConfigured || !state) {
    return { success: false, deletedObsolete: 0, upserted: 0, message: 'Supabase is not configured' };
  }

  const pushId = providedPushId || `force_push_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const updatedAt = state.updatedAt || createUpdatedAt();

  let deletedCount = 0;
  let upsertedCount = 0;

  try {
    // 1. Inspect existing Supabase rows to identify obsolete items
    const { data: existingRows, error: fetchErr } = await supabase
      .from('fest_data')
      .select('collection_name, id');

    if (fetchErr) {
      console.warn('Could not inspect existing Supabase rows:', fetchErr.message);
    }

    // Active item IDs for each collection
    const activeMap: Record<string, Set<string>> = {
      groups: new Set((state.groups || []).map((x: any) => String(x.id))),
      profiles: new Set((state.profiles || []).map((x: any) => String(x.id))),
      competitions: new Set((state.competitions || []).map((x: any) => String(x.id))),
      registrations: new Set((state.registrations || []).map((x: any) => String(x.id))),
      results: new Set((state.results || []).map((x: any) => String(x.id))),
      comments: new Set((state.comments || []).map((x: any) => String(x.id))),
      notifications: new Set((state.notifications || []).map((x: any) => String(x.id))),
      event_posters: new Set((state.eventPosters || []).map((x: any) => String(x.id))),
      fest_settings: new Set(['general', 'force_push_signal']),
    };

    // Find obsolete items in Supabase that are not in the new active state
    if (existingRows && Array.isArray(existingRows)) {
      const obsoleteByCol: Record<string, string[]> = {};

      for (const row of existingRows) {
        const col = row.collection_name;
        const validSet = activeMap[col];
        if (validSet) {
          if (!validSet.has(String(row.id))) {
            if (!obsoleteByCol[col]) obsoleteByCol[col] = [];
            obsoleteByCol[col].push(String(row.id));
          }
        } else if (col !== 'fest_settings') {
          if (!obsoleteByCol[col]) obsoleteByCol[col] = [];
          obsoleteByCol[col].push(String(row.id));
        }
      }

      // Delete obsolete items from Supabase in batches
      for (const [colName, ids] of Object.entries(obsoleteByCol)) {
        if (ids.length > 0) {
          for (let i = 0; i < ids.length; i += 100) {
            const chunk = ids.slice(i, i + 100);
            const { error: delErr } = await supabase
              .from('fest_data')
              .delete()
              .eq('collection_name', colName)
              .in('id', chunk);

            if (delErr) {
              console.warn(`Could not delete obsolete rows in ${colName}:`, delErr.message);
            } else {
              deletedCount += chunk.length;
            }
          }
        }
      }
    }

    // 2. Batch upsert all current active collections
    const collectionsToUpsert: Array<{ colName: string; items: any[] }> = [
      { colName: 'groups', items: state.groups || [] },
      { colName: 'profiles', items: state.profiles || [] },
      { colName: 'competitions', items: state.competitions || [] },
      { colName: 'registrations', items: state.registrations || [] },
      { colName: 'results', items: state.results || [] },
      { colName: 'comments', items: state.comments || [] },
      { colName: 'notifications', items: state.notifications || [] },
      { colName: 'event_posters', items: state.eventPosters || [] },
    ];

    for (const { colName, items } of collectionsToUpsert) {
      if (items.length > 0) {
        await batchSaveDocsToModularCloud(colName, items);
        upsertedCount += items.length;
      }
    }

    // 3. Save settings with force-push markers
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
      updatedAt,
      forcePushId: pushId,
      forcePushTimestamp: updatedAt,
    };

    await saveSettingsToModularCloud(settingsPayload);
    upsertedCount++;

    // 4. Upsert dedicated force_push_signal row to guarantee postgres_changes fires on all clients
    const signalPayload = {
      pushId,
      timestamp: Date.now(),
      updatedAt,
      action: 'force_replace_all_devices',
    };
    const { error: signalErr } = await supabase.from('fest_data').upsert(
      {
        collection_name: 'fest_settings',
        id: 'force_push_signal',
        data: signalPayload,
        updated_at: updatedAt,
      },
      { onConflict: 'collection_name,id' }
    );
    if (signalErr) {
      console.warn('Error saving force_push_signal:', signalErr.message);
    } else {
      upsertedCount++;
    }

    // 5. Broadcast real-time message across all active devices via the global channel
    const channelToUse = realtimeChannel || supabase.channel(GLOBAL_REALTIME_CHANNEL);
    try {
      await channelToUse.send({
        type: 'broadcast',
        event: 'force_push_full_state',
        payload: {
          pushId,
          timestamp: Date.now(),
          fullState: state,
        },
      });
    } catch (bcErr) {
      console.warn('Realtime channel broadcast warning:', bcErr);
    }

    return {
      success: true,
      deletedObsolete: deletedCount,
      upserted: upsertedCount,
      message: 'Successfully force-pushed state to cloud and signaled all devices',
    };
  } catch (error: any) {
    console.error('Error pushing full state to Supabase:', error);
    return {
      success: false,
      deletedObsolete: deletedCount,
      upserted: upsertedCount,
      message: error?.message || 'Error pushing to cloud',
    };
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
      forcePushId: undefined,
    };

    for (const row of rows) {
      const item = getRowData(row);

      switch (row.collection_name) {
        case 'fest_settings':
          if (row.id === 'general') {
            Object.assign(state, item);
            state.updatedAt = item.updatedAt || row.updated_at;
            state.forcePushId = item.forcePushId;
          } else if (row.id === 'force_push_signal') {
            state.latestSignalPushId = item.pushId;
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
  onConnected?: () => void,
  onForceReplace?: (fullState: any, pushId?: string) => void
): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  const channel = supabase
    .channel(GLOBAL_REALTIME_CHANNEL, {
      config: {
        broadcast: { ack: true },
      },
    })
    .on('broadcast', { event: 'force_push_full_state' }, (msg: any) => {
      console.log('Received real-time FORCE PUSH broadcast from cloud admin:', msg);
      if (msg?.payload?.fullState) {
        onForceReplace?.(msg.payload.fullState, msg.payload.pushId);
      }
    })
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

          // Check if this is the dedicated force push signal
          if (collectionName === 'fest_settings' && newRow.id === 'force_push_signal') {
            const signalData = getRowData(newRow);
            if (signalData?.pushId) {
              onUpdate('force_push_signal', signalData);
            }
            return;
          }

          if (collectionName === 'fest_settings') {
            const sData = getRowData(newRow);
            if (sData?.forcePushId) {
              onUpdate('force_push_signal', sData);
            }
            onUpdate('settings', sData);
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
  replaceFullState: (state: any, pushId?: string) => void,
  applyRealtimeUpdate: (type: string, data: any) => void,
  onError?: (error: Error) => void
): Promise<() => void> {
  const refreshFromDatabase = async (pushId?: string) => {
    const freshState =
      await fetchInitialModularCloudState();

    if (freshState) {
      replaceFullState(freshState, pushId);
    }
  };

  const unsubscribe =
    subscribeToModularCloudCollections(
      (type, data) => {
        if (type === 'force_push_signal') {
          console.log('Detected force_push_signal, refreshing full state from database to replace all local data...');
          refreshFromDatabase(data?.pushId);
        } else {
          applyRealtimeUpdate(type, data);
        }
      },
      onError,
      async () => {
        // Refresh after reconnect to recover missed events.
        await refreshFromDatabase();
      },
      (fullState, pushId) => {
        console.log('Applying direct broadcast full state replacement across device...');
        replaceFullState(fullState, pushId);
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
