import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, Competition, Registration, Group } from '../types';
import { festStore, formatStageName } from '../lib/store';
import { 
  Scale, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Calendar, 
  Save, 
  UserCheck, 
  Radio,
  Landmark,
  Filter,
  Layers,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

interface JudgeDashboardProps {
  currentUser: UserProfile;
  competitions: Competition[];
  registrations: Registration[];
  groups: Group[];
  onSignOut: () => void;
}

export const JudgeDashboard: React.FC<JudgeDashboardProps> = ({
  currentUser,
  competitions,
  registrations,
  onSignOut
}) => {
  const [activeTab, setActiveTab] = useState<'valuation' | 'callsheet'>('valuation');

  // Active competitions assigned by Admin
  const [assignedCompIds, setAssignedCompIds] = useState<string[]>(() => festStore.getActiveValuationCompIds());
  const [selectedCompId, setSelectedCompId] = useState<string>(() => festStore.getActiveValuationCompId());
  const [judgeStageFilter, setJudgeStageFilter] = useState<string>('All');
  const [callsheetStageFilter, setCallsheetStageFilter] = useState<string>('All');
  const [marksState, setMarksState] = useState<{ [regId: string]: string }>({});
  const [judgeRanksState, setJudgeRanksState] = useState<{ [regId: string]: number | undefined }>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Subscribe to real-time store changes (so when Admin assigns/changes competitions, it updates live on Judge desk)
  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      const ids = festStore.getActiveValuationCompIds();
      setAssignedCompIds(ids);
      setSelectedCompId(prev => (ids.includes(prev) ? prev : (ids[0] || '')));
    });
    return unsubscribe;
  }, []);

  const getCompStage = (c: Competition): string => {
    if (c.venue && c.venue.trim()) return formatStageName(c.venue.trim());
    if (c.isStage === false) return 'Off-Stage';
    return 'General Stage';
  };

  const assignedComps = useMemo(() => {
    return competitions.filter(c => assignedCompIds.includes(c.id));
  }, [competitions, assignedCompIds]);

  // Group assigned competitions by Stage
  const assignedCompsByStage = useMemo(() => {
    const map: { [stage: string]: Competition[] } = {};
    assignedComps.forEach(c => {
      const stg = getCompStage(c);
      if (!map[stg]) map[stg] = [];
      map[stg].push(c);
    });
    return map;
  }, [assignedComps]);

  const assignedStages = useMemo(() => {
    return Object.keys(assignedCompsByStage);
  }, [assignedCompsByStage]);

  const selectedComp = useMemo(() => {
    if (!selectedCompId) {
      return assignedComps.length > 0 ? assignedComps[0] : null;
    }
    return competitions.find(c => c.id === selectedCompId) || (assignedComps.length > 0 ? assignedComps[0] : null);
  }, [competitions, selectedCompId, assignedComps]);

  // Reported participants for selected competition (all reported candidates appear for judging)
  const reportedCandidates = useMemo(() => {
    if (!selectedComp) return [];
    return registrations
      .filter(r => r.competitionId === selectedComp.id && r.isReported)
      .sort((a, b) => {
        if (a.codeLetter && b.codeLetter) {
          return a.codeLetter.localeCompare(b.codeLetter);
        }
        if (a.codeLetter && !b.codeLetter) return -1;
        if (!a.codeLetter && b.codeLetter) return 1;
        return (a.participantUserId || a.participantName).localeCompare(b.participantUserId || b.participantName);
      });
  }, [registrations, selectedComp]);

  // Group all competitions by Stage for Callsheet tab
  const allCompsByStage = useMemo(() => {
    const map: { [stage: string]: Competition[] } = {};
    competitions.forEach(c => {
      const stg = getCompStage(c);
      if (!map[stg]) map[stg] = [];
      map[stg].push(c);
    });
    return map;
  }, [competitions]);

  const allStagesList = useMemo(() => {
    return Object.keys(allCompsByStage);
  }, [allCompsByStage]);

  // Compute tie marks across reported candidates
  const markCounts = useMemo(() => {
    const counts: { [m: string]: number } = {};
    reportedCandidates.forEach(r => {
      const val = (marksState[r.id] !== undefined ? marksState[r.id] : r.mark || '').trim();
      if (val) {
        counts[val] = (counts[val] || 0) + 1;
      }
    });
    return counts;
  }, [reportedCandidates, marksState]);

  const hasAnyTies = useMemo(() => {
    return Object.values(markCounts).some((count: number) => count > 1);
  }, [markCounts]);

  // Handle Mark Change
  const handleMarkChange = (regId: string, value: string) => {
    setMarksState(prev => ({
      ...prev,
      [regId]: value
    }));
  };

  // Handle Judge Rank Selection (1st, 2nd, 3rd place tie breaker)
  const handleRankSelect = (regId: string, rank: number | undefined) => {
    setJudgeRanksState(prev => {
      const updated = { ...prev };
      if (rank === undefined || rank === 0) {
        delete updated[regId];
        return updated;
      }
      // If another participant already had this rank in this competition, clear them to avoid duplicate rank assignment
      Object.keys(updated).forEach(k => {
        if (updated[k] === rank && k !== regId) {
          delete updated[k];
        }
      });
      updated[regId] = rank;
      return updated;
    });
  };

  // Save all marks for selected competition
  const handleSaveMarks = () => {
    if (!selectedComp) return;

    let updatedCount = 0;
    reportedCandidates.forEach(r => {
      const currentVal = marksState[r.id] !== undefined ? marksState[r.id] : r.mark || '';
      const currentRank = judgeRanksState[r.id] !== undefined ? judgeRanksState[r.id] : r.judgeRank;
      festStore.updateRegistrationMark(r.id, currentVal, currentRank);
      updatedCount++;
    });

    const compId = selectedComp.id;
    const compName = selectedComp.name;

    // Mark competition status as completed
    festStore.updateCompetition({
      ...selectedComp,
      status: 'completed',
      isRunning: false
    });

    // Remove from active Judge Valuation Desk (disappears from Official Fest Judge view)
    festStore.removeValuationCompId(compId);

    const remainingIds = festStore.getActiveValuationCompIds();
    setAssignedCompIds(remainingIds);
    setSelectedCompId(remainingIds.length > 0 ? remainingIds[0] : '');

    setSaveSuccessMsg(`Marks saved for "${compName}"! Competition moved to Publish Result section.`);
    setTimeout(() => {
      setSaveSuccessMsg('');
    }, 4000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-fadeIn">
      
      {/* Top Banner Card */}
      <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {currentUser.name || 'Official Fest Judge'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                  Judge Portal
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: VALUATION SHEET */}
      {activeTab === 'valuation' && (
        <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl">

          {/* Selected Competition Valuation Details */}
          {selectedComp ? (
            <div className="space-y-6">
              
              {/* Competition Info Header Card with Live Status & Stage Info */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#181b30] border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">
                    {selectedComp.name}
                  </h2>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1.5">
                    <span className="text-emerald-400 font-bold">
                      {reportedCandidates.length} Reported Candidate(s)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveMarks}
                  disabled={reportedCandidates.length === 0}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-emerald-400 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Marks</span>
                </button>
              </div>

              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Warning if any reported candidate is missing a code letter */}
              {reportedCandidates.some(c => !c.codeLetter) && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 font-semibold flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Some reported candidates have not been assigned a blind code letter yet. You can still evaluate and score them; their Chest No is shown as reference.
                  </span>
                </div>
              )}

              {/* Reported Candidates Table */}
              {reportedCandidates.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-3xl bg-[#181b30] border border-dashed border-[#292d4a] space-y-3">
                  <UserCheck className="w-12 h-12 text-slate-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">
                    No Reported Candidates Yet
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Candidates will appear here once stage coordinators mark them as reported.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#292d4a]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#181b30] text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#292d4a]">
                      <tr>
                        <th className="py-3.5 px-6 text-center w-32">Code Letter</th>
                        <th className="py-3.5 px-6 text-center">Marks / Score</th>
                        <th className="py-3.5 px-6 text-center">Rank / Tie-Break</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#292d4a] bg-[#121424]">
                      {reportedCandidates.map((reg) => {
                        const currentMark = marksState[reg.id] !== undefined ? marksState[reg.id] : reg.mark || '';
                        const currentRank = judgeRanksState[reg.id] !== undefined ? judgeRanksState[reg.id] : reg.judgeRank;
                        const hasCode = !!reg.codeLetter;
                        const isTied = currentMark.trim() !== '' && (markCounts[currentMark.trim()] || 0) > 1;

                        return (
                          <tr key={reg.id} className={`hover:bg-[#181b30]/50 transition-colors ${isTied ? 'bg-indigo-950/20' : ''}`}>
                            <td className="py-3.5 px-6 text-center">
                              {hasCode ? (
                                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-base shadow-md">
                                  {reg.codeLetter}
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black text-[11px]" title="Code letter not yet generated by stage admin">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              <div className="inline-flex flex-col items-center gap-1">
                                <input
                                  type="text"
                                  placeholder="e.g. 85 / A+"
                                  value={currentMark}
                                  onChange={(e) => handleMarkChange(reg.id, e.target.value)}
                                  className={`w-28 bg-[#181b30] border ${isTied ? 'border-amber-400/80 focus:border-amber-400' : 'border-[#292d4a] focus:border-emerald-500'} rounded-xl px-3 py-2 text-xs text-white font-bold text-center focus:outline-none transition-all`}
                                />
                                {isTied && (
                                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                    ⚖️ Tied Mark
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              <div className="inline-flex items-center gap-1 bg-[#0b0c16] p-1 rounded-xl border border-[#292d4a]">
                                <button
                                  type="button"
                                  onClick={() => handleRankSelect(reg.id, 1)}
                                  title="Choose 1st Place"
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    currentRank === 1
                                      ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                                      : 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                                  }`}
                                >
                                  🥇 1st
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRankSelect(reg.id, 2)}
                                  title="Choose 2nd Place"
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    currentRank === 2
                                      ? 'bg-slate-200 text-slate-950 shadow-md scale-105'
                                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-300/10'
                                  }`}
                                >
                                  🥈 2nd
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRankSelect(reg.id, 3)}
                                  title="Choose 3rd Place"
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    currentRank === 3
                                      ? 'bg-amber-700 text-amber-100 shadow-md scale-105'
                                      : 'text-slate-400 hover:text-amber-500 hover:bg-amber-700/10'
                                  }`}
                                >
                                  🥉 3rd
                                </button>
                                {currentRank !== undefined && currentRank > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRankSelect(reg.id, undefined)}
                                    title="Clear Rank"
                                    className="px-2 py-1.5 text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center py-16 px-4 rounded-3xl bg-[#181b30] border border-dashed border-[#292d4a] space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto shadow-inner">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-white">
                  Awaiting Competition Assignment
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  The Festival Admin has not assigned an active competition for valuation yet. Once the Admin selects one or more competitions by stage, they will automatically appear here on your Valuation Sheet for scoring.
                </p>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: CALL SHEET & STATUS (SEPARATE SECTION FOR EACH STAGE) */}
      {activeTab === 'callsheet' && (
        <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#292d4a] pb-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>Live Stage Call Sheet & Status</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Real-time schedule and reporting tracker grouped into separate sections for each stage.
              </p>
            </div>

            {/* Stage Filter Pills for Call Sheet */}
            <div className="flex flex-wrap items-center gap-1.5">
              {allStagesList.map(stg => {
                const isSelected = callsheetStageFilter === stg;
                return (
                  <button
                    key={stg}
                    type="button"
                    onClick={() => setCallsheetStageFilter(prev => prev === stg ? 'All' : stg)}
                    className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400'
                        : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                    }`}
                  >
                    <Landmark className="w-3 h-3 text-emerald-400" />
                    <span>{stg}</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px]">
                      {allCompsByStage[stg]?.length || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Render Call Sheet Stage Sections */}
          <div className="space-y-6">
            {(callsheetStageFilter === 'All' ? allStagesList : [callsheetStageFilter]).map(stg => {
              const compsInStage = allCompsByStage[stg] || [];
              if (compsInStage.length === 0) return null;

              return (
                <div 
                  key={stg}
                  className="p-5 bg-[#181b30] rounded-3xl border border-[#292d4a] space-y-4 shadow-lg"
                >
                  {/* Stage Section Header */}
                  <div className="flex items-center justify-between border-b border-[#292d4a] pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                          {stg}
                        </h3>
                        <span className="text-[11px] text-slate-400">
                          {compsInStage.length} Scheduled Event{compsInStage.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-bold border border-emerald-500/20">
                      Live Stage Venue
                    </span>
                  </div>

                  {/* Competitions Grid for this Stage */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {compsInStage.map(comp => {
                      const compRegs = registrations.filter(r => r.competitionId === comp.id);
                      const reported = compRegs.filter(r => r.isReported && r.codeLetter);
                      const isActiveOnDesk = assignedCompIds.includes(comp.id);

                      return (
                        <div 
                          key={comp.id} 
                          className={`p-4 rounded-2xl bg-[#121424] border transition-all space-y-2.5 ${
                            isActiveOnDesk ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10' : 'border-[#292d4a]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-black text-white line-clamp-1">{comp.name}</h4>
                              </div>
                              <span className="text-[10px] text-purple-300 font-semibold">{comp.category}</span>
                            </div>
                            {isActiveOnDesk ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase shrink-0 border border-emerald-500/30">
                                Live on Desk
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#292d4a]/60">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {comp.scheduleTime}
                            </span>
                            <span className="text-emerald-400 font-bold">
                              {reported.length} / {compRegs.length} Reported
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

