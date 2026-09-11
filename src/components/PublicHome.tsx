import React, { useState, useEffect } from 'react';
import { Countdown } from './Countdown';
import { EventPostersSlider } from './EventPostersSlider';
import { LeaderboardEntry, Competition } from '../types';
import { Trophy, Music, Palette, BookOpen, Search, SlidersHorizontal, Calendar, MapPin, Sparkles, Shield, Users, User, ArrowRight, Bookmark, Check, Share2, Clock, X } from 'lucide-react';
import { festStore, formatStageName, formatCompetitionName } from '../lib/store';
import { formatDayDateWithWeekday, normalizeScheduleString } from '../lib/scheduler';
import logoImg from '../assets/images/fest_logo_flat_1785671917562.jpg';

const isCompetitionScheduled = (comp: Competition): boolean => {
  if (comp.status === 'completed') return true;
  if (!comp.scheduleTime) return false;
  const { dayDate } = normalizeScheduleString(comp.scheduleTime);
  if (!dayDate) return false;
  
  const activeDays = festStore.getFestivalDays();
  if (activeDays.length === 0) {
    return true; // fallback if no days set up
  }

  const compFormatted = formatDayDateWithWeekday(dayDate);
  return activeDays.some((d) => {
    const dFormatted = formatDayDateWithWeekday(d.date, d.label);
    return (
      compFormatted === dFormatted ||
      (d.date && dayDate.includes(d.date)) ||
      (d.label && dayDate.toLowerCase().includes(d.label.toLowerCase()))
    );
  });
};

interface PublicHomeProps {
  leaderboard: LeaderboardEntry[];
  competitions: Competition[];
  onNavigate: (tab: string) => void;
}

