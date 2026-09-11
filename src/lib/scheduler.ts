import { Competition, Registration } from '../types';
import { festStore } from './store';

export function isVenueOnStage(venueName: string | undefined | null): boolean {
  if (!venueName) return true;
  try {
    if (typeof festStore !== 'undefined' && festStore && typeof festStore.isStageVenue === 'function') {
      return festStore.isStageVenue(venueName);
    }
  } catch {}
  const trimmed = String(venueName).trim().toLowerCase();
  if (trimmed.includes('off')) return false;
  return true;
}

export interface FestivalDay {
  id: string;
  label: string; // e.g. "Day 1"
  date: string;  // e.g. "2026-11-15"
  timeSlots: string[]; // e.g. ["09:00 AM - 10:00 AM", "10:00 AM - 11:00 AM", ...]
  competitionIds?: string[]; // Selected competition IDs conducted on this day
}

export interface ScheduleSlot {
  dayId: string;
  dayLabel: string;
  date: string;
  timeSlot: string;
  stage: string;
}

export interface ParticipantConflict {
  participantKey: string;
  participantName: string;
  participantUserId: string;
  groupName: string;
  dayDate: string;
  timeSlot: string;
  competitionIds: string[];
  competitionNames: string[];
}

export interface DistributionResult {
  updatedCompetitions: Competition[];
  conflictsFound: number;
  message: string;
  totalScheduled: number;
}

// Default standard festival days
export const DEFAULT_FESTIVAL_DAYS: FestivalDay[] = [
  {
    id: 'day-1',
    label: '15-11-2026 Sunday',
    date: '2026-11-15',
    timeSlots: [
      '09:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '11:00 AM - 12:00 PM',
      '01:30 PM - 02:30 PM',
      '02:30 PM - 03:30 PM',
      '03:30 PM - 04:30 PM',
      '04:30 PM - 05:30 PM',
    ],
  },
  {
    id: 'day-2',
    label: '16-11-2026 Monday',
    date: '2026-11-16',
    timeSlots: [
      '09:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '11:00 AM - 12:00 PM',
      '01:30 PM - 02:30 PM',
      '02:30 PM - 03:30 PM',
      '03:30 PM - 04:30 PM',
      '04:30 PM - 05:30 PM',
    ],
  },
  {
    id: 'day-3',
    label: '17-11-2026 Tuesday',
    date: '2026-11-17',
    timeSlots: [
      '09:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '11:00 AM - 12:00 PM',
      '01:30 PM - 02:30 PM',
      '02:30 PM - 03:30 PM',
      '03:30 PM - 04:30 PM',
      '04:30 PM - 05:30 PM',
    ],
  },
];

// Helper to format date + weekday e.g. "30-10-2026 Friday" or "15-11-2026 Sunday"
export function formatDayDateWithWeekday(dateStr?: string, fallbackLabel?: string): string {
  if (!dateStr && !fallbackLabel) return '';

  const raw = (dateStr || fallbackLabel || '').trim();
  if (!raw || raw === 'Date TBA' || raw === 'TBA' || raw === 'Unscheduled' || raw.toLowerCase().includes('unscheduled')) return '';

  // Check if string contains "YYYY-MM-DD"
  const ymdMatch = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const dateObj = new Date(year, month - 1, day);
    if (!isNaN(dateObj.getTime())) {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = weekdays[dateObj.getDay()];
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      const yyyy = String(year);
      return `${dd}-${mm}-${yyyy} ${dayName}`;
    }
  }

  // Check if string contains "DD-MM-YYYY" or "DD/MM/YYYY"
  const dmyMatch = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const dateObj = new Date(year, month - 1, day);
    if (!isNaN(dateObj.getTime())) {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = weekdays[dateObj.getDay()];
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      const yyyy = String(year);
      return `${dd}-${mm}-${yyyy} ${dayName}`;
    }
  }

  // Check if string is "Day 1", "Day 2", "Day 3", etc.
  const dayNumMatch = raw.match(/Day\s*(\d+)/i);
  if (dayNumMatch) {
    const num = parseInt(dayNumMatch[1], 10);
    const defaultDay = DEFAULT_FESTIVAL_DAYS[num - 1];
    if (defaultDay && defaultDay.date) {
      return formatDayDateWithWeekday(defaultDay.date);
    }
  }

  return raw;
}

// Helper to normalize schedule time into comparable day/date and time slot
export function normalizeScheduleString(scheduleTime: string): { dayDate: string; timeSlot: string } {
  if (!scheduleTime) return { dayDate: '', timeSlot: '' };
  
  const parts = scheduleTime.split(',');
  if (parts.length >= 2) {
    const dayDate = parts[0].trim();
    const timeSlot = parts.slice(1).join(',').trim();
    return { dayDate, timeSlot };
  }

  return { dayDate: scheduleTime.trim(), timeSlot: '' };
}

