import { Group, Competition, CompType, UserProfile, Registration, Result, LeaderboardEntry, CategoryType, EventPoster, CountdownConfig, BrandingConfig, SocialLinksConfig, CommentItem, CommentSettings, FestNotification, ParticipantIdConfig, PosterTemplateConfig, StageItem, PerformancePointConfig, PerformancePointRule, LimitRulesConfig, CategoryLimitRule, WinnerDetail } from '../types';
import { 
  DEFAULT_CATEGORIES, 
  DEFAULT_STAGES, 
  DEFAULT_LEVELS, 
  INITIAL_GROUPS, 
  INITIAL_PROFILES, 
  INITIAL_COMPETITIONS, 
  INITIAL_REGISTRATIONS, 
  INITIAL_RESULTS, 
  INITIAL_POSTERS 
} from './defaultData';
import { FestivalDay, DEFAULT_FESTIVAL_DAYS, formatDayDateWithWeekday, normalizeScheduleString } from './scheduler';
import { 
  isSupabaseConfigured, 
  subscribeToModularCloudCollections, 
  pushFullStateToModularCloud, 
  fetchInitialModularCloudState,
  startSupabaseSync,
  saveDocToModularCloud,
  deleteDocFromModularCloud,
  batchSaveDocsToModularCloud,
  batchDeleteDocsFromModularCloud,
  clearAllModularCloudData,
  saveSettingsToModularCloud,
  isCloudQuotaExhausted,
  markCloudQuotaExhausted,
  resetCloudQuotaFlag
} from './supabase';

export { startSupabaseSync };
import { getParticipantPhoto } from './avatarUtils';

const STORE_KEY = 'madani_art_fest_v2_clean';
const LEGACY_KEYS = ['madani_art_fest_v1', 'fest_manager_store', 'festival_desk_data'];

export const DEFAULT_LIMIT_RULES: LimitRulesConfig = {
  defaultStageLimit: 3,
  defaultOffStageLimit: 5,
  categoryLimits: {
    'Junior': { stage: 4, offStage: 5 },
    'Senior': { stage: 3, offStage: 5 },
    'Sub Junior': { stage: 3, offStage: 5 },
    'Sub-Junior': { stage: 3, offStage: 5 },
    'General': { stage: 3, offStage: 5 },
  }
};

export function formatStageName(venue: string | undefined | null): string {
  if (!venue) return '';
  const trimmed = String(venue).trim();
  if (!trimmed) return '';
  if (/^\d+$/.test(trimmed)) {
    return `Stage ${trimmed}`;
  }
  if (/^stage\s*(\d+)(.*)$/i.test(trimmed)) {
    return trimmed.replace(/^stage\s*(\d+)(.*)$/i, (_, num, rest) => `Stage ${num}${rest}`);
  }
  return trimmed;
}

export function areStageNamesEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  const trimA = String(a).trim().toLowerCase();
  const trimB = String(b).trim().toLowerCase();
  if (trimA === trimB) return true;
  return formatStageName(trimA).toLowerCase() === formatStageName(trimB).toLowerCase();
}