export const PublicHome: React.FC<PublicHomeProps> = ({
  leaderboard,
  competitions,
  onNavigate
}) => {
  const [branding, setBranding] = useState(() => festStore.getBrandingConfig());
  const [publishedCount, setPublishedCount] = useState(() => festStore.getResults().length);
  const [showGroupPointStatus, setShowGroupPointStatus] = useState(() => festStore.getShowGroupPointStatus());

  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      setBranding(festStore.getBrandingConfig());
      setPublishedCount(festStore.getResults().length);
      setShowGroupPointStatus(festStore.getShowGroupPointStatus());
    });
    return unsubscribe;
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStage, setSelectedStage] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);

  // Strictly filter running competitions (must also be scheduled)
  const runningCompetitions = competitions.filter(
    comp => (comp.status === 'running' || (comp.isRunning && comp.status !== 'completed' && !comp.isPublishedResult)) && isCompetitionScheduled(comp)
  );

  const categories = ['All', ...Array.from(new Set(runningCompetitions.map(c => c.category)))];
  const stagesList = Array.from(new Set(runningCompetitions.map(c => formatStageName(c.venue)))).filter(Boolean);

  const filteredCompetitions = runningCompetitions.filter(comp => {
    const formattedName = formatCompetitionName(comp.name, comp.category);
    const matchesCategory = selectedCategory === 'All' || comp.category === selectedCategory;
    const matchesStage = selectedStage === 'All' || formatStageName(comp.venue) === selectedStage;
    const matchesSearch = comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          formattedName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          comp.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          comp.venue.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesStage && matchesSearch;
  });

  const activeFilterCount = (selectedCategory !== 'All' ? 1 : 0) + (selectedStage !== 'All' ? 1 : 0);

  return (
    <div className="space-y-8 py-4 sm:py-6 pb-24">
      
      {/* Countdown Clock */}
      <Countdown />

      {/* Landscape Event Posters */}
      <EventPostersSlider />

      {/* Group Point Status Section (Styled like image with Group Theme Color) */}
      {showGroupPointStatus && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Group Point Status
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/40 text-amber-300 text-xs font-black font-mono shadow-[0_0_12px_rgba(245,158,11,0.2)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="text-slate-300 font-semibold">After</span>
              <span className="text-amber-400 font-black px-1.5 py-0.5 rounded bg-[#2d2613] border-none">
                {publishedCount}
              </span>
            </span>
          </div>

          {/* Group Point Status Capsules Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {leaderboard.map((group, idx) => {
              // Group Theme Color dynamically from group settings or fallback palette
              const defaultPalette = ['#eab308', '#38bdf8', '#22c55e', '#a855f7', '#ec4899', '#f97316'];
              const themeColor = (group.color && group.color.trim()) ? group.color : defaultPalette[idx % defaultPalette.length];

              return (
                <div
                  key={group.groupId}
                  className="px-6 py-3.5 sm:py-4 bg-[#141624] border-[3px] rounded-full flex items-center justify-between gap-4 transition-all duration-200 hover:scale-[1.02] shadow-lg"
                  style={{
                    borderColor: themeColor,
                    boxShadow: `0 0 16px ${themeColor}20`,
                  }}
                >
                  {/* Team Name in Uppercase, Bold, with Group Theme Color */}
                  <span
                    className="font-black uppercase tracking-wider text-xs sm:text-sm md:text-[13px] lg:text-sm truncate"
                    style={{ color: themeColor }}
                  >
                    {group.groupName}
                  </span>

                  {/* Points Count with Group Theme Color */}
                  <span
                    className="font-black font-mono text-base sm:text-lg lg:text-xl tracking-tight shrink-0"
                    style={{ color: themeColor }}
                  >
                    {group.totalPoints}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Running Competitions Controls Bar */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-[#12141d] border border-[#292d4a] px-3 py-1.5 rounded-xl">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-emerald-400 font-mono">
              {filteredCompetitions.length}
            </span>
            <span className="text-xs font-semibold text-emerald-400/90 lowercase">running</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search within running competitions */}
            <div className="relative flex-1 sm:w-44">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search running..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* Filter Modal Trigger Button */}
            <button
              onClick={() => setShowFilterModal(true)}
              title="Filter Options"
              className={`flex items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all relative shrink-0 ${
                activeFilterCount > 0
                  ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                  : 'bg-[#181b30] border-[#292d4a] text-slate-300 hover:text-white hover:border-purple-500/50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-[#0b0c16]">
                  {activeFilterCount}
                </span>
              )}
            </button>


          </div>
        </div>

        {/* Active Filters Bar */}
        {(selectedCategory !== 'All' || selectedStage !== 'All') && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
            <span className="text-slate-400 text-[11px] font-medium">Active filters:</span>
            {selectedCategory !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[11px] font-bold">
                Category: {selectedCategory}
                <X className="w-3 h-3 cursor-pointer hover:text-white ml-0.5" onClick={() => setSelectedCategory('All')} />
              </span>
            )}
            {selectedStage !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[11px] font-bold">
                Stage: {selectedStage}
                <X className="w-3 h-3 cursor-pointer hover:text-white ml-0.5" onClick={() => setSelectedStage('All')} />
              </span>
            )}
            <button
              onClick={() => { setSelectedCategory('All'); setSelectedStage('All'); }}
              className="text-[11px] text-purple-400 hover:underline font-semibold"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Competitions Cards Grid */}
        {filteredCompetitions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCompetitions.map((comp) => {
              return (
                <div
                  key={comp.id}
                  onClick={() => onNavigate('competitions')}
                  className="poster-card p-5 bg-[#151728] rounded-3xl border border-[#292d4a] hover:border-purple-500/50 cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header Row: Title & Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-2">
                        {formatCompetitionName(comp.name, comp.category)}
                      </h3>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        Running
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 font-medium">
                      {comp.venue && formatStageName(comp.venue) ? (
                        <span className="flex items-center gap-1 shrink-0">
                          <MapPin className="w-3 h-3 text-purple-400" /> {formatStageName(comp.venue)}
                        </span>
                      ) : null}
                      {(() => {
                        const parts = comp.scheduleTime.split(',');
                        const timePart = parts.slice(1).join(',')?.trim() || comp.scheduleTime;
                        return (
                          <>
                            <span className="text-slate-500">•</span>
                            <span className="flex items-center gap-1 text-sky-300 font-semibold shrink-0">
                              <Clock className="w-3 h-3 text-sky-400" /> {timePart}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-[#151728] border border-[#292d4a] rounded-3xl text-slate-400 text-sm">
            No running competitions found matching your criteria.
          </div>
        )}
      </div>

      {/* Filter Options Modal Overlay */}
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
                    onClick={() => setSelectedStage('All')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      selectedStage === 'All'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                    }`}
                  >
                    All Stages
                  </button>
                  {stagesList.map((st) => (
                    <button
                      key={st}
                      onClick={() => setSelectedStage(st)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedStage === st
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
                  setSelectedStage('All');
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

