import React, { useState, useEffect } from 'react';
import { LeaderboardEntry, Result, Competition } from '../types';
import { Award, CheckCircle2, Search, SlidersHorizontal, X, Crown, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ParticipantAvatar } from './ParticipantAvatar';
import { festStore, formatCompetitionName } from '../lib/store';

interface ResultsViewProps {
  leaderboard?: LeaderboardEntry[];
  results: Result[];
  competitions?: Competition[];
  onRefresh?: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  results,
  competitions = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const registrations = festStore.getRegistrations();

  useEffect(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }, []);

  // Extract unique categories & groups for filter pills
  const availableCategories = Array.from(
    new Set(['All', ...competitions.map((c) => c.category)])
  );

  const availableGroups = Array.from(
    new Set(
      results
        .flatMap((r) => {
          const w = festStore.getResultWinners(r);
          return [
            ...w.first.map((x) => x.groupName),
            ...w.second.map((x) => x.groupName),
            ...w.third.map((x) => x.groupName),
          ];
        })
        .filter(Boolean) as string[]
    )
  );

  // Filter logic
  const filteredResults = results.filter((res) => {
    const comp = competitions.find((c) => c.id === res.competitionId);
    
    // Ensure only competitions scored and saved by the judge appear in Published Results
    const compRegs = registrations.filter((r) => r.competitionId === res.competitionId);
    const reportedRegs = compRegs.filter((r) => r.isReported === true);
    const isScoredByJudge = reportedRegs.length > 0 && reportedRegs.some((r) => r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '');
    if (!isScoredByJudge) return false;

    const compCategory = comp ? comp.category : undefined;
    const formattedCompName = formatCompetitionName(res.competitionName, compCategory);

    const winners = festStore.getResultWinners(res);
    const allWinnerNames = [
      ...winners.first.map(w => festStore.getParticipantFullName(w.participantName, w.regId)),
      ...winners.second.map(w => festStore.getParticipantFullName(w.participantName, w.regId)),
      ...winners.third.map(w => festStore.getParticipantFullName(w.participantName, w.regId)),
    ].join(' ').toLowerCase();

    const allWinnerGroups = [
      ...winners.first.map(w => w.groupName),
      ...winners.second.map(w => w.groupName),
      ...winners.third.map(w => w.groupName),
    ];

    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      res.competitionName.toLowerCase().includes(term) ||
      formattedCompName.toLowerCase().includes(term) ||
      (compCategory && compCategory.toLowerCase().includes(term)) ||
      allWinnerNames.includes(term) ||
      allWinnerGroups.some(g => g.toLowerCase().includes(term));

    const matchesCategory =
      categoryFilter === 'All' || (compCategory && compCategory === categoryFilter);

    const matchesGroup =
      groupFilter === 'All' ||
      allWinnerGroups.includes(groupFilter);

    return matchesSearch && matchesCategory && matchesGroup;
  });

  const hasActiveFilters = categoryFilter !== 'All' || groupFilter !== 'All' || searchTerm !== '';

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('All');
    setGroupFilter('All');
  };

  return (
    <div className="space-y-8 py-4 sm:py-6 pb-24">

      {/* Published Competition Results Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Result
            </h2>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by competition name, winner, or group..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              title="Filter"
              className={`flex items-center justify-center p-2.5 sm:px-3 text-xs font-bold rounded-xl border transition-all ${
                showFilters || hasActiveFilters
                  ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-[#181b30] border-[#292d4a] text-slate-300 hover:text-white hover:border-purple-500/50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Filter Modal */}
          {showFilters && (
            <div 
              onClick={() => setShowFilters(false)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            >
              <div 
                className="bg-[#151728] border border-[#292d4a] rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-5 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setShowFilters(false)}
                  className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-xl bg-[#181b30] hover:bg-rose-500/20 transition-colors z-10"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-none pt-2">
                  {/* Category Filter Section */}
                  {availableCategories.length > 1 && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span>Category</span>
                        {categoryFilter !== 'All' && (
                          <span className="text-[10px] text-purple-400 font-normal">Active</span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availableCategories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                              categoryFilter === cat
                                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                                : 'bg-[#181b30] text-slate-300 border-[#292d4a] hover:border-purple-500/40 hover:text-white'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Group Filter Section */}
                  {availableGroups.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span>Winning Group</span>
                        {groupFilter !== 'All' && (
                          <span className="text-[10px] text-amber-400 font-normal">Active</span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setGroupFilter('All')}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                            groupFilter === 'All'
                              ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/30'
                              : 'bg-[#181b30] text-slate-300 border-[#292d4a] hover:border-amber-500/40 hover:text-white'
                          }`}
                        >
                          All Groups
                        </button>
                        {availableGroups.map((grp) => (
                          <button
                            key={grp}
                            onClick={() => setGroupFilter(grp)}
                            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                              groupFilter === grp
                                ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/30'
                                : 'bg-[#181b30] text-slate-300 border-[#292d4a] hover:border-amber-500/40 hover:text-white'
                            }`}
                          >
                            {grp}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-start pt-3 border-t border-[#292d4a]">
                  <button
                    onClick={() => {
                      clearFilters();
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-[#202542] rounded-xl transition-colors"
                  >
                    Reset All
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {results.length === 0 ? (
          <div className="poster-card p-12 text-center text-slate-400 bg-[#151728] rounded-3xl border border-[#292d4a]">
            <Award className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-base font-bold">No competition results published yet.</p>
            <p className="text-xs mt-1 text-slate-500">Results will appear here as soon as stage judges publish scores.</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="poster-card p-10 text-center text-slate-400 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-2">
            <Search className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">No results found matching your search and filter criteria.</p>
            <button
              onClick={clearFilters}
              className="text-xs font-bold text-purple-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredResults.map((res) => {
              const comp = competitions.find((c) => c.id === res.competitionId);
              const winners = festStore.getResultWinners(res);

              const firstWinners = winners.first.map(w => ({
                name: festStore.getParticipantFullName(w.participantName, w.regId),
                group: w.groupName,
                points: comp?.points1st ?? 10,
                photoUrl: festStore.getParticipantPhotoUrl(w.participantName, w.regId),
                code: w.codeLetter,
              }));

              const secondWinners = winners.second.map(w => ({
                name: festStore.getParticipantFullName(w.participantName, w.regId),
                group: w.groupName,
                points: comp?.points2nd ?? 5,
                photoUrl: festStore.getParticipantPhotoUrl(w.participantName, w.regId),
                code: w.codeLetter,
              }));

              const thirdWinners = winners.third.map(w => ({
                name: festStore.getParticipantFullName(w.participantName, w.regId),
                group: w.groupName,
                points: comp?.points3rd ?? 3,
                photoUrl: festStore.getParticipantPhotoUrl(w.participantName, w.regId),
                code: w.codeLetter,
              }));

              return (
                <div 
                  key={res.id}
                  className="poster-card p-5 sm:p-6 bg-[#121424] rounded-[28px] border border-[#292d4a] hover:border-purple-500/50 space-y-5 shadow-2xl transition-all relative overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="border-b border-[#292d4a]/70 pb-3 flex items-center justify-between gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-white">
                      {formatCompetitionName(res.competitionName, comp?.category)}
                    </h3>
                    <span className="text-[11px] font-bold text-slate-400 bg-[#181b30] px-2.5 py-1 rounded-lg border border-[#292d4a]">
                      {comp?.category || 'General'}
                    </span>
                  </div>

                  {/* TOP PODIUM AREA */}
                  <div className="relative pt-7 pb-5 px-3 bg-gradient-to-b from-[#181a33] to-[#121424] rounded-2xl border border-[#292d4a]/60">
                    
                    {/* Radial Glow behind 1st Place */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-end justify-center gap-2 sm:gap-4 relative z-0">
                      
                      {/* 2nd Place (Left) */}
                      <div className="flex flex-col items-center text-center w-24 sm:w-32 order-1 space-y-3">
                        {secondWinners.length > 0 ? (
                          secondWinners.map((p2, idx) => (
                            <div key={idx} className="flex flex-col items-center w-full">
                              <div className="relative mb-2">
                                <ParticipantAvatar name={p2.name} photoUrl={p2.photoUrl} className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-indigo-400 shadow-lg shadow-indigo-500/20" />
                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-indigo-600 border border-indigo-300 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                                  2
                                </div>
                              </div>
                              <div className="font-bold text-white text-xs truncate w-full mt-0.5" title={p2.name}>
                                {p2.name}
                              </div>
                              <div className="text-[11px] font-semibold text-indigo-300 flex items-center justify-center gap-0.5 mt-0.5">
                                <span className="text-amber-400 text-[10px]">🪙</span>
                                <span>{p2.points} pts</span>
                              </div>
                              <div className="text-[10px] font-bold text-indigo-300/80 truncate w-full uppercase mt-0.5">
                                {p2.group}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="w-full text-slate-600 text-[10px] italic py-4">No 2nd place</div>
                        )}
                      </div>

                      {/* 1st Place (Center - Elevated with Crown) */}
                      <div className="flex flex-col items-center text-center w-28 sm:w-36 order-2 -mt-4 space-y-3">
                        {firstWinners.length > 0 ? (
                          firstWinners.map((p1, idx) => (
                            <div key={idx} className="flex flex-col items-center w-full">
                              <div className="relative mb-2">
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.6)]">
                                  <Crown className="w-5 h-5 fill-amber-400" />
                                </div>
                                <ParticipantAvatar name={p1.name} photoUrl={p1.photoUrl} className="w-16 h-16 sm:w-18 sm:h-18 border-2 border-amber-400 shadow-xl shadow-amber-500/30" />
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-600 border border-amber-300 text-white font-extrabold text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                                  1
                                </div>
                              </div>
                              <div className="font-extrabold text-white text-xs sm:text-sm truncate w-full mt-1" title={p1.name}>
                                {p1.name}
                              </div>
                              <div className="text-xs font-bold text-amber-400 flex items-center justify-center gap-1 mt-0.5">
                                <span>🪙</span>
                                <span>{p1.points} pts</span>
                              </div>
                              <div className="text-[10px] font-bold text-amber-300/90 truncate w-full uppercase tracking-wide mt-0.5">
                                {p1.group}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="w-full text-slate-600 text-[10px] italic py-4">No 1st place</div>
                        )}
                      </div>

                      {/* 3rd Place (Right) */}
                      <div className="flex flex-col items-center text-center w-24 sm:w-32 order-3 space-y-3">
                        {thirdWinners.length > 0 ? (
                          thirdWinners.map((p3, idx) => (
                            <div key={idx} className="flex flex-col items-center w-full">
                              <div className="relative mb-2">
                                <ParticipantAvatar name={p3.name} photoUrl={p3.photoUrl} className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-amber-600 shadow-lg shadow-amber-600/20" />
                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-indigo-600 border border-amber-500 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                                  3
                                </div>
                              </div>
                              <div className="font-bold text-white text-xs truncate w-full mt-0.5" title={p3.name}>
                                {p3.name}
                              </div>
                              <div className="text-[11px] font-semibold text-amber-500 flex items-center justify-center gap-0.5 mt-0.5">
                                <span className="text-amber-400 text-[10px]">🪙</span>
                                <span>{p3.points} pts</span>
                              </div>
                              <div className="text-[10px] font-bold text-amber-400/80 truncate w-full uppercase mt-0.5">
                                {p3.group}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="w-full text-slate-600 text-[10px] italic py-4">No 3rd place</div>
                        )}
                      </div>

                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
};

