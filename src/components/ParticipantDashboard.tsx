import React, { useState } from 'react';
import { UserProfile, Competition, Registration, Result, Group } from '../types';
import { User, Calendar, MapPin, Clock, Trophy, Award, Sparkles, CheckCircle2, Camera, CheckCircle } from 'lucide-react';
import { formatStageName, formatCompetitionName } from '../lib/store';
import { ProfilePhotoModal } from './ProfilePhotoModal';
import { getParticipantPhoto } from '../lib/avatarUtils';

interface ParticipantDashboardProps {
  currentUser: UserProfile;
  competitions: Competition[];
  registrations: Registration[];
  results: Result[];
  groups: Group[];
  onUserUpdated?: (user: UserProfile) => void;
}

export const ParticipantDashboard: React.FC<ParticipantDashboardProps> = ({
  currentUser,
  competitions,
  registrations,
  results,
  groups,
  onUserUpdated
}) => {
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const myGroup = groups.find(g => g.id === currentUser.groupId);

  const fullName = currentUser.fatherName ? `${currentUser.name} ${currentUser.fatherName}` : currentUser.name;
  const photoSrc = getParticipantPhoto(currentUser.name, currentUser.photoUrl);

  // My registered competitions
  const myRegs = registrations.filter(r => r.participantId === currentUser.id);
  const myCompIds = myRegs.map(r => r.competitionId);
  const myCompetitions = competitions.filter(c => myCompIds.includes(c.id));

  // Determine competition status: 'completed' | 'running' | 'pending'
  const getCompetitionStatus = (comp: Competition): 'running' | 'completed' | 'pending' => {
    if (comp.status === 'completed' || comp.isPublishedResult || results.some(r => r.competitionId === comp.id)) {
      return 'completed';
    }
    if (comp.status === 'running' || comp.isRunning) {
      return 'running';
    }
    return 'pending';
  };

  // Sorted competitions: running first, then pending, then completed
  const sortedCompetitions = [...myCompetitions].sort((a, b) => {
    const statusRank = { running: 0, pending: 1, completed: 2 };
    const rankDiff = statusRank[getCompetitionStatus(a)] - statusRank[getCompetitionStatus(b)];
    if (rankDiff !== 0) return rankDiff;
    return (a.name || '').localeCompare(b.name || '');
  });

  // My published wins
  const myRegIds = new Set(myRegs.map(r => r.id));
  const myWins = results.filter(res => {
    const isFirst = (res.firstPlaceRegId && myRegIds.has(res.firstPlaceRegId)) || 
                    (res.firstPlaceParticipantName && (res.firstPlaceParticipantName.toLowerCase().includes(currentUser.name.toLowerCase()) || res.firstPlaceParticipantName.toLowerCase().includes(fullName.toLowerCase())));
    const isSecond = (res.secondPlaceRegId && myRegIds.has(res.secondPlaceRegId)) || 
                     (res.secondPlaceParticipantName && (res.secondPlaceParticipantName.toLowerCase().includes(currentUser.name.toLowerCase()) || res.secondPlaceParticipantName.toLowerCase().includes(fullName.toLowerCase())));
    const isThird = (res.thirdPlaceRegId && myRegIds.has(res.thirdPlaceRegId)) || 
                    (res.thirdPlaceParticipantName && (res.thirdPlaceParticipantName.toLowerCase().includes(currentUser.name.toLowerCase()) || res.thirdPlaceParticipantName.toLowerCase().includes(fullName.toLowerCase())));
    return isFirst || isSecond || isThird;
  });

  return (
    <div className="space-y-6 py-4 sm:py-6 pb-24 max-w-4xl mx-auto">
      
      {/* Participant Digital Pass Badge */}
      <div className="poster-card p-6 sm:p-8 bg-gradient-to-r from-purple-950/40 via-[#151728] to-[#0f111e] rounded-3xl border border-[#292d4a] shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 relative z-10 text-center sm:text-left">
          
          {/* Participant Profile Photo with Hover Edit Overlay */}
          <div className="relative group cursor-pointer shrink-0" onClick={() => setIsPhotoModalOpen(true)}>
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-xl transition-all duration-300 group-hover:scale-105 group-hover:border-purple-400">
              <img 
                src={photoSrc} 
                alt={fullName} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPhotoModalOpen(true);
              }}
              className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg border border-purple-400 transition-all group-hover:scale-110 flex items-center justify-center cursor-pointer"
              title="Change Profile Photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 bg-purple-900/60 text-purple-300 font-mono font-bold uppercase text-xs px-3 py-1 rounded-full border border-purple-500/25">
                Chest No: {currentUser.userId}
              </span>
              {myGroup && (
                <span 
                  className="inline-flex items-center gap-1.5 font-bold uppercase text-xs px-3 py-1 rounded-full border"
                  style={{ 
                    backgroundColor: `${myGroup.color}15`, 
                    borderColor: `${myGroup.color}40`, 
                    color: myGroup.color || '#a855f7' 
                  }}
                >
                  {myGroup.name}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {fullName}
              </h1>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-y-1 gap-x-3 text-slate-400 text-sm mt-1">
                <span>Level {currentUser.department}</span>
                <span className="text-slate-600">•</span>
                <span>{currentUser.category || 'Senior'} Category</span>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(true)}
                  className="text-purple-400 hover:text-purple-300 font-semibold hover:underline cursor-pointer transition-colors"
                >
                  Change Photo
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>



      {/* My Competitions Schedule */}
      <div className="poster-card p-6 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-5">
        <div className="flex items-center gap-2.5 border-b border-[#292d4a]/70 pb-4">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">
              My Competition Timetable
            </h2>
            <p className="text-xs text-slate-400">
              Live timetable with Pending, Running, and Complete stages
            </p>
          </div>
        </div>

        {sortedCompetitions.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">
            You are not currently enrolled in any competitions. Contact your Group Leader ({myGroup?.leaderName}) to register for competitions!
          </p>
        ) : (
          <div className="space-y-3">
            {sortedCompetitions.map((comp) => {
              const status = getCompetitionStatus(comp);
              const myReg = myRegs.find(r => r.competitionId === comp.id);
              const compWin = myWins.find(w => w.competitionId === comp.id || w.competitionName === comp.name);

              return (
                <div 
                  key={comp.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    status === 'running'
                      ? 'bg-gradient-to-r from-emerald-950/25 via-[#181b30] to-[#181b30] border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                      : status === 'completed'
                      ? 'bg-[#181b30]/80 border-[#292d4a] hover:border-slate-600/50'
                      : 'bg-[#181b30] border-[#292d4a] hover:border-purple-500/50'
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    {/* Top Row: Category, Type, Code Letter, and Status Badge */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Status Badge */}
                      {status === 'running' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-extrabold uppercase tracking-wide">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          Running
                        </span>
                      )}
                      {status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-extrabold uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          Pending
                        </span>
                      )}
                      {status === 'completed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-extrabold uppercase tracking-wide">
                          <CheckCircle className="w-3 h-3 text-rose-400" />
                          Complete
                        </span>
                      )}

                      <span className="font-bold text-purple-400 uppercase">{comp.category}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-300 font-mono">
                        {comp.type === 'Group' ? `Group (${comp.teamSize || 4} members)` : comp.type}
                      </span>

                      {myReg?.codeLetter && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-[11px] font-mono font-bold text-purple-300">
                            Code: {myReg.codeLetter}
                          </span>
                        </>
                      )}

                      {compWin && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                          <Trophy className="w-3 h-3 text-amber-400" />
                          {(compWin.firstPlaceRegId && myRegIds.has(compWin.firstPlaceRegId)) || compWin.firstPlaceParticipantName?.toLowerCase().includes(currentUser.name.toLowerCase()) ? '🥇 1st Place' :
                           (compWin.secondPlaceRegId && myRegIds.has(compWin.secondPlaceRegId)) || compWin.secondPlaceParticipantName?.toLowerCase().includes(currentUser.name.toLowerCase()) ? '🥈 2nd Place' :
                           '🥉 3rd Place'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-extrabold text-white">
                      {formatCompetitionName(comp.name, comp.category)}
                    </h3>
                  </div>

                  {getCompetitionStatus(comp) !== 'completed' && (
                    <div className="text-left sm:text-right text-xs font-medium space-y-1.5 shrink-0 sm:border-l sm:border-[#292d4a]/70 sm:pl-4">
                      {comp.venue && (
                        <div className="flex items-center sm:justify-end gap-1.5 text-rose-400 font-bold text-sm">
                          <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{formatStageName(comp.venue)}</span>
                        </div>
                      )}

                      {(() => {
                        const parts = (comp.scheduleTime || '').split(',');
                        const datePart = parts[0]?.trim();
                        const timePart = parts.slice(1).join(',')?.trim();
                        return (
                          <>
                            {datePart && (
                              <div className="flex items-center sm:justify-end gap-1.5 text-slate-300">
                                <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span>{datePart}</span>
                              </div>
                            )}
                            {timePart && (
                              <div className="flex items-center sm:justify-end gap-1.5 text-sky-300 font-semibold">
                                <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                <span>{timePart}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My Medals & Achievements */}
      {myWins.length > 0 && (
        <div className="poster-card p-6 bg-[#151728] rounded-3xl border border-amber-500/40 space-y-4">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            My Published Wins & Trophies
          </h2>

          <div className="space-y-3">
            {myWins.map((win) => (
              <div key={win.id} className="p-4 bg-[#181b30] border border-amber-500/30 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-white text-base">{win.competitionName}</h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Published Result</p>
                </div>
                <span className="text-xl font-bold">
                  {(win.firstPlaceRegId && myRegIds.has(win.firstPlaceRegId)) || win.firstPlaceParticipantName.toLowerCase().includes(currentUser.name.toLowerCase()) ? '🥇 1st Place' : ''}
                  {(win.secondPlaceRegId && myRegIds.has(win.secondPlaceRegId)) || (win.secondPlaceParticipantName && win.secondPlaceParticipantName.toLowerCase().includes(currentUser.name.toLowerCase())) ? '🥈 2nd Place' : ''}
                  {(win.thirdPlaceRegId && myRegIds.has(win.thirdPlaceRegId)) || (win.thirdPlaceParticipantName && win.thirdPlaceParticipantName.toLowerCase().includes(currentUser.name.toLowerCase())) ? '🥉 3rd Place' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Photo Editor Modal */}
      <ProfilePhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        currentUser={currentUser}
        onPhotoUpdated={(updatedUser) => {
          if (onUserUpdated) {
            onUserUpdated(updatedUser);
          }
        }}
      />

    </div>
  );
};
