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
  Sparkles
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

  // Reported participants for selected competition
  const reportedCandidates = useMemo(() => {
    if (!selectedComp) return [];
    return registrations
      .filter(r => r.competitionId === selectedComp.id && r.isReported && r.codeLetter)
      .sort((a, b) => {
        if (a.codeLetter && b.codeLetter) {
          return a.codeLetter.localeCompare(b.codeLetter);
        }
        return a.participantName.localeCompare(b.participantName);
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

  // Handle Mark Change
  const handleMarkChange = (regId: string, value: string) => {
    setMarksState(prev => ({
      ...prev,
      [regId]: value
    }));
  };

  // Save all marks for selected competition
  const handleSaveMarks = () => {
    if (!selectedComp) return;

    let updatedCount = 0;
    reportedCandidates.forEach(r => {
      const currentVal = marksState[r.id] !== undefined ? marksState[r.id] : r.mark || '';
      festStore.updateRegistrationMark(r.id, currentVal);
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
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
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
                {assignedComps.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                    {assignedComps.length} Assigned across {assignedStages.length} Stage{assignedStages.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluation Desk • Confidential Blind Scoring (Code Letters A, B, C...) • Stage-by-Stage View
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('valuation')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'valuation'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-[#181b30] text-slate-300 hover:text-white border border-[#292d4a]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Valuation Sheet</span>
            </button>

            <button
              onClick={() => setActiveTab('callsheet')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'callsheet'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-[#181b30] text-slate-300 hover:text-white border border-[#292d4a]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Call Sheet & Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: VALUATION SHEET */}
      {activeTab === 'valuation' && (
        <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl">
          
          {/* SEPARATE SECTION FOR EACH STAGE IN ASSIGNED COMPETITIONS */}
          {assignedComps.length > 0 && (
            <div className="space-y-4 pb-4 border-b border-[#292d4a]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    Assigned Competitions by Stage ({assignedComps.length} Events)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  Select a competition within any stage section to load its valuation sheet:
                </span>
              </div>

              {/* Stage Filter Buttons for Judge */}
              {assignedStages.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                  {assignedStages.map(stg => {
                    const isSelected = judgeStageFilter === stg;
                    return (
                      <button
                        key={stg}
                        type="button"
                        onClick={() => setJudgeStageFilter(prev => prev === stg ? 'All' : stg)}
                        className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400'
                            : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                        }`}
                      >
                        <Landmark className="w-3 h-3 text-emerald-400" />
                        <span>{stg}</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px]">
                          {assignedCompsByStage[stg]?.length || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Render Separate Section for Each Stage */}
              <div className="space-y-4">
                {(judgeStageFilter === 'All' ? assignedStages : [judgeStageFilter]).map(stg => {
                  const compsInThisStage = assignedCompsByStage[stg] || [];
                  if (compsInThisStage.length === 0) return null;

                  return (
                    <div 
                      key={stg}
                      className="p-4 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-3 shadow-md"
                    >
                      {/* Stage Header */}
                      <div className="flex items-center justify-between border-b border-[#292d4a]/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <Landmark className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">
                              {stg}
                            </h4>
                            <span className="text-[10px] text-slate-400">
                              {compsInThisStage.length} Assigned Event{compsInThisStage.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 text-[10px] font-bold border border-indigo-500/20">
                          Stage Venue
                        </span>
                      </div>

                      {/* Stage Competition Switcher Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {compsInThisStage.map(comp => {
                          const compRegs = registrations.filter(r => r.competitionId === comp.id && r.isReported && r.codeLetter);
                          const scoredCount = compRegs.filter(r => {
                            const mark = marksState[r.id] !== undefined ? marksState[r.id] : r.mark;
                            return mark !== undefined && mark !== null && String(mark).trim() !== '';
                          }).length;
                          const isSelected = selectedComp?.id === comp.id;
                          const isFullyScored = compRegs.length > 0 && scoredCount === compRegs.length;

                          return (
                            <button
                              key={comp.id}
                              type="button"
                              onClick={() => setSelectedCompId(comp.id)}
                              className={`p-3 rounded-xl text-xs font-bold transition-all flex flex-col justify-between gap-2 border cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-gradient-to-br from-emerald-950/80 to-[#151728] border-emerald-400 shadow-md ring-2 ring-emerald-500/40'
                                  : 'bg-[#121424] text-slate-300 hover:text-white hover:bg-[#1a1d33] border-[#292d4a]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[9px] font-bold border border-purple-500/30">
                                      {comp.category}
                                    </span>
                                    {isSelected && (
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    )}
                                  </div>
                                  <h5 className="text-xs font-black text-white line-clamp-1 pt-0.5">
                                    {comp.name}
                                  </h5>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-[#292d4a]/60">
                                <span>{compRegs.length} Reported</span>
                                <span className={`px-2 py-0.5 rounded-full font-mono font-bold ${
                                  isFullyScored
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : isSelected
                                      ? 'bg-emerald-600/30 text-emerald-200'
                                      : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {scoredCount}/{compRegs.length} Scored
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Competition Valuation Details */}
          {selectedComp ? (
            <div className="space-y-6">
              
              {/* Competition Info Header Card with Live Status & Stage Info */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#181b30] border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Active Competition on Judge Desk
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 flex items-center gap-1">
                      <Landmark className="w-3 h-3 text-indigo-400" />
                      {getCompStage(selectedComp)}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                      {selectedComp.category}
                    </span>
                  </div>
                  
                  <h2 className="text-lg sm:text-xl font-black text-white mt-2">
                    {selectedComp.name}
                  </h2>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Venue / Stage: <strong className="text-slate-200">{getCompStage(selectedComp)}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {selectedComp.scheduleTime}
                    </span>
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

              {/* Reported Candidates Table */}
              {reportedCandidates.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-3xl bg-[#181b30] border border-dashed border-[#292d4a] space-y-3">
                  <UserCheck className="w-12 h-12 text-slate-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">
                    No Reported Candidates Yet
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Candidates will appear here once stage coordinators mark them as reported with assigned blind code letters (A, B, C...).
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#292d4a]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#181b30] text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#292d4a]">
                      <tr>
                        <th className="py-3.5 px-4 text-center w-16">Sl No</th>
                        <th className="py-3.5 px-4 text-center w-28">Code Letter</th>
                        <th className="py-3.5 px-4">Evaluation / Performance</th>
                        <th className="py-3.5 px-4 w-44 text-right">Marks / Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#292d4a] bg-[#121424]">
                      {reportedCandidates.map((reg, idx) => {
                        const currentMark = marksState[reg.id] !== undefined ? marksState[reg.id] : reg.mark || '';
                        return (
                          <tr key={reg.id} className="hover:bg-[#181b30]/50 transition-colors">
                            <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-base shadow-md">
                                {reg.codeLetter}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white">
                                Candidate {reg.codeLetter}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>Reported On Stage ({getCompStage(selectedComp)})</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="e.g. 85 / A+"
                                  value={currentMark}
                                  onChange={(e) => handleMarkChange(reg.id, e.target.value)}
                                  className="w-32 bg-[#181b30] border border-[#292d4a] focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-bold text-center focus:outline-none transition-all"
                                />
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

