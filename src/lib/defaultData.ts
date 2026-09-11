import { Group, UserProfile, Competition, Registration, Result, EventPoster } from '../types';

export const DEFAULT_CATEGORIES = ['General', 'Senior', 'Junior', 'Sub Junior'];
export const DEFAULT_STAGES = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const DEFAULT_LEVELS = ['1', '2', '3', '4'];

export const RAW_INITIAL_GROUPS: Group[] = [];

// System admin & staff accounts for logging in and managing the fest
export function generateProfiles(): UserProfile[] {
  return [
    {
      id: 'usr-admin',
      userId: 'admin',
      password: 'admin123',
      name: 'Festival Convener (Admin)',
      role: 'admin',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr-judge',
      userId: 'judge',
      password: 'judge123',
      name: 'Official Fest Judge',
      role: 'judge',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr-media',
      userId: 'media',
      password: 'media123',
      name: 'Press & Media Desk',
      role: 'media',
      created_at: new Date().toISOString()
    }
  ];
}

export const INITIAL_PROFILES: UserProfile[] = generateProfiles();

export function generateCompetitions(): Competition[] {
  return [];
}

export const INITIAL_COMPETITIONS: Competition[] = [];

export function generateRegistrationsAndResults(
  _profiles: UserProfile[],
  _competitions: Competition[]
): { registrations: Registration[]; results: Result[] } {
  return { registrations: [], results: [] };
}

export function calculateInitialGroupPoints(groups: Group[], _results: Result[], _competitions: Competition[]): Group[] {
  return groups;
}

export const INITIAL_GROUPS: Group[] = [];
export const INITIAL_REGISTRATIONS: Registration[] = [];
export const INITIAL_RESULTS: Result[] = [];
export const INITIAL_POSTERS: EventPoster[] = [];
