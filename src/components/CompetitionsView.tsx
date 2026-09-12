import React, { useState, useEffect, useMemo } from 'react';
import { Competition } from '../types';
import { Search, Filter, MapPin, Clock, Trophy, Users, User, Info, SlidersHorizontal, X, Check, Calendar } from 'lucide-react';
import { festStore, formatStageName, formatCompetitionName, normalizeScheduleString } from '../lib/store';

interface CompetitionsViewProps {
  competitions: Competition[];
  onSelectCompetition?: (comp: Competition) => void;
}

export const CompetitionsView: React.FC<CompetitionsViewProps> = ({ competitions = [] }) => {
  const [branding, setBranding] = useState(() => festStore.getBrandingConfig());
  const [stagesList, setStagesList] = useState<string[]>(() => festStore.getStages());
  const [registrations, setRegistrations] = useState(() => festStore.getRegistrations());

  const safeCompetitions = Array.isArray(competitions) ? competitions : [];
  const safeRegistrations = Array.isArray(registrations) ? registrations : [];

  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      setBranding(festStore.getBrandingConfig());
      setStagesList(festStore.getStages());
      setRegistrations(festStore.getRegistrations());
    });
    return unsubscribe;
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [stageFilter, setStageFilter] = useState<string>('All');
  const [activeModalComp, setActiveModalComp] = useState<Competition | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const isCompetitionCompleted = (comp: Competition): boolean => {
    return comp.status === 'completed' || Boolean(comp.isPublishedResult);
  };

  // Determine competition status: 'running' | 'pending' | 'completed'
  const getCompetitionStatus = (comp: Competition): 'running' | 'pending' | 'completed' => {
    if (comp.status === 'completed' || Boolean(comp.isPublishedResult)) {
      return 'completed';
    }
    if (comp.status === 'running' || Boolean(comp.isRunning)) {
      return 'running';
    }
    return 'pending';
  };

  // Sort competitions strictly: 1. pending, 2. running, 3. completed
  const sortCompetitionsByStatus = (list: Competition[]): Competition[] => {
    const statusRank: Record<'pending' | 'running' | 'completed', number> = {
      pending: 0,
      running: 1,
      completed: 2,
    };

    return [...list].sort((a, b) => {
      const statusA = getCompetitionStatus(a);
      const statusB = getCompetitionStatus(b);
      const rankDiff = statusRank[statusA] - statusRank[statusB];
      if (rankDiff !== 0) return rankDiff;

      // Secondary chronological sort by schedule date & time slot
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
  };

  // Helper to test if a competition is genuinely scheduled
  const isScheduledCompetition = (comp: Competition): boolean => {
    if (isCompetitionCompleted(comp)) return true;
    if (comp.scheduleTime && comp.scheduleTime.trim() && comp.scheduleTime !== 'Unscheduled / TBA') return true;
    if (comp.venue && comp.venue.trim()) return true;
    return false;
  };

  // Only scheduled competitions (including completed ones)
  const scheduledCompetitions = useMemo(() => {
    return safeCompetitions.filter((comp) => isScheduledCompetition(comp) || isCompetitionCompleted(comp));
  }, [safeCompetitions]);

  // Unscheduled competitions: only pending competitions awaiting schedule
  // When completed, the competition disappears from unscheduled competitions
  const unscheduledCompetitions = useMemo(() => {
    return safeCompetitions.filter((comp) => !isScheduledCompetition(comp) && !isCompetitionCompleted(comp));
  }, [safeCompetitions]);

  const categories = useMemo(() => {
    return Array.from(new Set(['All', ...safeCompetitions.map(c => c.category).filter(Boolean)]));
  }, [safeCompetitions]);

  // Filter helper
  const filterCompList = (list: Competition[]) => {
    return list.filter(comp => {
      const isSched = isScheduledCompetition(comp);
      const formattedName = formatCompetitionName(comp.name, comp.category);
      const matchesSearch = comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            formattedName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (comp.category && comp.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (comp.description && comp.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (isSched && comp.venue && comp.venue.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || comp.category === selectedCategory;
      
      // Scheduled competitions only assigned to stages:
      // When filtering by a specific stage, unscheduled competitions (not assigned to any stage) do not match
      const matchesStage = stageFilter === 'All' || 
                           (isSched && comp.venue && (
                             comp.venue.toLowerCase().includes(stageFilter.toLowerCase()) ||
                             stageFilter.toLowerCase().includes(comp.venue.toLowerCase())
                           ));

      return matchesSearch && matchesCategory && matchesStage;
    });
  };

  const filteredScheduled = useMemo(() => {
    return sortCompetitionsByStatus(filterCompList(scheduledCompetitions));
  }, [scheduledCompetitions, searchTerm, selectedCategory, stageFilter]);

  const filteredUnscheduled = useMemo(() => {
    return sortCompetitionsByStatus(filterCompList(unscheduledCompetitions));
  }, [unscheduledCompetitions, searchTerm, selectedCategory, stageFilter]);

  return (
    <div className="space-y-6 py-4 sm:py-6 pb-24">
      
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Schedule
        </h1>
      </div>

      {/* Filters Bar */}
      <div className="space-y-3">
        
        {/* Search Input & Filter Button */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search competitions, stages, descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilterModal(true)}
            title="Filter Options"
            className={`flex items-center justify-center p-2.5 text-xs font-bold rounded-xl border transition-all ${
              selectedCategory !== 'All' || stageFilter !== 'All'
                ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20' 
                : 'bg-[#181b30] border-[#292d4a] text-slate-300 hover:text-white hover:border-purple-500/50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {(selectedCategory !== 'All' || stageFilter !== 'All') && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-1" />
            )}
          </button>
        </div>

        {/* Active Filters Bar */}
        {(selectedCategory !== 'All' || stageFilter !== 'All') && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
            <span className="text-slate-400 text-[11px] font-medium">Active filters:</span>
            {selectedCategory !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[11px] font-bold">
                Category: {selectedCategory}
                <X className="w-3 h-3 cursor-pointer hover:text-white ml-0.5" onClick={() => setSelectedCategory('All')} />
              </span>
            )}
            {stageFilter !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[11px] font-bold">
                Stage: {stageFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-white ml-0.5" onClick={() => setStageFilter('All')} />
              </span>
            )}
            <button
              onClick={() => { setSelectedCategory('All'); setStageFilter('All'); }}
              className="text-[11px] text-purple-400 hover:underline font-semibold"
            >
              Clear all
            </button>
          </div>
        )}

      </div>

      {/* Scheduled Competitions Grid */}
      {filteredScheduled.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredScheduled.map((comp) => {
            const status = getCompetitionStatus(comp);
            const isCompleted = status === 'completed';

            return (
              <div
                key={comp.id}
                onClick={() => setActiveModalComp(comp)}
                className="poster-card p-5 bg-[#151728] rounded-3xl border border-[#292d4a] hover:border-purple-500/50 cursor-pointer group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Header Row: Title & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-2">
                      {formatCompetitionName(comp.name, comp.category)}
                    </h3>
                    {status === 'running' ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5" title="Running">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        Running
                      </div>
                    ) : isCompleted ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5" title="Completed">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Completed
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5" title="Pending">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Pending
                      </div>
                    )}
                  </div>

                  {/* Stage and Time - hidden for completed competitions */}
                  {!isCompleted && (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 font-medium">
                      {comp.venue && formatStageName(comp.venue) ? (
                        <span className="flex items-center gap-1 shrink-0">
                          <MapPin className="w-3 h-3 text-purple-400" /> {formatStageName(comp.venue)}
                        </span>
                      ) : null}
                      {comp.scheduleTime && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span className="flex items-center gap-1 text-sky-300 font-semibold shrink-0">
                            <Clock className="w-3 h-3 text-sky-400" /> {comp.scheduleTime}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unscheduled Competitions Cards (under the Schedules cards, styled identically) */}
      {filteredUnscheduled.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[#292d4a]/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  Unscheduled Competitions
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {filteredUnscheduled.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Events awaiting festival day, time slot, or stage venue confirmation
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUnscheduled.map((comp) => {
              const status = getCompetitionStatus(comp);
              const isCompleted = status === 'completed';

              return (
                <div
                  key={comp.id}
                  onClick={() => setActiveModalComp(comp)}
                  className="poster-card p-5 bg-[#151728] rounded-3xl border border-[#292d4a] hover:border-amber-500/50 cursor-pointer group flex flex-col justify-between transition-all"
                >
                  <div className="space-y-3">
                    {/* Header Row: Title & Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2">
                        {formatCompetitionName(comp.name, comp.category)}
                      </h3>
                      {status === 'running' ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5" title="Running">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          Running
                        </div>
                      ) : isCompleted ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5" title="Completed">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Completed
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5" title="Pending Schedule">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Pending
                        </div>
                      )}
                    </div>

                    {/* Stage and Time - hidden for completed competitions */}
                    {!isCompleted && (
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1 text-slate-300 shrink-0">
                          <MapPin className="w-3 h-3 text-purple-400" />
                          <span>Stage: {comp.venue && formatStageName(comp.venue) ? formatStageName(comp.venue) : 'To Be Announced'}</span>
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="flex items-center gap-1 text-sky-400/80 font-semibold shrink-0">
                          <Clock className="w-3 h-3 text-sky-400/80" /> {comp.scheduleTime && comp.scheduleTime.trim() ? comp.scheduleTime : 'Schedule TBA'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No results empty state */}
      {filteredScheduled.length === 0 && filteredUnscheduled.length === 0 && (
        <div className="poster-card p-12 text-center text-slate-400 space-y-3 bg-[#151728] rounded-3xl border border-[#292d4a]">
          {safeCompetitions.length === 0 ? (
            <>
              <p className="text-sm font-semibold text-slate-300">No competitions found.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No festival competitions have been registered in the system yet.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">No competitions found matching your search or filter criteria.</p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setStageFilter('All'); }}
                className="poster-btn-outline text-xs rounded-xl"
              >
                Reset Filters
              </button>
            </>
          )}
        </div>
      )}

      {/* Details Modal */}
      {activeModalComp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="poster-card max-w-lg w-full bg-[#151728] border border-purple-500/50 p-6 rounded-3xl space-y-5 shadow-2xl relative">
            
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-purple-600 text-white">
                  {activeModalComp.category} • {activeModalComp.type}
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-2">
                  {formatCompetitionName(activeModalComp.name, activeModalComp.category)}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalComp(null)}
                className="p-2 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-slate-300 text-xs sm:text-sm leading-relaxed bg-[#181b30] p-4 rounded-2xl border border-[#292d4a] whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
              {activeModalComp.description}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-3 bg-[#181b30] rounded-xl border border-[#292d4a]">
                <span className="text-slate-400 font-semibold">Status:</span>
                {(() => {
                  const modalStatus = getCompetitionStatus(activeModalComp);
                  if (modalStatus === 'running') {
                    return <span className="text-emerald-400 font-bold uppercase text-xs">● Running</span>;
                  }
                  if (modalStatus === 'completed') {
                    return <span className="text-rose-400 font-bold uppercase text-xs">● Completed</span>;
                  }
                  return <span className="text-amber-400 font-bold uppercase text-xs">● Pending</span>;
                })()}
              </div>

              {/* Stage and Time - hidden for completed competitions */}
              {getCompetitionStatus(activeModalComp) !== 'completed' && (
                <>
                  <div className="flex justify-between p-3 bg-[#181b30] rounded-xl border border-[#292d4a]">
                    <span className="text-slate-400 font-semibold">Stage:</span>
                    <span className="text-white font-bold">
                      {isScheduledCompetition(activeModalComp) && activeModalComp.venue && activeModalComp.venue.trim()
                        ? formatStageName(activeModalComp.venue)
                        : 'To Be Announced'}
                    </span>
                  </div>
                  {(() => {
                    const scheduleTimeStr = activeModalComp.scheduleTime || '';
                    const parts = scheduleTimeStr.split(',');
                    const datePart = parts[0]?.trim();
                    const timePart = parts.slice(1).join(',')?.trim();
                    return (
                      <>
                        {datePart ? (
                          <div className="flex justify-between p-3 bg-[#181b30] rounded-xl border border-[#292d4a]">
                            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-purple-400" /> Scheduled Date:
                            </span>
                            <span className="text-white font-bold">{datePart}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between p-3 bg-[#181b30] rounded-xl border border-[#292d4a]">
                            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" /> Scheduled Date:
                            </span>
                            <span className="text-slate-400 font-bold">To Be Announced</span>
                          </div>
                        )}
                        {timePart && (
                          <div className="flex justify-between p-3 bg-[#181b30] rounded-xl border border-[#292d4a]">
                            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-sky-400" /> Scheduled Time:
                            </span>
                            <span className="text-sky-300 font-bold">{timePart}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
              <div className="flex justify-between p-3 bg-[#181b30] rounded-xl border border-[#292d4a]">
                <span className="text-slate-400 font-semibold">Max Entries per Group:</span>
                <span className="text-indigo-300 font-bold">{activeModalComp.maxEntriesPerGroup} Entry</span>
              </div>
              <div className="flex justify-between p-3 bg-[#181b30] rounded-xl border border-[#292d4a]">
                <span className="text-slate-400 font-semibold">Point Scale (1st / 2nd / 3rd):</span>
                <span className="text-amber-400 font-bold font-mono">
                  {activeModalComp.points1st} / {activeModalComp.points2nd} / {activeModalComp.points3rd} Points
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveModalComp(null)}
              className="poster-btn-primary w-full text-xs py-3 rounded-2xl"
            >
              Close Details
            </button>

          </div>
        </div>
      )}

      {/* Schedule Filter Options Modal Overlay */}
      {showFilterModal && (
        <div 
          onClick={() => setShowFilterModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#151728] border border-[#292d4a] rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Close Button */}
            <button
              onClick={() => setShowFilterModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors z-10"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Body */}
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
              
              {/* Category Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedCategory === cat
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                          : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stage Location Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Stage / Location
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setStageFilter('All')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      stageFilter === 'All'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                    }`}
                  >
                    All Stages
                  </button>
                  {stagesList.map((st) => (
                    <button
                      key={st}
                      onClick={() => setStageFilter(st)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        stageFilter === st
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                          : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-start pt-4 border-t border-[#292d4a]">
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setStageFilter('All');
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-[#181b30] border border-[#292d4a] transition-colors"
              >
                Reset All
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
