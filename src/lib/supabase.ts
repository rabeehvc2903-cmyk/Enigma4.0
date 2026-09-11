import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// Default project credentials provided by user
const DEFAULT_SUPABASE_URL = 'https://yhgwbjvgazighzwkuvje.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZ3dianZnYXppZ2h6d2t1dmplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTg4ODMsImV4cCI6MjEwNDY5NDg4M30.NylUgBwDbg7oCHvrH9LuuRQeAh76htNqRGKDMP6mHx4';

// Environment variables for Supabase with fallback and typo sanitization
function resolveSupabaseUrl(): string {
  let raw = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL || '').trim();
  if (raw.startsWith('https:https://')) {
    raw = raw.replace('https:https://', 'https://');
  } else if (raw.startsWith('http:http://')) {
    raw = raw.replace('http:http://', 'http://');
  }
  return raw;
}

const envUrl = resolveSupabaseUrl();
const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  envUrl &&
  envAnonKey &&
  !envUrl.includes('placeholder') &&
  !envAnonKey.includes('placeholder') &&
  envUrl.startsWith('https://')
);

export const supabaseConfig = {
  url: envUrl,
  anonKey: envAnonKey
};

let supabase: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;

if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 20
        }
      },
      auth: {
        persistSession: false
      }
    });
  } catch (err) {
    console.warn('Supabase initialization error:', err);
  }
}

export { supabase };

/**
 * SQL Schema script to run in Supabase SQL Editor.
 * Creates the high-performance JSONB storage table with Realtime enabled.
 */
export const SUPABASE_SETUP_SQL = `-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Create the main fest_data storage table
CREATE TABLE IF NOT EXISTS public.fest_data (
    collection_name text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (collection_name, id)
);

-- 2. Create index on collection_name for rapid filtering
CREATE INDEX IF NOT EXISTS idx_fest_data_collection ON public.fest_data (collection_name);

-- 3. Enable Row Level Security (RLS) and allow public read/write for fest operations
ALTER TABLE public.fest_data ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'fest_data' AND policyname = 'Allow public read access'
    ) THEN
        CREATE POLICY "Allow public read access" ON public.fest_data FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'fest_data' AND policyname = 'Allow public write access'
    ) THEN
        CREATE POLICY "Allow public write access" ON public.fest_data FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Enable Supabase Realtime for fest_data
ALTER PUBLICATION supabase_realtime ADD TABLE public.fest_data;
`;

// Helper to sanitize payload (remove undefined, fix deep objects)
export function sanitizeForSupabase(obj: any): any {
  if (obj === null || obj === undefined) return null;
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value === undefined) return null;
    return value;
  }));
}

/**
 * Save an individual document to Supabase (upsert)
 */
export async function saveDocToModularCloud(collectionName: string, docId: string, data: any): Promise<void> {
  if (!supabase || !isSupabaseConfigured || !docId) return;
  try {
    const cleanData = sanitizeForSupabase({
      ...data,
      id: docId,
      _updatedAt: new Date().toISOString()
    });

    const { error } = await supabase
      .from('fest_data')
      .upsert({
        collection_name: collectionName,
        id: String(docId),
        data: cleanData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'collection_name,id'
      });

    if (error) {
      console.warn(`Supabase upsert failed for ${collectionName}/${docId}:`, error.message);
    }
  } catch (err) {
    console.warn(`Error writing document ${collectionName}/${docId} to Supabase:`, err);
  }
}

/**
 * Delete an individual document from Supabase
 */
export async function deleteDocFromModularCloud(collectionName: string, docId: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured || !docId) return;
  try {
    const { error } = await supabase
      .from('fest_data')
      .delete()
      .match({
        collection_name: collectionName,
        id: String(docId)
      });

    if (error) {
      console.warn(`Supabase delete failed for ${collectionName}/${docId}:`, error.message);
    }
  } catch (err) {
    console.warn(`Error deleting document ${collectionName}/${docId} from Supabase:`, err);
  }
}

/**
 * Batch save multiple documents to Supabase
 */