// Generate time slots based on start/end hours and interval
export function generateTimeSlots(
  startHour = 9,
  endHour = 17,
  intervalMinutes = 60,
  gapMinutes = 0
): string[] {
  const slots: string[] = [];
  let currentMinutes = startHour * 60;
  const targetEndMinutes = endHour * 60;

  while (currentMinutes + intervalMinutes <= targetEndMinutes) {
    const startH = Math.floor(currentMinutes / 60);
    const startM = currentMinutes % 60;
    const endMinutes = currentMinutes + intervalMinutes;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;

    const formatH = (h: number) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      return { displayH: String(displayH).padStart(2, '0'), period };
    };

    const startF = formatH(startH);
    const endF = formatH(endH);

    const slotStr = `${startF.displayH}:${String(startM).padStart(2, '0')} ${startF.period} - ${endF.displayH}:${String(endM).padStart(2, '0')} ${endF.period}`;
    slots.push(slotStr);

    currentMinutes += intervalMinutes + gapMinutes;
  }

  return slots;
}

// Detect any participant that has 2 or more competitions at the exact same Day/Date and TimeSlot
export function detectParticipantConflicts(
  competitions: Competition[] = [],
  registrations: Registration[] = []
): ParticipantConflict[] {
  const conflicts: ParticipantConflict[] = [];

  const safeCompetitions = Array.isArray(competitions) ? competitions : [];
  const safeRegistrations = Array.isArray(registrations) ? registrations : [];

  // Map of participant identifier -> array of { compId, dayDate, timeSlot, compName, groupName, participantName, participantUserId }
  const participantScheduleMap = new Map<
    string,
    Array<{
      compId: string;
      compName: string;
      dayDate: string;
      timeSlot: string;
      groupName: string;
      participantName: string;
      participantUserId: string;
    }>
  >();

  const compMap = new Map(safeCompetitions.map((c) => [c.id, c]));

  for (const reg of safeRegistrations) {
    const comp = compMap.get(reg.competitionId);
    if (!comp || !comp.scheduleTime) continue;

    const { dayDate, timeSlot } = normalizeScheduleString(comp.scheduleTime);
    if (!dayDate || !timeSlot) continue;

    const pKey = reg.participantUserId || reg.participantId || reg.participantName.toLowerCase();
    if (!pKey) continue;

    if (!participantScheduleMap.has(pKey)) {
      participantScheduleMap.set(pKey, []);
    }

    participantScheduleMap.get(pKey)!.push({
      compId: comp.id,
      compName: comp.name,
      dayDate,
      timeSlot,
      groupName: reg.groupName,
      participantName: reg.participantName,
      participantUserId: reg.participantUserId,
    });
  }

  // Check for duplicate dayDate + timeSlot for each participant
  participantScheduleMap.forEach((entries, pKey) => {
    const slotGroupMap = new Map<string, typeof entries>();

    for (const item of entries) {
      const slotKey = `${item.dayDate}__${item.timeSlot}`.toLowerCase();
      if (!slotGroupMap.has(slotKey)) {
        slotGroupMap.set(slotKey, []);
      }
      slotGroupMap.get(slotKey)!.push(item);
    }

    slotGroupMap.forEach((groupEntries, slotKey) => {
      // If participant is registered in 2+ competitions at this exact slot
      const uniqueComps = Array.from(new Set(groupEntries.map((e) => e.compId)));
      if (uniqueComps.length > 1) {
        const first = groupEntries[0];
        conflicts.push({
          participantKey: pKey,
          participantName: first.participantName,
          participantUserId: first.participantUserId,
          groupName: first.groupName,
          dayDate: first.dayDate,
          timeSlot: first.timeSlot,
          competitionIds: uniqueComps,
          competitionNames: groupEntries.map((e) => e.compName),
        });
      }
    });
  });

  return conflicts;
}

