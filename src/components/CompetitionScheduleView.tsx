import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Competition, Registration } from '../types';
import { festStore, formatStageName } from '../lib/store';
import { normalizeScheduleString } from '../lib/scheduler';
import { PrintDayScheduleModal } from './PrintDayScheduleModal';
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  CheckCircle2,
  Edit2,
  Trash2,
  Plus,
  Filter,
  Check,
  RotateCcw,
  Printer,
} from 'lucide-react';

interface CompetitionScheduleViewProps {
  competitions: Competition[];
  registrations?: Registration[];
  stagesList?: string[];
  onOpenEditModal?: (comp: Competition) => void;
  onDeleteComp?: (id: string, name: string) => void;
  onOpenCallSheet?: (comp: Competition) => void;
  onOpenPrintSchedule?: () => void;
  onRefresh?: () => void;
}

// Helper to format date cleanly
function formatDisplayDate(dateStr: string): string {
  if (!dateStr || dateStr === 'Unscheduled / TBA') return dateStr || '07/09/2026';
  const clean = dateStr.replace(/^[a-zA-Z]+,\s*/, '').trim();
  const dmyMatch = clean.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${day}/${month}/${year}`;
  }
  return clean;
}

export const CompetitionScheduleView: React.FC<CompetitionScheduleViewProps> = ({
  competitions = [],
  registrations = [],
  stagesList = [],
  onOpenPrintSchedule,
  onRefresh,
}) => {
  const safeCompetitions = useMemo(
    () => (Array.isArray(competitions) ? competitions : []),
    [competitions]
  );

  // Manual Form Fields
  const [selectedCompId, setSelectedCompId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('07/09/2026');
  const [formStage, setFormStage] = useState<string>('STAGE 4');
  const [formTime, setFormTime] = useState<string>('3.00 to 3.30');
  const [formCategory, setFormCategory] = useState<string>('Senior');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'unscheduled'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const handleTriggerPrint = () => {
    if (onOpenPrintSchedule) {
      onOpenPrintSchedule();
    } else {
      setIsPrintModalOpen(true);
    }
  };

  const formRef = useRef<HTMLDivElement>(null);

  // Standard Stage presets
  const standardStages = useMemo(() => {
    const list = ['STAGE 1', 'STAGE 2', 'STAGE 3', 'STAGE 4', 'STAGE 5', 'STAGE 6', 'Main Stage'];
    for (const s of stagesList) {
      const u = s.toUpperCase();
      if (!list.includes(u)) list.push(u);
    }
    return list;
  }, [stagesList]);

  // Standard Time presets
  const standardTimeSlots = [
    '3.00 to 3.30',
    '4.40 to 5.10',
    '5.15 to 5.45',
    '9.30 to 10.00',
    '10.10 to 10.40',
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '01:30 PM - 02:30 PM',
    '02:30 PM - 03:30 PM',
  ];

  const isCompCompleted = (comp: Competition) =>
    comp.status === 'completed' || Boolean(comp.isPublishedResult);

  // Available competitions for Manual Schedule Enter panel: completed competitions strictly disappear!
  const manualSchedulableCompetitions = useMemo(() => {
    return safeCompetitions.filter((c) => !isCompCompleted(c));
  }, [safeCompetitions]);

  // Auto-select first unscheduled or first competition in manualSchedulableCompetitions
  useEffect(() => {
    const isCurrentInvalid = !selectedCompId || !manualSchedulableCompetitions.some((c) => c.id === selectedCompId);
    if (isCurrentInvalid && manualSchedulableCompetitions.length > 0) {
      const first = manualSchedulableCompetitions.find((c) => !c.scheduleTime || !c.scheduleTime.trim()) || manualSchedulableCompetitions[0];
      if (first) {
        handleSelectCompetition(first.id);
      }
    } else if (manualSchedulableCompetitions.length === 0) {
      setSelectedCompId('');
    }
  }, [manualSchedulableCompetitions, selectedCompId]);

  const handleSelectCompetition = (compId: string) => {
    const comp = safeCompetitions.find((c) => c.id === compId);
    if (!comp || isCompCompleted(comp)) return;
    setSelectedCompId(compId);
    setFormCategory(comp.category || 'Senior');
    if (comp.venue) {
      setFormStage(comp.venue.toUpperCase());
    }
    if (comp.scheduleTime) {
      const { dayDate, timeSlot } = normalizeScheduleString(comp.scheduleTime);
      if (dayDate) setFormDate(formatDisplayDate(dayDate));
      if (timeSlot) setFormTime(timeSlot);
    } else {
      setFormTime('');
    }
  };

  // Populate form for quick editing
  const handleEditComp = (comp: Competition) => {
    handleSelectCompetition(comp.id);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Save Schedule Handler
  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompId) return;

    const comp = safeCompetitions.find((c) => c.id === selectedCompId);
    if (!comp) return;

    const finalDate = formDate.trim() || '07/09/2026';
    const finalTime = formTime.trim() || '3.00 to 3.30';
    const finalStage = formStage.trim() || 'STAGE 4';
    const finalScheduleString = `${finalDate}, ${finalTime}`;

    const updated: Competition = {
      ...comp,
      category: formCategory || comp.category,
      venue: finalStage,
      scheduleTime: finalScheduleString,
    };

    festStore.updateCompetition(updated);
    if (onRefresh) onRefresh();

    setSuccessMessage(`✓ Saved schedule for "${comp.name}" on ${finalStage} at ${finalTime}`);
    setTimeout(() => setSuccessMessage(''), 4000);

    // Pick next unscheduled
    const nextUnscheduled = manualSchedulableCompetitions.find(
      (c) => c.id !== selectedCompId && (!c.scheduleTime || !c.scheduleTime.trim())
    );
    if (nextUnscheduled) {
      handleSelectCompetition(nextUnscheduled.id);
    } else if (manualSchedulableCompetitions.length > 0) {
      const fallback = manualSchedulableCompetitions.find((c) => c.id !== selectedCompId) || manualSchedulableCompetitions[0];
      if (fallback) handleSelectCompetition(fallback.id);
    }
  };

  // Clear Schedule Handler
  const handleClearSchedule = (compId: string) => {
    const comp = safeCompetitions.find((c) => c.id === compId);
    if (!comp) return;

    const updated: Competition = {
      ...comp,
      scheduleTime: '',
      venue: '',
    };

    festStore.updateCompetition(updated);
    if (onRefresh) onRefresh();

    setSuccessMessage(`Cleared schedule for "${comp.name}"`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Clear All Schedules Handler
  const handleConfirmClearAllSchedules = () => {
    festStore.clearAllCompetitionSchedules();
    setShowClearAllModal(false);
    setSuccessMessage('✓ All entered schedules have been cleared! Ready to create new schedules.');
    setTimeout(() => setSuccessMessage(''), 4000);
    if (onRefresh) onRefresh();
  };

  // Filtered Competitions for table (sorted by running -> pending -> completed)
  const filteredCompetitions = useMemo(() => {
    const list = safeCompetitions.filter((comp) => {
      const isCompleted = isCompCompleted(comp);
      const isScheduled = Boolean(comp.scheduleTime && comp.scheduleTime.trim()) || isCompleted;

      if (filterStatus === 'scheduled' && !isScheduled) return false;
      if (filterStatus === 'unscheduled' && (isScheduled || isCompleted)) return false;

      if (categoryFilter !== 'All' && comp.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          comp.name.toLowerCase().includes(q) ||
          comp.category?.toLowerCase().includes(q) ||
          comp.venue?.toLowerCase().includes(q) ||
          comp.scheduleTime?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });

    const statusRank: Record<'running' | 'pending' | 'completed', number> = {
      running: 0,
      pending: 1,
      completed: 2,
    };

    const getCompStatus = (c: Competition): 'running' | 'pending' | 'completed' => {
      if (isCompCompleted(c)) return 'completed';
      if (c.status === 'running' || Boolean(c.isRunning)) return 'running';
      return 'pending';
    };

    return list.sort((a, b) => {
      const rankDiff = statusRank[getCompStatus(a)] - statusRank[getCompStatus(b)];
      if (rankDiff !== 0) return rankDiff;

      if (a.scheduleTime && b.scheduleTime) {
        const schedA = normalizeScheduleString(a.scheduleTime);
        const schedB = normalizeScheduleString(b.scheduleTime);
        if (schedA.dayDate && schedB.dayDate && schedA.dayDate !== schedB.dayDate) {
          return schedA.dayDate.localeCompare(schedB.dayDate);
        }
        if (schedA.timeSlot && schedB.timeSlot && schedA.timeSlot !== schedB.timeSlot) {
          return schedA.timeSlot.localeCompare(schedB.timeSlot);
        }
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [safeCompetitions, filterStatus, categoryFilter, searchQuery]);

  const scheduledCount = safeCompetitions.filter((c) => Boolean(c.scheduleTime && c.scheduleTime.trim()) || isCompCompleted(c)).length;
  const unscheduledCount = safeCompetitions.filter((c) => (!c.scheduleTime || !c.scheduleTime.trim()) && !isCompCompleted(c)).length;
  const currentSelectedComp = safeCompetitions.find((c) => c.id === selectedCompId);

  return (
    <div className="space-y-6">
      {/* Clear All Confirmation Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#151728] border-2 border-rose-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Clear All Schedules?</h3>
                <p className="text-xs text-slate-400">
                  This will remove all dates, venues/stages, and time slots from {scheduledCount} scheduled competition(s).
                </p>
              </div>
            </div>

            <p className="text-xs text-rose-300/90 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
              All competition names, categories, and participant registrations will stay completely safe. Only the assigned schedule times and venues will be reset so you can create new schedules.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202442] text-slate-300 text-xs font-bold transition-all cursor-pointer border border-[#292d4a]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAllSchedules}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-600/30 cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Yes, Clear All Schedules</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. SIMPLE MANUAL SCHEDULE ENTER FORM */}
      <div
        ref={formRef}
        className="p-6 bg-[#151728] rounded-3xl border-2 border-purple-500/40 shadow-2xl space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#292d4a] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg shadow-purple-600/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">
                Manual Schedule Enter
              </h2>
              <p className="text-xs text-slate-400">
                Assign or update Date, Stage / Venue, and Time Slot for competitions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
            {/* Print Schedule Button - Positioned in the header as requested */}
            <button
              type="button"
              onClick={handleTriggerPrint}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-600/30 cursor-pointer inline-flex items-center gap-1.5 active:scale-95 border border-purple-400/40"
              title="Print Festival Schedule (Official ENIGMA Format)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Schedule</span>
            </button>

            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {scheduledCount} Scheduled
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {unscheduledCount} Unscheduled
            </span>

            {scheduledCount > 0 && (
              <button
                type="button"
                onClick={() => setShowClearAllModal(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                title="Clear all entered schedules"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear All Schedules</span>
              </button>
            )}
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {manualSchedulableCompetitions.length === 0 ? (
          <div className="p-8 text-center bg-[#181b30]/60 border border-emerald-500/30 rounded-2xl space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="font-bold text-white text-sm">All Competitions Completed</p>
            <p className="text-xs text-slate-400">There are no pending competitions remaining to schedule in this panel.</p>
          </div>
        ) : (
          <form onSubmit={handleSaveSchedule} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* 1. Select Competition */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-purple-300">
                  1. Select Competition
                </label>
                <select
                  value={selectedCompId}
                  onChange={(e) => handleSelectCompetition(e.target.value)}
                  className="w-full bg-[#181b30] border border-purple-500/40 focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs text-white font-bold"
                >
                  {manualSchedulableCompetitions.map((c) => {
                    const isSched = Boolean(c.scheduleTime && c.scheduleTime.trim());
                    const statusBadge = isSched
                      ? `[✓ ${c.venue || 'Scheduled'}]`
                      : '[○ Unscheduled]';
                    return (
                      <option key={c.id} value={c.id} className="bg-[#181b30]">
                        {c.name} ({c.category || 'Senior'}) {statusBadge}
                      </option>
                    );
                  })}
                </select>
                {currentSelectedComp && !isCompCompleted(currentSelectedComp) && currentSelectedComp.scheduleTime && (
                  <p className="text-[11px] text-purple-300 font-mono">
                    Currently: {currentSelectedComp.venue} • {currentSelectedComp.scheduleTime}
                  </p>
                )}
              </div>

            {/* 2. Date */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-purple-300">
                2. Date
              </label>
              <input
                type="text"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                placeholder="07/09/2026"
                className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs text-white font-mono font-bold"
              />
              <div className="flex gap-1 flex-wrap">
                {['07/09/2026', '08/09/2026', '09/09/2026'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFormDate(d)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[#181b30] hover:bg-purple-600/30 text-slate-400 hover:text-purple-300 border border-[#292d4a]"
                  >
                    {d.slice(0, 5)}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Stage / Venue */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-purple-300">
                3. Stage / Venue
              </label>
              <input
                type="text"
                list="simple-stage-presets"
                value={formStage}
                onChange={(e) => setFormStage(e.target.value)}
                placeholder="STAGE 4"
                className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs text-white font-bold"
              />
              <datalist id="simple-stage-presets">
                {standardStages.map((st) => (
                  <option key={st} value={st} />
                ))}
              </datalist>
              <div className="flex gap-1 flex-wrap">
                {['STAGE 1', 'STAGE 2', 'STAGE 3', 'STAGE 4', 'STAGE 5', 'STAGE 6'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFormStage(st)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[#181b30] hover:bg-purple-600/30 text-slate-400 hover:text-purple-300 border border-[#292d4a]"
                  >
                    {st.replace('STAGE ', 'S')}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Time Slot */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-amber-300">
                4. Time Slot
              </label>
              <input
                type="text"
                list="simple-time-presets"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                placeholder="3.00 to 3.30"
                className="w-full bg-[#181b30] border border-[#292d4a] focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-amber-300 font-mono font-bold"
              />
              <datalist id="simple-time-presets">
                {standardTimeSlots.map((ts) => (
                  <option key={ts} value={ts} />
                ))}
              </datalist>
              <div className="flex gap-1 flex-wrap">
                {['3.00 to 3.30', '4.40 to 5.10', '5.15 to 5.45'].map((ts) => (
                  <button
                    key={ts}
                    type="button"
                    onClick={() => setFormTime(ts)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[#181b30] hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-[#292d4a]"
                  >
                    {ts}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Category */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-purple-300">
                5. Category
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs text-white font-bold"
              >
                <option value="Senior">Senior</option>
                <option value="Junior">Junior</option>
                <option value="General">General</option>
              </select>
            </div>

          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#292d4a]">
            {currentSelectedComp?.scheduleTime && (
              <button
                type="button"
                onClick={() => handleClearSchedule(selectedCompId)}
                className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Schedule</span>
              </button>
            )}

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-600/30 active:scale-95 cursor-pointer inline-flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Save Schedule</span>
            </button>
          </div>
        </form>
        )}
      </div>

      {/* 2. SIMPLE SCHEDULE TABLE */}
      <div className="p-6 bg-[#121422] rounded-3xl border border-[#292d4a] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
              }`}
            >
              All Events ({safeCompetitions.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('scheduled')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'scheduled'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-[#181b30] text-emerald-400/80 hover:text-emerald-300 border border-[#292d4a]'
              }`}
            >
              Scheduled ({scheduledCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('unscheduled')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'unscheduled'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-[#181b30] text-amber-400/80 hover:text-amber-300 border border-[#292d4a]'
              }`}
            >
              Unscheduled ({unscheduledCount})
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search competition..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white w-48"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              <option value="All">All Categories</option>
              <option value="Senior">Senior</option>
              <option value="Junior">Junior</option>
              <option value="General">General</option>
            </select>

            <button
              type="button"
              onClick={handleTriggerPrint}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
              title="Print Festival Schedule"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Schedule</span>
            </button>
          </div>
        </div>

        {/* Competitions Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#292d4a]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#0e101d] text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#292d4a]">
                <th className="py-3 px-4">Competition Name</th>
                <th className="py-3 px-4 w-28">Category</th>
                <th className="py-3 px-4 w-36">Stage / Venue</th>
                <th className="py-3 px-4 w-44">Schedule (Date & Time)</th>
                <th className="py-3 px-4 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#292d4a]/50 text-slate-200">
              {filteredCompetitions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No competitions found matching filters.
                  </td>
                </tr>
              ) : (
                filteredCompetitions.map((comp) => {
                  const isCompleted = isCompCompleted(comp);
                  const isScheduled = Boolean(comp.scheduleTime && comp.scheduleTime.trim()) || isCompleted;
                  const isSelected = comp.id === selectedCompId;

                  return (
                    <tr
                      key={comp.id}
                      className={`transition-colors ${
                        isCompleted
                          ? 'opacity-85 hover:bg-[#181b30]/40'
                          : isSelected
                          ? 'bg-purple-900/25 border-l-4 border-l-purple-500 cursor-pointer'
                          : 'hover:bg-[#181b30] cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isCompleted) {
                          handleSelectCompetition(comp.id);
                        }
                      }}
                    >
                      <td className="py-3 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span>{comp.name}</span>
                          {comp.isStage && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold uppercase">
                              Stage
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded-full bg-[#181b30] border border-[#292d4a] text-[11px]">
                          {comp.category || 'Senior'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {comp.venue ? (
                          <span className="font-bold text-purple-300">{comp.venue}</span>
                        ) : (
                          <span className="text-slate-500 italic">Not set</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[11px]">
                            ✓ Completed
                          </span>
                        ) : isScheduled ? (
                          <span className="font-mono font-bold text-sky-300">{comp.scheduleTime}</span>
                        ) : (
                          <span className="text-slate-500 italic">Unscheduled</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleEditComp(comp)}
                              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}

                          {isScheduled && !isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleClearSchedule(comp.id)}
                              className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white transition-all cursor-pointer"
                              title="Clear Schedule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Festival Schedule Modal */}
      <PrintDayScheduleModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        competitions={safeCompetitions}
        registrations={registrations}
        stagesList={stagesList}
      />
    </div>
  );
};
