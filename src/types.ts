export type UserRole = 'admin' | 'leader' | 'participant' | 'public' | 'judge' | 'media';

export type CategoryType = 'Junior' | 'Senior' | 'General' | string;
export type CompCategory = 'General' | 'Senior' | 'Junior' | string;
export type CompType = 'Individual' | 'Group';
export type VenueType = string;

export interface Group {
  id: string;
  name: string;
  leaderName: string;
  leaderId: string; // Used for leader login
  leaderPassword?: string;
  code: string; // e.g. "RUBY", "EMER"
  color: string; // Hex color or Tailwind accent
  badgeSymbol: string;
  totalPoints: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  created_at?: string;
  participantIdConfig?: ParticipantIdConfig;
}

export interface UserProfile {
  id: string; // UUID or string ID
  userId: string; // Deterministic format: ART-2026-014 or Chest No
  chestNo?: string | number;
  password?: string;
  name: string;
  fatherName?: string; // Second Name / Father Name
  role: UserRole;
  groupId?: string; // Group ID if participant/leader
  groupName?: string;
  department?: string; // e.g. Level 1, 2, 3, 4
  category?: CategoryType;
  photoUrl?: string; // Custom or default profile photo URL
  created_at?: string;
}

export interface Competition {
  id: string;
  name: string;
  category: CompCategory;
  type: CompType;
  isStage: boolean;
  venue: VenueType;
  scheduleTime: string; // e.g., "Day 1, 10:30 AM"
  timeSpan?: number; // Duration in minutes (e.g., 30, 45, 60, 90, 120)
  maxEntriesPerGroup: number;
  points1st: number;
  points2nd: number;
  points3rd: number;
  description: string;
  isPublishedResult?: boolean;
  isRunning?: boolean;
  status?: 'pending' | 'running' | 'completed';
  reportingStatus?: 'open' | 'closed';
  imageUrl?: string;
  imageType?: 'painting' | 'writing' | 'mic' | 'dhuff' | 'custom';
  teamSize?: number;
}

export interface StageItem {
  id: string;
  name: string;
  isStage: boolean; // true = Stage (On-Stage), false = Off-Stage
}

export interface Registration {
  id: string;
  competitionId: string;
  participantId: string;
  participantName: string;
  participantUserId: string; // ART-2026-xxx
  groupId: string;
  groupName: string;
  registeredAt: string;
  isReported?: boolean; // Defaults to false if unspecified
  codeLetter?: string;  // e.g. "A", "B", "C", "D"...
  mark?: string;        // Assigned marks/scores
  judgeRank?: number;   // 1 = 1st, 2 = 2nd, 3 = 3rd (chosen by judge, especially on tie marks)
}

export interface WinnerDetail {
  regId: string;
  participantName: string;
  groupId: string;
  groupName: string;
  codeLetter?: string;
  photoUrl?: string;
  mark?: string;
  score?: number;
}

export interface Result {
  id: string;
  competitionId: string;
  competitionName: string;
  firstPlaceRegId: string;
  firstPlaceParticipantName: string;
  firstPlaceGroupId: string;
  firstPlaceGroupName: string;
  firstPlaceCodeLetter?: string;

  secondPlaceRegId?: string;
  secondPlaceParticipantName?: string;
  secondPlaceGroupId?: string;
  secondPlaceGroupName?: string;
  secondPlaceCodeLetter?: string;

  thirdPlaceRegId?: string;
  thirdPlaceParticipantName?: string;
  thirdPlaceGroupId?: string;
  thirdPlaceGroupName?: string;
  thirdPlaceCodeLetter?: string;

  // Multiple winners support for ties or multiple 1st, 2nd, 3rd rankings
  firstPlaceWinners?: WinnerDetail[];
  secondPlaceWinners?: WinnerDetail[];
  thirdPlaceWinners?: WinnerDetail[];

  publishedAt: string;

  useDetailedPoints?: boolean;
  participantPointsMap?: Record<string, {
    competitionPoints: number;
    performancePoints: number;
    totalPoints: number;
    grade: string;
    score: number;
  }>;
}

export interface LeaderboardEntry {
  groupId: string;
  groupName: string;
  groupCode: string;
  color: string;
  totalPoints: number;
  golds: number;
  silvers: number;
  bronzes: number;
  rank: number;
}

export interface EventPoster {
  id: string;
  url: string;
}

export interface CountdownConfig {
  show: boolean;
  title: string;
  subtitle: string;
  targetDate?: string;
  dayLabel?: string;
  hourLabel?: string;
  minLabel?: string;
  secLabel?: string;
  showDays?: boolean;
  showHours?: boolean;
  showMinutes?: boolean;
  showSeconds?: boolean;
}

export interface PerformancePointRule {
  grade: string;
  minScore: number;
  maxScore: number;
  individual: number;
  group2: number;
  group3: number;
  group4Plus: number;
}

export interface PerformancePointConfig {
  rules: PerformancePointRule[];
}

export interface BrandingConfig {
  tag: string;
  college: string;
  title: string;
  logoUrl: string; // Base64 or image URL
  splashLogoUrl?: string; // Dedicated splash screen logo URL or Base64
  primaryColor?: string;
  secondaryColor?: string;
  bgDarkColor?: string;
  bgCardColor?: string;
  fontFamily?: string;
  headingFontFamily?: string;
}

export interface SocialLinksConfig {
  instagram?: string;
  youtube?: string;
  whatsapp?: string;
  facebook?: string;
  twitter?: string;
  website?: string;
}

export interface CommentItem {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  authorRole: UserRole;
  groupName?: string;
  groupColor?: string;
  text: string;
  createdAt: string;
  likes?: number;
  likedBy?: string[];
}

export interface CommentSettings {
  enabled: boolean;
  cooldownMinutes: number;
  autoExpireHours: number;
}

export interface FestNotification {
  id: string;
  title: string;
  message: string;
  category: 'Stage Alert' | 'Result Published' | 'General' | 'Schedule Update' | string;
  createdAt: string;
  createdBy?: string;
}

export interface ParticipantIdConfig {
  startNumber: number; // e.g. 14 or 1
  digits: number; // e.g. 3
  isLocked?: boolean; // toggle to disable/close add participant option
  isCompLocked?: boolean; // toggle to disable/close competition registration option
}

export interface PosterTemplateConfig {
  backgroundImageUrl?: string; // Custom uploaded background template image
  themePreset?: 'royal_gold' | 'neon_fest' | 'midnight_purple' | 'emerald_glory' | 'sunset_fire' | 'custom';
  headerText?: string;
  subHeaderText?: string;
  footerText?: string;
  showCollegeLogo?: boolean;
  showFestName?: boolean;
  showPoints?: boolean;
  accentColor?: string;
  secondaryAccent?: string;
  overlayOpacity?: number; // 0 to 1
}

export interface CategoryLimitRule {
  stage: number;      // Maximum stage (on-stage) competitions allowed
  offStage: number;   // Maximum off-stage competitions allowed
  total?: number;     // Optional maximum combined competitions limit
}

export interface LimitRulesConfig {
  defaultStageLimit: number;
  defaultOffStageLimit: number;
  categoryLimits: Record<string, CategoryLimitRule>;
}

export type MediaTabType =
  | 'poster-template'
  | 'results'
  | 'branding'
  | 'posters';

export type AdminTabType =
  | 'overview'
  | 'schedule'
  | 'results'
  | 'reporting'
  | 'valuation'
  | 'competitions'
  | 'groups'
  | 'registrations'
  | 'updates'
  | 'notifications'
  | 'branding'
  | 'backup';