// Auto-distribution scheduling algorithm that strictly avoids participant time clashes without adding new time slots
export function autoDistributeSchedule(options: {
  competitions: Competition[];
  registrations: Registration[];
  days: FestivalDay[];
  stages: string[];
  categoryFilter?: string;
  avoidParticipantClashes?: boolean;
  stageCategoryMap?: Record<string, string[]>;
  preserveExistingSchedules?: boolean;
}): {
  updatedCompetitions: Competition[];
  conflictsFound: number;
  message: string;
  totalScheduled: number;
} {
  const {
    competitions = [],
    registrations = [],
    days = [],
    stages = [],
    categoryFilter = 'All',
    avoidParticipantClashes = true,
    stageCategoryMap = {},
    preserveExistingSchedules = true,
  } = options;

  const safeCompetitions = Array.isArray(competitions) ? competitions : [];
  const safeRegistrations = Array.isArray(registrations) ? registrations : [];

  // Filter competitions to distribute
  const targetCompetitions = safeCompetitions.filter((c) => {
    if (categoryFilter === 'All') return true;
    return c.category === categoryFilter;
  });

  if (targetCompetitions.length === 0) {
    return {
      updatedCompetitions: competitions,
      conflictsFound: 0,
      message: 'No competitions matched the selected category filter.',
      totalScheduled: safeCompetitions.filter((c) => c.scheduleTime && c.scheduleTime.trim()).length,
    };
  }

  if (days.length === 0 || stages.length === 0) {
    return {
      updatedCompetitions: competitions,
      conflictsFound: 0,
      message: 'Please configure at least 1 festival day and 1 stage before distributing.',
      totalScheduled: safeCompetitions.filter((c) => c.scheduleTime && c.scheduleTime.trim()).length,
    };
  }

  // 1. Build all available discrete slots: (Day, TimeSlot, Stage) strictly from configured day.timeSlots
  const allSlots: ScheduleSlot[] = [];
  for (const day of days) {
    let slotsForDay: string[] = [];
    if (day.timeSlots && day.timeSlots.length > 0) {
      slotsForDay = day.timeSlots;
    } else {
      // Look up in festStore if available
      try {
        const storeDays = festStore.getFestivalDays();
        const found = storeDays.find((d) => d.id === day.id || d.date === day.date || d.label === day.label);
        if (found && found.timeSlots && found.timeSlots.length > 0) {
          slotsForDay = found.timeSlots;
        }
      } catch {}
      if (slotsForDay.length === 0) {
        // Collect existing slots from competitions on this day
        const existingCompSlots = new Set<string>();
        safeCompetitions.forEach((c) => {
          if (c.scheduleTime) {
            const { dayDate, timeSlot } = normalizeScheduleString(c.scheduleTime);
            if (dayDate && (dayDate.includes(day.date) || (day.label && dayDate.includes(day.label)))) {
              if (timeSlot) existingCompSlots.add(timeSlot);
            }
          }
        });
        slotsForDay = Array.from(existingCompSlots);
      }
      if (slotsForDay.length === 0) {
        slotsForDay = ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM', '01:30 PM - 02:30 PM', '02:30 PM - 03:30 PM'];
      }
    }

    for (const timeSlot of slotsForDay) {
      for (const stage of stages) {
        allSlots.push({
          dayId: day.id,
          dayLabel: day.label,
          date: day.date,
          timeSlot,
          stage,
        });
      }
    }
  }

  // 2. Build participant map per competition from registrations
  const compParticipantsMap = new Map<string, Set<string>>();
  for (const reg of safeRegistrations) {
    const pKey = reg.participantUserId || reg.participantId || reg.participantName.toLowerCase();
    if (!pKey) continue;
    if (!compParticipantsMap.has(reg.competitionId)) {
      compParticipantsMap.set(reg.competitionId, new Set());
    }
    compParticipantsMap.get(reg.competitionId)!.add(pKey);
  }

  // Track assigned slots
  const slotUsage = new Map<string, string>(); // `dayDate__timeSlot__stage` -> compId
  const participantSlotUsage = new Map<string, Set<string>>(); // `dayDate__timeSlot` -> Set<participantId>

  const updatedCompMap = new Map<string, Competition>(
    safeCompetitions.map((c) => [c.id, { ...c }])
  );

  let scheduledCount = 0;

  // 3. If preserveExistingSchedules is active, lock and reserve slots for already scheduled competitions
  const alreadyScheduledCompIds = new Set<string>();
  if (preserveExistingSchedules) {
    for (const comp of safeCompetitions) {
      if (comp.scheduleTime && comp.scheduleTime.trim() && comp.venue && comp.venue.trim()) {
        const { dayDate, timeSlot } = normalizeScheduleString(comp.scheduleTime);
        if (dayDate && timeSlot) {
          const dayFormatted = formatDayDateWithWeekday(dayDate);
          const stageSlotKey = `${dayFormatted}__${timeSlot}__${comp.venue}`.toLowerCase();
          const timeSlotKey = `${dayFormatted}__${timeSlot}`.toLowerCase();

          slotUsage.set(stageSlotKey, comp.id);

          if (!participantSlotUsage.has(timeSlotKey)) {
            participantSlotUsage.set(timeSlotKey, new Set());
          }
          const currentBusy = participantSlotUsage.get(timeSlotKey)!;
          const participantsInComp = compParticipantsMap.get(comp.id) || new Set<string>();
          participantsInComp.forEach((p) => currentBusy.add(p));

          alreadyScheduledCompIds.add(comp.id);
          scheduledCount++;
        }
      }
    }
  }

  // 4. Competitions that need scheduling
  const competitionsToSchedule = targetCompetitions.filter(
    (c) => !preserveExistingSchedules || !alreadyScheduledCompIds.has(c.id)
  );

  // 5. Measure conflict degree for remaining competitions to schedule
  const conflictDegreeMap = new Map<string, number>();
  for (const c1 of competitionsToSchedule) {
    const p1 = compParticipantsMap.get(c1.id) || new Set();
    let sharedCount = 0;
    for (const c2 of competitionsToSchedule) {
      if (c1.id === c2.id) continue;
      const p2 = compParticipantsMap.get(c2.id) || new Set();
      for (const p of p1) {
        if (p2.has(p)) {
          sharedCount++;
          break;
        }
      }
    }
    conflictDegreeMap.set(c1.id, sharedCount);
  }

  // Sort target competitions by highest conflict degree first (Welsh-Powell heuristic)
  const sortedCompetitions = [...competitionsToSchedule].sort((a, b) => {
    const degA = conflictDegreeMap.get(a.id) || 0;
    const degB = conflictDegreeMap.get(b.id) || 0;
    if (degB !== degA) return degB - degA;
    return a.category.localeCompare(b.category);
  });

  // Helper to score a candidate slot for a given competition
  const getSlotCompatibilityScore = (comp: Competition, slot: ScheduleSlot): number => {
    let score = 0;
    const compCategory = (comp.category || 'General').trim().toLowerCase();
    const stageAllocatedCategories = stageCategoryMap[slot.stage];

    if (stageAllocatedCategories && Array.isArray(stageAllocatedCategories) && stageAllocatedCategories.length > 0) {
      const isAll = stageAllocatedCategories.some((c) => c.toLowerCase() === 'all');
      if (isAll) {
        score += 10;
      } else {
        const matchesCategory = stageAllocatedCategories.some(
          (c) => c.toLowerCase() === compCategory
        );
        if (matchesCategory) {
          score += 50; // High preference: stage specifically assigned to this category
        } else {
          score -= 500; // Strong penalty: stage is dedicated to other categories
        }
      }
    } else {
      score += 10; // Neutral shared stage
    }

    const isCompStage = comp.isStage !== undefined ? comp.isStage : isVenueOnStage(comp.venue);
    const isStageVenueVal = isVenueOnStage(slot.stage);
    if (isStageVenueVal === isCompStage) {
      score += 20;
    } else {
      score -= 200;
    }

    return score;
  };

  for (const comp of sortedCompetitions) {
    const participantsInComp = compParticipantsMap.get(comp.id) || new Set<string>();

    const assignedDay = days.find((d) => d.competitionIds && d.competitionIds.includes(comp.id));
    
    let candidateSlots: ScheduleSlot[] = [];
    if (assignedDay) {
      candidateSlots = allSlots.filter((s) => s.dayId === assignedDay.id);
    } else {
      const daysWithAssignments = days.filter((d) => d.competitionIds && d.competitionIds.length > 0);
      if (daysWithAssignments.length > 0) {
        const reservedDayIds = new Set(daysWithAssignments.map((d) => d.id));
        candidateSlots = allSlots.filter((s) => !reservedDayIds.has(s.dayId));
      } else {
        candidateSlots = allSlots;
      }
    }

    // Sort candidate slots by compatibility score descending
    const sortedCandidateSlots = [...candidateSlots].sort(
      (s1, s2) => getSlotCompatibilityScore(comp, s2) - getSlotCompatibilityScore(comp, s1)
    );

    let bestSlot: ScheduleSlot | null = null;
    let minClashesInSlot = Infinity;

    for (const slot of sortedCandidateSlots) {
      const dayFormatted = formatDayDateWithWeekday(slot.date, slot.dayLabel);
      const stageSlotKey = `${dayFormatted}__${slot.timeSlot}__${slot.stage}`.toLowerCase();
      
      // Stage must not already be occupied
      if (slotUsage.has(stageSlotKey)) {
        continue;
      }

      const timeSlotKey = `${dayFormatted}__${slot.timeSlot}`.toLowerCase();
      const busyParticipants = participantSlotUsage.get(timeSlotKey) || new Set<string>();

      let clashes = 0;
      if (avoidParticipantClashes) {
        for (const p of participantsInComp) {
          if (busyParticipants.has(p)) {
            clashes++;
          }
        }
      }

      if (clashes === 0) {
        bestSlot = slot;
        break;
      }

      if (clashes < minClashesInSlot) {
        minClashesInSlot = clashes;
        bestSlot = slot;
      }
    }

    // Fallback: Pick unoccupied slot with highest score
    if (!bestSlot && sortedCandidateSlots.length > 0) {
      const unoccupiedSlot = sortedCandidateSlots.find((slot) => {
        const dayFormatted = formatDayDateWithWeekday(slot.date, slot.dayLabel);
        const stageSlotKey = `${dayFormatted}__${slot.timeSlot}__${slot.stage}`.toLowerCase();
        return !slotUsage.has(stageSlotKey);
      });
      bestSlot = unoccupiedSlot || sortedCandidateSlots[scheduledCount % sortedCandidateSlots.length];
    }

    if (bestSlot) {
      const dayFormatted = formatDayDateWithWeekday(bestSlot.date, bestSlot.dayLabel);
      const stageSlotKey = `${dayFormatted}__${bestSlot.timeSlot}__${bestSlot.stage}`.toLowerCase();
      const timeSlotKey = `${dayFormatted}__${bestSlot.timeSlot}`.toLowerCase();

      slotUsage.set(stageSlotKey, comp.id);

      if (!participantSlotUsage.has(timeSlotKey)) {
        participantSlotUsage.set(timeSlotKey, new Set());
      }
      const currentBusy = participantSlotUsage.get(timeSlotKey)!;
      participantsInComp.forEach((p) => currentBusy.add(p));

      const formattedSchedule = `${dayFormatted}, ${bestSlot.timeSlot}`;

      const existing = updatedCompMap.get(comp.id)!;
      updatedCompMap.set(comp.id, {
        ...existing,
        scheduleTime: formattedSchedule,
        venue: bestSlot.stage,
      });

      scheduledCount++;
    } else {
      // Keep existing schedule intact if it had one, never wipe it out
      const existing = updatedCompMap.get(comp.id)!;
      updatedCompMap.set(comp.id, {
        ...existing,
        scheduleTime: existing.scheduleTime || '',
        venue: existing.venue || '',
      });
    }
  }

  // --- CLASH REMOVAL LOCAL SEARCH (Iterative Min-Conflicts Swap Optimizer) ---
  // Optimizes and swaps assignments strictly within existing slots to achieve 0 clashes without adding new slots
  let currentConflicts = detectParticipantConflicts(Array.from(updatedCompMap.values()), safeRegistrations);
  let iteration = 0;
  const maxIterations = 300;

  while (currentConflicts.length > 0 && iteration < maxIterations) {
    iteration++;
    let improved = false;

    // Pick a conflicting participant and their involved competitions
    const conflict = currentConflicts[0];
    const conflictingCompIds = conflict.competitionIds.filter((id) => updatedCompMap.has(id));

    if (conflictingCompIds.length >= 2) {
      // Prioritize moving newly scheduled competitions before touching preserved ones
      const sortedConfComps = [...conflictingCompIds].sort((a, b) => {
        const aLocked = alreadyScheduledCompIds.has(a) ? 1 : 0;
        const bLocked = alreadyScheduledCompIds.has(b) ? 1 : 0;
        return aLocked - bLocked;
      });

      const compAId = sortedConfComps[0];
      const compA = updatedCompMap.get(compAId)!;
      const { dayDate: dayA, timeSlot: timeA } = normalizeScheduleString(compA.scheduleTime);

      // Try moving compA to an empty slot on the same day without conflicts
      const daySlotsForA = allSlots.filter((s) => {
        const dF = formatDayDateWithWeekday(s.date, s.dayLabel);
        return dF === dayA || (s.date && dayA.includes(s.date));
      });

      for (const candidateSlot of daySlotsForA) {
        const dF = formatDayDateWithWeekday(candidateSlot.date, candidateSlot.dayLabel);
        const stageSlotKey = `${dF}__${candidateSlot.timeSlot}__${candidateSlot.stage}`.toLowerCase();
        
        // Check if candidate slot is unoccupied
        const isOccupied = Array.from(updatedCompMap.values()).some((c) => {
          if (c.id === compAId || !c.scheduleTime) return false;
          const { dayDate: cd, timeSlot: ct } = normalizeScheduleString(c.scheduleTime);
          return cd === dF && ct === candidateSlot.timeSlot && c.venue === candidateSlot.stage;
        });

        if (!isOccupied) {
          // Test move
          const originalSchedule = compA.scheduleTime;
          const originalVenue = compA.venue;
          const testSchedule = `${dF}, ${candidateSlot.timeSlot}`;

          updatedCompMap.set(compAId, {
            ...compA,
            scheduleTime: testSchedule,
            venue: candidateSlot.stage,
          });

          const testConflicts = detectParticipantConflicts(Array.from(updatedCompMap.values()), safeRegistrations);
          if (testConflicts.length < currentConflicts.length) {
            currentConflicts = testConflicts;
            improved = true;
            break;
          } else {
            // Revert
            updatedCompMap.set(compAId, {
              ...compA,
              scheduleTime: originalSchedule,
              venue: originalVenue,
            });
          }
        }
      }

      // If simple move didn't work, try swapping compA with another competition on the same day
      if (!improved) {
        const dayComps = Array.from(updatedCompMap.values()).filter((c) => {
          if (c.id === compAId || !c.scheduleTime) return false;
          if (preserveExistingSchedules && alreadyScheduledCompIds.has(c.id)) return false;
          const { dayDate: cd } = normalizeScheduleString(c.scheduleTime);
          return cd === dayA;
        });

        for (const compB of dayComps) {
          const originalScheduleA = compA.scheduleTime;
          const originalVenueA = compA.venue;
          const originalScheduleB = compB.scheduleTime;
          const originalVenueB = compB.venue;

          // Swap schedules
          updatedCompMap.set(compAId, {
            ...compA,
            scheduleTime: originalScheduleB,
            venue: originalVenueB,
          });
          updatedCompMap.set(compB.id, {
            ...compB,
            scheduleTime: originalScheduleA,
            venue: originalVenueA,
          });

          const testConflicts = detectParticipantConflicts(Array.from(updatedCompMap.values()), safeRegistrations);
          if (testConflicts.length < currentConflicts.length) {
            currentConflicts = testConflicts;
            improved = true;
            break;
          } else {
            // Revert swap
            updatedCompMap.set(compAId, {
              ...compA,
              scheduleTime: originalScheduleA,
              venue: originalVenueA,
            });
            updatedCompMap.set(compB.id, {
              ...compB,
              scheduleTime: originalScheduleB,
              venue: originalVenueB,
            });
          }
        }
      }
    }

    if (!improved) {
      break;
    }
  }

  const finalCompetitions = Array.from(updatedCompMap.values());
  const remainingConflicts = detectParticipantConflicts(finalCompetitions, safeRegistrations);

  let message = `Successfully distributed ${scheduledCount} competition(s) across ${days.length} day(s) and ${stages.length} stage(s).`;
  if (remainingConflicts.length === 0) {
    message += ' ✨ 100% Conflict-Free: No participant has overlapping events!';
  } else {
    message += ` ⚠️ Note: ${remainingConflicts.length} potential clash(es) remaining within existing slots.`;
  }

  return {
    updatedCompetitions: finalCompetitions,
    conflictsFound: remainingConflicts.length,
    message,
    totalScheduled: scheduledCount,
  };
}