export async function batchSaveDocsToModularCloud(collectionName: string, items: any[]): Promise<void> {
  if (!supabase || !isSupabaseConfigured || !Array.isArray(items) || items.length === 0) return;
  const CHUNK_SIZE = 200;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const rows = chunk.map(item => ({
      collection_name: collectionName,
      id: String(item.id),
      data: sanitizeForSupabase({
        ...item,
        _updatedAt: item._updatedAt || item.updatedAt || new Date().toISOString()
      }),
      updated_at: new Date().toISOString()
    }));

    try {
      const { error } = await supabase
        .from('fest_data')
        .upsert(rows, {
          onConflict: 'collection_name,id'
        });

      if (error) {
        console.warn(`Supabase batch upsert failed for ${collectionName}:`, error.message);
      }
    } catch (err) {
      console.warn(`Batch write exception for collection ${collectionName}:`, err);
    }
  }
}

/**
 * Batch delete multiple documents from Supabase
 */
export async function batchDeleteDocsFromModularCloud(collectionName: string, docIds: string[]): Promise<void> {
  if (!supabase || !isSupabaseConfigured || !Array.isArray(docIds) || docIds.length === 0) return;
  try {
    const { error } = await supabase
      .from('fest_data')
      .delete()
      .eq('collection_name', collectionName)
      .in('id', docIds.map(String));

    if (error) {
      console.warn(`Supabase batch delete failed for ${collectionName}:`, error.message);
    }
  } catch (err) {
    console.warn(`Batch delete exception for collection ${collectionName}:`, err);
  }
}

/**
 * Save fest settings document to Supabase
 */
export async function saveSettingsToModularCloud(settingsData: any): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  try {
    const clean = sanitizeForSupabase({
      ...settingsData,
      updatedAt: new Date().toISOString()
    });

    const { error } = await supabase
      .from('fest_data')
      .upsert({
        collection_name: 'fest_settings',
        id: 'general',
        data: clean,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'collection_name,id'
      });

    if (error) {
      console.warn('Error saving fest_settings to Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Error saving fest_settings to Supabase:', err);
  }
}

/**
 * Push entire state to Supabase
 */
export async function pushFullStateToModularCloud(state: any): Promise<void> {
  if (!supabase || !isSupabaseConfigured || !state) return;
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
      showGroupPointStatus: state.showGroupPointStatus,
      commentSettings: state.commentSettings,
      activeValuationCompIds: state.activeValuationCompIds,
      activeValuationCompId: state.activeValuationCompId,
      updatedAt: state.updatedAt || new Date().toISOString()
    };

    await saveSettingsToModularCloud(settingsPayload);

    if (Array.isArray(state.groups) && state.groups.length > 0) {
      await batchSaveDocsToModularCloud('groups', state.groups);
    }
    if (Array.isArray(state.profiles) && state.profiles.length > 0) {
      await batchSaveDocsToModularCloud('profiles', state.profiles);
    }
    if (Array.isArray(state.competitions) && state.competitions.length > 0) {
      await batchSaveDocsToModularCloud('competitions', state.competitions);
    }
    if (Array.isArray(state.registrations) && state.registrations.length > 0) {
      await batchSaveDocsToModularCloud('registrations', state.registrations);
    }
    if (Array.isArray(state.results) && state.results.length > 0) {
      await batchSaveDocsToModularCloud('results', state.results);
    }
    if (Array.isArray(state.comments) && state.comments.length > 0) {
      await batchSaveDocsToModularCloud('comments', state.comments);
    }
    if (Array.isArray(state.notifications) && state.notifications.length > 0) {
      await batchSaveDocsToModularCloud('notifications', state.notifications);
    }
    if (Array.isArray(state.eventPosters) && state.eventPosters.length > 0) {
      await batchSaveDocsToModularCloud('event_posters', state.eventPosters);
    }
  } catch (err) {
    console.warn('Error pushing full state to Supabase:', err);
  }
}

/**
 * Fetch initial modular state from Supabase once
 */