export function cleanCompetitionBaseName(name: string | undefined | null): string {
  if (!name) return '';
  return String(name).replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function formatCompetitionName(name: string | undefined | null, category?: string | undefined | null): string {
  if (!name) return '';
  const cleanBase = cleanCompetitionBaseName(name);
  const trimmedCat = category ? String(category).trim() : '';

  if (!trimmedCat || trimmedCat.toLowerCase() === 'all') {
    return cleanBase || String(name).trim();
  }

  return `${cleanBase || String(name).trim()} (${trimmedCat})`;
}

export function formatParticipantFullName(name?: string | null, fatherName?: string | null): string {
  if (!name) return '';
  const trimmedName = String(name).trim();
  if (!fatherName || !String(fatherName).trim()) return trimmedName;
  const trimmedFather = String(fatherName).trim();
  // Avoid duplicating fatherName if name already ends with it
  if (trimmedName.toLowerCase().endsWith(trimmedFather.toLowerCase())) {
    return trimmedName;
  }
  return `${trimmedName} ${trimmedFather}`;
}

export function ensureSystemProfiles(profilesList: UserProfile[] | undefined | null): UserProfile[] {
  const list = Array.isArray(profilesList) ? [...profilesList] : [];
  if (!list.some(p => p.role === 'admin' || p.userId === 'admin')) {
    list.unshift({
      id: 'usr-admin',
      userId: 'admin',
      password: 'admin123',
      name: 'Festival Convener (Admin)',
      role: 'admin',
      created_at: new Date().toISOString()
    });
  }
  if (!list.some(p => p.role === 'judge' || p.userId === 'judge')) {
    list.push({
      id: 'usr-judge',
      userId: 'judge',
      password: 'judge123',
      name: 'Official Fest Judge',
      role: 'judge',
      created_at: new Date().toISOString()
    });
  }
  if (!list.some(p => p.role === 'media' || p.userId === 'media')) {
    list.push({
      id: 'usr-media',
      userId: 'media',
      password: 'media123',
      name: 'Press & Media Desk',
      role: 'media',
      created_at: new Date().toISOString()
    });
  }
  return list;
}

interface StoreData {
  groups: Group[];
  profiles: UserProfile[];
  competitions: Competition[];
  registrations: Registration[];
  results: Result[];
  categories?: string[];
  stages?: (string | StageItem)[];
  levels?: string[];
  eventPosters?: EventPoster[];
  countdownConfig?: CountdownConfig;
  brandingConfig?: BrandingConfig;
  socialLinks?: SocialLinksConfig;
  participantIdConfig?: ParticipantIdConfig;
  commentSettings?: CommentSettings;
  comments?: CommentItem[];
  notifications?: FestNotification[];
  hasUnreadNotifications?: boolean;
  activeValuationCompId?: string;
  activeValuationCompIds?: string[];
  posterTemplateConfig?: PosterTemplateConfig;
  performancePointConfig?: PerformancePointConfig;
  festivalDays?: FestivalDay[];
  stageCategoryMapping?: Record<string, string[]>;
  limitRules?: LimitRulesConfig;
  showGroupPointStatus?: boolean;
  calculateWithPerformancePoints?: boolean;
  updatedAt?: string;
}

const INITIAL_NOTIFICATIONS: FestNotification[] = [];
const INITIAL_COMMENTS: CommentItem[] = [];

class FestStore {
  private listeners: (() => void)[] = [];
  private isSyncingFromCloud = false;
  private hasReceivedCloudData = false;
  private isInitialCloudSyncResolved = false;
  private isDeviceFresh = false;
  private isQuotaExceeded = false;
  private cloudError: string | null = null;
  private cloudStatus: 'disconnected' | 'connected' | 'error' | 'initializing' | 'quota-exceeded' = isSupabaseConfigured ? 'initializing' : 'disconnected';
  private unsubscribeSnapshot: (() => void) | null = null;
  private inMemoryState: StoreData | null = null;
  private lastSyncedState: StoreData | null = null;
  private syncDebounceTimer: any = null;
  private isPushingToCloud = false;
  private hasPendingPush = false;
  private lastProcessedPushId: string | null = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      try {
        LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
      } catch {}
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
    let loadedState: StoreData | null = null;
    if (raw) {
      try {
        loadedState = JSON.parse(raw);
      } catch {
        loadedState = null;
      }
    }

    if (!loadedState) {
      this.isDeviceFresh = true;
      this.inMemoryState = this.getDefaultData();
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(this.inMemoryState));
        } catch {}
      }
    } else {
      this.isDeviceFresh = false;
      this.inMemoryState = loadedState;
    }
    
    // Initialize initial snapshot for delta calculation
    if (this.inMemoryState) {
      this.lastSyncedState = JSON.parse(JSON.stringify(this.inMemoryState));
    }

    this.initCloudSync();
  }

  public getServerSyncStatus() {
    return {
      status: this.cloudStatus,
      error: this.cloudError,
      isConfigured: isSupabaseConfigured
    };
  }

  public clearAllFestData(): void {
    const cleanState: StoreData = {
      ...this.getDefaultData(),
      updatedAt: new Date().toISOString()
    };
    this.saveData(cleanState);
    if (isSupabaseConfigured) {
      this.syncToCloud(cleanState, true);
      clearAllModularCloudData('DELETE_ALL_FEST_DATA').then(() => {
        this.syncToCloud(cleanState, true);
      }).catch((err) => {
        console.warn('Error clearing Supabase cloud data:', err);
      });
    }
    this.notify();
  }

  private getDefaultData(): StoreData {
    return {
      groups: [],
      profiles: INITIAL_PROFILES,
      competitions: [],
      registrations: [],
      results: [],
      categories: DEFAULT_CATEGORIES,
      stages: DEFAULT_STAGES,
      levels: DEFAULT_LEVELS,
      eventPosters: [],
      comments: [],
      notifications: [],
      countdownConfig: {
        show: true,
        title: 'Art Fest 2026',
        subtitle: 'The countdown to unforgettable festival moments starts here.'
      },
      brandingConfig: {
        tag: 'FEST 2026',
        college: 'Madani College',
        title: 'Madani College Fest',
        logoUrl: '',
        splashLogoUrl: '',
        primaryColor: '#8b5cf6',
        secondaryColor: '#6366f1',
        bgDarkColor: '#0b0c16',
        bgCardColor: '#151728'
      },
      socialLinks: {
        instagram: '',
        youtube: '',
        whatsapp: '',
        facebook: '',
        twitter: '',
        website: ''
      },
      limitRules: DEFAULT_LIMIT_RULES,
      showGroupPointStatus: true,
      calculateWithPerformancePoints: true
    };
  }

  /**
   * Replace / hydrate the application state with fresh data from Supabase
   * Completely removes old local stored data on this device and replaces with new data.
   */
  public setApplicationState(freshState: any, pushId?: string): void {
    if (!freshState || typeof freshState !== 'object') return;

    // Avoid redundant re-wipe if this device just sent this exact push
    if (pushId && this.lastProcessedPushId === pushId) {
      return;
    }
    if (pushId) {
      this.lastProcessedPushId = pushId;
    }

    this.isInitialCloudSyncResolved = true;
    const hasCloudData = (
      (Array.isArray(freshState.groups) && freshState.groups.length > 0) ||
      (Array.isArray(freshState.competitions) && freshState.competitions.length > 0) ||
      (Array.isArray(freshState.profiles) && freshState.profiles.length > 0) ||
      (freshState.updatedAt && !this.isDeviceFresh) ||
      Boolean(freshState.forcePushId)
    );

    if (hasCloudData) {
      console.log('Hydrating and replacing all local stored data with authoritative Supabase cloud state.');
      this.hasReceivedCloudData = true;
      this.isDeviceFresh = false;
      this.isSyncingFromCloud = true;

      // CRITICAL: REMOVE OLD LOCAL STORED DATA OF THIS DEVICE COMPLETELY
      try {
        localStorage.removeItem(STORE_KEY);
        LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
      } catch (storageErr) {
        console.warn('Error clearing old localStorage:', storageErr);
      }

      this.inMemoryState = {
        ...this.getDefaultData(),
        ...freshState,
        profiles: ensureSystemProfiles(freshState.profiles)
      };
      this.lastSyncedState = JSON.parse(JSON.stringify(this.inMemoryState));

      // Save the fresh replacement state to localStorage
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(this.inMemoryState));
        if (freshState.forcePushId || pushId) {
          localStorage.setItem('fest_last_force_push_id', freshState.forcePushId || pushId);
        }
      } catch (storageErr) {
        console.warn('LocalStorage limit exceeded while syncing Supabase cloud data.', storageErr);
      }

      this.recalculateGroupPoints(false);
      this.cloudStatus = 'connected';
      this.cloudError = null;
      this.isSyncingFromCloud = false;
      this.notify();
    } else {
      console.log('No existing remote festival data found in Supabase. Ready for live sync.');
      this.hasReceivedCloudData = true;
      this.isDeviceFresh = false;
      this.cloudStatus = 'connected';
      this.cloudError = null;
      this.notify();
      if (this.inMemoryState && ((this.inMemoryState.groups && this.inMemoryState.groups.length > 0) || (this.inMemoryState.competitions && this.inMemoryState.competitions.length > 0))) {
        this.syncToCloud(this.inMemoryState, true);
      }
    }
  }

  /**
   * Apply real-time INSERT, UPDATE, and DELETE changes from Supabase
   */
  public applyRealtimeUpdate(type: string, data: any): void {
    if (!this.inMemoryState) {
      this.inMemoryState = this.getDefaultData();
    }

    console.log(`Received Supabase real-time event for [${type}].`);
    this.hasReceivedCloudData = true;
    this.isInitialCloudSyncResolved = true;
    this.isDeviceFresh = false;
    this.isSyncingFromCloud = true;

    if (type.startsWith('single_')) {
      const storeKey = type.replace('single_', '') as keyof StoreData;
      const { action, item, id } = data;
      const list = Array.isArray(this.inMemoryState[storeKey]) ? [...(this.inMemoryState[storeKey] as any[])] : [];
      
      if (action === 'delete') {
        (this.inMemoryState as any)[storeKey] = list.filter((x: any) => String(x.id) !== String(id));
      } else if (action === 'upsert' && item) {
        const itemToInsert = storeKey === 'competitions' ? (() => {
          const c = item;
          const isScheduled = Boolean(c.scheduleTime && String(c.scheduleTime).trim()) || c.status === 'completed' || Boolean(c.isPublishedResult);
          let status = c.status || 'pending';
          let isRunning = Boolean(c.isRunning);
          if (status === 'completed' || c.isPublishedResult) {
            status = 'completed';
            isRunning = false;
          } else if (!isScheduled) {
            if (status === 'running') status = 'pending';
            isRunning = false;
          } else if (status === 'running' || isRunning) {
            status = 'running';
            isRunning = true;
          }
          return { ...c, status, isRunning };
        })() : item;

        const idx = list.findIndex((x: any) => String(x.id) === String(item.id || id));
        if (idx >= 0) {
          list[idx] = itemToInsert;
        } else {
          list.push(itemToInsert);
        }
        if (storeKey === 'profiles') {
          (this.inMemoryState as any)[storeKey] = ensureSystemProfiles(list);
        } else {
          (this.inMemoryState as any)[storeKey] = list;
        }
      }
    } else if (type === 'settings' && data) {
      if (data.brandingConfig) this.inMemoryState.brandingConfig = data.brandingConfig;
      if (data.countdownConfig) this.inMemoryState.countdownConfig = data.countdownConfig;
      if (data.socialLinks) this.inMemoryState.socialLinks = data.socialLinks;
      if (data.limitRules) this.inMemoryState.limitRules = data.limitRules;
      if (data.participantIdConfig) this.inMemoryState.participantIdConfig = data.participantIdConfig;
      if (data.posterTemplateConfig) this.inMemoryState.posterTemplateConfig = data.posterTemplateConfig;
      if (data.performancePointConfig) this.inMemoryState.performancePointConfig = data.performancePointConfig;
      if (Array.isArray(data.categories)) this.inMemoryState.categories = data.categories;
      if (Array.isArray(data.stages)) this.inMemoryState.stages = data.stages;
      if (Array.isArray(data.levels)) this.inMemoryState.levels = data.levels;
      if (Array.isArray(data.festivalDays)) this.inMemoryState.festivalDays = data.festivalDays;
      if (typeof data.showGroupPointStatus === 'boolean') this.inMemoryState.showGroupPointStatus = data.showGroupPointStatus;
      if (typeof data.calculateWithPerformancePoints === 'boolean') this.inMemoryState.calculateWithPerformancePoints = data.calculateWithPerformancePoints;
      if (data.commentSettings) this.inMemoryState.commentSettings = data.commentSettings;
      if (Array.isArray(data.activeValuationCompIds)) this.inMemoryState.activeValuationCompIds = data.activeValuationCompIds;
      if (data.activeValuationCompId) this.inMemoryState.activeValuationCompId = data.activeValuationCompId;
    } else if (type === 'groups' && Array.isArray(data)) {
      this.inMemoryState.groups = data;
    } else if (type === 'profiles' && Array.isArray(data)) {
      this.inMemoryState.profiles = ensureSystemProfiles(data);
    } else if (type === 'competitions' && Array.isArray(data)) {
      this.inMemoryState.competitions = data.map((c: any) => {
        const isScheduled = Boolean(c.scheduleTime && String(c.scheduleTime).trim()) || c.status === 'completed' || Boolean(c.isPublishedResult);
        let status = c.status || 'pending';
        let isRunning = Boolean(c.isRunning);
        if (status === 'completed' || c.isPublishedResult) {
          status = 'completed';
          isRunning = false;
        } else if (!isScheduled) {
          if (status === 'running') status = 'pending';
          isRunning = false;
        } else if (status === 'running' || isRunning) {
          status = 'running';
          isRunning = true;
        }
        return { ...c, status, isRunning };
      });
    } else if (type === 'registrations' && Array.isArray(data)) {
      this.inMemoryState.registrations = data;
    } else if (type === 'results' && Array.isArray(data)) {
      this.inMemoryState.results = data;
    } else if (type === 'comments' && Array.isArray(data)) {
      this.inMemoryState.comments = data;
    } else if (type === 'notifications' && Array.isArray(data)) {
      this.inMemoryState.notifications = data;
    } else if (type === 'eventPosters' && Array.isArray(data)) {
      this.inMemoryState.eventPosters = data;
    }

    if (['results', 'registrations', 'competitions', 'groups', 'single_results', 'single_registrations', 'single_competitions', 'single_groups'].includes(type)) {
      this.recalculateGroupPoints(false);
    }

    // Keep lastSyncedState in lock-step with remote changes
    this.lastSyncedState = JSON.parse(JSON.stringify(this.inMemoryState));

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.inMemoryState));
    } catch (storageErr) {
      console.warn('LocalStorage save skipped during Supabase live update.', storageErr);
    }

    this.cloudStatus = 'connected';
    this.cloudError = null;
    this.notify();
    this.isSyncingFromCloud = false;
  }

  /**
   * Stop Supabase synchronization (call when logging out or destroying the app)
   */
  public stopSupabaseSync(): void {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
    this.cloudStatus = 'disconnected';
    this.notify();
  }

  private async initCloudSync(): Promise<void> {
    if (!isSupabaseConfigured) {
      this.cloudStatus = 'disconnected';
      this.cloudError = 'Supabase credentials are not configured. The app runs in offline local mode.';
      this.notify();
      return;
    }

    try {
      this.cloudStatus = 'initializing';
      this.cloudError = null;
      this.notify();
      console.log('Connecting to Supabase Real-Time Sync using startSupabaseSync...');

      // Clean up previous subscription if active
      if (this.unsubscribeSnapshot) {
        this.unsubscribeSnapshot();
        this.unsubscribeSnapshot = null;
      }

      this.unsubscribeSnapshot = await startSupabaseSync(
        (freshState, pushId) => {
          this.setApplicationState(freshState, pushId);
        },
        (type, data) => {
          this.applyRealtimeUpdate(type, data);
        },
        (error) => {
          console.warn('Supabase sync error:', error?.message);
          this.cloudStatus = 'error';
          this.cloudError = error?.message || 'Supabase connection issue.';
          this.notify();
        }
      );
    } catch (err: any) {
      console.error('Failed to initialize Supabase Realtime Sync:', err);
      this.cloudStatus = 'error';
      this.cloudError = err?.message || 'Failed to connect to Supabase database.';
      this.notify();
    }
  }

  public async forcePushToCloud(): Promise<{ success: boolean; deletedObsolete: number; upserted: number; message: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, deletedObsolete: 0, upserted: 0, message: 'Supabase is not configured' };
    }
    const data = this.getData();
    this.isDeviceFresh = false;
    const nowIso = new Date().toISOString();
    data.updatedAt = nowIso;
    const pushId = `force_push_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.lastProcessedPushId = pushId;

    try {
      this.cloudStatus = 'initializing';
      this.notify();

      const result = await pushFullStateToModularCloud(data, pushId);

      this.lastSyncedState = JSON.parse(JSON.stringify(data));
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(this.inMemoryState));
        localStorage.setItem('fest_last_force_push_id', pushId);
      } catch (err) {
        console.warn('LocalStorage save warning:', err);
      }

      if (result.success) {
        this.cloudStatus = 'connected';
        this.cloudError = null;
      } else {
        this.cloudStatus = 'error';
        this.cloudError = result.message;
      }
      this.notify();
      return result;
    } catch (err: any) {
      this.cloudStatus = 'error';
      this.cloudError = err?.message || 'Supabase sync failed';
      this.notify();
      return {
        success: false,
        deletedObsolete: 0,
        upserted: 0,
        message: err?.message || 'Supabase sync failed',
      };
    }
  }

  public async forcePullFromCloud(): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      this.cloudStatus = 'initializing';
      this.notify();
      const cloudState = await fetchInitialModularCloudState();
      if (cloudState && typeof cloudState === 'object') {
        try {
          localStorage.removeItem(STORE_KEY);
          LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
        } catch {}

        this.inMemoryState = {
          ...this.getDefaultData(),
          ...cloudState,
          profiles: ensureSystemProfiles(cloudState.profiles)
        };
        this.lastSyncedState = JSON.parse(JSON.stringify(this.inMemoryState));
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(this.inMemoryState));
        } catch {}
        this.recalculateGroupPoints(false);
        this.cloudStatus = 'connected';
        this.cloudError = null;
        this.notify();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Failed to force pull from Supabase:', err);
      this.cloudStatus = 'error';
      this.cloudError = err?.message || 'Failed to pull latest live data from Supabase';
      this.notify();
      return false;
    }
  }

  public async mutateCloudDoc(collectionName: string, docId: string, data: any, isDelete = false): Promise<void> {
    if (!isSupabaseConfigured || !docId) return;
    try {
      if (isDelete) {
        await deleteDocFromModularCloud(collectionName, docId);
      } else {
        await saveDocToModularCloud(collectionName, docId, data);
      }
      if (this.cloudStatus === 'error') {
        this.cloudStatus = 'connected';
        this.cloudError = null;
        this.notify();
      }
    } catch (err: any) {
      console.error(`Supabase sync failed for ${collectionName}/${docId}:`, err);
      this.cloudStatus = 'error';
      this.cloudError = err?.message || 'Cloud sync failed for item.';
      this.notify();
    }
  }

  public async mutateCloudSettings(): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      const data = this.getData();
      const settingsPayload = {
        categories: data.categories,
        stages: data.stages,
        levels: data.levels,
        festivalDays: data.festivalDays,
        brandingConfig: data.brandingConfig,
        countdownConfig: data.countdownConfig,
        socialLinks: data.socialLinks,
        limitRules: data.limitRules,
        participantIdConfig: data.participantIdConfig,
        posterTemplateConfig: data.posterTemplateConfig,
        performancePointConfig: data.performancePointConfig,
        calculateWithPerformancePoints: data.calculateWithPerformancePoints,
        showGroupPointStatus: data.showGroupPointStatus,
        commentSettings: data.commentSettings,
        activeValuationCompIds: data.activeValuationCompIds,
        activeValuationCompId: data.activeValuationCompId,
        updatedAt: new Date().toISOString()
      };
      await saveSettingsToModularCloud(settingsPayload);
      if (this.cloudStatus === 'error') {
        this.cloudStatus = 'connected';
        this.cloudError = null;
        this.notify();
      }
    } catch (err: any) {
      console.error('Supabase settings sync failed:', err);
      this.cloudStatus = 'error';
      this.cloudError = err?.message || 'Settings update failed';
      this.notify();
    }
  }

  public async mutateCloudBatch(collectionName: string, items: any[]): Promise<void> {
    if (!isSupabaseConfigured || !Array.isArray(items) || items.length === 0) return;
    try {
      await batchSaveDocsToModularCloud(collectionName, items);
      if (this.cloudStatus === 'error') {
        this.cloudStatus = 'connected';
        this.cloudError = null;
        this.notify();
      }
    } catch (err: any) {
      console.error(`Batch sync failed for ${collectionName}:`, err);
      this.cloudStatus = 'error';
      this.cloudError = err?.message || 'Batch update failed';
      this.notify();
    }
  }

  private syncToCloud(data: StoreData, immediate = false): void {
    if (this.isSyncingFromCloud || !isSupabaseConfigured) {
      return;
    }

    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }

    const executePush = async () => {
      if (this.isPushingToCloud) {
        this.hasPendingPush = true;
        return;
      }

      this.isPushingToCloud = true;
      this.hasPendingPush = false;

      try {
        const current = this.inMemoryState || data;
        const prev = this.lastSyncedState;

        // If no baseline snapshot exists yet, initialize it
        if (!prev) {
          this.lastSyncedState = JSON.parse(JSON.stringify(current));
          return;
        }

        // --- 1. Delta Sync Settings ---
        const settingsKeys: (keyof StoreData)[] = [
          'categories', 'stages', 'levels', 'festivalDays',
          'brandingConfig', 'countdownConfig', 'socialLinks',
          'limitRules', 'participantIdConfig', 'posterTemplateConfig',
          'performancePointConfig', 'showGroupPointStatus', 'calculateWithPerformancePoints',
          'commentSettings', 'activeValuationCompIds', 'activeValuationCompId'
        ];

        const settingsChanged = settingsKeys.some(k => {
          return JSON.stringify(current[k]) !== JSON.stringify(prev[k]);
        });

        if (settingsChanged) {
          const settingsPayload = {
            categories: current.categories,
            stages: current.stages,
            levels: current.levels,
            festivalDays: current.festivalDays,
            brandingConfig: current.brandingConfig,
            countdownConfig: current.countdownConfig,
            socialLinks: current.socialLinks,
            limitRules: current.limitRules,
            participantIdConfig: current.participantIdConfig,
            posterTemplateConfig: current.posterTemplateConfig,
            performancePointConfig: current.performancePointConfig,
            calculateWithPerformancePoints: current.calculateWithPerformancePoints,
            showGroupPointStatus: current.showGroupPointStatus,
            commentSettings: current.commentSettings,
            activeValuationCompIds: current.activeValuationCompIds,
            activeValuationCompId: current.activeValuationCompId,
            updatedAt: current.updatedAt || new Date().toISOString()
          };
          await saveSettingsToModularCloud(settingsPayload);
        }

        // --- 2. Delta Sync Collections ---
        const syncCollectionDelta = async (colName: string, currItems: any[], prevItems: any[]) => {
          const prevMap = new Map<string, any>((prevItems || []).map(item => [String(item.id), item]));
          const currMap = new Map<string, any>((currItems || []).map(item => [String(item.id), item]));

          const toUpsert: any[] = [];
          for (const item of currItems || []) {
            if (!item || !item.id) continue;
            const prevItem = prevMap.get(String(item.id));
            if (!prevItem || JSON.stringify(item) !== JSON.stringify(prevItem)) {
              toUpsert.push(item);
            }
          }

          const toDeleteIds: string[] = [];
          for (const prevItem of prevItems || []) {
            if (!prevItem || !prevItem.id) continue;
            if (!currMap.has(String(prevItem.id))) {
              toDeleteIds.push(String(prevItem.id));
            }
          }

          if (toUpsert.length === 1) {
            await saveDocToModularCloud(colName, toUpsert[0].id, toUpsert[0]);
          } else if (toUpsert.length > 1) {
            await batchSaveDocsToModularCloud(colName, toUpsert);
          }

          if (toDeleteIds.length === 1) {
            await deleteDocFromModularCloud(colName, toDeleteIds[0]);
          } else if (toDeleteIds.length > 1) {
            await batchDeleteDocsFromModularCloud(colName, toDeleteIds);
          }
        };

        await Promise.all([
          syncCollectionDelta('groups', current.groups, prev.groups),
          syncCollectionDelta('profiles', current.profiles, prev.profiles),
          syncCollectionDelta('competitions', current.competitions, prev.competitions),
          syncCollectionDelta('registrations', current.registrations, prev.registrations),
          syncCollectionDelta('results', current.results, prev.results),
          syncCollectionDelta('comments', current.comments, prev.comments),
          syncCollectionDelta('notifications', current.notifications, prev.notifications),
          syncCollectionDelta('event_posters', current.eventPosters, prev.eventPosters)
        ]);

        this.lastSyncedState = JSON.parse(JSON.stringify(current));

        if (this.cloudStatus === 'error') {
          this.cloudStatus = 'connected';
          this.cloudError = null;
          this.notify();
        }
      } catch (err: any) {
        console.error('Error syncing modifications to Supabase:', err);
        this.cloudStatus = 'error';
        this.cloudError = err?.message || 'Supabase cloud sync update failed.';
        this.notify();
      } finally {
        this.isPushingToCloud = false;
        if (this.hasPendingPush && this.inMemoryState) {
          this.hasPendingPush = false;
          this.syncToCloud(this.inMemoryState, true);
        }
      }
    };

    if (immediate) {
      executePush();
    } else {
      this.syncDebounceTimer = setTimeout(() => {
        this.syncDebounceTimer = null;
        executePush();
      }, 500);
    }
  }

  public async forceCloudSync(): Promise<void> {
    const data = this.getData();
    await this.syncToCloud(data, true);
    await this.initCloudSync();
  }

  private getData(): StoreData {
    if (this.inMemoryState) return this.inMemoryState;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) {
        const defaults = this.getDefaultData();
        this.inMemoryState = defaults;
        return defaults;
      }
      const parsed = JSON.parse(raw);
      let changed = false;
      if (parsed) {
        if (Array.isArray(parsed.competitions)) {
          parsed.competitions = parsed.competitions.map((c: any) => {
            let updated = { ...c };
            if (updated.name) {
              const clean = cleanCompetitionBaseName(updated.name);
              if (clean && clean !== updated.name) {
                updated.name = clean;
                changed = true;
              }
            }
            const isScheduled = Boolean(updated.scheduleTime && String(updated.scheduleTime).trim()) || updated.status === 'completed' || Boolean(updated.isPublishedResult);

            // Unscheduled competitions can NEVER be running, but completed status is preserved
            if (updated.status === 'completed' || updated.isPublishedResult) {
              updated.isRunning = false;
            } else if (!isScheduled) {
              if (updated.status === 'running') {
                updated.status = 'pending';
                changed = true;
              }
              if (updated.isRunning) {
                updated.isRunning = false;
                changed = true;
              }
            }

            if (updated.isRunning === undefined) {
              updated.isRunning = isScheduled && updated.status === 'running';
              changed = true;
            }
            if (updated.status === undefined) {
              updated.status = 'pending';
              changed = true;
            }
            return updated;
          });
        }
        if (Array.isArray(parsed.results)) {
          parsed.results = parsed.results.map((r: any) => {
            let updated = { ...r };
            if (updated.competitionName) {
              const clean = cleanCompetitionBaseName(updated.competitionName);
              if (clean && clean !== updated.competitionName) {
                updated.competitionName = clean;
                changed = true;
              }
            }
            return updated;
          });
        }
        if (parsed.profiles && Array.isArray(parsed.profiles)) {
          const originalLength = parsed.profiles.length;
          parsed.profiles = ensureSystemProfiles(parsed.profiles);
          if (parsed.profiles.length !== originalLength) {
            changed = true;
          }
          parsed.profiles = parsed.profiles.map((p: any) => {
            if (p.photoUrl && typeof p.photoUrl === 'string' && p.photoUrl.includes('unsplash.com/photo-')) {
              changed = true;
              return { ...p, photoUrl: getParticipantPhoto(p.name) };
            }
            return p;
          });
        }
        if (Array.isArray(parsed.registrations) && Array.isArray(parsed.profiles)) {
          parsed.registrations = parsed.registrations.map((r: any) => {
            const prof = parsed.profiles.find((p: any) => p.id === r.participantId || p.userId === r.participantUserId);
            if (prof && prof.fatherName) {
              const fullName = formatParticipantFullName(prof.name, prof.fatherName);
              if (fullName && r.participantName !== fullName) {
                changed = true;
                return { ...r, participantName: fullName };
              }
            }
            return r;
          });
        }
        if (Array.isArray(parsed.results) && Array.isArray(parsed.registrations)) {
          parsed.results = parsed.results.map((res: any) => {
            let updated = { ...res };
            if (res.firstPlaceRegId) {
              const reg = parsed.registrations.find((r: any) => r.id === res.firstPlaceRegId);
              if (reg && reg.participantName && reg.participantName !== updated.firstPlaceParticipantName) {
                updated.firstPlaceParticipantName = reg.participantName;
                changed = true;
              }
            }
            if (res.secondPlaceRegId) {
              const reg = parsed.registrations.find((r: any) => r.id === res.secondPlaceRegId);
              if (reg && reg.participantName && reg.participantName !== updated.secondPlaceParticipantName) {
                updated.secondPlaceParticipantName = reg.participantName;
                changed = true;
              }
            }
            if (res.thirdPlaceRegId) {
              const reg = parsed.registrations.find((r: any) => r.id === res.thirdPlaceRegId);
              if (reg && reg.participantName && reg.participantName !== updated.thirdPlaceParticipantName) {
                updated.thirdPlaceParticipantName = reg.participantName;
                changed = true;
              }
            }
            return updated;
          });
        }
        if (!parsed.eventPosters) {
          parsed.eventPosters = INITIAL_POSTERS;
          changed = true;
        }
        if (!parsed.countdownConfig) {
          parsed.countdownConfig = {
            show: true,
            title: 'Tick-Tock, It’s Fest O’Clock!',
            subtitle: 'Months of prep, endless late nights, and one massive stage. The countdown to unforgettable memories starts • November 15-17, 2026'
          };
          changed = true;
        }
        if (!parsed.brandingConfig) {
          parsed.brandingConfig = {
            tag: 'FEST 2026',
            college: 'Madani College',
            title: 'Madani College Fest',
            logoUrl: '',
            primaryColor: '#8b5cf6',
            secondaryColor: '#6366f1',
            bgDarkColor: '#0b0c16',
            bgCardColor: '#151728'
          };
          changed = true;
        }
        if (!parsed.stages || JSON.stringify(parsed.stages) === JSON.stringify(['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4'])) {
          parsed.stages = DEFAULT_STAGES;
          changed = true;
        }
        if (!parsed.registrations || !Array.isArray(parsed.registrations)) {
          parsed.registrations = INITIAL_REGISTRATIONS;
          changed = true;
        } else {
          const getCodeLetter = (idx: number): string => {
            let letter = '';
            let temp = idx;
            while (temp >= 0) {
              letter = String.fromCharCode((temp % 26) + 65) + letter;
              temp = Math.floor(temp / 26) - 1;
            }
            return letter;
          };
          const compCounts: Record<string, number> = {};
          parsed.registrations = parsed.registrations.map((r: any) => {
            let updated = { ...r };
            if (updated.isReported === undefined) {
              updated.isReported = false;
              changed = true;
            }
            if (updated.codeLetter === undefined) {
              updated.codeLetter = '';
              changed = true;
            }
            return updated;
          });
        }

        // Validate Published status: Competitions can ONLY be published if scored by judge
        const scoredCompIds = new Set<string>();
        if (Array.isArray(parsed.registrations)) {
          parsed.registrations.forEach((r: any) => {
            if (r.isReported && r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '') {
              scoredCompIds.add(r.competitionId);
            }
          });
        }

        if (Array.isArray(parsed.results)) {
          const originalResultsLen = parsed.results.length;
          parsed.results = parsed.results.filter((res: any) => scoredCompIds.has(res.competitionId));
          if (parsed.results.length !== originalResultsLen) {
            changed = true;
          }
        }

        if (Array.isArray(parsed.competitions)) {
          parsed.competitions = parsed.competitions.map((comp: any) => {
            const isScored = scoredCompIds.has(comp.id);
            const hasResult = Array.isArray(parsed.results) && parsed.results.some((r: any) => r.competitionId === comp.id);
            if (comp.isPublishedResult && (!isScored || !hasResult)) {
              changed = true;
              const isScheduled = Boolean(comp.scheduleTime && String(comp.scheduleTime).trim());
              return {
                ...comp,
                isPublishedResult: false,
                status: 'pending',
                isRunning: false
              };
            }
            return comp;
          });
        }

        if (changed) {
          try {
            localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
          } catch (e) {
            console.warn('LocalStorage limit exceeded during auto-migration.', e);
          }
        }
      }
      this.inMemoryState = parsed;
      return parsed;
    } catch {
      const defaults = this.getDefaultData();
      this.inMemoryState = defaults;
      return defaults;
    }
  }

  private saveData(data: StoreData, immediate = false, syncToCloud = true): void {
    data.updatedAt = new Date().toISOString();
    this.isDeviceFresh = false;
    this.inMemoryState = data;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('LocalStorage limit exceeded while saving data. Using in-memory store.', err);
    }
    this.notify();
    if (syncToCloud) {
      this.syncToCloud(data, immediate);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  public resetToDefaults(syncToCloud = true): StoreData {
    const data = this.getDefaultData();
    this.isDeviceFresh = false;
    this.saveData(data, true, syncToCloud);
    this.recalculateGroupPoints(false);
    return data;
  }

  // --- COUNTDOWN CONFIG GETTER & SETTER ---
  public getCountdownConfig(): CountdownConfig {
    const data = this.getData();
    const defaults: CountdownConfig = {
      show: true,
      title: 'Tick-Tock, It’s Fest O’Clock!',
      subtitle: 'Months of prep, endless late nights, and one massive stage. The countdown to unforgettable memories starts • November 15-17, 2026',
      targetDate: '2026-11-15T09:00',
      dayLabel: 'Days',
      hourLabel: 'Hours',
      minLabel: 'Mins',
      secLabel: 'Secs',
      showDays: true,
      showHours: true,
      showMinutes: true,
      showSeconds: true,
    };
    if (!data.countdownConfig) {
      return defaults;
    }
    return {
      ...defaults,
      ...data.countdownConfig
    };
  }

  public updateCountdownConfig(config: Partial<CountdownConfig>): void {
    const data = this.getData();
    const current = this.getCountdownConfig();
    data.countdownConfig = {
      ...current,
      ...config
    };
    this.saveData(data);
  }

  // --- BRANDING CONFIG GETTER & SETTER ---
  public getBrandingConfig(): BrandingConfig {
    const data = this.getData();
    const config = data.brandingConfig || {
      tag: 'FEST 2026',
      college: 'Madani College',
      title: 'Madani College Fest',
      logoUrl: ''
    };
    return {
      tag: config.tag || 'FEST 2026',
      college: config.college || 'Madani College',
      title: config.title || 'Madani College Fest',
      logoUrl: config.logoUrl || '',
      splashLogoUrl: config.splashLogoUrl || '',
      primaryColor: config.primaryColor || '#8b5cf6',
      secondaryColor: config.secondaryColor || '#6366f1',
      bgDarkColor: config.bgDarkColor || '#0b0c16',
      bgCardColor: config.bgCardColor || '#151728',
      fontFamily: config.fontFamily || "'Plus Jakarta Sans', sans-serif",
      headingFontFamily: config.headingFontFamily || "'Plus Jakarta Sans', sans-serif"
    };
  }

  public updateBrandingConfig(config: Partial<BrandingConfig>): void {
    const data = this.getData();
    const current = this.getBrandingConfig();
    data.brandingConfig = {
      ...current,
      ...config
    };
    this.saveData(data);
  }

  // --- SOCIAL MEDIA LINKS GETTER & SETTER ---
  public getSocialLinks(): SocialLinksConfig {
    const data = this.getData();
    const defaults: SocialLinksConfig = {
      instagram: '',
      youtube: '',
      whatsapp: '',
      facebook: '',
      twitter: '',
      website: ''
    };
    if (!data.socialLinks) {
      return defaults;
    }
    return {
      ...defaults,
      ...data.socialLinks
    };
  }

  public updateSocialLinks(links: Partial<SocialLinksConfig>): void {
    const data = this.getData();
    const current = this.getSocialLinks();
    data.socialLinks = {
      ...current,
      ...links
    };
    this.saveData(data);
    this.notify();
  }

  // --- POSTER TEMPLATE CONFIG GETTER & SETTER ---
  public getPosterTemplateConfig(): PosterTemplateConfig {
    const data = this.getData();
    const branding = this.getBrandingConfig();
    const defaults: PosterTemplateConfig = {
      themePreset: 'royal_gold',
      headerText: 'OFFICIAL RESULT',
      subHeaderText: branding.title || 'Madani College Fest',
      footerText: 'Congratulations to all winning participants & groups!',
      showCollegeLogo: true,
      showFestName: true,
      showPoints: true,
      accentColor: '#f59e0b',
      secondaryAccent: '#8b5cf6',
      overlayOpacity: 0.85,
    };
    if (!data.posterTemplateConfig) {
      return defaults;
    }
    return {
      ...defaults,
      ...data.posterTemplateConfig
    };
  }

  public updatePosterTemplateConfig(config: Partial<PosterTemplateConfig>): void {
    const data = this.getData();
    const current = this.getPosterTemplateConfig();
    data.posterTemplateConfig = {
      ...current,
      ...config
    };
    this.saveData(data);
    this.notify();
  }

  // --- PERFORMANCE POINT CONFIG GETTER & SETTER ---
  public getPerformancePointConfig(): PerformancePointConfig {
    const data = this.getData();
    const defaultRules: PerformancePointRule[] = [
      { grade: 'A+', minScore: 90, maxScore: 100, individual: 6, group2: 7, group3: 10, group4Plus: 18 },
      { grade: 'A', minScore: 70, maxScore: 89, individual: 4, group2: 6, group3: 9, group4Plus: 15 },
      { grade: 'B', minScore: 60, maxScore: 69, individual: 3, group2: 4, group3: 6, group4Plus: 10 },
      { grade: 'C', minScore: 50, maxScore: 59, individual: 1, group2: 2, group3: 3, group4Plus: 5 },
      { grade: 'No Grade', minScore: 1, maxScore: 49, individual: 0, group2: 0, group3: 0, group4Plus: 0 }
    ];
    if (!data.performancePointConfig || !Array.isArray(data.performancePointConfig.rules)) {
      return { rules: defaultRules };
    }
    return data.performancePointConfig;
  }

  public updatePerformancePointConfig(config: PerformancePointConfig): void {
    const data = this.getData();
    data.performancePointConfig = config;
    this.saveData(data);
    this.notify();
  }

  // --- HOME SCREEN GROUP POINT STATUS VISIBILITY ---
  public getShowGroupPointStatus(): boolean {
    const data = this.getData();
    return data.showGroupPointStatus !== false;
  }

  public setShowGroupPointStatus(show: boolean): void {
    const data = this.getData();
    data.showGroupPointStatus = show;
    this.saveData(data);
    this.notify();
  }

  // --- TEAM POINTS CALCULATION MODE (WITH vs WITHOUT PERFORMANCE POINTS) ---
  public getCalculateWithPerformancePoints(): boolean {
    const data = this.getData();
    return data.calculateWithPerformancePoints !== false;
  }

  public setCalculateWithPerformancePoints(enabled: boolean): void {
    const data = this.getData();
    data.calculateWithPerformancePoints = enabled;
    this.saveData(data, true);
    this.recalculateGroupPoints(true);
    this.notify();
  }

  // --- GETTERS ---
  public getGroups(): Group[] {
    const d = this.getData();
    return Array.isArray(d?.groups) ? d.groups : INITIAL_GROUPS;
  }

  public getProfiles(): UserProfile[] {
    const d = this.getData();
    return Array.isArray(d?.profiles) ? d.profiles : INITIAL_PROFILES;
  }

  public getCompetitions(): Competition[] {
    const d = this.getData();
    const comps = Array.isArray(d?.competitions) ? d.competitions : INITIAL_COMPETITIONS;
    const regs = Array.isArray(d?.registrations) ? d.registrations : INITIAL_REGISTRATIONS;

    // A competition is only eligible to be published if scored by judge (has reported candidates with saved marks)
    const scoredCompIds = new Set<string>();
    regs.forEach(r => {
      if (r.isReported && r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '') {
        scoredCompIds.add(r.competitionId);
      }
    });

    return comps.map(c => {
      // Scheduled competitions only assigned to stages
      const isScheduled = Boolean(c.scheduleTime && c.scheduleTime.trim()) || c.status === 'completed' || Boolean(c.isPublishedResult);
      const effectiveVenue = c.venue || '';
      const stageStatus = c.isStage !== undefined ? c.isStage : (effectiveVenue ? this.isStageVenue(effectiveVenue) : true);
      const isJudgeScored = scoredCompIds.has(c.id);
      const isPublished = Boolean(c.isPublishedResult && isJudgeScored);

      let effectiveStatus: 'pending' | 'running' | 'completed' = 'pending';
      let effectiveIsRunning = false;

      if (isPublished || c.isPublishedResult || c.status === 'completed') {
        effectiveStatus = 'completed';
        effectiveIsRunning = false;
      } else if (!isScheduled) {
        // An unscheduled competition can NEVER be running
        effectiveStatus = 'pending';
        effectiveIsRunning = false;
      } else {
        // Scheduled competition
        if (c.status === 'running' || c.isRunning) {
          effectiveStatus = 'running';
          effectiveIsRunning = true;
        } else {
          effectiveStatus = 'pending';
          effectiveIsRunning = false;
        }
      }

      let updated = c;
      if (
        c.venue !== effectiveVenue ||
        c.isStage !== stageStatus ||
        c.isPublishedResult !== isPublished ||
        c.status !== effectiveStatus ||
        c.isRunning !== effectiveIsRunning
      ) {
        updated = {
          ...c,
          venue: effectiveVenue,
          isStage: stageStatus,
          isPublishedResult: isPublished,
          status: effectiveStatus,
          isRunning: effectiveIsRunning
        };
      }
      return updated;
    });
  }

  public getRegistrations(): Registration[] {
    const d = this.getData();
    return Array.isArray(d?.registrations) ? d.registrations : INITIAL_REGISTRATIONS;
  }

  public getResults(): Result[] {
    const d = this.getData();
    const results = Array.isArray(d?.results) ? d.results : INITIAL_RESULTS;
    const regs = Array.isArray(d?.registrations) ? d.registrations : INITIAL_REGISTRATIONS;

    // Filter out results for competitions that are not scored and saved by the judge
    const scoredCompIds = new Set<string>();
    regs.forEach(r => {
      if (r.isReported && r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '') {
        scoredCompIds.add(r.competitionId);
      }
    });

    return results
      .filter(r => scoredCompIds.has(r.competitionId))
      .map(r => ({
        ...r,
        firstPlaceParticipantName: r.firstPlaceParticipantName ? r.firstPlaceParticipantName.replace(/\s*\([^)]*\)/g, '').trim() : '',
        secondPlaceParticipantName: r.secondPlaceParticipantName ? r.secondPlaceParticipantName.replace(/\s*\([^)]*\)/g, '').trim() : undefined,
        thirdPlaceParticipantName: r.thirdPlaceParticipantName ? r.thirdPlaceParticipantName.replace(/\s*\([^)]*\)/g, '').trim() : undefined,
      }));
  }

  public getParticipantPhotoUrl(participantName?: string, regId?: string): string {
    const data = this.getData();
    const profiles = Array.isArray(data?.profiles) ? data.profiles : INITIAL_PROFILES;
    const registrations = Array.isArray(data?.registrations) ? data.registrations : INITIAL_REGISTRATIONS;

    if (regId) {
      const reg = registrations.find(r => r.id === regId);
      if (reg) {
        const profile = profiles.find(p => p.id === reg.participantId || p.userId === reg.participantUserId || p.name === reg.participantName);
        if (profile?.photoUrl) {
          return profile.photoUrl;
        }
      }
    }

    if (!participantName) {
      return getParticipantPhoto();
    }

    const clean = participantName.replace(/\s*\([^)]*\)/g, '').trim();

    const userIdMatch = participantName.match(/\(([^)]+)\)/);
    const userId = userIdMatch ? userIdMatch[1].trim() : null;

    if (userId) {
      const profile = profiles.find(p => p.userId && p.userId.toLowerCase() === userId.toLowerCase());
      if (profile?.photoUrl) {
        return profile.photoUrl;
      }
    }

    const profileByName = profiles.find(p => p.name && p.name.trim().toLowerCase() === clean.toLowerCase());
    if (profileByName?.photoUrl) {
      return profileByName.photoUrl;
    }

    const regByName = registrations.find(r => r.participantName && r.participantName.trim().toLowerCase() === clean.toLowerCase());
    if (regByName) {
      const profile = profiles.find(p => p.id === regByName.participantId || (p.userId && p.userId === regByName.participantUserId));
      if (profile?.photoUrl) {
        return profile.photoUrl;
      }
    }

    return getParticipantPhoto(clean);
  }

  public getParticipantFullName(participantName?: string, regId?: string, fallbackFatherName?: string): string {
    const data = this.getData();
    const profiles = Array.isArray(data?.profiles) ? data.profiles : INITIAL_PROFILES;
    const registrations = Array.isArray(data?.registrations) ? data.registrations : INITIAL_REGISTRATIONS;

    if (regId) {
      const reg = registrations.find(r => r.id === regId);
      if (reg) {
        const profile = profiles.find(p => p.id === reg.participantId || p.userId === reg.participantUserId || p.name === reg.participantName);
        if (profile) {
          return formatParticipantFullName(profile.name, profile.fatherName || fallbackFatherName);
        }
        if (reg.participantName) {
          return formatParticipantFullName(reg.participantName, fallbackFatherName);
        }
      }
    }

    if (!participantName) return '';

    const clean = participantName.replace(/\s*\([^)]*\)/g, '').trim();

    const userIdMatch = participantName.match(/\(([^)]+)\)/);
    const userId = userIdMatch ? userIdMatch[1].trim() : null;

    if (userId) {
      const profile = profiles.find(p => p.userId && p.userId.toLowerCase() === userId.toLowerCase());
      if (profile) {
        return formatParticipantFullName(profile.name, profile.fatherName || fallbackFatherName);
      }
    }

    const profileByName = profiles.find(p => p.name && (p.name.trim().toLowerCase() === clean.toLowerCase() || formatParticipantFullName(p.name, p.fatherName).toLowerCase() === clean.toLowerCase()));
    if (profileByName) {
      return formatParticipantFullName(profileByName.name, profileByName.fatherName || fallbackFatherName);
    }

    const regByName = registrations.find(r => r.participantName && r.participantName.trim().toLowerCase() === clean.toLowerCase());
    if (regByName) {
      const profile = profiles.find(p => p.id === regByName.participantId || (p.userId && p.userId === regByName.participantUserId));
      if (profile) {
        return formatParticipantFullName(profile.name, profile.fatherName || fallbackFatherName);
      }
    }

    return formatParticipantFullName(clean, fallbackFatherName);
  }

  public getEventPosters(): EventPoster[] {
    const d = this.getData();
    return Array.isArray(d?.eventPosters) ? d.eventPosters : INITIAL_POSTERS;
  }

  public getActiveValuationCompIds(): string[] {
    const d = this.getData();
    if (Array.isArray(d?.activeValuationCompIds) && d.activeValuationCompIds.length > 0) {
      return d.activeValuationCompIds.filter(Boolean);
    }
    if (d?.activeValuationCompId) {
      return [d.activeValuationCompId.trim()].filter(Boolean);
    }
    return [];
  }

  public getActiveValuationCompId(): string {
    const ids = this.getActiveValuationCompIds();
    return ids.length > 0 ? ids[0] : '';
  }

  public setActiveValuationCompIds(compIds: string[]): void {
    const data = this.getData();
    const cleanIds = Array.from(new Set(compIds.map(id => id ? id.trim() : '').filter(Boolean)));
    data.activeValuationCompIds = cleanIds;
    data.activeValuationCompId = cleanIds.length > 0 ? cleanIds[0] : '';
    this.saveData(data);
    this.notify();
    if (isSupabaseConfigured) {
      this.mutateCloudSettings().catch(() => {});
    }
  }

  public toggleValuationCompId(compId: string): void {
    const current = this.getActiveValuationCompIds();
    const clean = compId.trim();
    if (!clean) return;
    const exists = current.includes(clean);
    const updated = exists ? current.filter(id => id !== clean) : [...current, clean];
    this.setActiveValuationCompIds(updated);
  }

  public addValuationCompId(compId: string): void {
    const current = this.getActiveValuationCompIds();
    const clean = compId.trim();
    if (!clean || current.includes(clean)) return;
    this.setActiveValuationCompIds([...current, clean]);
  }

  public removeValuationCompId(compId: string): void {
    const current = this.getActiveValuationCompIds();
    const clean = compId.trim();
    this.setActiveValuationCompIds(current.filter(id => id !== clean));
  }

  public clearValuationCompIds(): void {
    this.setActiveValuationCompIds([]);
  }

  public setActiveValuationCompId(compId: string): void {
    if (!compId) {
      this.setActiveValuationCompIds([]);
    } else {
      this.setActiveValuationCompIds([compId]);
    }
  }

  // --- ACTIONS ---

  public addEventPoster(url: string): EventPoster {
    const data = this.getData();
    if (!data.eventPosters) {
      data.eventPosters = [...INITIAL_POSTERS];
    }
    const newPoster: EventPoster = {
      id: `poster-${Date.now()}`,
      url
    };
    data.eventPosters.push(newPoster);
    this.saveData(data);
    return newPoster;
  }

  public removeEventPoster(id: string): void {
    const data = this.getData();
    if (data.eventPosters) {
      data.eventPosters = data.eventPosters.filter(p => p.id !== id);
      this.saveData(data);
      if (isSupabaseConfigured) {
        deleteDocFromModularCloud('event_posters', id).catch(() => {});
      }
    }
  }

  public getParticipantIdConfig(groupId?: string): ParticipantIdConfig {
    const data = this.getData();
    const globalConfig = data.participantIdConfig || {
      startNumber: 14,
      digits: 3,
      isLocked: false,
      isCompLocked: false,
    };
    if (groupId) {
      const grp = data.groups.find(g => g.id === groupId);
      if (grp && grp.participantIdConfig) {
        return {
          ...grp.participantIdConfig,
          isLocked: !!(grp.participantIdConfig.isLocked || globalConfig.isLocked),
          isCompLocked: !!(grp.participantIdConfig.isCompLocked || globalConfig.isCompLocked),
        };
      }
    }
    return globalConfig;
  }

  public updateParticipantIdConfig(config: Partial<ParticipantIdConfig>, groupId?: string): ParticipantIdConfig {
    const data = this.getData();
    const current = this.getParticipantIdConfig(groupId);
    const updated: ParticipantIdConfig = {
      ...current,
      ...config,
    };
    if (groupId) {
      const grpIndex = data.groups.findIndex(g => g.id === groupId);
      if (grpIndex > -1) {
        data.groups[grpIndex].participantIdConfig = updated;
      }
    } else {
      data.participantIdConfig = updated;
      if (data.groups && data.groups.length > 0) {
        data.groups.forEach(g => {
          g.participantIdConfig = {
            ...(g.participantIdConfig || updated),
            ...config,
          };
        });
      }
    }
    this.saveData(data);
    this.notify();
    return updated;
  }

  // Generate next participant Chest No like 014 (configurable by Admin per group)
  public generateNextParticipantId(groupId?: string): { userId: string; password: string } {
    const config = this.getParticipantIdConfig(groupId);
    const profiles = this.getProfiles();
    
    const existingNums = profiles
      .filter(p => p.role === 'participant' && (!groupId || p.groupId === groupId))
      .map(p => {
        const id = p.userId.trim();
        if (id.includes('-')) {
          const parts = id.split('-');
          return parseInt(parts[parts.length - 1] || '0', 10);
        }
        return parseInt(id, 10);
      })
      .filter(num => !isNaN(num) && num > 0);

    const startNum = config.startNumber !== undefined && config.startNumber > 0 ? config.startNumber : 1;
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : startNum;
    const padDigits = config.digits || 3;
    const userId = String(nextNum).padStart(padDigits, '0');
    
    // Generate simple readable random password
    const randAlpha = ['art', 'fest', 'star', 'madani', 'gem'][Math.floor(Math.random() * 5)];
    const randNum = Math.floor(100 + Math.random() * 900);
    const password = `${randAlpha}${randNum}`;

    return { userId, password };
  }

  // Add Group Leader / Group
  public addGroup(name: string, leaderName: string, leaderId: string, leaderPassword: string, code: string, color: string): Group {
    const data = this.getData();
    const groupId = `grp-${Date.now()}`;
    const newGroup: Group = {
      id: groupId,
      name,
      leaderName,
      leaderId,
      leaderPassword,
      code: code.toUpperCase(),
      color: color || '#ffbe0b',
      badgeSymbol: '🚩',
      totalPoints: 0,
      goldCount: 0,
      silverCount: 0,
      bronzeCount: 0,
      created_at: new Date().toISOString()
    };

    data.groups.push(newGroup);

    // Create profile for leader
    const newLeaderProfile: UserProfile = {
      id: `usr-${Date.now()}`,
      userId: leaderId,
      password: leaderPassword,
      name: leaderName,
      role: 'leader',
      groupId: groupId,
      groupName: name,
      created_at: new Date().toISOString()
    };
    data.profiles.push(newLeaderProfile);

    this.saveData(data);
    return newGroup;
  }

  // Add Participant by Leader
  public addParticipant(groupId: string, name: string, department: string, category: CategoryType, photoUrl?: string, fatherName?: string): UserProfile {
    const config = this.getParticipantIdConfig(groupId);
    if (config.isLocked) {
      throw new Error('Participant registration is closed by Admin.');
    }

    if (!name || !name.trim()) {
      throw new Error('Participant Name is required.');
    }

    if (!fatherName || !fatherName.trim()) {
      throw new Error('Second Name (Father Name) is required.');
    }

    const data = this.getData();
    const group = data.groups.find(g => g.id === groupId);
    const { userId, password } = this.generateNextParticipantId(groupId);

    const newParticipant: UserProfile = {
      id: `usr-${Date.now()}`,
      userId,
      password,
      name: name.trim(),
      fatherName: fatherName.trim(),
      role: 'participant',
      groupId,
      groupName: group ? group.name : 'Unknown Group',
      department,
      category,
      photoUrl,
      created_at: new Date().toISOString()
    };

    data.profiles.push(newParticipant);
    this.saveData(data);
    return newParticipant;
  }

  // Update Group & Leader Credentials / Group ID
  public updateGroup(
    groupId: string,
    updates: {
      newGroupId?: string;
      code?: string;
      name?: string;
      leaderName?: string;
      leaderId?: string;
      leaderPassword?: string;
      color?: string;
    }
  ): { success: boolean; message: string } {
    const data = this.getData();
    const grpIndex = data.groups.findIndex(g => g.id === groupId);
    if (grpIndex === -1) {
      return { success: false, message: 'Group not found' };
    }

    const currentGrp = data.groups[grpIndex];
    const targetGroupId = updates.newGroupId?.trim() || groupId;

    // Check if newGroupId is unique if changing
    if (targetGroupId !== groupId && data.groups.some(g => g.id === targetGroupId)) {
      return { success: false, message: `Group ID "${targetGroupId}" is already in use.` };
    }

    // Update group object
    const updatedGrp: Group = {
      ...currentGrp,
      id: targetGroupId,
      code: updates.code ? updates.code.toUpperCase() : currentGrp.code,
      name: updates.name || currentGrp.name,
      leaderName: updates.leaderName || currentGrp.leaderName,
      leaderId: updates.leaderId || currentGrp.leaderId,
      leaderPassword: updates.leaderPassword !== undefined ? updates.leaderPassword : currentGrp.leaderPassword,
      color: updates.color || currentGrp.color,
    };
    data.groups[grpIndex] = updatedGrp;

    // If groupId changed, update profiles, registrations, results
    if (targetGroupId !== groupId) {
      data.profiles = data.profiles.map(p => p.groupId === groupId ? { ...p, groupId: targetGroupId, groupName: updatedGrp.name } : p);
      data.registrations = data.registrations.map(r => r.groupId === groupId ? { ...r, groupId: targetGroupId, groupName: updatedGrp.name } : r);
      data.results = data.results.map(r => ({
        ...r,
        firstPlaceGroupId: r.firstPlaceGroupId === groupId ? targetGroupId : r.firstPlaceGroupId,
        secondPlaceGroupId: r.secondPlaceGroupId === groupId ? targetGroupId : r.secondPlaceGroupId,
        thirdPlaceGroupId: r.thirdPlaceGroupId === groupId ? targetGroupId : r.thirdPlaceGroupId,
      }));
    } else if (updates.name && updates.name !== currentGrp.name) {
      // Update groupName everywhere
      data.profiles = data.profiles.map(p => p.groupId === groupId ? { ...p, groupName: updates.name } : p);
      data.registrations = data.registrations.map(r => r.groupId === groupId ? { ...r, groupName: updates.name } : r);
    }

    // Sync Leader Profile credentials if changed
    data.profiles = data.profiles.map(p => {
      if (p.role === 'leader' && (p.groupId === targetGroupId || p.groupId === groupId)) {
        return {
          ...p,
          groupId: targetGroupId,
          groupName: updatedGrp.name,
          userId: updates.leaderId || p.userId,
          password: updates.leaderPassword !== undefined ? updates.leaderPassword : p.password,
          name: updates.leaderName || p.name
        };
      }
      return p;
    });

    this.saveData(data);
    this.notify();
    return { success: true, message: 'Group details and Leader credentials updated successfully!' };
  }

  // Update Profile Credentials (Leader Password, Participant Chest No)
  public updateProfileCredentials(
    profileId: string,
    updates: {
      userId?: string;
      password?: string;
      name?: string;
      fatherName?: string;
      department?: string;
      category?: CategoryType;
      groupId?: string;
      photoUrl?: string;
    }
  ): { success: boolean; message: string } {
    const data = this.getData();
    const profIndex = data.profiles.findIndex(p => p.id === profileId);
    if (profIndex === -1) {
      return { success: false, message: 'Profile not found' };
    }

    const currentProfile = data.profiles[profIndex];
    const newUserId = updates.userId?.trim() || currentProfile.userId;

    if (currentProfile.role === 'participant') {
      if (updates.name !== undefined && !updates.name.trim()) {
        return { success: false, message: 'Participant Name is required.' };
      }
      if (updates.fatherName !== undefined && !updates.fatherName.trim()) {
        return { success: false, message: 'Second Name (Father Name) is required.' };
      }
    }

    // Check uniqueness of userId if changed
    if (newUserId.toLowerCase() !== currentProfile.userId.toLowerCase()) {
      if (data.profiles.some(p => p.id !== profileId && p.userId.toLowerCase() === newUserId.toLowerCase())) {
        return { success: false, message: `User ID "${newUserId}" is already assigned to another profile.` };
      }
    }

    let targetGroup = undefined;
    if (updates.groupId && updates.groupId !== currentProfile.groupId) {
      targetGroup = data.groups.find(g => g.id === updates.groupId);
    }

    const updatedProfile: UserProfile = {
      ...currentProfile,
      userId: newUserId,
      password: updates.password !== undefined ? updates.password : currentProfile.password,
      name: updates.name || currentProfile.name,
      fatherName: updates.fatherName !== undefined ? updates.fatherName : currentProfile.fatherName,
      department: updates.department !== undefined ? updates.department : currentProfile.department,
      category: updates.category || currentProfile.category,
      groupId: updates.groupId || currentProfile.groupId,
      groupName: targetGroup ? targetGroup.name : (updates.groupId ? currentProfile.groupName : currentProfile.groupName),
      photoUrl: updates.photoUrl !== undefined ? updates.photoUrl : currentProfile.photoUrl
    };

    data.profiles[profIndex] = updatedProfile;

    // If participant userId changed, update registrations
    if (currentProfile.role === 'participant') {
      const fullName = formatParticipantFullName(updatedProfile.name, updatedProfile.fatherName);
      data.registrations = data.registrations.map(r => {
        if (r.participantId === profileId) {
          return {
            ...r,
            participantUserId: newUserId,
            participantName: fullName,
            groupId: updatedProfile.groupId || r.groupId,
            groupName: updatedProfile.groupName || r.groupName
          };
        }
        return r;
      });

      if (Array.isArray(data.results)) {
        data.results = data.results.map(res => {
          let resUpdated = { ...res };
          if (res.firstPlaceRegId && data.registrations.some(r => r.id === res.firstPlaceRegId && r.participantId === profileId)) {
            resUpdated.firstPlaceParticipantName = fullName;
          }
          if (res.secondPlaceRegId && data.registrations.some(r => r.id === res.secondPlaceRegId && r.participantId === profileId)) {
            resUpdated.secondPlaceParticipantName = fullName;
          }
          if (res.thirdPlaceRegId && data.registrations.some(r => r.id === res.thirdPlaceRegId && r.participantId === profileId)) {
            resUpdated.thirdPlaceParticipantName = fullName;
          }
          return resUpdated;
        });
      }
    }

    // If leader userId / password changed, sync in Group record too
    if (currentProfile.role === 'leader' && currentProfile.groupId) {
      data.groups = data.groups.map(g => {
        if (g.id === currentProfile.groupId) {
          return {
            ...g,
            leaderId: newUserId,
            leaderPassword: updatedProfile.password || g.leaderPassword,
            leaderName: updatedProfile.name
          };
        }
        return g;
      });
    }

    this.saveData(data);
    this.notify();
    return { success: true, message: 'Profile updated successfully!' };
  }

  // Get Judge Profile
  public getJudgeProfile(): UserProfile {
    const profiles = this.getProfiles();
    const judge = profiles.find(p => p.role === 'judge' || p.id === 'usr-judge' || p.userId.toLowerCase() === 'judge');
    if (judge) return judge;
    return {
      id: 'usr-judge',
      userId: 'judge',
      password: 'judge123',
      name: 'Official Fest Judge',
      role: 'judge',
      created_at: new Date().toISOString()
    };
  }

  // Get Media Profile
  public getMediaProfile(): UserProfile {
    const profiles = this.getProfiles();
    const media = profiles.find(p => p.role === 'media' || p.id === 'usr-media' || p.userId.toLowerCase() === 'media');
    if (media) return media;
    return {
      id: 'usr-media',
      userId: 'media',
      password: 'media123',
      name: 'Press & Media Desk',
      role: 'media',
      created_at: new Date().toISOString()
    };
  }

  // Update Judge Password / Profile
  public updateJudgePassword(password: string, name?: string): { success: boolean; message: string } {
    const trimmed = password.trim();
    if (!trimmed) {
      return { success: false, message: 'Judge password cannot be empty.' };
    }
    const data = this.getData();
    let judgeIndex = data.profiles.findIndex(p => p.role === 'judge' || p.id === 'usr-judge' || p.userId.toLowerCase() === 'judge');
    if (judgeIndex === -1) {
      data.profiles.push({
        id: 'usr-judge',
        userId: 'judge',
        password: trimmed,
        name: name || 'Official Fest Judge',
        role: 'judge',
        created_at: new Date().toISOString()
      });
    } else {
      data.profiles[judgeIndex] = {
        ...data.profiles[judgeIndex],
        password: trimmed,
        name: name || data.profiles[judgeIndex].name || 'Official Fest Judge'
      };
    }
    this.saveData(data);
    this.notify();
    return { success: true, message: 'Judge password updated successfully!' };
  }

  // Update Media Password / Profile
  public updateMediaPassword(password: string, name?: string): { success: boolean; message: string } {
    const trimmed = password.trim();
    if (!trimmed) {
      return { success: false, message: 'Media password cannot be empty.' };
    }
    const data = this.getData();
    let mediaIndex = data.profiles.findIndex(p => p.role === 'media' || p.id === 'usr-media' || p.userId.toLowerCase() === 'media');
    if (mediaIndex === -1) {
      data.profiles.push({
        id: 'usr-media',
        userId: 'media',
        password: trimmed,
        name: name || 'Press & Media Desk',
        role: 'media',
        created_at: new Date().toISOString()
      });
    } else {
      data.profiles[mediaIndex] = {
        ...data.profiles[mediaIndex],
        password: trimmed,
        name: name || data.profiles[mediaIndex].name || 'Press & Media Desk'
      };
    }
    this.saveData(data);
    this.notify();
    return { success: true, message: 'Media password updated successfully!' };
  }

  // Delete Profile
  public deleteProfile(profileId: string): void {
    const data = this.getData();
    const deletedRegIds = data.registrations.filter(r => r.participantId === profileId).map(r => r.id);
    data.profiles = data.profiles.filter(p => p.id !== profileId);
    data.registrations = data.registrations.filter(r => r.participantId !== profileId);
    this.saveData(data);
    this.notify();
    if (isSupabaseConfigured) {
      deleteDocFromModularCloud('profiles', profileId).catch(() => {});
      if (deletedRegIds.length > 0) {
        batchDeleteDocsFromModularCloud('registrations', deletedRegIds).catch(() => {});
      }
    }
  }

  // Add Competition by Admin
  public addCompetition(comp: Omit<Competition, 'id' | 'isPublishedResult'>): Competition {
    const data = this.getData();
    const cleanBaseName = cleanCompetitionBaseName(comp.name);
    // Scheduled competitions only assigned to stages
    const isScheduled = Boolean(comp.scheduleTime && comp.scheduleTime.trim()) || comp.status === 'completed';
    const finalVenue = isScheduled ? (comp.venue || '') : '';
    const isStage = comp.isStage !== undefined ? comp.isStage : (finalVenue ? this.isStageVenue(finalVenue) : true);
    const finalStatus = comp.status === 'completed' ? 'completed' : (!isScheduled ? 'pending' : (comp.status || 'pending'));
    const finalIsRunning = !isScheduled ? false : (finalStatus === 'running');
    const newComp: Competition = {
      ...comp,
      venue: finalVenue,
      isStage,
      status: finalStatus,
      isRunning: finalIsRunning,
      name: cleanBaseName,
      id: `comp-${Date.now()}`,
      isPublishedResult: false
    };
    data.competitions.push(newComp);
    this.saveData(data);
    return newComp;
  }

  // Edit Competition
  public updateCompetition(updated: Competition): void {
    const data = this.getData();
    const cleanBaseName = cleanCompetitionBaseName(updated.name);
    // Scheduled competitions only assigned to stages, completed competitions preserve schedule status
    const isScheduled = Boolean(updated.scheduleTime && updated.scheduleTime.trim()) || updated.status === 'completed' || Boolean(updated.isPublishedResult);
    const finalVenue = updated.venue || '';
    const isStage = updated.isStage !== undefined ? updated.isStage : (finalVenue ? this.isStageVenue(finalVenue) : true);
    const finalStatus = updated.status || 'pending';
    const finalIsRunning = !isScheduled ? false : (finalStatus === 'running');
    const finalComp: Competition = {
      ...updated,
      venue: finalVenue,
      isStage,
      status: finalStatus,
      isRunning: finalIsRunning,
      name: cleanBaseName
    };
    data.competitions = data.competitions.map(c => c.id === updated.id ? finalComp : c);
    if (data.results) {
      data.results = data.results.map(r => {
        if (r.competitionId === updated.id) {
          return { ...r, competitionName: cleanBaseName };
        }
        return r;
      });
    }
    this.saveData(data);
    this.recalculateGroupPoints();
    this.notify();
  }

  // Batch Update Competitions (e.g. For Schedule Distribution)
  public updateCompetitionsBatch(updatedList: Competition[]): void {
    const data = this.getData();
    const updateMap = new Map<string, Competition>(
      updatedList.map(c => {
        const isScheduled = Boolean(c.scheduleTime && c.scheduleTime.trim()) || c.status === 'completed' || Boolean(c.isPublishedResult);
        const finalVenue = c.venue || '';
        const finalStatus = c.status || 'pending';
        const finalIsRunning = !isScheduled ? false : (finalStatus === 'running');
        return [c.id, {
          ...c,
          venue: finalVenue,
          status: finalStatus,
          isRunning: finalIsRunning,
          name: cleanCompetitionBaseName(c.name)
        }];
      })
    );
    data.competitions = data.competitions.map(c => updateMap.get(c.id) || c);
    this.saveData(data);
    this.recalculateGroupPoints();
    this.notify();
  }

  // Clear All Competition Schedules for clean rescheduling
  public clearAllCompetitionSchedules(): void {
    const data = this.getData();
    data.competitions = (data.competitions || []).map(c => ({
      ...c,
      scheduleTime: '',
      venue: '',
      isRunning: false,
      status: c.status === 'completed' ? 'completed' : 'pending'
    }));
    this.saveData(data);
    this.recalculateGroupPoints();
    this.notify();
  }

  // Get Festival Days
  public getFestivalDays(): FestivalDay[] {
    const data = this.getData();
    if (data.festivalDays !== undefined && Array.isArray(data.festivalDays)) {
      return data.festivalDays;
    }
    return DEFAULT_FESTIVAL_DAYS;
  }

  // Set Festival Days
  public setFestivalDays(days: FestivalDay[]): void {
    const data = this.getData();
    data.festivalDays = days;

    // Keep all existing scheduled competitions safe and preserved
    this.saveData(data);
    this.notify();
  }

  // Get Stage-Category Specifications
  public getStageCategoryMapping(): Record<string, string[]> {
    const data = this.getData();
    if (data.stageCategoryMapping && typeof data.stageCategoryMapping === 'object') {
      return data.stageCategoryMapping;
    }
    return {};
  }

  // Set Stage-Category Specifications
  public setStageCategoryMapping(mapping: Record<string, string[]>): void {
    const data = this.getData();
    data.stageCategoryMapping = mapping;
    this.saveData(data);
    this.notify();
  }

  // Get All Categories
  public getCategories(): string[] {
    const data = this.getData();
    const storedCats = data.categories && Array.isArray(data.categories) && data.categories.length > 0
      ? data.categories
      : DEFAULT_CATEGORIES;
    const compCats = data.competitions.map(c => c.category);
    // Unique list preserving order
    const list: string[] = [];
    [...storedCats, ...compCats, 'General'].forEach(cat => {
      if (cat && !list.some(existing => existing.toLowerCase() === cat.toLowerCase())) {
        list.push(cat);
      }
    });
    return list;
  }

  // Add Category
  public addCategory(catName: string): { success: boolean; message: string } {
    const trimmed = catName.trim();
    if (!trimmed) {
      return { success: false, message: 'Category name cannot be empty.' };
    }
    const categories = this.getCategories();
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, message: `Category "${trimmed}" already exists.` };
    }

    const data = this.getData();
    data.categories = [...categories, trimmed];
    this.saveData(data);
    this.notify();
    return { success: true, message: `Category "${trimmed}" added successfully!` };
  }

  // Delete Category
  public deleteCategory(catName: string, reassignTo: string = 'General'): { success: boolean; affectedCount: number } {
    const categories = this.getCategories();
    const filteredCategories = categories.filter(c => c.toLowerCase() !== catName.toLowerCase());

    const data = this.getData();
    data.categories = filteredCategories;

    let affectedCount = 0;
    data.competitions = data.competitions.map(comp => {
      if (comp.category.toLowerCase() === catName.toLowerCase()) {
        affectedCount++;
        const baseName = cleanCompetitionBaseName(comp.name);
        return { ...comp, name: baseName, category: reassignTo };
      }
      return comp;
    });

    if (data.results) {
      data.results = data.results.map(r => {
        const comp = data.competitions.find(c => c.id === r.competitionId);
        if (comp) {
          return { ...r, competitionName: comp.name };
        }
        return r;
      });
    }

    this.saveData(data);
    this.notify();
    return { success: true, affectedCount };
  }

  // Get All Levels
  public getLevels(): string[] {
    const data = this.getData();
    const storedLevels = data.levels && Array.isArray(data.levels) && data.levels.length > 0
      ? data.levels
      : DEFAULT_LEVELS;
    const profileDepts = data.profiles.map(p => p.department).filter(Boolean) as string[];
    // Unique list preserving order
    const list: string[] = [];
    [...storedLevels, ...profileDepts].forEach(lvl => {
      if (lvl && !list.some(existing => existing.toLowerCase() === lvl.toLowerCase())) {
        list.push(lvl);
      }
    });
    return list;
  }

  // Add Level
  public addLevel(levelName: string): { success: boolean; message: string } {
    const trimmed = levelName.trim();
    if (!trimmed) {
      return { success: false, message: 'Level name cannot be empty.' };
    }
    const levels = this.getLevels();
    if (levels.some(l => l.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, message: `Level "${trimmed}" already exists.` };
    }

    const data = this.getData();
    data.levels = [...levels, trimmed];
    this.saveData(data);
    this.notify();
    return { success: true, message: `Level "${trimmed}" added successfully!` };
  }

  // Update / Rename Level
  public updateLevel(oldLevelName: string, newLevelName: string): { success: boolean; message: string; affectedCount?: number } {
    const trimmedNew = newLevelName.trim();
    if (!trimmedNew) {
      return { success: false, message: 'Level name cannot be empty.' };
    }

    const levels = this.getLevels();
    const existsOther = levels.some(
      l => l.toLowerCase() === trimmedNew.toLowerCase() && l.toLowerCase() !== oldLevelName.toLowerCase()
    );
    if (existsOther) {
      return { success: false, message: `Level "${trimmedNew}" already exists.` };
    }

    const data = this.getData();
    const storedLevels = data.levels && Array.isArray(data.levels) && data.levels.length > 0
      ? data.levels
      : DEFAULT_LEVELS;

    const updatedLevels = storedLevels.map(l => (l.toLowerCase() === oldLevelName.toLowerCase() ? trimmedNew : l));
    if (!updatedLevels.some(l => l.toLowerCase() === trimmedNew.toLowerCase())) {
      updatedLevels.push(trimmedNew);
    }
    data.levels = updatedLevels;

    let affectedCount = 0;
    data.profiles = data.profiles.map(p => {
      if (p.department && p.department.toLowerCase() === oldLevelName.toLowerCase()) {
        affectedCount++;
        return { ...p, department: trimmedNew };
      }
      return p;
    });

    this.saveData(data);
    this.notify();
    return {
      success: true,
      message: `Level "${oldLevelName}" renamed to "${trimmedNew}" successfully! (${affectedCount} student profile(s) updated)`,
      affectedCount
    };
  }

  // Delete Level
  public deleteLevel(levelName: string, reassignTo: string = '1'): { success: boolean; affectedCount: number } {
    const levels = this.getLevels();
    const filteredLevels = levels.filter(l => l.toLowerCase() !== levelName.toLowerCase());

    const data = this.getData();
    data.levels = filteredLevels;

    let affectedCount = 0;
    data.profiles = data.profiles.map(p => {
      if (p.department && p.department.toLowerCase() === levelName.toLowerCase()) {
        affectedCount++;
        return { ...p, department: reassignTo };
      }
      return p;
    });

    this.saveData(data);
    this.notify();
    return { success: true, affectedCount };
  }

  // Get All Stage Items with Stage/Off-Stage Type
  public getStageItems(): StageItem[] {
    const data = this.getData();
    const storedStages = data.stages && Array.isArray(data.stages) && data.stages.length > 0
      ? data.stages
      : DEFAULT_STAGES;
    const compVenues = data.competitions.map(c => c.venue).filter(Boolean);
    const itemsMap = new Map<string, StageItem>();

    storedStages.forEach((st, idx) => {
      if (!st) return;
      if (typeof st === 'string') {
        const trimmed = st.trim();
        if (!trimmed) return;
        const normKey = formatStageName(trimmed).toLowerCase();
        if (!itemsMap.has(normKey)) {
          const isOff = trimmed.toLowerCase().includes('off');
          itemsMap.set(normKey, {
            id: `stg-${idx + 1}-${trimmed}`,
            name: trimmed,
            isStage: !isOff
          });
        }
      } else if (typeof st === 'object' && st.name) {
        const trimmed = st.name.trim();
        if (!trimmed) return;
        const normKey = formatStageName(trimmed).toLowerCase();
        if (!itemsMap.has(normKey)) {
          itemsMap.set(normKey, {
            id: st.id || `stg-${idx + 1}-${trimmed}`,
            name: trimmed,
            isStage: st.isStage !== undefined ? !!st.isStage : !trimmed.toLowerCase().includes('off')
          });
        }
      }
    });

    // Also include any venues found in competitions
    compVenues.forEach((v, idx) => {
      const trimmed = String(v).trim();
      if (!trimmed) return;
      const normKey = formatStageName(trimmed).toLowerCase();
      if (!itemsMap.has(normKey)) {
        const isOff = trimmed.toLowerCase().includes('off');
        itemsMap.set(normKey, {
          id: `stg-comp-${idx + 1}-${trimmed}`,
          name: trimmed,
          isStage: !isOff
        });
      }
    });

    return Array.from(itemsMap.values());
  }

  // Get All Stages (names list)
  public getStages(): string[] {
    return this.getStageItems().map(s => s.name);
  }

  // Check if a venue is configured as Stage (On-Stage) vs Off-Stage
  public isStageVenue(venueName: string | undefined | null): boolean {
    if (!venueName) return true;
    const items = this.getStageItems();
    const found = items.find(s => areStageNamesEqual(s.name, venueName));
    if (found) return found.isStage;
    const trimmed = String(venueName).trim().toLowerCase();
    if (trimmed.includes('off')) return false;
    return true;
  }

  // Add Stage (with stage vs off-stage type)
  public addStage(stageName: string, isStage: boolean = true): { success: boolean; message: string } {
    const trimmed = stageName.trim();
    if (!trimmed) {
      return { success: false, message: 'Stage name cannot be empty.' };
    }
    const currentItems = this.getStageItems();
    if (currentItems.some(s => areStageNamesEqual(s.name, trimmed))) {
      return { success: false, message: `Stage "${trimmed}" already exists.` };
    }

    const newItem: StageItem = {
      id: `stg-${Date.now()}`,
      name: trimmed,
      isStage
    };

    const data = this.getData();
    data.stages = [...currentItems, newItem];
    this.saveData(data);
    this.notify();
    return { success: true, message: `Stage "${trimmed}" (${isStage ? 'Stage' : 'Off-Stage'}) added successfully!` };
  }

  // Update Stage Name and/or Type
  public updateStage(oldName: string, newName: string, isStage?: boolean): { success: boolean; message: string; affectedCount: number } {
    const trimmedNew = newName.trim();
    if (!trimmedNew) {
      return { success: false, message: 'Stage name cannot be empty.', affectedCount: 0 };
    }
    const currentItems = this.getStageItems();
    if (currentItems.some(s => areStageNamesEqual(s.name, trimmedNew) && !areStageNamesEqual(s.name, oldName))) {
      return { success: false, message: `Stage "${trimmedNew}" already exists.`, affectedCount: 0 };
    }

    const targetIsStage = isStage !== undefined ? isStage : this.isStageVenue(oldName);

    const data = this.getData();
    const updatedStages = currentItems.map(s => {
      if (areStageNamesEqual(s.name, oldName)) {
        return {
          ...s,
          name: trimmedNew,
          isStage: targetIsStage
        };
      }
      return s;
    });
    data.stages = updatedStages;

    let affectedCount = 0;
    data.competitions = data.competitions.map(comp => {
      if (comp.venue && areStageNamesEqual(comp.venue, oldName)) {
        affectedCount++;
        return {
          ...comp,
          venue: trimmedNew as any,
          isStage: targetIsStage
        };
      }
      return comp;
    });

    this.saveData(data);
    this.notify();
    return {
      success: true,
      message: `Stage updated to "${trimmedNew}" (${targetIsStage ? 'Stage' : 'Off-Stage'}) successfully!`,
      affectedCount
    };
  }

  // Quick Toggle / Set Stage Type (Stage vs Off-Stage)
  public setStageType(stageName: string, isStage: boolean): { success: boolean; message: string; affectedCount: number } {
    const data = this.getData();
    const currentItems = this.getStageItems();
    const updatedStages = currentItems.map(s => {
      if (areStageNamesEqual(s.name, stageName)) {
        return { ...s, isStage };
      }
      return s;
    });
    data.stages = updatedStages;

    let affectedCount = 0;
    data.competitions = data.competitions.map(comp => {
      if (comp.venue && areStageNamesEqual(comp.venue, stageName)) {
        affectedCount++;
        return { ...comp, isStage };
      }
      return comp;
    });

    this.saveData(data);
    this.notify();
    return {
      success: true,
      message: `Stage "${formatStageName(stageName)}" set to ${isStage ? 'Stage (On-Stage)' : 'Off-Stage'}. (${affectedCount} competition(s) updated)`,
      affectedCount
    };
  }

  // Delete Stage
  public deleteStage(stageName: string, reassignTo: string = '1'): { success: boolean; affectedCount: number } {
    const currentItems = this.getStageItems();
    const filteredStages = currentItems.filter(s => !areStageNamesEqual(s.name, stageName));

    const data = this.getData();
    data.stages = filteredStages.length > 0 ? filteredStages : [{ id: 'stg-1', name: '1', isStage: true }];

    const targetIsStage = this.isStageVenue(reassignTo);

    let affectedCount = 0;
    data.competitions = data.competitions.map(comp => {
      if (comp.venue && areStageNamesEqual(comp.venue, stageName)) {
        affectedCount++;
        return { ...comp, venue: reassignTo as any, isStage: targetIsStage };
      }
      return comp;
    });

    this.saveData(data);
    this.notify();
    return { success: true, affectedCount };
  }

  // Delete Competition
  public deleteCompetition(competitionId: string): void {
    const data = this.getData();
    const deletedRegIds = data.registrations.filter(r => r.competitionId === competitionId).map(r => r.id);
    const deletedResultIds = data.results.filter(r => r.competitionId === competitionId).map(r => r.id);
    data.competitions = data.competitions.filter(c => c.id !== competitionId);
    data.registrations = data.registrations.filter(r => r.competitionId !== competitionId);
    data.results = data.results.filter(r => r.competitionId !== competitionId);
    this.saveData(data);
    this.recalculateGroupPoints();
    this.notify();
    if (isSupabaseConfigured) {
      deleteDocFromModularCloud('competitions', competitionId).catch(() => {});
      if (deletedRegIds.length > 0) {
        batchDeleteDocsFromModularCloud('registrations', deletedRegIds).catch(() => {});
      }
      if (deletedResultIds.length > 0) {
        batchDeleteDocsFromModularCloud('results', deletedResultIds).catch(() => {});
      }
    }
  }

  // Delete Group
  public deleteGroup(groupId: string): void {
    const data = this.getData();
    const deletedProfIds = data.profiles.filter(p => p.groupId === groupId).map(p => p.id);
    const deletedRegIds = data.registrations.filter(r => r.groupId === groupId).map(r => r.id);
    data.groups = data.groups.filter(g => g.id !== groupId);
    data.profiles = data.profiles.filter(p => p.groupId !== groupId);
    data.registrations = data.registrations.filter(r => r.groupId !== groupId);
    data.results = data.results.filter(r => 
      r.firstPlaceGroupId !== groupId && 
      r.secondPlaceGroupId !== groupId && 
      r.thirdPlaceGroupId !== groupId
    );
    this.saveData(data);
    this.recalculateGroupPoints();
    this.notify();
    if (isSupabaseConfigured) {
      deleteDocFromModularCloud('groups', groupId).catch(() => {});
      if (deletedProfIds.length > 0) {
        batchDeleteDocsFromModularCloud('profiles', deletedProfIds).catch(() => {});
      }
      if (deletedRegIds.length > 0) {
        batchDeleteDocsFromModularCloud('registrations', deletedRegIds).catch(() => {});
      }
    }
  }

  // --- Competition & Participant Limits Configuration ---
  public getLimitRules(): LimitRulesConfig {
    const data = this.getData();
    if (!data.limitRules) {
      return DEFAULT_LIMIT_RULES;
    }
    return {
      defaultStageLimit: data.limitRules.defaultStageLimit ?? DEFAULT_LIMIT_RULES.defaultStageLimit,
      defaultOffStageLimit: data.limitRules.defaultOffStageLimit ?? DEFAULT_LIMIT_RULES.defaultOffStageLimit,
      categoryLimits: {
        ...DEFAULT_LIMIT_RULES.categoryLimits,
        ...(data.limitRules.categoryLimits || {})
      }
    };
  }

  public updateLimitRules(newRules: LimitRulesConfig): void {
    const data = this.getData();
    data.limitRules = newRules;
    this.saveData(data);
    this.notify();
  }

  public getCategoryLimit(categoryName?: string | null): CategoryLimitRule {
    const rules = this.getLimitRules();
    const defaultRule: CategoryLimitRule = {
      stage: rules.defaultStageLimit ?? 3,
      offStage: rules.defaultOffStageLimit ?? 5
    };

    if (!categoryName) return defaultRule;

    const trimmed = categoryName.trim();
    if (rules.categoryLimits[trimmed]) {
      return rules.categoryLimits[trimmed];
    }

    // Case-insensitive / normalized lookup
    const lower = trimmed.toLowerCase();
    const cleanKey = lower.replace(/[-_]/g, ' ');
    for (const [key, val] of Object.entries(rules.categoryLimits)) {
      const norm = key.toLowerCase().replace(/[-_]/g, ' ');
      if (norm === cleanKey || norm === lower) {
        return val;
      }
    }

    return defaultRule;
  }

  public getParticipantEnrollmentStats(
    participantId: string,
    competitionCategory?: string
  ): {
    stageCount: number;
    offStageCount: number;
    totalCount: number;
    groupEventsCount: number;
    stageLimit: number;
    offStageLimit: number;
    isStageLimitReached: boolean;
    isOffStageLimitReached: boolean;
    category: string;
    categoryBreakdown?: Record<string, {
      stageCount: number;
      offStageCount: number;
      totalCount: number;
      stageLimit: number;
      offStageLimit: number;
      isStageLimitReached: boolean;
      isOffStageLimitReached: boolean;
    }>;
  } {
    const data = this.getData();
    const partRegs = data.registrations.filter(r => r.participantId === participantId);
    const registeredComps = partRegs.map(r => data.competitions.find(c => c.id === r.competitionId)).filter(Boolean) as Competition[];

    // Group competitions are NOT counted against participant limits; only Individual competitions count
    const individualComps = registeredComps.filter(c => c.type !== 'Group');
    const groupComps = registeredComps.filter(c => c.type === 'Group');

    // Build breakdown for all festival categories
    const allCategories = this.getCategories();
    const categoryBreakdown: Record<string, {
      stageCount: number;
      offStageCount: number;
      totalCount: number;
      stageLimit: number;
      offStageLimit: number;
      isStageLimitReached: boolean;
      isOffStageLimitReached: boolean;
    }> = {};

    allCategories.forEach(cat => {
      const catRule = this.getCategoryLimit(cat);
      const catComps = individualComps.filter(
        c => (c.category || 'General').trim().toLowerCase() === cat.trim().toLowerCase()
      );
      const s = catComps.filter(c => c.isStage !== undefined ? c.isStage : this.isStageVenue(c.venue)).length;
      const o = catComps.filter(c => !(c.isStage !== undefined ? c.isStage : this.isStageVenue(c.venue))).length;
      categoryBreakdown[cat] = {
        stageCount: s,
        offStageCount: o,
        totalCount: s + o,
        stageLimit: catRule.stage,
        offStageLimit: catRule.offStage,
        isStageLimitReached: s >= catRule.stage,
        isOffStageLimitReached: o >= catRule.offStage
      };
    });

    // Resolve target competition category (Limits work based on competition category)
    let targetCategory = competitionCategory?.trim();
    if (!targetCategory) {
      if (individualComps.length > 0 && individualComps[0].category) {
        targetCategory = individualComps[0].category.trim();
      } else {
        targetCategory = 'General';
      }
    }

    const limitRule = this.getCategoryLimit(targetCategory);
    const compCategoryIndComps = individualComps.filter(
      c => (c.category || 'General').trim().toLowerCase() === targetCategory.toLowerCase()
    );

    const stageCount = compCategoryIndComps.filter(c => c.isStage !== undefined ? c.isStage : this.isStageVenue(c.venue)).length;
    const offStageCount = compCategoryIndComps.filter(c => !(c.isStage !== undefined ? c.isStage : this.isStageVenue(c.venue))).length;
    const totalCount = stageCount + offStageCount;

    return {
      stageCount,
      offStageCount,
      totalCount,
      groupEventsCount: groupComps.length,
      stageLimit: limitRule.stage,
      offStageLimit: limitRule.offStage,
      isStageLimitReached: stageCount >= limitRule.stage,
      isOffStageLimitReached: offStageCount >= limitRule.offStage,
      category: targetCategory,
      categoryBreakdown
    };
  }

  // Register Participant to Competition
  public registerParticipantToComp(competitionId: string, participantId: string): { success: boolean; message: string } {
    const data = this.getData();
    const comp = data.competitions.find(c => c.id === competitionId);
    const part = data.profiles.find(p => p.id === participantId);

    if (!comp || !part || !part.groupId) {
      return { success: false, message: 'Invalid competition or participant profile' };
    }

    // Check if competition registration is closed by Admin
    const config = this.getParticipantIdConfig(part.groupId);
    if (config.isCompLocked) {
      return { success: false, message: 'Competition registration has been closed by the Admin.' };
    }

    // Check if already registered
    const existing = data.registrations.find(
      r => r.competitionId === competitionId && r.participantId === participantId
    );
    if (existing) {
      return { success: false, message: 'Participant is already registered for this event!' };
    }

    // Check per-group entry limit for this competition
    const groupEntries = data.registrations.filter(
      r => r.competitionId === competitionId && r.groupId === part.groupId
    );
    if (groupEntries.length >= comp.maxEntriesPerGroup) {
      return {
        success: false,
        message: `Maximum entry limit reached! ${part.groupName} already has ${groupEntries.length}/${comp.maxEntriesPerGroup} entries.`
      };
    }

    // Check per-competition category limits (Stage & Off-Stage)
    // NOTE: Limits are strictly evaluated based on the competition category, not participant category.
    // NOTE: Group competitions do NOT count towards participant limit quotas; only Individual competitions count.
    if (comp.type !== 'Group') {
      const isStageEvent = comp.isStage !== undefined ? comp.isStage : this.isStageVenue(comp.venue);
      const compCategory = comp.category || 'General';
      const partStats = this.getParticipantEnrollmentStats(participantId, compCategory);

      if (isStageEvent && partStats.stageCount >= partStats.stageLimit) {
        return {
          success: false,
          message: `Limit reached: ${part.name} has already reached the maximum of ${partStats.stageLimit} Individual Stage competition(s) in the "${compCategory}" category. Group events are not limited.`
        };
      }

      if (!isStageEvent && partStats.offStageCount >= partStats.offStageLimit) {
        return {
          success: false,
          message: `Limit reached: ${part.name} has already reached the maximum of ${partStats.offStageLimit} Individual Off-Stage competition(s) in the "${compCategory}" category. Group events are not limited.`
        };
      }
    }

    const compRegs = data.registrations.filter(r => r.competitionId === competitionId);
    const getCodeLetter = (idx: number): string => {
      let letter = '';
      let temp = idx;
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };

    const fullName = formatParticipantFullName(part.name, part.fatherName);
    const newReg: Registration = {
      id: `reg-${Date.now()}`,
      competitionId,
      participantId,
      participantName: fullName,
      participantUserId: part.userId,
      groupId: part.groupId,
      groupName: part.groupName || '',
      registeredAt: new Date().toISOString(),
      isReported: false,
      codeLetter: ''
    };

    data.registrations.push(newReg);
    this.saveData(data);
    return { success: true, message: `Successfully registered ${fullName} for ${comp.name}!` };
  }

  // Register Multiple Participants to Competition
  public registerMultipleParticipantsToComp(competitionId: string, participantIds: string[]): {
    success: boolean;
    registeredCount: number;
    failedCount: number;
    messages: string[];
    summary: string;
  } {
    if (!participantIds || participantIds.length === 0) {
      return { success: false, registeredCount: 0, failedCount: 0, messages: ['No participants selected.'], summary: 'Please select at least one participant.' };
    }

    const data = this.getData();
    const comp = data.competitions.find(c => c.id === competitionId);
    if (!comp) {
      return { success: false, registeredCount: 0, failedCount: participantIds.length, messages: ['Invalid competition.'], summary: 'Invalid competition selected.' };
    }

    const messages: string[] = [];
    const newRegistrations: Registration[] = [];
    let registeredCount = 0;
    let failedCount = 0;

    for (let i = 0; i < participantIds.length; i++) {
      const partId = participantIds[i];
      const part = data.profiles.find(p => p.id === partId);
      if (!part || !part.groupId) {
        messages.push(`Invalid participant (${partId})`);
        failedCount++;
        continue;
      }

      // Check locked
      const config = this.getParticipantIdConfig(part.groupId);
      if (config.isCompLocked) {
        messages.push(`Registration closed for ${part.groupName || 'Group'}`);
        failedCount++;
        continue;
      }

      // Check existing
      const existing = data.registrations.find(
        r => r.competitionId === competitionId && r.participantId === partId
      ) || newRegistrations.find(
        r => r.competitionId === competitionId && r.participantId === partId
      );
      if (existing) {
        messages.push(`${part.name} is already enrolled`);
        failedCount++;
        continue;
      }

      // Check group max entries limit
      const currentGroupEntries = data.registrations.filter(
        r => r.competitionId === competitionId && r.groupId === part.groupId
      ).length + newRegistrations.filter(
        r => r.competitionId === competitionId && r.groupId === part.groupId
      ).length;

      if (currentGroupEntries >= comp.maxEntriesPerGroup) {
        messages.push(`Group entry limit (${comp.maxEntriesPerGroup}) reached for ${part.groupName || ''}`);
        failedCount++;
        continue;
      }

      // Check individual participant competition category limits
      if (comp.type !== 'Group') {
        const isStageEvent = comp.isStage !== undefined ? comp.isStage : this.isStageVenue(comp.venue);
        const compCategory = comp.category || 'General';
        const partStats = this.getParticipantEnrollmentStats(partId, compCategory);

        if (isStageEvent && partStats.stageCount >= partStats.stageLimit) {
          messages.push(`${part.name}: Max Stage limit (${partStats.stageLimit}) reached in "${compCategory}" category`);
          failedCount++;
          continue;
        }

        if (!isStageEvent && partStats.offStageCount >= partStats.offStageLimit) {
          messages.push(`${part.name}: Max Off-Stage limit (${partStats.offStageLimit}) reached in "${compCategory}" category`);
          failedCount++;
          continue;
        }
      }

      const fullName = formatParticipantFullName(part.name, part.fatherName);
      const newReg: Registration = {
        id: `reg-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        competitionId,
        participantId: partId,
        participantName: fullName,
        participantUserId: part.userId,
        groupId: part.groupId,
        groupName: part.groupName || '',
        registeredAt: new Date().toISOString(),
        isReported: false,
        codeLetter: ''
      };

      newRegistrations.push(newReg);
      registeredCount++;
    }

    if (newRegistrations.length > 0) {
      data.registrations.push(...newRegistrations);
      this.saveData(data);
    }

    const isSuccess = registeredCount > 0;
    const summary = isSuccess
      ? (failedCount === 0
          ? `Successfully enrolled ${registeredCount} participant${registeredCount > 1 ? 's' : ''} for ${comp.name}!`
          : `Enrolled ${registeredCount} participant${registeredCount > 1 ? 's' : ''}. (${failedCount} skipped due to limits or duplicates: ${messages.join(', ')})`)
      : (messages.join(', ') || 'Enrollment failed.');

    return {
      success: isSuccess,
      registeredCount,
      failedCount,
      messages,
      summary
    };
  }

  // Update participant reporting status (present / absent)
  public updateRegistrationReporting(registrationId: string, isReported: boolean): void {
    const data = this.getData();
    const reg = data.registrations.find(r => r.id === registrationId);
    if (reg) {
      reg.isReported = isReported;
      if (!isReported) {
        reg.codeLetter = '';
      }
      this.saveData(data, true);
      if (isSupabaseConfigured) {
        this.mutateCloudDoc('registrations', registrationId, reg).catch(() => {});
      }
    }
  }

  // Update candidate assigned code letter
  public updateRegistrationCodeLetter(registrationId: string, codeLetter: string): void {
    const data = this.getData();
    const reg = data.registrations.find(r => r.id === registrationId);
    if (reg) {
      const sanitized = (codeLetter || '').trim().toUpperCase();
      reg.codeLetter = sanitized;
      // If a code letter is explicitly assigned, make sure candidate is marked reported
      if (sanitized && !reg.isReported) {
        reg.isReported = true;
      }
      this.saveData(data, true);
      if (isSupabaseConfigured) {
        this.mutateCloudDoc('registrations', registrationId, reg).catch(() => {});
      }
    }
  }

  // Update candidate valuation marks and optional judge rank
  public updateRegistrationMark(registrationId: string, mark: string, judgeRank?: number): void {
    const data = this.getData();
    const reg = data.registrations.find(r => r.id === registrationId);
    if (reg) {
      reg.mark = mark.trim();
      if (judgeRank !== undefined) {
        reg.judgeRank = judgeRank > 0 ? judgeRank : undefined;
      }
      this.saveData(data, true);
      if (isSupabaseConfigured) {
        this.mutateCloudDoc('registrations', registrationId, reg).catch(() => {});
      }
    }
  }

  // Update candidate judge rank position (1st, 2nd, 3rd)
  public updateRegistrationJudgeRank(registrationId: string, judgeRank?: number): void {
    const data = this.getData();
    const reg = data.registrations.find(r => r.id === registrationId);
    if (reg) {
      reg.judgeRank = judgeRank && judgeRank > 0 ? judgeRank : undefined;
      this.saveData(data, true);
      if (isSupabaseConfigured) {
        this.mutateCloudDoc('registrations', registrationId, reg).catch(() => {});
      }
    }
  }

  // Delete/Remove a participant registration
  public deleteRegistration(registrationId: string): void {
    const data = this.getData();
    data.registrations = data.registrations.filter(r => r.id !== registrationId);
    this.saveData(data, true);
    if (isSupabaseConfigured) {
      deleteDocFromModularCloud('registrations', registrationId).catch(() => {});
    }
  }

  // Bulk update reporting status for all participants in a competition
  public bulkUpdateReporting(competitionId: string, isReported: boolean): void {
    const data = this.getData();
    data.registrations = data.registrations.map(r => {
      if (r.competitionId === competitionId) {
        return {
          ...r,
          isReported,
          codeLetter: isReported ? r.codeLetter : ''
        };
      }
      return r;
    });
    this.saveData(data, true);
    if (isSupabaseConfigured) {
      const updatedRegs = data.registrations.filter(r => r.competitionId === competitionId);
      this.mutateCloudBatch('registrations', updatedRegs).catch(() => {});
    }
  }

  // Clear all assigned code letters for a specific competition
  public clearCompetitionCodeLetters(competitionId: string): void {
    const data = this.getData();
    data.registrations = data.registrations.map(r => {
      if (r.competitionId === competitionId) {
        return { ...r, codeLetter: '' };
      }
      return r;
    });
    this.saveData(data, true);
    if (isSupabaseConfigured) {
      const updatedRegs = data.registrations.filter(r => r.competitionId === competitionId);
      this.mutateCloudBatch('registrations', updatedRegs).catch(() => {});
    }
  }

  // Automatically generate code letters (A, B, C...) with optional blind randomized order
  // When onlyReported is true (or by default when some are reported), only generates code letters for reported candidates
  public autoGenerateCodeLetters(competitionId: string, randomize = true, onlyReported = true): void {
    const data = this.getData();
    let compRegs = data.registrations.filter(r => r.competitionId === competitionId);
    
    // If onlyReported is true, only assign letters to participants marked as reported (present)
    let targetRegs = onlyReported ? compRegs.filter(r => r.isReported === true) : compRegs;
    if (targetRegs.length === 0) {
      targetRegs = compRegs;
    }

    if (randomize) {
      // Shuffle candidates randomly for blind judging
      targetRegs = [...targetRegs].sort(() => Math.random() - 0.5);
    } else {
      // Sort deterministically by participant chest number/userId
      targetRegs = [...targetRegs].sort((a, b) => (a.participantUserId || '').localeCompare(b.participantUserId || ''));
    }

    const getCodeLetter = (idx: number): string => {
      let letter = '';
      let temp = idx;
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };

    const letterMap = new Map<string, string>();
    targetRegs.forEach((r, idx) => {
      letterMap.set(r.id, getCodeLetter(idx));
    });

    data.registrations = data.registrations.map(r => {
      if (r.competitionId === competitionId) {
        if (letterMap.has(r.id)) {
          return { ...r, codeLetter: letterMap.get(r.id) };
        } else if (onlyReported && !r.isReported) {
          return { ...r, codeLetter: '' };
        }
      }
      return r;
    });

    this.saveData(data, true);
    if (isSupabaseConfigured) {
      const updatedRegs = data.registrations.filter(r => r.competitionId === competitionId);
      this.mutateCloudBatch('registrations', updatedRegs).catch(() => {});
    }
  }

  // Delete registration
  public cancelRegistration(registrationId: string): void {
    const data = this.getData();
    const reg = data.registrations.find(r => r.id === registrationId);
    if (reg) {
      const config = this.getParticipantIdConfig(reg.groupId);
      if (config.isCompLocked) {
        throw new Error('Competition registration is closed. Withdrawals are locked.');
      }
    }
    data.registrations = data.registrations.filter(r => r.id !== registrationId);
    this.saveData(data);
    this.notify();
  }

  // Helper to extract all 1st, 2nd, 3rd winners from a Result
  public getResultWinners(res: Result): {
    first: WinnerDetail[];
    second: WinnerDetail[];
    third: WinnerDetail[];
  } {
    const data = this.getData();
    const regs = Array.isArray(data?.registrations) ? data.registrations : INITIAL_REGISTRATIONS;

    const buildWinner = (regId?: string, name?: string, groupId?: string, groupName?: string, code?: string): WinnerDetail | null => {
      if (!regId && !name) return null;
      const reg = regId ? regs.find(r => r.id === regId) : undefined;
      const finalName = this.getParticipantFullName(name || reg?.participantName, regId);
      return {
        regId: regId || reg?.id || '',
        participantName: finalName,
        groupId: groupId || reg?.groupId || '',
        groupName: groupName || reg?.groupName || '',
        codeLetter: code || reg?.codeLetter,
        photoUrl: this.getParticipantPhotoUrl(finalName, regId || reg?.id),
        mark: reg?.mark,
        score: reg?.mark ? Number(reg.mark) : undefined
      };
    };

    let first: WinnerDetail[] = (res.firstPlaceWinners && res.firstPlaceWinners.length > 0)
      ? res.firstPlaceWinners
      : ([buildWinner(res.firstPlaceRegId, res.firstPlaceParticipantName, res.firstPlaceGroupId, res.firstPlaceGroupName, res.firstPlaceCodeLetter)].filter(Boolean) as WinnerDetail[]);

    let second: WinnerDetail[] = (res.secondPlaceWinners && res.secondPlaceWinners.length > 0)
      ? res.secondPlaceWinners
      : ([buildWinner(res.secondPlaceRegId, res.secondPlaceParticipantName, res.secondPlaceGroupId, res.secondPlaceGroupName, res.secondPlaceCodeLetter)].filter(Boolean) as WinnerDetail[]);

    let third: WinnerDetail[] = (res.thirdPlaceWinners && res.thirdPlaceWinners.length > 0)
      ? res.thirdPlaceWinners
      : ([buildWinner(res.thirdPlaceRegId, res.thirdPlaceParticipantName, res.thirdPlaceGroupId, res.thirdPlaceGroupName, res.thirdPlaceCodeLetter)].filter(Boolean) as WinnerDetail[]);

    return { first, second, third };
  }

  // Submit/Publish Competition Result (Supports multiple winners for 1st, 2nd, and 3rd)
  public publishResult(
    competitionId: string,
    firstPlaceRegIds: string | string[],
    secondPlaceRegIds?: string | string[],
    thirdPlaceRegIds?: string | string[],
    useDetailedPoints?: boolean,
    participantPointsMap?: Record<string, {
      competitionPoints: number;
      performancePoints: number;
      totalPoints: number;
      grade: string;
      score: number;
    }>
  ): Result {
    const data = this.getData();
    const comp = data.competitions.find(c => c.id === competitionId);
    const regs = data.registrations.filter(r => r.competitionId === competitionId);

    const toArray = (v?: string | string[]): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.filter(Boolean);
      return [v].filter(Boolean);
    };

    const firstIds = toArray(firstPlaceRegIds);
    const secondIds = toArray(secondPlaceRegIds);
    const thirdIds = toArray(thirdPlaceRegIds);

    if (!comp || firstIds.length === 0) {
      throw new Error('At least one 1st Place winner selection is required!');
    }

    // Verify that the competition has been evaluated & scored by the Judge
    const reportedRegs = regs.filter(r => r.isReported === true);
    const hasJudgeScores = reportedRegs.length > 0 && reportedRegs.some(r => r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '');
    if (!hasJudgeScores) {
      throw new Error('Cannot publish result: Competition has not been evaluated and scored by the Official Fest Judge.');
    }

    // Remove old result for this competition if re-publishing
    data.results = data.results.filter(r => r.competitionId !== competitionId);

    const mapWinnerDetails = (idList: string[]): WinnerDetail[] => {
      return idList.map(id => {
        const reg = regs.find(r => r.id === id);
        if (!reg) return null;
        const fullName = this.getParticipantFullName(reg.participantName, id);
        return {
          regId: id,
          participantName: fullName,
          groupId: reg.groupId,
          groupName: reg.groupName,
          codeLetter: reg.codeLetter || undefined,
          photoUrl: this.getParticipantPhotoUrl(fullName, id),
          mark: reg.mark,
          score: reg.mark ? Number(reg.mark) : undefined
        };
      }).filter(Boolean) as WinnerDetail[];
    };

    const firstWinners = mapWinnerDetails(firstIds);
    const secondWinners = mapWinnerDetails(secondIds);
    const thirdWinners = mapWinnerDetails(thirdIds);

    const primaryFirst = firstWinners[0];
    const primarySecond = secondWinners[0];
    const primaryThird = thirdWinners[0];

    const newResult: Result = {
      id: `res-${Date.now()}`,
      competitionId,
      competitionName: comp.name,
      firstPlaceRegId: primaryFirst ? primaryFirst.regId : '',
      firstPlaceParticipantName: primaryFirst ? primaryFirst.participantName : '',
      firstPlaceGroupId: primaryFirst ? primaryFirst.groupId : '',
      firstPlaceGroupName: primaryFirst ? primaryFirst.groupName : '',
      firstPlaceCodeLetter: primaryFirst?.codeLetter,

      secondPlaceRegId: primarySecond?.regId,
      secondPlaceParticipantName: primarySecond?.participantName,
      secondPlaceGroupId: primarySecond?.groupId,
      secondPlaceGroupName: primarySecond?.groupName,
      secondPlaceCodeLetter: primarySecond?.codeLetter,

      thirdPlaceRegId: primaryThird?.regId,
      thirdPlaceParticipantName: primaryThird?.participantName,
      thirdPlaceGroupId: primaryThird?.groupId,
      thirdPlaceGroupName: primaryThird?.groupName,
      thirdPlaceCodeLetter: primaryThird?.codeLetter,

      firstPlaceWinners: firstWinners,
      secondPlaceWinners: secondWinners,
      thirdPlaceWinners: thirdWinners,

      publishedAt: new Date().toISOString(),

      useDetailedPoints,
      participantPointsMap
    };

    data.results.push(newResult);

    // Mark competition as published and completed
    data.competitions = data.competitions.map(c => 
      c.id === competitionId ? { ...c, isPublishedResult: true, status: 'completed', isRunning: false } : c
    );

    this.saveData(data);
    this.recalculateGroupPoints();
    return newResult;
  }

  // Unpublish Competition Result
  public unpublishResult(competitionId: string): void {
    const data = this.getData();
    // Remove the published result entry
    data.results = data.results.filter(r => r.competitionId !== competitionId);

    // Reset competition status
    data.competitions = data.competitions.map(c =>
      c.id === competitionId ? { ...c, isPublishedResult: false } : c
    );

    this.saveData(data);
    this.recalculateGroupPoints();
    this.notify();
  }

  // Recalculate live total points and medal tallies for all groups (Supporting multi-winners for 1st, 2nd, 3rd)
  public recalculateGroupPoints(save = true): LeaderboardEntry[] {
    const data = this.getData();
    const usePerformancePointsGlobally = data.calculateWithPerformancePoints !== false;
    
    // Reset points
    const groupScores: Record<string, { totalPoints: number; golds: number; silvers: number; bronzes: number }> = {};
    data.groups.forEach(g => {
      groupScores[g.id] = { totalPoints: 0, golds: 0, silvers: 0, bronzes: 0 };
    });

    const scoredCompIds = new Set<string>();
    data.registrations.forEach(r => {
      if (r.isReported && r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '') {
        scoredCompIds.add(r.competitionId);
      }
    });

    const validResults = data.results.filter(res => scoredCompIds.has(res.competitionId));

    validResults.forEach(res => {
      const comp = data.competitions.find(c => c.id === res.competitionId);
      const p1 = comp?.points1st || 10;
      const p2 = comp?.points2nd || 7;
      const p3 = comp?.points3rd || 5;

      const { first, second, third } = this.getResultWinners(res);

      if (usePerformancePointsGlobally && res.useDetailedPoints && res.participantPointsMap) {
        // Detailed Team Point Calculation mode (including performance grade points)
        Object.keys(res.participantPointsMap).forEach(regId => {
          const breakdown = res.participantPointsMap![regId];
          const reg = data.registrations.find(r => r.id === regId);
          const groupId = reg?.groupId;
          if (groupId && groupScores[groupId]) {
            groupScores[groupId].totalPoints += breakdown.totalPoints;
          }
        });

        // Still accumulate gold/silver/bronze medals for all winners
        first.forEach(w => {
          if (w.groupId && groupScores[w.groupId]) {
            groupScores[w.groupId].golds += 1;
          }
        });
        second.forEach(w => {
          if (w.groupId && groupScores[w.groupId]) {
            groupScores[w.groupId].silvers += 1;
          }
        });
        third.forEach(w => {
          if (w.groupId && groupScores[w.groupId]) {
            groupScores[w.groupId].bronzes += 1;
          }
        });
      } else {
        // Competition Winner Points Only mode (1st, 2nd, 3rd points for all ranked winners)
        first.forEach(w => {
          if (w.groupId && groupScores[w.groupId]) {
            groupScores[w.groupId].totalPoints += p1;
            groupScores[w.groupId].golds += 1;
          }
        });
        second.forEach(w => {
          if (w.groupId && groupScores[w.groupId]) {
            groupScores[w.groupId].totalPoints += p2;
            groupScores[w.groupId].silvers += 1;
          }
        });
        third.forEach(w => {
          if (w.groupId && groupScores[w.groupId]) {
            groupScores[w.groupId].totalPoints += p3;
            groupScores[w.groupId].bronzes += 1;
          }
        });
      }
    });

    // Update group records
    data.groups = data.groups.map(g => {
      const score = groupScores[g.id] || { totalPoints: 0, golds: 0, silvers: 0, bronzes: 0 };
      return {
        ...g,
        totalPoints: score.totalPoints,
        goldCount: score.golds,
        silverCount: score.silvers,
        bronzeCount: score.bronzes
      };
    });

    if (save) {
      this.saveData(data);
    } else {
      this.inMemoryState = data;
    }

    // Sort into ranked leaderboard
    const leaderboard: LeaderboardEntry[] = data.groups
      .map(g => ({
        groupId: g.id,
        groupName: g.name,
        groupCode: g.code,
        color: g.color,
        totalPoints: g.totalPoints,
        golds: g.goldCount,
        silvers: g.silverCount,
        bronzes: g.bronzeCount,
        rank: 0
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints || b.golds - a.golds || b.silvers - a.silvers)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    return leaderboard;
  }

  // Get current ranked leaderboard
  public getLeaderboard(): LeaderboardEntry[] {
    return this.recalculateGroupPoints(false);
  }

  // Unique persistent Client/Device ID for tracking user interactions (e.g. unique likes)
  public getClientDeviceId(): string {
    try {
      const KEY = 'madani_fest_device_uid';
      let id = localStorage.getItem(KEY);
      if (!id) {
        id = 'user_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      return 'user_client_anon';
    }
  }

  // Comments Engine & Settings
  public getCommentSettings(): CommentSettings {
    const data = this.getData();
    if (!data.commentSettings) {
      return { enabled: true, cooldownMinutes: 10, autoExpireHours: 12 };
    }
    return {
      enabled: typeof data.commentSettings.enabled === 'boolean' ? data.commentSettings.enabled : true,
      cooldownMinutes: typeof data.commentSettings.cooldownMinutes === 'number' && data.commentSettings.cooldownMinutes >= 0 
        ? data.commentSettings.cooldownMinutes 
        : 10,
      autoExpireHours: typeof data.commentSettings.autoExpireHours === 'number' && data.commentSettings.autoExpireHours > 0
        ? data.commentSettings.autoExpireHours
        : 12,
    };
  }

  public updateCommentSettings(settings: Partial<CommentSettings>): CommentSettings {
    const data = this.getData();
    const current = this.getCommentSettings();
    const updated: CommentSettings = {
      ...current,
      ...settings,
    };
    data.commentSettings = updated;
    this.saveData(data);
    return updated;
  }

  public getUserLastCommentTime(userId?: string, authorName?: string): number | null {
    const comments = this.getComments();
    const cleanUserId = userId?.trim();
    const cleanAuthorName = authorName?.trim().toLowerCase();

    const userComments = comments.filter((c) => {
      if (cleanUserId && c.authorId && c.authorId === cleanUserId) return true;
      if (cleanAuthorName && c.authorName && c.authorName.trim().toLowerCase() === cleanAuthorName) return true;
      return false;
    });

    if (userComments.length === 0) return null;

    let newest = 0;
    for (const c of userComments) {
      if (c.createdAt) {
        const t = new Date(c.createdAt).getTime();
        if (!isNaN(t) && t > newest) {
          newest = t;
        }
      }
    }
    return newest > 0 ? newest : null;
  }

  private pruneExpiredComments(comments: CommentItem[]): CommentItem[] {
    const settings = this.getCommentSettings();
    const expireHours = typeof settings.autoExpireHours === 'number' && settings.autoExpireHours > 0 ? settings.autoExpireHours : 12;
    const expireMs = expireHours * 60 * 60 * 1000;
    const now = Date.now();
    return comments.filter((cmt) => {
      if (!cmt || !cmt.createdAt) return true;
      const createdTime = new Date(cmt.createdAt).getTime();
      if (isNaN(createdTime)) return true;
      return (now - createdTime) <= expireMs;
    });
  }

  public getComments(): CommentItem[] {
    const data = this.getData();
    const rawComments = Array.isArray(data.comments) && data.comments.length > 0 ? data.comments : INITIAL_COMMENTS;
    const validComments = this.pruneExpiredComments(rawComments);

    if (data.comments && validComments.length !== data.comments.length) {
      data.comments = validComments;
      this.inMemoryState = data;
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
      } catch (err) {
        console.warn('LocalStorage limit exceeded while pruning comments.', err);
      }
      setTimeout(() => {
        this.notify();
        this.syncToCloud(data, false);
      }, 0);
    }

    return validComments;
  }

  public addComment(comment: Omit<CommentItem, 'id' | 'createdAt' | 'likes'>): CommentItem {
    const data = this.getData();
    const currentComments = this.pruneExpiredComments(
      Array.isArray(data.comments) && data.comments.length > 0 ? data.comments : INITIAL_COMMENTS
    );
    const newComment: CommentItem = {
      ...comment,
      id: `cmt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: []
    };
    data.comments = [newComment, ...currentComments];
    this.saveData(data);
    return newComment;
  }

  // Toggle like - Strictly only ONE like per user/device
  public toggleLikeComment(commentId: string, userId?: string): { liked: boolean; newCount: number } {
    const data = this.getData();
    if (!data.comments) return { liked: false, newCount: 0 };
    
    data.comments = this.pruneExpiredComments(data.comments);
    const effectiveUserId = userId || this.getClientDeviceId();
    let result = { liked: false, newCount: 0 };

    data.comments = data.comments.map(c => {
      if (c.id === commentId) {
        const likedBy = Array.isArray(c.likedBy) ? [...c.likedBy] : [];
        const alreadyLiked = likedBy.includes(effectiveUserId);
        
        let newLikedBy: string[];
        let updatedLikes: number;

        if (alreadyLiked) {
          // Already liked -> remove like (toggle off)
          newLikedBy = likedBy.filter(id => id !== effectiveUserId);
          const currentCount = typeof c.likes === 'number' ? c.likes : likedBy.length;
          updatedLikes = Math.max(0, currentCount - 1);
          result = { liked: false, newCount: updatedLikes };
        } else {
          // Not liked yet -> add user like (toggle on)
          newLikedBy = [...likedBy, effectiveUserId];
          const currentCount = typeof c.likes === 'number' ? c.likes : 0;
          updatedLikes = currentCount + 1;
          result = { liked: true, newCount: updatedLikes };
        }

        return {
          ...c,
          likes: updatedLikes,
          likedBy: newLikedBy
        };
      }
      return c;
    });

    this.saveData(data);
    return result;
  }

  public hasUserLikedComment(commentId: string, userId?: string): boolean {
    const data = this.getData();
    const comments = this.pruneExpiredComments(data.comments || []);
    const comment = comments.find(c => c.id === commentId);
    if (!comment || !Array.isArray(comment.likedBy)) return false;
    const effectiveUserId = userId || this.getClientDeviceId();
    return comment.likedBy.includes(effectiveUserId);
  }

  public deleteComment(commentId: string): void {
    const data = this.getData();
    if (!data.comments) return;
    data.comments = this.pruneExpiredComments(data.comments).filter(c => c.id !== commentId);
    this.saveData(data);
    if (isSupabaseConfigured) {
      deleteDocFromModularCloud('comments', commentId).catch(() => {});
    }
  }

  // Notifications Engine
  public getNotifications(): FestNotification[] {
    const data = this.getData();
    if (!data.notifications || data.notifications.length === 0) {
      return INITIAL_NOTIFICATIONS;
    }
    return data.notifications;
  }

  public hasUnreadNotifications(): boolean {
    const data = this.getData();
    if (data.hasUnreadNotifications === undefined) {
      return true; // Show red dot by default
    }
    return data.hasUnreadNotifications;
  }

  public markNotificationsAsRead(): void {
    const data = this.getData();
    data.hasUnreadNotifications = false;
    this.saveData(data);
  }

  public addNotification(notif: Omit<FestNotification, 'id' | 'createdAt'>): FestNotification {
    const data = this.getData();
    if (!data.notifications) {
      data.notifications = [...INITIAL_NOTIFICATIONS];
    }
    const newNotif: FestNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString()
    };
    data.notifications = [newNotif, ...data.notifications];
    data.hasUnreadNotifications = true; // Trigger RED DOT on update/add
    this.saveData(data);
    return newNotif;
  }

  public updateNotification(id: string, updated: Partial<FestNotification>): void {
    const data = this.getData();
    if (!data.notifications) return;
    data.notifications = data.notifications.map(n => {
      if (n.id === id) {
        return { ...n, ...updated, createdAt: new Date().toISOString() };
      }
      return n;
    });
    data.hasUnreadNotifications = true; // Trigger RED DOT on update
    this.saveData(data);
  }

  public deleteNotification(id: string): void {
    const data = this.getData();
    if (!data.notifications) return;
    data.notifications = data.notifications.filter(n => n.id !== id);
    this.saveData(data);
    if (isSupabaseConfigured) {
      deleteDocFromModularCloud('notifications', id).catch(() => {});
    }
  }

  // --- EXPORT & RESTORE BACKUP METHODS ---
  public exportJSON(): string {
    const data = this.getData();
    return JSON.stringify(data, null, 2);
  }

  public importJSON(jsonString: string): { success: boolean; message: string; summary?: any } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, message: 'Invalid backup file format: Root is not a valid JSON object.' };
      }

      const importedData: StoreData = {
        groups: Array.isArray(parsed.groups) ? parsed.groups : INITIAL_GROUPS,
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : INITIAL_PROFILES,
        competitions: Array.isArray(parsed.competitions) ? parsed.competitions : INITIAL_COMPETITIONS,
        registrations: Array.isArray(parsed.registrations) ? parsed.registrations : INITIAL_REGISTRATIONS,
        results: Array.isArray(parsed.results) ? parsed.results : INITIAL_RESULTS,
        categories: Array.isArray(parsed.categories) ? parsed.categories : DEFAULT_CATEGORIES,
        stages: Array.isArray(parsed.stages) ? parsed.stages : DEFAULT_STAGES,
        levels: Array.isArray(parsed.levels) ? parsed.levels : DEFAULT_LEVELS,
        eventPosters: Array.isArray(parsed.eventPosters) ? parsed.eventPosters : INITIAL_POSTERS,
        countdownConfig: parsed.countdownConfig && typeof parsed.countdownConfig === 'object' ? parsed.countdownConfig : {
          show: true,
          title: 'Tick-Tock, It’s Fest O’Clock!',
          subtitle: 'Months of prep, endless late nights, and one massive stage. The countdown to unforgettable memories starts • November 15-17, 2026'
        },
        brandingConfig: parsed.brandingConfig && typeof parsed.brandingConfig === 'object' ? parsed.brandingConfig : {
          tag: 'FEST 2026',
          college: 'Madani College',
          title: 'Madani College Fest',
          logoUrl: '',
          primaryColor: '#8b5cf6',
          secondaryColor: '#6366f1',
          bgDarkColor: '#0b0c16',
          bgCardColor: '#151728'
        },
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : INITIAL_NOTIFICATIONS,
        showGroupPointStatus: parsed.showGroupPointStatus !== undefined ? !!parsed.showGroupPointStatus : true,
        calculateWithPerformancePoints: parsed.calculateWithPerformancePoints !== undefined ? !!parsed.calculateWithPerformancePoints : true
      };

      this.saveData(importedData);
      this.recalculateGroupPoints();

      return {
        success: true,
        message: 'Festival data successfully imported and restored!',
        summary: {
          groupsCount: importedData.groups.length,
          profilesCount: importedData.profiles.length,
          competitionsCount: importedData.competitions.length,
          registrationsCount: importedData.registrations.length,
          resultsCount: importedData.results.length,
        }
      };
    } catch (err: any) {
      return { success: false, message: `Failed to parse backup file: ${err.message || 'Syntax error'}` };
    }
  }

  // --- COMPETITIONS JSON EXPORT & IMPORT ---
  public exportCompetitionsJSON(filterList?: Competition[]): string {
    const list = filterList || this.getCompetitions();
    const payload = {
      type: 'competitions_export',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      count: list.length,
      competitions: list
    };
    return JSON.stringify(payload, null, 2);
  }

  public importCompetitionsJSON(jsonString: string, mode: 'merge' | 'replace' = 'merge'): {
    success: boolean;
    message: string;
    count?: number;
    errors?: string[];
  } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed) {
        return { success: false, message: 'Invalid JSON: Empty or invalid input.' };
      }

      let rawList: any[] = [];
      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (Array.isArray(parsed.competitions)) {
        rawList = parsed.competitions;
      } else if (Array.isArray(parsed.data)) {
        rawList = parsed.data;
      } else {
        return { success: false, message: 'Invalid format: Expected a JSON array of competitions or an object with a "competitions" array.' };
      }

      if (rawList.length === 0) {
        return { success: false, message: 'No competition records found in JSON.' };
      }

      const validComps: Competition[] = [];
      const errors: string[] = [];
      const currentCats = this.getCategories();
      const defaultCategory = currentCats[0] || 'Senior';

      rawList.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`Row ${idx + 1}: item is not an object.`);
          return;
        }

        const rawName = typeof item.name === 'string' ? item.name.trim() : '';
        if (!rawName) {
          errors.push(`Row ${idx + 1}: missing competition name.`);
          return;
        }

        const id = (typeof item.id === 'string' && item.id.trim())
          ? item.id.trim()
          : `comp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        const category = (typeof item.category === 'string' && item.category.trim())
          ? item.category.trim()
          : defaultCategory;

        const type: CompType = (typeof item.type === 'string' && (item.type.toLowerCase() === 'group' || item.type.toLowerCase() === 'team')) ? 'Group' : 'Individual';
        const isStage = typeof item.isStage === 'boolean' ? item.isStage : true;
        const venue = typeof item.venue === 'string' && item.venue.trim() ? item.venue.trim() : 'Stage 1';
        const scheduleTime = typeof item.scheduleTime === 'string' ? item.scheduleTime.trim() : '';
        const timeSpan = Number(item.timeSpan) > 0 ? Number(item.timeSpan) : 30;
        const maxEntriesPerGroup = Number(item.maxEntriesPerGroup) > 0 ? Number(item.maxEntriesPerGroup) : (type === 'Group' ? 1 : 2);
        const points1st = Number(item.points1st) >= 0 ? Number(item.points1st) : 10;
        const points2nd = Number(item.points2nd) >= 0 ? Number(item.points2nd) : 7;
        const points3rd = Number(item.points3rd) >= 0 ? Number(item.points3rd) : 5;
        const description = typeof item.description === 'string' ? item.description : '';
        const status = ['pending', 'running', 'completed'].includes(item.status) ? item.status : 'pending';
        const reportingStatus = ['open', 'closed'].includes(item.reportingStatus) ? item.reportingStatus : 'open';
        const teamSize = Number(item.teamSize) > 0 ? Number(item.teamSize) : (type === 'Group' ? 4 : 1);

        validComps.push({
          id,
          name: cleanCompetitionBaseName(rawName),
          category,
          type,
          isStage,
          venue,
          scheduleTime,
          timeSpan,
          maxEntriesPerGroup,
          points1st,
          points2nd,
          points3rd,
          description,
          status,
          reportingStatus,
          teamSize,
          isPublishedResult: Boolean(item.isPublishedResult),
          isRunning: Boolean(item.isRunning),
          imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
          imageType: item.imageType || undefined
        });
      });

      if (validComps.length === 0) {
        return {
          success: false,
          message: `Failed to import: None of the ${rawList.length} items were valid competitions.`,
          errors
        };
      }

      const data = this.getData();

      // Ensure any new categories from imported competitions exist in the categories list
      const existingCategories = new Set(data.categories || []);
      validComps.forEach(c => {
        if (c.category && !existingCategories.has(c.category)) {
          data.categories.push(c.category);
          existingCategories.add(c.category);
        }
      });

      // Ensure any new stages exist
      const existingStages = new Set(this.getStages().map(s => s.toLowerCase()));
      validComps.forEach(c => {
        if (c.venue && !existingStages.has(c.venue.toLowerCase())) {
          this.addStage(c.venue, c.isStage);
          existingStages.add(c.venue.toLowerCase());
        }
      });

      if (mode === 'replace') {
        data.competitions = validComps;
      } else {
        // Merge: match by ID, or if ID doesn't match, by lowercase name + category
        const compMap = new Map<string, Competition>();
        (data.competitions || []).forEach(c => compMap.set(c.id, c));

        validComps.forEach(newComp => {
          if (compMap.has(newComp.id)) {
            const prev = compMap.get(newComp.id)!;
            compMap.set(newComp.id, { ...prev, ...newComp });
          } else {
            const existingMatch = Array.from(compMap.values()).find(
              c => c.name.toLowerCase() === newComp.name.toLowerCase() && c.category.toLowerCase() === newComp.category.toLowerCase()
            );
            if (existingMatch) {
              compMap.set(existingMatch.id, { ...existingMatch, ...newComp, id: existingMatch.id });
            } else {
              compMap.set(newComp.id, newComp);
            }
          }
        });

        data.competitions = Array.from(compMap.values());
      }

      this.saveData(data);
      this.recalculateGroupPoints();
      this.notify();

      return {
        success: true,
        message: mode === 'replace'
          ? `Successfully replaced all competitions with ${validComps.length} items.`
          : `Successfully imported and merged ${validComps.length} competitions.`,
        count: validComps.length,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (err: any) {
      return { success: false, message: `JSON parsing error: ${err.message || 'Invalid syntax'}` };
    }
  }

  // --- REGISTRATIONS JSON EXPORT & IMPORT ---
  public exportRegistrationsJSON(filterList?: Registration[]): string {
    const list = filterList || this.getRegistrations();
    const payload = {
      type: 'registrations_export',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      count: list.length,
      registrations: list
    };
    return JSON.stringify(payload, null, 2);
  }

  public importRegistrationsJSON(jsonString: string, mode: 'merge' | 'replace' = 'merge'): {
    success: boolean;
    message: string;
    count?: number;
    errors?: string[];
  } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed) {
        return { success: false, message: 'Invalid JSON: Empty or invalid input.' };
      }

      let rawList: any[] = [];
      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (Array.isArray(parsed.registrations)) {
        rawList = parsed.registrations;
      } else if (Array.isArray(parsed.data)) {
        rawList = parsed.data;
      } else {
        return { success: false, message: 'Invalid format: Expected a JSON array of registrations or an object with a "registrations" array.' };
      }

      if (rawList.length === 0) {
        return { success: false, message: 'No registration records found in JSON.' };
      }

      const data = this.getData();
      const compById = new Map((data.competitions || []).map(c => [c.id, c]));
      const compByName = new Map((data.competitions || []).map(c => [c.name.toLowerCase().trim(), c]));
      const groupById = new Map((data.groups || []).map(g => [g.id, g]));
      const groupByName = new Map((data.groups || []).map(g => [g.name.toLowerCase().trim(), g]));
      const profileById = new Map((data.profiles || []).map(p => [p.id, p]));
      const profileByUserId = new Map((data.profiles || []).map(p => [(p.userId || '').toLowerCase().trim(), p]));
      const profileByName = new Map((data.profiles || []).map(p => [p.name.toLowerCase().trim(), p]));

      const validRegs: Registration[] = [];
      const errors: string[] = [];

      rawList.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`Row ${idx + 1}: item is not an object.`);
          return;
        }

        // Resolve competition
        let comp = item.competitionId ? compById.get(item.competitionId) : undefined;
        if (!comp && item.competitionName) {
          comp = compByName.get(String(item.competitionName).toLowerCase().trim());
        }
        if (!comp && item.competitionId) {
          comp = compByName.get(String(item.competitionId).toLowerCase().trim());
        }

        const compId = comp ? comp.id : (typeof item.competitionId === 'string' && item.competitionId.trim() ? item.competitionId.trim() : '');
        if (!compId) {
          errors.push(`Row ${idx + 1}: missing or unrecognized competition.`);
          return;
        }

        // Resolve participant & group
        let profile = item.participantId ? profileById.get(item.participantId) : undefined;
        if (!profile && item.participantUserId) {
          profile = profileByUserId.get(String(item.participantUserId).toLowerCase().trim());
        }
        if (!profile && item.participantName) {
          profile = profileByName.get(String(item.participantName).toLowerCase().trim());
        }

        const partId = profile ? profile.id : (typeof item.participantId === 'string' && item.participantId.trim() ? item.participantId.trim() : `part_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        const partName = profile ? profile.name : (typeof item.participantName === 'string' && item.participantName.trim() ? item.participantName.trim() : 'Participant');
        const partUserId = profile ? profile.userId : (typeof item.participantUserId === 'string' && item.participantUserId.trim() ? item.participantUserId.trim() : `ART-2026-${Math.floor(100 + Math.random() * 900)}`);

        // Resolve group
        let group = (profile && profile.groupId) ? groupById.get(profile.groupId) : undefined;
        if (!group && item.groupId) group = groupById.get(item.groupId);
        if (!group && item.groupName) group = groupByName.get(String(item.groupName).toLowerCase().trim());
        if (!group && item.groupId) group = groupByName.get(String(item.groupId).toLowerCase().trim());

        const groupId = group ? group.id : (typeof item.groupId === 'string' && item.groupId.trim() ? item.groupId.trim() : (data.groups[0]?.id || 'group-1'));
        const groupName = group ? group.name : (typeof item.groupName === 'string' && item.groupName.trim() ? item.groupName.trim() : (data.groups[0]?.name || 'Group'));

        const regId = (typeof item.id === 'string' && item.id.trim())
          ? item.id.trim()
          : `reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        const registeredAt = typeof item.registeredAt === 'string' && item.registeredAt.trim()
          ? item.registeredAt.trim()
          : new Date().toISOString();

        validRegs.push({
          id: regId,
          competitionId: compId,
          participantId: partId,
          participantName: partName,
          participantUserId: partUserId,
          groupId,
          groupName,
          registeredAt,
          isReported: Boolean(item.isReported),
          codeLetter: typeof item.codeLetter === 'string' ? item.codeLetter.trim() : undefined,
          mark: item.mark !== undefined && item.mark !== null ? String(item.mark).trim() : undefined,
          judgeRank: Number(item.judgeRank) > 0 ? Number(item.judgeRank) : undefined
        });
      });

      if (validRegs.length === 0) {
        return {
          success: false,
          message: `Failed to import: None of the ${rawList.length} items were valid registrations.`,
          errors
        };
      }

      if (mode === 'replace') {
        data.registrations = validRegs;
      } else {
        const regMap = new Map<string, Registration>();
        (data.registrations || []).forEach(r => regMap.set(r.id, r));

        validRegs.forEach(newReg => {
          if (regMap.has(newReg.id)) {
            const prev = regMap.get(newReg.id)!;
            regMap.set(newReg.id, { ...prev, ...newReg });
          } else {
            const existingMatch = Array.from(regMap.values()).find(
              r => r.competitionId === newReg.competitionId &&
                   (r.participantId === newReg.participantId || r.participantUserId.toLowerCase() === newReg.participantUserId.toLowerCase())
            );
            if (existingMatch) {
              regMap.set(existingMatch.id, { ...existingMatch, ...newReg, id: existingMatch.id });
            } else {
              regMap.set(newReg.id, newReg);
            }
          }
        });

        data.registrations = Array.from(regMap.values());
      }

      this.saveData(data);
      this.recalculateGroupPoints();
      this.notify();

      return {
        success: true,
        message: mode === 'replace'
          ? `Successfully replaced all registrations with ${validRegs.length} entries.`
          : `Successfully imported and merged ${validRegs.length} registrations.`,
        count: validRegs.length,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (err: any) {
      return { success: false, message: `JSON parsing error: ${err.message || 'Invalid syntax'}` };
    }
  }

  // ==========================================
  // RESULTS JSON IMPORT & EXPORT
  // ==========================================
  public exportResultsJSON(filterResults?: Result[]): string {
    const data = this.getData();
    const list = filterResults || data.results || [];
    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'festival_results',
      count: list.length,
      results: list
    };
    return JSON.stringify(payload, null, 2);
  }

  public importResultsJSON(jsonString: string, mode: 'merge' | 'replace' = 'merge'): {
    success: boolean;
    message: string;
    count?: number;
    errors?: string[];
  } {
    try {
      const parsed = JSON.parse(jsonString);
      let rawList: any[] = [];

      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.results)) {
          rawList = parsed.results;
        } else if (Array.isArray(parsed.festivalResults)) {
          rawList = parsed.festivalResults;
        } else if (Array.isArray(parsed.data)) {
          rawList = parsed.data;
        } else {
          return { success: false, message: 'Invalid JSON format: expected an array of results or an object with a "results" array.' };
        }
      }

      if (rawList.length === 0) {
        return { success: false, message: 'JSON file contains no result items.' };
      }

      const data = this.getData();
      const compMap = new Map((data.competitions || []).map(c => [c.id, c]));
      const compByName = new Map((data.competitions || []).map(c => [c.name.trim().toLowerCase(), c]));

      const validResults: Result[] = [];
      const errors: string[] = [];

      rawList.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`Item #${idx + 1} is not a valid object.`);
          return;
        }

        // Match competition by ID or Name
        let comp: Competition | undefined;
        if (item.competitionId && compMap.has(item.competitionId)) {
          comp = compMap.get(item.competitionId);
        } else if (item.competitionName && compByName.has(String(item.competitionName).trim().toLowerCase())) {
          comp = compByName.get(String(item.competitionName).trim().toLowerCase());
        }

        if (!comp) {
          errors.push(`Item #${idx + 1}: Competition "${item.competitionName || item.competitionId || 'Unknown'}" not found.`);
          return;
        }

        const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `res-${Date.now()}-${idx}`;
        const firstPlaceParticipantName = item.firstPlaceParticipantName || (item.firstPlaceWinners && item.firstPlaceWinners[0]?.participantName) || '';

        if (!firstPlaceParticipantName && !item.firstPlaceRegId) {
          errors.push(`Item #${idx + 1} (${comp.name}): Missing 1st place winner details.`);
          return;
        }

        const res: Result = {
          id,
          competitionId: comp.id,
          competitionName: comp.name,
          firstPlaceRegId: item.firstPlaceRegId || '',
          firstPlaceParticipantName,
          firstPlaceGroupId: item.firstPlaceGroupId || '',
          firstPlaceGroupName: item.firstPlaceGroupName || '',
          firstPlaceCodeLetter: item.firstPlaceCodeLetter || undefined,

          secondPlaceRegId: item.secondPlaceRegId || undefined,
          secondPlaceParticipantName: item.secondPlaceParticipantName || (item.secondPlaceWinners && item.secondPlaceWinners[0]?.participantName) || undefined,
          secondPlaceGroupId: item.secondPlaceGroupId || undefined,
          secondPlaceGroupName: item.secondPlaceGroupName || undefined,
          secondPlaceCodeLetter: item.secondPlaceCodeLetter || undefined,

          thirdPlaceRegId: item.thirdPlaceRegId || undefined,
          thirdPlaceParticipantName: item.thirdPlaceParticipantName || (item.thirdPlaceWinners && item.thirdPlaceWinners[0]?.participantName) || undefined,
          thirdPlaceGroupId: item.thirdPlaceGroupId || undefined,
          thirdPlaceGroupName: item.thirdPlaceGroupName || undefined,
          thirdPlaceCodeLetter: item.thirdPlaceCodeLetter || undefined,

          firstPlaceWinners: Array.isArray(item.firstPlaceWinners) ? item.firstPlaceWinners : undefined,
          secondPlaceWinners: Array.isArray(item.secondPlaceWinners) ? item.secondPlaceWinners : undefined,
          thirdPlaceWinners: Array.isArray(item.thirdPlaceWinners) ? item.thirdPlaceWinners : undefined,

          publishedAt: typeof item.publishedAt === 'string' && item.publishedAt.trim() ? item.publishedAt : new Date().toISOString(),
          useDetailedPoints: typeof item.useDetailedPoints === 'boolean' ? item.useDetailedPoints : undefined,
          participantPointsMap: item.participantPointsMap && typeof item.participantPointsMap === 'object' ? item.participantPointsMap : undefined
        };

        validResults.push(res);
      });

      if (validResults.length === 0) {
        return {
          success: false,
          message: 'No valid results could be imported.',
          errors: errors.length > 0 ? errors : undefined
        };
      }

      if (mode === 'replace') {
        // Reset all competitions to unpublished
        data.competitions.forEach(c => {
          c.isPublishedResult = false;
        });
        data.results = validResults;
      } else {
        // Merge: overwrite existing result for matching competitionId, or add new
        const resultMap = new Map<string, Result>();
        (data.results || []).forEach(r => resultMap.set(r.competitionId, r));
        validResults.forEach(r => resultMap.set(r.competitionId, r));
        data.results = Array.from(resultMap.values());
      }

      // Mark affected competitions as published & completed
      const publishedCompIds = new Set(data.results.map(r => r.competitionId));
      data.competitions = data.competitions.map(c => {
        if (publishedCompIds.has(c.id)) {
          return { ...c, isPublishedResult: true, status: 'completed', isRunning: false };
        }
        return c;
      });

      this.saveData(data);
      this.recalculateGroupPoints();
      this.notify();

      return {
        success: true,
        message: mode === 'replace'
          ? `Successfully replaced all results with ${validResults.length} records.`
          : `Successfully imported & updated results for ${validResults.length} competition(s).`,
        count: validResults.length,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (err: any) {
      return { success: false, message: `JSON parsing error: ${err.message || 'Invalid syntax'}` };
    }
  }

  // ==========================================
  // JUDGE MARKS JSON IMPORT & EXPORT
  // ==========================================
  public exportJudgeMarksJSON(filterCompId?: string): string {
    const data = this.getData();
    const profileById = new Map((data.profiles || []).map(p => [p.id, p]));
    const compMap = new Map((data.competitions || []).map(c => [c.id, c.name]));

    let targetRegs = data.registrations || [];
    if (filterCompId && filterCompId !== 'All') {
      targetRegs = targetRegs.filter(r => r.competitionId === filterCompId);
    }

    const marksList = targetRegs.map(r => {
      const prof = r.participantId ? profileById.get(r.participantId) : undefined;
      return {
        registrationId: r.id,
        competitionId: r.competitionId,
        competitionName: compMap.get(r.competitionId) || r.competitionId,
        participantName: r.participantName || prof?.name || '',
        participantUserId: r.participantUserId || prof?.userId || '',
        groupName: r.groupName || prof?.groupName || '',
        codeLetter: r.codeLetter || '',
        mark: r.mark !== undefined && r.mark !== null ? String(r.mark) : '',
        judgeRank: r.judgeRank !== undefined && r.judgeRank > 0 ? Number(r.judgeRank) : null,
        isReported: Boolean(r.isReported)
      };
    });

    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'judge_marks',
      filterCompetitionId: filterCompId || 'All',
      totalCandidates: marksList.length,
      scoredCount: marksList.filter(m => m.mark && m.mark.trim() !== '').length,
      judgeMarks: marksList
    };

    return JSON.stringify(payload, null, 2);
  }

  public importJudgeMarksJSON(jsonString: string, mode: 'merge' | 'replace' = 'merge'): {
    success: boolean;
    message: string;
    count?: number;
    errors?: string[];
  } {
    try {
      const parsed = JSON.parse(jsonString);
      let rawList: any[] = [];

      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.judgeMarks)) {
          rawList = parsed.judgeMarks;
        } else if (Array.isArray(parsed.marks)) {
          rawList = parsed.marks;
        } else if (Array.isArray(parsed.data)) {
          rawList = parsed.data;
        } else {
          return { success: false, message: 'Invalid JSON format: expected an array of judge marks or an object with "judgeMarks" array.' };
        }
      }

      if (rawList.length === 0) {
        return { success: false, message: 'JSON file contains no judge mark entries.' };
      }

      const data = this.getData();
      const compMap = new Map((data.competitions || []).map(c => [c.id, c]));
      const compByName = new Map((data.competitions || []).map(c => [c.name.trim().toLowerCase(), c]));
      const regById = new Map((data.registrations || []).map(r => [r.id, r]));

      let updatedCount = 0;
      const errors: string[] = [];

      // If replace mode, collect affected competitions and clear their existing marks
      if (mode === 'replace') {
        const affectedCompIds = new Set<string>();
        rawList.forEach(item => {
          if (item?.competitionId) affectedCompIds.add(item.competitionId);
          if (item?.competitionName && compByName.has(String(item.competitionName).trim().toLowerCase())) {
            affectedCompIds.add(compByName.get(String(item.competitionName).trim().toLowerCase())!.id);
          }
        });

        data.registrations.forEach(r => {
          if (affectedCompIds.has(r.competitionId)) {
            r.mark = undefined;
            r.judgeRank = undefined;
          }
        });
      }

      rawList.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`Item #${idx + 1} is not a valid object.`);
          return;
        }

        // 1. Direct match by registrationId
        let reg: Registration | undefined;
        if (item.registrationId && regById.has(item.registrationId)) {
          reg = regById.get(item.registrationId);
        }

        // 2. Secondary match by competition + chestNo / codeLetter / participantName
        if (!reg) {
          let compId = item.competitionId;
          if (!compId && item.competitionName && compByName.has(String(item.competitionName).trim().toLowerCase())) {
            compId = compByName.get(String(item.competitionName).trim().toLowerCase())!.id;
          }

          if (compId) {
            const compRegs = (data.registrations || []).filter(r => r.competitionId === compId);
            const chestNo = String(item.participantUserId || item.chestNo || '').trim().toLowerCase();
            const codeLetter = String(item.codeLetter || '').trim().toUpperCase();
            const pName = String(item.participantName || '').trim().toLowerCase();

            if (chestNo) {
              reg = compRegs.find(r => (r.participantUserId || '').trim().toLowerCase() === chestNo);
            }
            if (!reg && codeLetter) {
              reg = compRegs.find(r => (r.codeLetter || '').trim().toUpperCase() === codeLetter);
            }
            if (!reg && pName) {
              reg = compRegs.find(r => (r.participantName || '').trim().toLowerCase() === pName);
            }
          }
        }

        if (!reg) {
          errors.push(`Item #${idx + 1}: Participant "${item.participantName || item.participantUserId || item.registrationId || 'Unknown'}" not found.`);
          return;
        }

        // Apply mark
        if (item.mark !== undefined && item.mark !== null) {
          reg.mark = String(item.mark).trim();
        }

        // Apply judge rank
        if (item.judgeRank !== undefined && item.judgeRank !== null) {
          const rankNum = Number(item.judgeRank);
          reg.judgeRank = rankNum > 0 ? rankNum : undefined;
        }

        // Apply code letter if present
        if (item.codeLetter !== undefined && typeof item.codeLetter === 'string' && item.codeLetter.trim()) {
          reg.codeLetter = item.codeLetter.trim().toUpperCase();
        }

        // If mark is present or explicitly set reported, ensure isReported is true
        if (typeof item.isReported === 'boolean') {
          reg.isReported = item.isReported;
        } else if (reg.mark && reg.mark.trim() !== '') {
          reg.isReported = true;
        }

        updatedCount++;
      });

      if (updatedCount === 0) {
        return {
          success: false,
          message: 'No judge marks could be applied to existing registrations.',
          errors: errors.length > 0 ? errors : undefined
        };
      }

      this.saveData(data);
      this.notify();

      return {
        success: true,
        message: `Successfully imported & updated judge marks for ${updatedCount} participant(s).`,
        count: updatedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (err: any) {
      return { success: false, message: `JSON parsing error: ${err.message || 'Invalid syntax'}` };
    }
  }

  // ==========================================
  // ATTENDANCE & FESTIVAL REPORT JSON IMPORT & EXPORT
  // ==========================================
  public exportAttendanceReportJSON(filterCompId?: string): string {
    const data = this.getData();
    const profileById = new Map((data.profiles || []).map(p => [p.id, p]));
    const compMap = new Map((data.competitions || []).map(c => [c.id, c.name]));

    let targetRegs = data.registrations || [];
    if (filterCompId && filterCompId !== 'All') {
      targetRegs = targetRegs.filter(r => r.competitionId === filterCompId);
    }

    const total = targetRegs.length;
    const reported = targetRegs.filter(r => r.isReported).length;
    const absent = total - reported;
    const rate = total > 0 ? `${((reported / total) * 100).toFixed(1)}%` : '0%';

    const attendanceList = targetRegs.map(r => {
      const prof = r.participantId ? profileById.get(r.participantId) : undefined;
      return {
        registrationId: r.id,
        competitionId: r.competitionId,
        competitionName: compMap.get(r.competitionId) || r.competitionId,
        participantName: r.participantName || prof?.name || '',
        participantUserId: r.participantUserId || prof?.userId || '',
        groupName: r.groupName || prof?.groupName || '',
        codeLetter: r.codeLetter || '',
        isReported: Boolean(r.isReported),
        mark: r.mark || null
      };
    });

    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'attendance_report',
      filterCompetitionId: filterCompId || 'All',
      summary: {
        totalCandidates: total,
        reportedCount: reported,
        absentCount: absent,
        attendanceRate: rate
      },
      attendance: attendanceList
    };

    return JSON.stringify(payload, null, 2);
  }

  public importAttendanceReportJSON(jsonString: string, mode: 'merge' | 'replace' = 'merge'): {
    success: boolean;
    message: string;
    count?: number;
    errors?: string[];
  } {
    try {
      const parsed = JSON.parse(jsonString);
      let rawList: any[] = [];

      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.attendance)) {
          rawList = parsed.attendance;
        } else if (Array.isArray(parsed.report)) {
          rawList = parsed.report;
        } else if (Array.isArray(parsed.data)) {
          rawList = parsed.data;
        } else {
          return { success: false, message: 'Invalid JSON format: expected an array or an object with an "attendance" array.' };
        }
      }

      if (rawList.length === 0) {
        return { success: false, message: 'JSON file contains no attendance records.' };
      }

      const data = this.getData();
      const compByName = new Map((data.competitions || []).map(c => [c.name.trim().toLowerCase(), c]));
      const regById = new Map((data.registrations || []).map(r => [r.id, r]));

      let updatedCount = 0;
      const errors: string[] = [];

      rawList.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`Item #${idx + 1} is not a valid object.`);
          return;
        }

        let reg: Registration | undefined;
        if (item.registrationId && regById.has(item.registrationId)) {
          reg = regById.get(item.registrationId);
        }

        if (!reg) {
          let compId = item.competitionId;
          if (!compId && item.competitionName && compByName.has(String(item.competitionName).trim().toLowerCase())) {
            compId = compByName.get(String(item.competitionName).trim().toLowerCase())!.id;
          }

          if (compId) {
            const compRegs = (data.registrations || []).filter(r => r.competitionId === compId);
            const chestNo = String(item.participantUserId || item.chestNo || '').trim().toLowerCase();
            const pName = String(item.participantName || '').trim().toLowerCase();

            if (chestNo) {
              reg = compRegs.find(r => (r.participantUserId || '').trim().toLowerCase() === chestNo);
            }
            if (!reg && pName) {
              reg = compRegs.find(r => (r.participantName || '').trim().toLowerCase() === pName);
            }
          }
        }

        if (!reg) {
          errors.push(`Item #${idx + 1}: Participant "${item.participantName || item.participantUserId || 'Unknown'}" not found.`);
          return;
        }

        if (typeof item.isReported === 'boolean') {
          reg.isReported = item.isReported;
        }
        if (typeof item.codeLetter === 'string' && item.codeLetter.trim()) {
          reg.codeLetter = item.codeLetter.trim().toUpperCase();
        }

        updatedCount++;
      });

      if (updatedCount === 0) {
        return {
          success: false,
          message: 'No attendance records matched existing candidates.',
          errors: errors.length > 0 ? errors : undefined
        };
      }

      this.saveData(data);
      this.notify();

      return {
        success: true,
        message: `Successfully updated attendance status for ${updatedCount} candidate(s).`,
        count: updatedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (err: any) {
      return { success: false, message: `JSON parsing error: ${err.message || 'Invalid syntax'}` };
    }
  }

  public exportFestivalReportJSON(): string {
    const data = this.getData();
    const leaderboard = this.getLeaderboard();
    const categories = this.getCategories();
    const totalComps = data.competitions.length;
    const completedComps = data.competitions.filter(c => c.isPublishedResult).length;
    const totalRegs = data.registrations.length;
    const reportedRegs = data.registrations.filter(r => r.isReported).length;
    const attendanceRate = totalRegs > 0 ? `${((reportedRegs / totalRegs) * 100).toFixed(1)}%` : '0%';

    const branding = this.getBrandingConfig();
    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'festival_master_report',
      festivalName: branding.title || branding.college || 'Art Fest',
      summary: {
        totalCompetitions: totalComps,
        completedCompetitions: completedComps,
        pendingCompetitions: totalComps - completedComps,
        completionRate: totalComps > 0 ? `${((completedComps / totalComps) * 100).toFixed(1)}%` : '0%',
        totalParticipants: data.profiles.length,
        totalRegistrations: totalRegs,
        totalReported: reportedRegs,
        totalAbsent: totalRegs - reportedRegs,
        overallAttendanceRate: attendanceRate,
        totalGroups: data.groups.length,
        totalPublishedResults: data.results.length
      },
      leaderboard: leaderboard.map(g => ({
        rank: g.rank,
        groupId: g.groupId,
        groupName: g.groupName,
        code: g.groupCode,
        color: g.color,
        totalPoints: g.totalPoints,
        goldCount: g.golds,
        silverCount: g.silvers,
        bronzeCount: g.bronzes
      })),
      categories: categories.map(cat => ({
        name: cat,
        competitionsCount: data.competitions.filter(c => c.category === cat).length,
        completedCount: data.competitions.filter(c => c.category === cat && c.isPublishedResult).length
      })),
      competitionsSummary: data.competitions.map(c => {
        const cRegs = data.registrations.filter(r => r.competitionId === c.id);
        const cReported = cRegs.filter(r => r.isReported).length;
        const cResult = data.results.find(r => r.competitionId === c.id);
        return {
          id: c.id,
          name: c.name,
          category: c.category,
          venue: c.venue,
          scheduleTime: c.scheduleTime || 'Unscheduled',
          status: c.status,
          reportingStatus: c.reportingStatus,
          isPublished: Boolean(c.isPublishedResult),
          enrolledCount: cRegs.length,
          reportedCount: cReported,
          firstPlaceWinner: cResult?.firstPlaceParticipantName || null,
          firstPlaceGroup: cResult?.firstPlaceGroupName || null
        };
      }),
      results: data.results
    };

    return JSON.stringify(payload, null, 2);
  }

  public exportCSV(type: 'participants' | 'competitions' | 'registrations' | 'results' | 'groups' | 'marks' | 'stages' | 'comments' | 'notifications' | 'categories' | 'levels'): string {
    const data = this.getData();
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const profileById = new Map((data.profiles || []).map(p => [p.id, p]));
    const profileByUserId = new Map((data.profiles || []).map(p => [p.userId, p]));
    const compMap = new Map((data.competitions || []).map(c => [c.id, c.name]));
    const regById = new Map((data.registrations || []).map(r => [r.id, r]));

    if (type === 'participants') {
      const headers = [
        'Chest No.', 'User ID', 'First Name', 'Second Name (Father Name)', 'Full Name', 
        'Role', 'Group Name', 'Group ID', 'Department / Level', 'Category', 'Created At'
      ];
      const rows = (data.profiles || []).map(p => [
        p.userId || p.id,
        p.id,
        p.name || '',
        p.fatherName || '',
        formatParticipantFullName(p.name, p.fatherName),
        p.role,
        p.groupName || '',
        p.groupId || '',
        p.department || '',
        p.category || '',
        p.created_at || ''
      ]);
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    if (type === 'competitions') {
      const headers = [
        'Competition ID', 'Competition Name', 'Category', 'Type', 'Team Size', 'Venue / Stage', 
        'Schedule Time', 'Time Span (Mins)', 'Stage Event', 'Max Entries/Group', 
        '1st Points', '2nd Points', '3rd Points', 'Status', 'Reporting Status', 'Description'
      ];
      const rows = (data.competitions || []).map(c => [
        c.id,
        c.name,
        c.category,
        c.type,
        c.teamSize || 1,
        c.venue,
        c.scheduleTime,
        c.timeSpan || '',
        c.isStage ? 'Yes' : 'No',
        c.maxEntriesPerGroup || 1,
        c.points1st,
        c.points2nd,
        c.points3rd,
        c.status || 'pending',
        c.reportingStatus || 'open',
        c.description || ''
      ]);
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    if (type === 'registrations') {
      const headers = [
        'Registration ID', 'Competition ID', 'Competition Name', 
        'Participant First Name', 'Second Name (Father Name)', 'Participant Full Name', 
        'Chest No.', 'Group Name', 'Group ID', 'Code Letter', 'Reported Status', 'Assigned Mark', 'Registered At'
      ];
      const rows = (data.registrations || []).map(r => {
        const prof = (r.participantId && profileById.get(r.participantId)) || 
                     (r.participantUserId && profileByUserId.get(r.participantUserId)) || 
                     (data.profiles || []).find(p => p.name === r.participantName);
        const fatherName = prof?.fatherName || '';
        const firstName = prof?.name || r.participantName || '';
        const fullName = this.getParticipantFullName(r.participantName || firstName, r.id, fatherName);

        return [
          r.id,
          r.competitionId,
          compMap.get(r.competitionId) || r.competitionId,
          firstName,
          fatherName,
          fullName,
          r.participantUserId || prof?.userId || '',
          r.groupName || prof?.groupName || '',
          r.groupId || prof?.groupId || '',
          r.codeLetter || '',
          r.isReported ? 'Reported' : 'Not Reported',
          r.mark || '',
          r.registeredAt
        ];
      });
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    if (type === 'results') {
      const headers = [
        'Result ID', 'Competition ID', 'Competition Name', 
        '1st Place Name', '1st Place Father Name', '1st Place Full Name', '1st Place Group', '1st Code Letter',
        '2nd Place Name', '2nd Place Father Name', '2nd Place Full Name', '2nd Place Group', '2nd Code Letter',
        '3rd Place Name', '3rd Place Father Name', '3rd Place Full Name', '3rd Place Group', '3rd Code Letter',
        'Published At'
      ];

      const getPlaceInfo = (regId?: string, fallbackName?: string) => {
        if (!regId && !fallbackName) return { name: '', fatherName: '', fullName: '' };
        const reg = regId ? regById.get(regId) : undefined;
        const prof = reg 
          ? ((reg.participantId && profileById.get(reg.participantId)) || (reg.participantUserId && profileByUserId.get(reg.participantUserId)) || (data.profiles || []).find(p => p.name === reg.participantName))
          : (data.profiles || []).find(p => p.name === fallbackName || formatParticipantFullName(p.name, p.fatherName) === fallbackName);
        const fatherName = prof?.fatherName || '';
        const name = prof?.name || reg?.participantName || fallbackName || '';
        const fullName = this.getParticipantFullName(fallbackName || name, regId, fatherName);
        return { name, fatherName, fullName };
      };

      const rows = (data.results || []).map(r => {
        const first = getPlaceInfo(r.firstPlaceRegId, r.firstPlaceParticipantName);
        const second = getPlaceInfo(r.secondPlaceRegId, r.secondPlaceParticipantName);
        const third = getPlaceInfo(r.thirdPlaceRegId, r.thirdPlaceParticipantName);

        return [
          r.id,
          r.competitionId,
          r.competitionName,
          first.name,
          first.fatherName,
          first.fullName,
          r.firstPlaceGroupName || '',
          r.firstPlaceCodeLetter || '',
          second.name,
          second.fatherName,
          second.fullName,
          r.secondPlaceGroupName || '',
          r.secondPlaceCodeLetter || '',
          third.name,
          third.fatherName,
          third.fullName,
          r.thirdPlaceGroupName || '',
          r.thirdPlaceCodeLetter || '',
          r.publishedAt
        ];
      });
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    if (type === 'groups') {
      const headers = [
        'Group ID', 'Group Name', 'Code', 'Leader Name', 'Leader Chest No./ID', 
        'Total Points', 'Gold Count', 'Silver Count', 'Bronze Count', 'Badge Symbol', 'Badge Color'
      ];
      const rows = (data.groups || []).map(g => [
        g.id,
        g.name,
        g.code,
        g.leaderName,
        g.leaderId,
        g.totalPoints,
        g.goldCount,
        g.silverCount,
        g.bronzeCount,
        g.badgeSymbol || '',
        g.color || ''
      ]);
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    if (type === 'marks') {
      const headers = [
        'Competition ID', 'Competition Name', 
        'Participant First Name', 'Second Name (Father Name)', 'Participant Full Name', 
        'Chest No.', 'Group Name', 'Code Letter', 'Assigned Score / Mark', 'Reported Status'
      ];
      const rows = (data.registrations || []).map(r => {
        const prof = (r.participantId && profileById.get(r.participantId)) || 
                     (r.participantUserId && profileByUserId.get(r.participantUserId)) || 
                     (data.profiles || []).find(p => p.name === r.participantName);
        const fatherName = prof?.fatherName || '';
        const firstName = prof?.name || r.participantName || '';
        const fullName = this.getParticipantFullName(r.participantName || firstName, r.id, fatherName);

        return [
          r.competitionId,
          compMap.get(r.competitionId) || r.competitionId,
          firstName,
          fatherName,
          fullName,
          r.participantUserId || prof?.userId || '',
          r.groupName || prof?.groupName || '',
          r.codeLetter || '',
          r.mark || 'Not Graded',
          r.isReported ? 'Reported' : 'Not Reported'
        ];
      });
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    if (type === 'stages') {
      const headers = ['Stage / Venue ID', 'Venue Name', 'Type'];
      const items = this.getStageItems();
      const rows = items.map(s => [
        s.id,
        s.name,
        s.isStage ? 'On-Stage Event' : 'Off-Stage Venue'
      ]);
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    if (type === 'comments') {
      const headers = ['Comment ID', 'Author Name', 'Author Role', 'Group Name', 'Comment Message', 'Likes Count', 'Posted At'];
      const rows = (data.comments || []).map(c => [
        c.id,
        c.authorName,
        c.authorRole,
        c.groupName || '',
        c.text,
        c.likes || 0,
        c.createdAt
      ]);
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    if (type === 'notifications') {
      const headers = ['Notification ID', 'Title', 'Message', 'Category / Alert Type', 'Created By', 'Created At'];
      const rows = (data.notifications || []).map(n => [
        n.id,
        n.title,
        n.message,
        n.category,
        n.createdBy || 'Admin Desk',
        n.createdAt
      ]);
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    if (type === 'categories') {
      const headers = ['Category Name'];
      const rows = (data.categories || []).map(c => [c]);
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    if (type === 'levels') {
      const headers = ['Level / Department Name'];
      const rows = (data.levels || []).map(l => [l]);
      return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    }

    return '';
  }
}

export const festStore = new FestStore();
export { normalizeScheduleString, formatDayDateWithWeekday } from './scheduler';