export interface AutoResolveDayOptions {
  dayIdentifier: string; // The day string or date or formatted label, e.g. "15-11-2026 Sunday"
  competitions: Competition[];
  registrations: Registration[];
  stages?: string[];
  customTimeSlots?: string[];
  stageCategoryMap?: Record<string, string[]>;
}

/**
 * Auto-resolves participant clashes specifically for a single chosen festival day,
 * without adding ANY new time slots and without altering other festival days.
 */
export function autoResolveDayClashes(options: AutoResolveDayOptions): DistributionResult {
  const {
    dayIdentifier,
    competitions = [],
    registrations = [],
    stages = ['Stage 1', 'Stage 2', 'Stage 3'],
    customTimeSlots,
    stageCategoryMap = {},
  } = options;

  const targetDayFormatted = formatDayDateWithWeekday(dayIdentifier);

  // 1. Filter competitions scheduled on this specific day
  const dayCompetitions: Competition[] = [];
  const otherCompetitions: Competition[] = [];

  for (const comp of competitions) {
    if (!comp || !comp.scheduleTime) {
      otherCompetitions.push(comp);
      continue;
    }
    const { dayDate } = normalizeScheduleString(comp.scheduleTime);
    const compFormatted = formatDayDateWithWeekday(dayDate);

    const isMatch =
      compFormatted === targetDayFormatted ||
      dayDate.toLowerCase().includes(dayIdentifier.toLowerCase()) ||
      dayIdentifier.toLowerCase().includes(dayDate.toLowerCase());

    if (isMatch) {
      dayCompetitions.push(comp);
    } else {
      otherCompetitions.push(comp);
    }
  }

  if (dayCompetitions.length === 0) {
    return {
      updatedCompetitions: competitions,
      conflictsFound: 0,
      message: `No competitions found for ${targetDayFormatted}.`,
      totalScheduled: 0,
    };
  }

  // 2. Determine stages to utilize
  const stageSet = new Set<string>(stages);
  dayCompetitions.forEach((c) => {
    if (c.venue && c.venue.trim()) stageSet.add(c.venue.trim());
  });
  const availableStages = Array.from(stageSet).filter(Boolean);
  if (availableStages.length === 0) {
    availableStages.push('Stage 1', 'Stage 2', 'Stage 3');
  }

  // 3. Determine time slots for this day WITHOUT adding new time slots
  let availableTimeSlots: string[] = [];
  if (customTimeSlots && customTimeSlots.length > 0) {
    availableTimeSlots = [...customTimeSlots];
  } else {
    // Check festStore festivalDays
    try {
      const storeDays = festStore.getFestivalDays();
      const matchedStoreDay = storeDays.find(
        (d) =>
          formatDayDateWithWeekday(d.date, d.label) === targetDayFormatted ||
          d.label.toLowerCase() === dayIdentifier.toLowerCase() ||
          (d.date && dayIdentifier.includes(d.date))
      );
      if (matchedStoreDay && matchedStoreDay.timeSlots && matchedStoreDay.timeSlots.length > 0) {
        availableTimeSlots = [...matchedStoreDay.timeSlots];
      }
    } catch {}

    // If still empty, strictly use ONLY the time slots currently present in dayCompetitions
    if (availableTimeSlots.length === 0) {
      const slotSet = new Set<string>();
      dayCompetitions.forEach((c) => {
        const { timeSlot } = normalizeScheduleString(c.scheduleTime);
        if (timeSlot) slotSet.add(timeSlot);
      });
      availableTimeSlots = Array.from(slotSet);
    }

    // Absolute fallback only if day had zero time slots assigned
    if (availableTimeSlots.length === 0) {
      availableTimeSlots = [
        '09:00 AM - 10:00 AM',
        '10:00 AM - 11:00 AM',
        '11:00 AM - 12:00 PM',
        '01:30 PM - 02:30 PM',
        '02:30 PM - 03:30 PM',
      ];
    }
  }

  // 4. Build discrete slots for this day strictly from existing time slots
  const slots: { stage: string; timeSlot: string }[] = [];
  for (const timeSlot of availableTimeSlots) {
    for (const stage of availableStages) {
      slots.push({ stage, timeSlot });
    }
  }

  // 5. Build participant map
  const compParticipantsMap = new Map<string, Set<string>>();
  for (const reg of registrations) {
    const pKey = reg.participantUserId || reg.participantId || reg.participantName.toLowerCase();
    if (!pKey) continue;
    if (!compParticipantsMap.has(reg.competitionId)) {
      compParticipantsMap.set(reg.competitionId, new Set());
    }
    compParticipantsMap.get(reg.competitionId)!.add(pKey);
  }

  // 6. Conflict degree ranking (Welsh-Powell)
  const conflictDegreeMap = new Map<string, number>();
  for (const c1 of dayCompetitions) {
    const p1 = compParticipantsMap.get(c1.id) || new Set();
    let sharedCount = 0;
    for (const c2 of dayCompetitions) {
      if (c1.id === c2.id) continue;
      const p2 = compParticipantsMap.get(c2.id) || new Set();
      for (const p of p1) {
        if (p2.has(p)) {
          sharedCount++;
          break;
        }
      }
    }
    conflictDegreeMap.set(c1.id, sharedCount);
  }

  const sortedCompetitions = [...dayCompetitions].sort((a, b) => {
    const degA = conflictDegreeMap.get(a.id) || 0;
    const degB = conflictDegreeMap.get(b.id) || 0;
    if (degB !== degA) return degB - degA;
    return a.category.localeCompare(b.category);
  });

  // Track assigned slots on this day
  const stageSlotUsage = new Map<string, string>(); // `timeSlot__stage` -> compId
  const participantSlotUsage = new Map<string, Set<string>>(); // `timeSlot` -> Set<participantId>

  const updatedDayCompMap = new Map<string, Competition>();

  for (let i = 0; i < sortedCompetitions.length; i++) {
    const comp = sortedCompetitions[i];
    const participantsInComp = compParticipantsMap.get(comp.id) || new Set<string>();

    const compCategory = (comp.category || 'General').trim().toLowerCase();
    const compIsStage = comp.isStage !== undefined ? comp.isStage : isVenueOnStage(comp.venue);

    // Score and rank slots
    const rankedSlots = [...slots].sort((s1, s2) => {
      let score1 = 0;
      let score2 = 0;

      // Category stage mapping
      const cats1 = stageCategoryMap[s1.stage];
      if (cats1 && cats1.length > 0 && !cats1.includes('All')) {
        if (cats1.some((c) => c.toLowerCase() === compCategory)) score1 += 50;
        else score1 -= 200;
      }
      const cats2 = stageCategoryMap[s2.stage];
      if (cats2 && cats2.length > 0 && !cats2.includes('All')) {
        if (cats2.some((c) => c.toLowerCase() === compCategory)) score2 += 50;
        else score2 -= 200;
      }

      // Stage type matching
      if (isVenueOnStage(s1.stage) === compIsStage) score1 += 20;
      if (isVenueOnStage(s2.stage) === compIsStage) score2 += 20;

      return score2 - score1;
    });

    let bestSlot: { stage: string; timeSlot: string } | null = null;
    let minClashes = Infinity;

    for (const slot of rankedSlots) {
      const stageKey = `${slot.timeSlot}__${slot.stage}`.toLowerCase();
      if (stageSlotUsage.has(stageKey)) {
        continue;
      }

      const timeSlotKey = slot.timeSlot.toLowerCase();
      const busyParticipants = participantSlotUsage.get(timeSlotKey) || new Set<string>();

      let clashes = 0;
      for (const p of participantsInComp) {
        if (busyParticipants.has(p)) {
          clashes++;
        }
      }

      if (clashes === 0) {
        bestSlot = slot;
        break;
      }

      if (clashes < minClashes) {
        minClashes = clashes;
        bestSlot = slot;
      }
    }

    if (!bestSlot) {
      const unoccupiedSlot = rankedSlots.find((slot) => {
        const stageKey = `${slot.timeSlot}__${slot.stage}`.toLowerCase();
        return !stageSlotUsage.has(stageKey);
      });
      bestSlot = unoccupiedSlot || rankedSlots[i % rankedSlots.length];
    }

    const stageKey = `${bestSlot.timeSlot}__${bestSlot.stage}`.toLowerCase();
    stageSlotUsage.set(stageKey, comp.id);

    const timeSlotKey = bestSlot.timeSlot.toLowerCase();
    if (!participantSlotUsage.has(timeSlotKey)) {
      participantSlotUsage.set(timeSlotKey, new Set());
    }
    const currentBusy = participantSlotUsage.get(timeSlotKey)!;
    participantsInComp.forEach((p) => currentBusy.add(p));

    const formattedSchedule = `${targetDayFormatted}, ${bestSlot.timeSlot}`;
    updatedDayCompMap.set(comp.id, {
      ...comp,
      scheduleTime: formattedSchedule,
      venue: bestSlot.stage,
    });
  }

  // --- DAY-LEVEL CLASH RESOLUTION SWAP OPTIMIZER ---
  let combinedForCheck = [...otherCompetitions, ...Array.from(updatedDayCompMap.values())];
  let dayConflicts = detectParticipantConflicts(combinedForCheck, registrations).filter((c) => {
    const formatted = formatDayDateWithWeekday(c.dayDate);
    return (
      formatted === targetDayFormatted ||
      c.dayDate.toLowerCase().includes(dayIdentifier.toLowerCase()) ||
      dayIdentifier.toLowerCase().includes(c.dayDate.toLowerCase())
    );
  });

  let optIter = 0;
  while (dayConflicts.length > 0 && optIter < 250) {
    optIter++;
    let improved = false;

    const conflict = dayConflicts[0];
    const conflictingCompIds = conflict.competitionIds.filter((id) => updatedDayCompMap.has(id));

    if (conflictingCompIds.length >= 2) {
      const compAId = conflictingCompIds[0];
      const compA = updatedDayCompMap.get(compAId)!;

      // Try moving compA to any empty slot on this day
      for (const candidateSlot of slots) {
        const isOccupied = Array.from(updatedDayCompMap.values()).some((c) => {
          if (c.id === compAId) return false;
          const { timeSlot: ct } = normalizeScheduleString(c.scheduleTime);
          return ct === candidateSlot.timeSlot && c.venue === candidateSlot.stage;
        });

        if (!isOccupied) {
          const originalSchedule = compA.scheduleTime;
          const originalVenue = compA.venue;
          const testSchedule = `${targetDayFormatted}, ${candidateSlot.timeSlot}`;

          updatedDayCompMap.set(compAId, {
            ...compA,
            scheduleTime: testSchedule,
            venue: candidateSlot.stage,
          });

          const testCombined = [...otherCompetitions, ...Array.from(updatedDayCompMap.values())];
          const testConflicts = detectParticipantConflicts(testCombined, registrations).filter((c) => {
            const formatted = formatDayDateWithWeekday(c.dayDate);
            return (
              formatted === targetDayFormatted ||
              c.dayDate.toLowerCase().includes(dayIdentifier.toLowerCase()) ||
              dayIdentifier.toLowerCase().includes(c.dayDate.toLowerCase())
            );
          });

          if (testConflicts.length < dayConflicts.length) {
            dayConflicts = testConflicts;
            improved = true;
            break;
          } else {
            updatedDayCompMap.set(compAId, {
              ...compA,
              scheduleTime: originalSchedule,
              venue: originalVenue,
            });
          }
        }
      }

      // If empty slot didn't improve, try swapping compA with another competition on this day
      if (!improved) {
        const dayOtherComps = Array.from(updatedDayCompMap.values()).filter((c) => c.id !== compAId);
        for (const compB of dayOtherComps) {
          const originalScheduleA = compA.scheduleTime;
          const originalVenueA = compA.venue;
          const originalScheduleB = compB.scheduleTime;
          const originalVenueB = compB.venue;

          updatedDayCompMap.set(compAId, {
            ...compA,
            scheduleTime: originalScheduleB,
            venue: originalVenueB,
          });
          updatedDayCompMap.set(compB.id, {
            ...compB,
            scheduleTime: originalScheduleA,
            venue: originalVenueA,
          });

          const testCombined = [...otherCompetitions, ...Array.from(updatedDayCompMap.values())];
          const testConflicts = detectParticipantConflicts(testCombined, registrations).filter((c) => {
            const formatted = formatDayDateWithWeekday(c.dayDate);
            return (
              formatted === targetDayFormatted ||
              c.dayDate.toLowerCase().includes(dayIdentifier.toLowerCase()) ||
              dayIdentifier.toLowerCase().includes(c.dayDate.toLowerCase())
            );
          });

          if (testConflicts.length < dayConflicts.length) {
            dayConflicts = testConflicts;
            improved = true;
            break;
          } else {
            updatedDayCompMap.set(compAId, {
              ...compA,
              scheduleTime: originalScheduleA,
              venue: originalVenueA,
            });
            updatedDayCompMap.set(compB.id, {
              ...compB,
              scheduleTime: originalScheduleB,
              venue: originalVenueB,
            });
          }
        }
      }
    }

    if (!improved) break;
  }

  // Merge with other competitions that were not modified
  const finalCompetitions = [...otherCompetitions, ...Array.from(updatedDayCompMap.values())];
  const allConflicts = detectParticipantConflicts(finalCompetitions, registrations);
  const finalDayConflicts = allConflicts.filter((c) => {
    const formatted = formatDayDateWithWeekday(c.dayDate);
    return (
      formatted === targetDayFormatted ||
      c.dayDate.toLowerCase().includes(dayIdentifier.toLowerCase()) ||
      dayIdentifier.toLowerCase().includes(c.dayDate.toLowerCase())
    );
  });

  const message =
    finalDayConflicts.length === 0
      ? `✨ Clashes resolved for ${targetDayFormatted}: 0 participant clashes on this day (without adding new time slots)!`
      : `Day ${targetDayFormatted} rescheduled. ${finalDayConflicts.length} clash(es) remaining within existing slots.`;

  return {
    updatedCompetitions: finalCompetitions,
    conflictsFound: finalDayConflicts.length,
    message,
    totalScheduled: updatedDayCompMap.size,
  };
}
