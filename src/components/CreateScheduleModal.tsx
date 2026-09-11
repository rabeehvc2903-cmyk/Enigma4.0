import React, { useState, useMemo, useEffect } from 'react';
import { Competition, Registration } from '../types';
import { festStore, formatStageName } from '../lib/store';
import {
  FestivalDay,
  DEFAULT_FESTIVAL_DAYS,
  autoDistributeSchedule,
  autoResolveDayClashes,
  detectParticipantConflicts,
  normalizeScheduleString,
  formatDayDateWithWeekday,
  generateTimeSlots,
  ParticipantConflict,
  DistributionResult,
} from '../lib/scheduler';
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Layers,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Check,
  ChevronRight,
  ChevronLeft,
  Settings,
  Edit2,
  ArrowRight,
  Sliders,
} from 'lucide-react';

interface CreateScheduleModalProps {
  isOpen?: boolean;
  onClose: () => void;
  competitions?: Competition[];
  registrations?: Registration[];
  stagesList?: string[];
  onScheduleApplied?: () => void;
  onSuccess?: () => void;
  initialMode?: 'auto' | 'manual' | 'resolve';
  initialCompId?: string;
  initialDayId?: string;
}

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

export const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({
  isOpen = true,
  onClose,
  competitions = [],
  registrations = [],
  stagesList = [],
  onScheduleApplied,
  onSuccess,
  initialMode = 'auto',
  initialCompId,
  initialDayId,
}) => {
  const safeCompetitions = useMemo(
    () => (Array.isArray(competitions) && competitions.length > 0 ? competitions : festStore.getCompetitions()),
    [competitions]
  );
  const safeRegistrations = useMemo(
    () => (Array.isArray(registrations) && registrations.length > 0 ? registrations : festStore.getRegistrations()),
    [registrations]
  );

  const [activeMode, setActiveMode] = useState<'auto' | 'manual' | 'resolve'>(initialMode);
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Auto-schedule settings state
  const [festivalDays, setFestivalDays] = useState<FestivalDay[]>(() => {
    // Check if we have existing days in competitions
    const existingDaysMap = new Map<string, string[]>();
    for (const c of safeCompetitions) {
      if (c.scheduleTime) {
        const { dayDate, timeSlot } = normalizeScheduleString(c.scheduleTime);
        if (dayDate) {
          if (!existingDaysMap.has(dayDate)) existingDaysMap.set(dayDate, []);
          if (timeSlot && !existingDaysMap.get(dayDate)!.includes(timeSlot)) {
            existingDaysMap.get(dayDate)!.push(timeSlot);
          }
        }
      }
    }

    if (existingDaysMap.size > 0) {
      let idx = 1;
      const days: FestivalDay[] = [];
      for (const [dayDate, slots] of existingDaysMap.entries()) {
        days.push({
          id: `day-${idx}`,
          label: `Day ${idx} (${formatDisplayDate(dayDate)})`,
          date: dayDate,
          timeSlots: slots.length > 0 ? slots : DEFAULT_FESTIVAL_DAYS[0].timeSlots,
        });
        idx++;
      }
      return days;
    }

    return DEFAULT_FESTIVAL_DAYS;
  });

  const [selectedStages, setSelectedStages] = useState<string[]>(() => {
    const list = stagesList.length > 0 ? stagesList : ['STAGE 1', 'STAGE 2', 'STAGE 3', 'STAGE 4', 'STAGE 5', 'STAGE 6'];
    return list;
  });

  const [newStageName, setNewStageName] = useState<string>('');
  const [prioritizeStage, setPrioritizeStage] = useState<boolean>(true);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [previewResult, setPreviewResult] = useState<DistributionResult | null>(null);
  const [isComputing, setIsComputing] = useState<boolean>(false);

  // Manual Enter state
  const [manualCompId, setManualCompId] = useState<string>(initialCompId || '');
  const [manualDate, setManualDate] = useState<string>(initialDayId ? formatDisplayDate(initialDayId) : '07/09/2026');
  const [manualStage, setManualStage] = useState<string>('STAGE 4');
  const [manualTime, setManualTime] = useState<string>('3.00 to 3.30');
  const [manualCategory, setManualCategory] = useState<string>('Senior');
  const [manualSearch, setManualSearch] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Resolve Clashes state
  const [targetResolveDay, setTargetResolveDay] = useState<string>(initialDayId || '07/09/2026');
  const [resolveResult, setResolveResult] = useState<DistributionResult | null>(null);

  // Initialize selected competition for manual mode
  useEffect(() => {
    if (initialCompId) {
      handleSelectManualComp(initialCompId);
    } else if (!manualCompId && safeCompetitions.length > 0) {
      const first = safeCompetitions.find((c) => (!c.scheduleTime || !c.scheduleTime.trim()) && c.status !== 'completed' && !c.isPublishedResult) || safeCompetitions[0];
      if (first) {
        handleSelectManualComp(first.id);
      }
    }
  }, [initialCompId, safeCompetitions]);

  const handleSelectManualComp = (compId: string) => {
    setManualCompId(compId);
    const comp = safeCompetitions.find((c) => c.id === compId);
    if (comp) {
      setManualCategory(comp.category || 'Senior');
      if (comp.venue) {
        setManualStage(comp.venue.toUpperCase());
      }
      if (comp.scheduleTime) {
        const { dayDate, timeSlot } = normalizeScheduleString(comp.scheduleTime);
        if (dayDate) setManualDate(formatDisplayDate(dayDate));
        if (timeSlot) setManualTime(timeSlot);
      }
    }
  };

  // Day management for Auto mode
  const handleAddDay = () => {
    const nextNum = festivalDays.length + 1;
    const newDay: FestivalDay = {
      id: `day-${nextNum}-${Date.now()}`,
      label: `Day ${nextNum}`,
      date: `2026-11-${14 + nextNum}`,
      timeSlots: [
        '09:00 AM - 10:00 AM',
        '10:00 AM - 11:00 AM',
        '11:00 AM - 12:00 PM',
        '01:30 PM - 02:30 PM',
        '02:30 PM - 03:30 PM',
      ],
    };
    setFestivalDays([...festivalDays, newDay]);
  };

  const handleRemoveDay = (id: string) => {
    if (festivalDays.length <= 1) return;
    setFestivalDays(festivalDays.filter((d) => d.id !== id));
  };

  const handleUpdateDay = (id: string, updates: Partial<FestivalDay>) => {
    setFestivalDays(festivalDays.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const handleAddTimeSlotToDay = (dayId: string, slot: string) => {
    if (!slot.trim()) return;
    setFestivalDays(
      festivalDays.map((d) => {
        if (d.id === dayId && !d.timeSlots.includes(slot.trim())) {
          return { ...d, timeSlots: [...d.timeSlots, slot.trim()] };
        }
        return d;
      })
    );
  };

  const handleRemoveTimeSlotFromDay = (dayId: string, slotIndex: number) => {
    setFestivalDays(
      festivalDays.map((d) => {
        if (d.id === dayId) {
          const newSlots = [...d.timeSlots];
          newSlots.splice(slotIndex, 1);
          return { ...d, timeSlots: newSlots };
        }
        return d;
      })
    );
  };

  // Stage selection
  const handleToggleStage = (stageName: string) => {
    if (selectedStages.includes(stageName)) {
      if (selectedStages.length > 1) {
        setSelectedStages(selectedStages.filter((s) => s !== stageName));
      }
    } else {
      setSelectedStages([...selectedStages, stageName]);
    }
  };

  const handleAddCustomStage = () => {
    if (!newStageName.trim()) return;
    const clean = newStageName.trim().toUpperCase();
    if (!selectedStages.includes(clean)) {
      setSelectedStages([...selectedStages, clean]);
    }
    setNewStageName('');
  };

  // Run Auto Distribution calculation
  const handleCalculateAutoSchedule = () => {
    setIsComputing(true);
    setTimeout(() => {
      try {
        let compsToSchedule = safeCompetitions;
        if (!overwriteExisting) {
          compsToSchedule = safeCompetitions.filter((c) => !c.scheduleTime || !c.scheduleTime.trim());
        }
        if (selectedCategoryFilter !== 'All') {
          compsToSchedule = compsToSchedule.filter((c) => c.category === selectedCategoryFilter);
        }

        const result = autoDistributeSchedule({
          competitions: safeCompetitions,
          registrations: safeRegistrations,
          days: festivalDays,
          stages: selectedStages,
          categoryFilter: selectedCategoryFilter,
          preserveExistingSchedules: !overwriteExisting,
          avoidParticipantClashes: true,
        });

        setPreviewResult(result);
        setCurrentStep(3); // Go to preview step
      } catch (err) {
        console.error('Auto schedule distribution error:', err);
      } finally {
        setIsComputing(false);
      }
    }, 200);
  };

  // Apply Preview Result
  const handleApplyAutoSchedule = () => {
    if (!previewResult) return;
    festStore.updateCompetitionsBatch(previewResult.updatedCompetitions);
    if (onScheduleApplied) onScheduleApplied();
    if (onSuccess) onSuccess();
    onClose();
  };

  // Save Manual Schedule
  const handleSaveManualSchedule = (e?: React.FormEvent, andClose: boolean = false) => {
    if (e) e.preventDefault();
    if (!manualCompId) return;

    const comp = safeCompetitions.find((c) => c.id === manualCompId);
    if (!comp) return;

    const finalDate = manualDate.trim() || '07/09/2026';
    const finalTime = manualTime.trim() || '3.00 to 3.30';
    const finalStage = manualStage.trim() || 'STAGE 4';
    const finalScheduleString = `${finalDate}, ${finalTime}`;

    const updated: Competition = {
      ...comp,
      category: manualCategory || comp.category,
      venue: finalStage,
      scheduleTime: finalScheduleString,
    };

    festStore.updateCompetition(updated);
    if (onScheduleApplied) onScheduleApplied();
    if (onSuccess) onSuccess();

    setSuccessMessage(`✓ Saved schedule for "${comp.name}" on ${finalStage} at ${finalTime}`);
    setTimeout(() => setSuccessMessage(''), 3500);

    if (andClose) {
      onClose();
    } else {
      const nextUnscheduled = safeCompetitions.find((c) => c.id !== manualCompId && (!c.scheduleTime || !c.scheduleTime.trim()) && c.status !== 'completed' && !c.isPublishedResult);
      if (nextUnscheduled) {
        handleSelectManualComp(nextUnscheduled.id);
      }
    }
  };

  // Clear Schedule
  const handleClearSchedule = (compId: string) => {
    const comp = safeCompetitions.find((c) => c.id === compId);
    if (!comp) return;

    const updated: Competition = {
      ...comp,
      scheduleTime: '',
      venue: '',
    };

    festStore.updateCompetition(updated);
    if (onScheduleApplied) onScheduleApplied();
    if (onSuccess) onSuccess();

    setSuccessMessage(`Cleared schedule for "${comp.name}"`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Resolve Clashes for a single day
  const handleRunDayClashResolve = () => {
    setIsComputing(true);
    setTimeout(() => {
      try {
        const result = autoResolveDayClashes({
          dayIdentifier: targetResolveDay,
          competitions: safeCompetitions,
          registrations: safeRegistrations,
          stages: selectedStages,
        });
        setResolveResult(result);
      } catch (err) {
        console.error('Resolve clashes error:', err);
      } finally {
        setIsComputing(false);
      }
    }, 200);
  };

  const handleApplyResolvedClashes = () => {
    if (!resolveResult) return;
    festStore.updateCompetitionsBatch(resolveResult.updatedCompetitions);
    if (onScheduleApplied) onScheduleApplied();
    if (onSuccess) onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#121422] border-2 border-purple-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-[#151728] border-b border-[#292d4a] flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg shadow-purple-600/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                Festival Schedule Manager
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Auto-distribute events conflict-free or manually assign timetable slots
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher Tabs */}
            <div className="flex bg-[#0e101d] p-1 rounded-2xl border border-[#292d4a]">
              <button
                type="button"
                onClick={() => {
                  setActiveMode('auto');
                  setCurrentStep(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMode === 'auto'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto Wizard</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('manual')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMode === 'manual'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Manual Entry</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('resolve')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMode === 'resolve'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Resolve Clashes</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-[#292d4a] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Feedback banner */}
          {successMessage && (
            <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-300 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* MODE 1: AUTO SCHEDULE WIZARD */}
          {/* ======================================================== */}
          {activeMode === 'auto' && (
            <div className="space-y-6">
              {/* Wizard Steps Navigation */}
              <div className="flex items-center justify-between border-b border-[#292d4a] pb-4">
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs">
                  <span
                    onClick={() => setCurrentStep(1)}
                    className={`cursor-pointer px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 ${
                      currentStep === 1
                        ? 'bg-purple-600 text-white'
                        : 'bg-[#181b30] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>1. Festival Days & Slots</span>
                  </span>

                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden sm:block" />

                  <span
                    onClick={() => setCurrentStep(2)}
                    className={`cursor-pointer px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 ${
                      currentStep === 2
                        ? 'bg-purple-600 text-white'
                        : 'bg-[#181b30] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>2. Stages & Rules</span>
                  </span>

                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden sm:block" />

                  <span
                    onClick={() => previewResult && setCurrentStep(3)}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 ${
                      currentStep === 3
                        ? 'bg-purple-600 text-white'
                        : previewResult
                        ? 'bg-[#181b30] text-slate-400 hover:text-white cursor-pointer'
                        : 'bg-[#181b30]/50 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <span>3. Distribution Preview</span>
                  </span>
                </div>
              </div>

              {/* STEP 1: Festival Days & Time Slots */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        Configure Festival Days & Time Slots
                      </h3>
                      <p className="text-xs text-slate-400">
                        Specify festival dates and the time intervals available for competitions on each day.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddDay}
                      className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Day</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {festivalDays.map((day, idx) => (
                      <div
                        key={day.id}
                        className="p-4 bg-[#151728] rounded-2xl border border-[#292d4a] space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 flex-wrap">
                            <input
                              type="text"
                              value={day.label}
                              onChange={(e) => handleUpdateDay(day.id, { label: e.target.value })}
                              placeholder="Day Label"
                              className="bg-[#181b30] border border-[#292d4a] rounded-xl px-3 py-1 text-xs text-white font-bold w-40"
                            />
                            <input
                              type="text"
                              value={day.date}
                              onChange={(e) => handleUpdateDay(day.id, { date: e.target.value })}
                              placeholder="2026-11-15 or 07/09/2026"
                              className="bg-[#181b30] border border-[#292d4a] rounded-xl px-3 py-1 text-xs text-white font-mono w-40"
                            />
                            <span className="text-[11px] text-slate-400 font-mono">
                              ({day.timeSlots.length} time slots)
                            </span>
                          </div>

                          {festivalDays.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDay(day.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all cursor-pointer"
                              title="Delete Day"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Time slots tags */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Time Slots:</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const slots = generateTimeSlots(9, 17, 60, 0);
                                  handleUpdateDay(day.id, { timeSlots: slots });
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-[#181b30] hover:bg-purple-600/30 text-purple-300 border border-[#292d4a]"
                              >
                                Standard 1-Hour Slots
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const slots = ['3.00 to 3.30', '4.40 to 5.10', '5.15 to 5.45', '9.30 to 10.00', '10.10 to 10.40'];
                                  handleUpdateDay(day.id, { timeSlots: slots });
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-[#181b30] hover:bg-purple-600/30 text-purple-300 border border-[#292d4a]"
                              >
                                Afternoon Timetable Presets
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {day.timeSlots.map((slot, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#181b30] border border-[#292d4a] text-xs font-mono text-slate-200"
                              >
                                <span>{slot}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTimeSlotFromDay(day.id, sIdx)}
                                  className="text-slate-500 hover:text-rose-400"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <span>Proceed to Stages & Rules</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Stages & Optimization Rules */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Select Active Stages / Venues
                    </h3>
                    <p className="text-xs text-slate-400">
                      Competitions will be distributed across selected stages to eliminate participant conflicts.
                    </p>
                  </div>

                  {/* Stages Checkboxes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {['STAGE 1', 'STAGE 2', 'STAGE 3', 'STAGE 4', 'STAGE 5', 'STAGE 6', 'Main Stage'].map(
                      (st) => {
                        const isSelected = selectedStages.includes(st);
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleToggleStage(st)}
                            className={`p-3 rounded-2xl border text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-[#a83b8a] text-white border-[#a83b8a] shadow-md'
                                : 'bg-[#151728] text-slate-400 border-[#292d4a] hover:border-slate-600'
                            }`}
                          >
                            <span>{st}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* Add Custom Stage */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add custom stage / venue..."
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      className="bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomStage}
                      className="px-4 py-2 rounded-xl bg-[#181b30] hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all cursor-pointer"
                    >
                      + Add Stage
                    </button>
                  </div>

                  {/* Scheduling Rules */}
                  <div className="p-4 bg-[#151728] rounded-2xl border border-[#292d4a] space-y-3">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                      Distribution Optimization Rules
                    </h4>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input
                          type="checkbox"
                          checked={prioritizeStage}
                          onChange={(e) => setPrioritizeStage(e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span>Prioritize Stage items on main stages and off-stage items on secondary venues</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input
                          type="checkbox"
                          checked={overwriteExisting}
                          onChange={(e) => setOverwriteExisting(e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span>Overwrite already scheduled competitions (rebalance all)</span>
                      </label>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-bold">Category Scope:</span>
                      <select
                        value={selectedCategoryFilter}
                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        className="bg-[#181b30] border border-[#292d4a] rounded-xl px-2.5 py-1 text-xs text-white"
                      >
                        <option value="All">All Categories</option>
                        <option value="Senior">Senior Only</option>
                        <option value="Junior">Junior Only</option>
                        <option value="General">General Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 rounded-xl bg-[#181b30] text-slate-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCalculateAutoSchedule}
                      disabled={isComputing}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-600/30 active:scale-95 cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isComputing ? 'Computing Optimal Slots...' : 'Run Auto Distribution'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Preview Result & Apply */}
              {currentStep === 3 && previewResult && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-[#151728] rounded-2xl border border-[#292d4a]">
                      <span className="text-xs text-slate-400 font-bold">Total Scheduled</span>
                      <p className="text-xl font-black text-white">{previewResult.totalScheduled} Competitions</p>
                    </div>

                    <div className="p-4 bg-[#151728] rounded-2xl border border-[#292d4a]">
                      <span className="text-xs text-slate-400 font-bold">Participant Conflicts</span>
                      <p className={`text-xl font-black ${previewResult.conflictsFound === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {previewResult.conflictsFound === 0 ? '✓ 0 Conflicts (Clean!)' : `${previewResult.conflictsFound} Clashes`}
                      </p>
                    </div>

                    <div className="p-4 bg-[#151728] rounded-2xl border border-[#292d4a]">
                      <span className="text-xs text-slate-400 font-bold">Status</span>
                      <p className="text-xs font-medium text-purple-300 mt-1">{previewResult.message}</p>
                    </div>
                  </div>

                  {/* Scheduled Items List Preview */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Proposed Timetable Assignments:
                    </h4>

                    <div className="max-h-64 overflow-y-auto rounded-2xl border border-[#292d4a] overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-[#0e101d] text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#292d4a]">
                            <th className="py-2.5 px-4">Competition</th>
                            <th className="py-2.5 px-4 w-40">Date & Time</th>
                            <th className="py-2.5 px-4 w-32">Stage / Venue</th>
                            <th className="py-2.5 px-4 w-28">Category</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#292d4a]/50 text-slate-200">
                          {previewResult.updatedCompetitions
                            .filter((c) => Boolean(c.scheduleTime))
                            .map((c) => (
                              <tr key={c.id} className="hover:bg-[#181b30] transition-colors">
                                <td className="py-2 px-4 font-bold text-white">{c.name}</td>
                                <td className="py-2 px-4 font-mono text-sky-300">{c.scheduleTime}</td>
                                <td className="py-2 px-4 font-bold text-purple-300">{c.venue}</td>
                                <td className="py-2 px-4 text-slate-400">{c.category || 'Senior'}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 rounded-xl bg-[#181b30] text-slate-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back to Settings</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyAutoSchedule}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer inline-flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Apply & Save Schedule</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* MODE 2: MANUAL TIMETABLE ENTRY */}
          {/* ======================================================== */}
          {activeMode === 'manual' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Direct Timetable Assignment
                </h3>
                <p className="text-xs text-slate-400">
                  Select any competition, specify the festival date, stage venue, and time slot to immediately record the schedule.
                </p>
              </div>

              <form onSubmit={(e) => handleSaveManualSchedule(e, false)} className="space-y-4">
                {/* 1. Pick Competition */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-purple-300">
                    1. Select Competition
                  </label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search competition by name..."
                        value={manualSearch}
                        onChange={(e) => setManualSearch(e.target.value)}
                        className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <select
                      value={manualCompId}
                      onChange={(e) => handleSelectManualComp(e.target.value)}
                      className="w-full bg-[#181b30] border border-purple-500/40 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-bold"
                    >
                      {safeCompetitions
                        .filter(
                          (c) =>
                            c.status !== 'completed' &&
                            !c.isPublishedResult &&
                            (!manualSearch ||
                              c.name.toLowerCase().includes(manualSearch.toLowerCase()) ||
                              c.category?.toLowerCase().includes(manualSearch.toLowerCase()))
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id} className="bg-[#181b30]">
                            {c.name} ({c.category || 'Senior'}) {c.scheduleTime ? `[✓ ${c.venue || 'Scheduled'}]` : '[○ Unscheduled]'}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Grid fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* 2. Date */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-purple-300">
                      2. Date (DD/MM/YYYY)
                    </label>
                    <input
                      type="text"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      placeholder="07/09/2026"
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {['07/09/2026', '08/09/2026', '09/09/2026'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setManualDate(d)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[#181b30] hover:bg-purple-600/30 text-slate-400 hover:text-purple-300 border border-[#292d4a]"
                        >
                          {d.slice(0, 5)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Stage / Venue */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-purple-300">
                      3. Stage / Venue
                    </label>
                    <input
                      type="text"
                      value={manualStage}
                      onChange={(e) => setManualStage(e.target.value)}
                      placeholder="STAGE 4"
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-bold"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {['STAGE 4', 'STAGE 5', 'STAGE 6', 'STAGE 1', 'Main Stage'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setManualStage(st)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[#181b30] hover:bg-purple-600/30 text-slate-400 hover:text-purple-300 border border-[#292d4a]"
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Time Slot */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-amber-300">
                      4. Time Slot
                    </label>
                    <input
                      type="text"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      placeholder="3.00 to 3.30"
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {['3.00 to 3.30', '4.40 to 5.10', '5.15 to 5.45', '9.30 to 10.00'].map((ts) => (
                        <button
                          key={ts}
                          type="button"
                          onClick={() => setManualTime(ts)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[#181b30] hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-[#292d4a]"
                        >
                          {ts}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. Category */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-purple-300">
                      5. Category
                    </label>
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-bold"
                    >
                      <option value="Senior">Senior</option>
                      <option value="Junior">Junior</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#292d4a]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-[#181b30] text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    ✓ Save Schedule
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleSaveManualSchedule(e, true)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer"
                  >
                    ✓ Save & Close
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* MODE 3: RESOLVE DAY CLASHES */}
          {/* ======================================================== */}
          {activeMode === 'resolve' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  <span>Auto-Resolve Participant Clashes for a Day</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Select a day to rebalance slot assignments across stages without creating new time slots or moving items to another date.
                </p>
              </div>

              <div className="p-4 bg-[#151728] rounded-2xl border border-[#292d4a] space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-purple-300">Target Festival Day:</span>
                  <input
                    type="text"
                    value={targetResolveDay}
                    onChange={(e) => setTargetResolveDay(e.target.value)}
                    placeholder="07/09/2026 or Day 1"
                    className="bg-[#181b30] border border-[#292d4a] rounded-xl px-3 py-1.5 text-xs text-white font-mono w-48"
                  />
                  <button
                    type="button"
                    onClick={handleRunDayClashResolve}
                    disabled={isComputing}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>{isComputing ? 'Resolving...' : 'Resolve Clashes'}</span>
                  </button>
                </div>

                {resolveResult && (
                  <div className="p-4 bg-[#181b30] rounded-xl border border-[#292d4a] space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Resolution Outcome:</span>
                      <span className={`text-xs font-black ${resolveResult.conflictsFound === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {resolveResult.conflictsFound === 0 ? '✓ 0 Conflicts Remaining' : `${resolveResult.conflictsFound} Remaining Clashes`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{resolveResult.message}</p>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleApplyResolvedClashes}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer"
                      >
                        ✓ Apply Rebalanced Schedule
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
