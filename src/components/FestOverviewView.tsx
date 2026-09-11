import React, { useMemo } from 'react';
import { Competition, Group, LeaderboardEntry, Registration, Result, AdminTabType } from '../types';
import { festStore, formatCompetitionName, formatStageName } from '../lib/store';
import {
  detectParticipantConflicts,
  normalizeScheduleString,
  DEFAULT_FESTIVAL_DAYS,
  formatDayDateWithWeekday,
} from '../lib/scheduler';
import {
  Trophy,
  Calendar,
  Award,
  Users,
  CheckCircle2,
  MapPin,
  Megaphone,
  Layers,
  ArrowRight,
  FileText,
  Zap,
  Palette,
  Printer,
} from 'lucide-react';

interface FestOverviewViewProps {
  competitions: Competition[];
  registrations: Registration[];
  groups: Group[];
  results: Result[];
  leaderboard: LeaderboardEntry[];
  stagesList: string[];
  onNavigateTab: (tab: AdminTabType) => void;
  onOpenCreateScheduleModal: () => void;
  onOpenPrintScheduleModal: () => void;
  onRefresh: () => void;
}

export const FestOverviewView: React.FC<FestOverviewViewProps> = ({
  competitions = [],
  registrations = [],
  groups = [],
  results = [],
  leaderboard = [],
  stagesList = [],
  onNavigateTab,
  onOpenCreateScheduleModal,
  onOpenPrintScheduleModal,
}) => {
  const safeRegistrations = useMemo(() => Array.isArray(registrations) ? registrations : [], [registrations]);
  const safeCompetitions = useMemo(() => Array.isArray(competitions) ? competitions : [], [competitions]);
  const safeGroups = useMemo(() => Array.isArray(groups) ? groups : [], [groups]);
  const safeResults = useMemo(() => Array.isArray(results) ? results : [], [results]);
  const safeLeaderboard = useMemo(() => Array.isArray(leaderboard) ? leaderboard : [], [leaderboard]);

  const branding = festStore.getBrandingConfig();
  const notifications = festStore.getNotifications();

  // Clash & conflict detection
  const conflicts = useMemo(() => {
    return detectParticipantConflicts(safeCompetitions, safeRegistrations);
  }, [safeCompetitions, safeRegistrations]);

  // Total unique participants
  const uniqueParticipantsCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of safeRegistrations) {
      if (r.participantUserId) set.add(r.participantUserId);
      else if (r.participantName) set.add(r.participantName);
    }
    return set.size;
  }, [safeRegistrations]);

  // Total participants count (from store profiles or unique enrolled participants)
  const totalParticipantsCount = useMemo(() => {
    const profiles = festStore.getProfiles();
    if (profiles && profiles.length > 0) {
      return profiles.length;
    }
    return uniqueParticipantsCount;
  }, [uniqueParticipantsCount]);

  // Stage vs Non-Stage breakdown
  const stageCompetitionsCount = useMemo(() => {
    return safeCompetitions.filter((c) => c.isStage).length;
  }, [safeCompetitions]);
  const nonStageCompetitionsCount = safeCompetitions.length - stageCompetitionsCount;

  // Published vs Pending results
  const publishedCount = useMemo(() => {
    return safeCompetitions.filter((c) => {
      if (!c.isPublishedResult) return false;
      const compRegs = safeRegistrations.filter((r) => r.competitionId === c.id);
      return compRegs.some((r) => r.isReported && r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '');
    }).length;
  }, [safeCompetitions, safeRegistrations]);
  const pendingResultsCount = safeCompetitions.length - publishedCount;
  const resultCompletionPercent = safeCompetitions.length > 0
    ? Math.round((publishedCount / safeCompetitions.length) * 100)
    : 0;

  // Attendance & Reporting count
  const reportedCount = useMemo(() => {
    return safeRegistrations.filter((r) => r.isReported === true).length;
  }, [safeRegistrations]);
  const attendanceRate = safeRegistrations.length > 0
    ? Math.round((reportedCount / safeRegistrations.length) * 100)
    : 0;

  // Category-wise statistics breakdown
  const categoriesList = useMemo(() => {
    return festStore.getCategories();
  }, [safeCompetitions]);

  const categoryStats = useMemo(() => {
    return categoriesList.map((cat) => {
      const catComps = safeCompetitions.filter((c) => c.category.toLowerCase() === cat.toLowerCase());
      const catRegs = safeRegistrations.filter((r) => {
        const comp = safeCompetitions.find((c) => c.id === r.competitionId);
        return comp && comp.category.toLowerCase() === cat.toLowerCase();
      });
      const catPublished = catComps.filter((c) => {
        if (!c.isPublishedResult) return false;
        const compRegs = safeRegistrations.filter((r) => r.competitionId === c.id);
        return compRegs.some((r) => r.isReported && r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '');
      }).length;

      return {
        category: cat,
        competitionsCount: catComps.length,
        registrationsCount: catRegs.length,
        publishedCount: catPublished,
      };
    });
  }, [categoriesList, safeCompetitions, safeRegistrations]);

  // Day-wise Schedule Breakdown
  const dayScheduleStats = useMemo(() => {
    const festivalDays = festStore.getFestivalDays();
    return festivalDays.map((d) => {
      const dayComps = safeCompetitions.filter((c) => {
        if (!c.scheduleTime || !c.scheduleTime.trim() || !c.venue || !c.venue.trim()) return false;
        const { dayDate } = normalizeScheduleString(c.scheduleTime);
        if (!dayDate) return false;
        return (
          dayDate.toLowerCase().includes(d.label.toLowerCase()) ||
          (d.date && dayDate.includes(d.date)) ||
          dayDate === `${d.label} (${d.date})` ||
          dayDate === formatDayDateWithWeekday(d.date, d.label)
        );
      });

      return {
        label: d.label,
        date: d.date,
        count: dayComps.length,
        competitions: dayComps,
      };
    });
  }, [safeCompetitions]);

  // Top leading group
  const topGroup = safeLeaderboard.length > 0 ? safeLeaderboard[0] : null;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Welcome / Header Banner */}
      <div className="bg-[#151728] border border-[#292d4a] p-6 sm:p-7 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Fest Overview & Operations Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {branding.title || 'Madani Art Fiesta'} • {branding.college || 'Madani College'} ({branding.tag || '2026'})
          </p>
        </div>

        <button
          onClick={() => onNavigateTab('branding')}
          className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Palette className="w-4 h-4" />
          Edit Festival Titles & Branding
        </button>
      </div>

      {/* 6 Key Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Metric 1: Total Competitions */}
        <div
          onClick={() => onNavigateTab('competitions')}
          className="p-4 bg-[#151728] border border-[#292d4a] hover:border-purple-500/40 rounded-3xl space-y-2 shadow-lg cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wide">
              Competitions
            </span>
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{competitions.length}</div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <span className="text-purple-300 font-bold">{stageCompetitionsCount} Stage</span>
            <span>•</span>
            <span>{nonStageCompetitionsCount} Off-Stage</span>
          </div>
        </div>

        {/* Metric 2: Total Participants */}
        <div
          onClick={() => onNavigateTab('registrations')}
          className="p-4 bg-[#151728] border border-[#292d4a] hover:border-emerald-500/40 rounded-3xl space-y-2 shadow-lg cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
              Participants
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{totalParticipantsCount}</div>
          <div className="text-[10px] text-slate-400">
            <span className="text-emerald-300 font-bold">{safeRegistrations.length}</span> event registrations ({uniqueParticipantsCount} active)
          </div>
        </div>

        {/* Metric 3: Results Published */}
        <div
          onClick={() => onNavigateTab('results')}
          className="p-4 bg-[#151728] border border-[#292d4a] hover:border-amber-500/40 rounded-3xl space-y-2 shadow-lg cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
              Results Done
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {publishedCount} <span className="text-xs font-semibold text-slate-400">/ {competitions.length}</span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <span className="text-amber-300 font-bold">{resultCompletionPercent}%</span>
            <span>completed ({pendingResultsCount} pending)</span>
          </div>
        </div>

        {/* Metric 4: Reporting Attendance */}
        <div
          onClick={() => onNavigateTab('reporting')}
          className="p-4 bg-[#151728] border border-[#292d4a] hover:border-cyan-500/40 rounded-3xl space-y-2 shadow-lg cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wide">
              Reporting
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{attendanceRate}%</div>
          <div className="text-[10px] text-slate-400">
            <span className="text-cyan-300 font-bold">{reportedCount}</span> reported present
          </div>
        </div>

        {/* Metric 5: Active Competing Groups */}
        <div
          onClick={() => onNavigateTab('groups')}
          className="p-4 bg-[#151728] border border-[#292d4a] hover:border-blue-500/40 rounded-3xl space-y-2 shadow-lg cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wide">
              Groups
            </span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{groups.length}</div>
          <div className="text-[10px] text-slate-400 truncate">
            {topGroup ? (
              <span className="text-blue-300 font-bold">Top: {topGroup.groupName} ({topGroup.totalPoints} pts)</span>
            ) : (
              'Registered houses'
            )}
          </div>
        </div>

        {/* Metric 6: Stages & Venues */}
        <div
          onClick={() => onNavigateTab('schedule')}
          className="p-4 bg-[#151728] border border-[#292d4a] hover:border-purple-500/40 rounded-3xl space-y-2 shadow-lg cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wide">
              Stages
            </span>
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-300 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{stagesList.length}</div>
          <div className="text-[10px] text-slate-400 truncate">
            {stagesList.slice(0, 2).map((s) => formatStageName(s)).join(', ')}
          </div>
        </div>
      </div>

      {/* 2-Column Section: Day Schedule Timeline Snapshot + Live Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Festival Day-Wise Schedule Snapshot */}
        <div className="lg:col-span-7 bg-[#151728] border border-[#292d4a] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-[#292d4a] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Day-Wise Schedule Timeline</h3>
                <p className="text-xs text-slate-400">Events mapped into festival days</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenPrintScheduleModal}
                className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                title="Print Festival Schedule"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Schedule</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('schedule')}
                className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Full Schedule View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {dayScheduleStats.map((day) => (
              <div
                key={day.label}
                onClick={() => onNavigateTab('schedule')}
                className="p-4 bg-[#181b30] border border-[#292d4a] hover:border-purple-500/40 rounded-2xl space-y-2 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 font-black text-xs flex items-center justify-center border border-purple-500/30">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-mono text-purple-300 font-bold bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/30">
                    {day.count} Event(s)
                  </span>
                </div>
                <div className="text-xs font-black text-white group-hover:text-purple-300 transition-colors">
                  {formatDayDateWithWeekday(day.date, day.label)}
                </div>
                <div className="text-[11px] text-slate-400">
                  Click to view timeline
                </div>
              </div>
            ))}
          </div>

          {/* Quick Schedule Preview List */}
          <div className="space-y-2 pt-2">
            <div className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              Upcoming Scheduled Events:
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {competitions.slice(0, 5).map((comp) => {
                const { dayDate, timeSlot } = normalizeScheduleString(comp.scheduleTime);
                const displayDay = formatDayDateWithWeekday(dayDate);
                return (
                  <div
                    key={comp.id}
                    className="p-2.5 bg-[#121422] rounded-xl border border-[#292d4a]/70 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">
                        {formatCompetitionName(comp.name, comp.category)}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        {comp.scheduleTime && comp.venue && formatStageName(comp.venue) ? (
                          <>
                            <span className="text-amber-300">{formatStageName(comp.venue)}</span>
                            <span>•</span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-400 italic">Stage: To Be Announced</span>
                            <span>•</span>
                          </>
                        )}
                        <span>
                          {displayDay ? `${displayDay}${timeSlot ? ` (${timeSlot})` : ''}` : timeSlot || ''}
                        </span>
                      </div>
                    </div>
                    {comp.isPublishedResult ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold shrink-0">
                        Result Published
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold shrink-0">
                        {comp.category}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Live Leaderboard Standings Snapshot */}
        <div className="lg:col-span-5 bg-[#151728] border border-[#292d4a] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-[#292d4a] pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Group Leaderboard</h3>
                  <p className="text-xs text-slate-400">Current points & medal standings</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('results')}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Full Results</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Standings List */}
            {leaderboard.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No group standings calculated yet.
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 4).map((entry, idx) => (
                  <div
                    key={entry.groupId}
                    className="p-3 bg-[#181b30] border border-[#292d4a] rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center ${
                          idx === 0
                            ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                            : idx === 1
                            ? 'bg-slate-300 text-black'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-[#121422] text-slate-400 border border-[#292d4a]'
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="font-extrabold text-white text-xs sm:text-sm">
                          {entry.groupName}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span>🥇 {entry.golds}</span>
                          <span>🥈 {entry.silvers}</span>
                          <span>🥉 {entry.bronzes}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-amber-400 font-mono">
                        {entry.totalPoints}
                      </div>
                      <div className="text-[9px] uppercase font-bold text-slate-400">pts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#292d4a]/70 flex items-center justify-between text-xs text-slate-400">
            <span>{results.length} total results awarded</span>
            <button
              onClick={() => onNavigateTab('results')}
              className="text-amber-400 font-bold hover:underline"
            >
              Enter New Result →
            </button>
          </div>
        </div>
      </div>

      {/* Category Breakdown & Operations Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Category Breakdown Grid (8 Cols) */}
        <div className="lg:col-span-8 bg-[#151728] border border-[#292d4a] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-[#292d4a] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Category-Wise Breakdown</h3>
                <p className="text-xs text-slate-400">Event and participant counts across levels</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('competitions')}
              className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Events</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categoryStats.map((cs) => (
              <div
                key={cs.category}
                className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-extrabold">
                    {cs.category}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {cs.publishedCount} / {cs.competitionsCount} Results Done
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 bg-[#121422] rounded-xl border border-[#292d4a]/60">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Events</span>
                    <span className="text-lg font-black text-white">{cs.competitionsCount}</span>
                  </div>
                  <div className="p-2.5 bg-[#121422] rounded-xl border border-[#292d4a]/60">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Entries</span>
                    <span className="text-lg font-black text-emerald-400">{cs.registrationsCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Operations Panel (4 Cols) */}
        <div className="lg:col-span-4 bg-[#151728] border border-[#292d4a] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-[#292d4a] pb-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Admin Quick Hub</h3>
              <p className="text-xs text-slate-400">Direct operational shortcuts</p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => onNavigateTab('schedule')}
              className="w-full p-3 bg-[#181b30] hover:bg-purple-600 text-slate-200 hover:text-white rounded-2xl border border-[#292d4a] hover:border-purple-500 text-xs font-bold flex items-center justify-between transition-all group"
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400 group-hover:text-white" />
                Schedule & Clash Engine
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => onNavigateTab('results')}
              className="w-full p-3 bg-[#181b30] hover:bg-amber-600 text-slate-200 hover:text-white rounded-2xl border border-[#292d4a] hover:border-amber-500 text-xs font-bold flex items-center justify-between transition-all group"
            >
              <span className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400 group-hover:text-white" />
                Publish Competition Results
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => onNavigateTab('reporting')}
              className="w-full p-3 bg-[#181b30] hover:bg-cyan-600 text-slate-200 hover:text-white rounded-2xl border border-[#292d4a] hover:border-cyan-500 text-xs font-bold flex items-center justify-between transition-all group"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400 group-hover:text-white" />
                Participants Call Sheet & Codes
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => onNavigateTab('notifications')}
              className="w-full p-3 bg-[#181b30] hover:bg-rose-600 text-slate-200 hover:text-white rounded-2xl border border-[#292d4a] hover:border-rose-500 text-xs font-bold flex items-center justify-between transition-all group"
            >
              <span className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-rose-400 group-hover:text-white" />
                Broadcast Stage Announcement
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