export async function fetchInitialModularCloudState(): Promise<any | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  try {
    const { data: rows, error } = await supabase
      .from('fest_data')
      .select('*');

    if (error) {
      console.warn('Supabase fetch initial state error:', error.message);
      return null;
    }

    if (!rows || rows.length === 0) {
      return null;
    }

    const groups: any[] = [];
    const profiles: any[] = [];
    const competitions: any[] = [];
    const registrations: any[] = [];
    const results: any[] = [];
    const comments: any[] = [];
    const notifications: any[] = [];
    const eventPosters: any[] = [];
    let settingsData: any = null;

    for (const row of rows) {
      const item = row.data || {};
      switch (row.collection_name) {
        case 'groups':
          groups.push(item);
          break;
        case 'profiles':
          profiles.push(item);
          break;
        case 'competitions':
          competitions.push(item);
          break;
        case 'registrations':
          registrations.push(item);
          break;
        case 'results':
          results.push(item);
          break;
        case 'comments':
          comments.push(item);
          break;
        case 'notifications':
          notifications.push(item);
          break;
        case 'event_posters':
          eventPosters.push(item);
          break;
        case 'fest_settings':
          if (row.id === 'general') {
            settingsData = item;
          }
          break;
      }
    }

    const mergedState: any = {
      groups,
      profiles,
      competitions,
      registrations,
      results,
      comments,
      notifications,
      eventPosters,
      categories: settingsData?.categories,
      stages: settingsData?.stages,
      levels: settingsData?.levels,
      festivalDays: settingsData?.festivalDays,
      brandingConfig: settingsData?.brandingConfig,
      countdownConfig: settingsData?.countdownConfig,
      socialLinks: settingsData?.socialLinks,
      limitRules: settingsData?.limitRules,
      participantIdConfig: settingsData?.participantIdConfig,
      posterTemplateConfig: settingsData?.posterTemplateConfig,
      performancePointConfig: settingsData?.performancePointConfig,
      showGroupPointStatus: settingsData?.showGroupPointStatus,
      commentSettings: settingsData?.commentSettings,
      activeValuationCompIds: settingsData?.activeValuationCompIds,
      activeValuationCompId: settingsData?.activeValuationCompId,
      updatedAt: settingsData?.updatedAt || new Date().toISOString()
    };

    return mergedState;
  } catch (err) {
    console.warn('Failed to fetch state from Supabase:', err);
    return null;
  }
}

/**
 * Real-time subscription for Supabase
 */
export function subscribeToModularCloudCollections(
  onUpdate: (type: string, data: any) => void,
  onError?: (error: any) => void
): () => void {
  if (!supabase || !isSupabaseConfigured) return () => {};

  try {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase
      .channel('fest_realtime_sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fest_data'
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const colName = newRow?.collection_name;
            const data = newRow?.data;
            if (colName === 'fest_settings') {
              onUpdate('settings', data);
            } else {
              const keyMap: Record<string, string> = {
                groups: 'groups',
                profiles: 'profiles',
                competitions: 'competitions',
                registrations: 'registrations',
                results: 'results',
                comments: 'comments',
                notifications: 'notifications',
                event_posters: 'eventPosters'
              };
              const storeKey = keyMap[colName] || colName;
              onUpdate(`single_${storeKey}`, { action: 'upsert', item: data, id: newRow?.id });
            }
          } else if (eventType === 'DELETE') {
            const colName = oldRow?.collection_name;
            const id = oldRow?.id;
            const keyMap: Record<string, string> = {
              groups: 'groups',
              profiles: 'profiles',
              competitions: 'competitions',
              registrations: 'registrations',
              results: 'results',
              comments: 'comments',
              notifications: 'notifications',
              event_posters: 'eventPosters'
            };
            const storeKey = keyMap[colName] || colName;
            onUpdate(`single_${storeKey}`, { action: 'delete', id });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Supabase Realtime Channel connected successfully.');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('Supabase Realtime Channel Error.');
          if (onError) onError(new Error('Supabase Realtime subscription error.'));
        }
      });

    return () => {
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    };
  } catch (err) {
    console.warn('Supabase real-time subscription setup error:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Clear all records from Supabase fest_data table
 */
export async function clearAllModularCloudData(): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  try {
    const { error } = await supabase
      .from('fest_data')
      .delete()
      .neq('collection_name', '__non_existent_key__');

    if (error) {
      console.warn('Error clearing Supabase fest_data:', error.message);
    }
  } catch (err) {
    console.warn('Error clearing all Supabase data:', err);
  }
}

// Quota compatibility helpers (Supabase does not have restrictive Firestore daily write limits on standard tiers)
export function isCloudQuotaExhausted(): boolean {
  return false;
}
export function markCloudQuotaExhausted(): void {}
export function resetCloudQuotaFlag(): void {}
