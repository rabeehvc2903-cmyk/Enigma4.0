import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Send, Heart, X, Sparkles, Trash2, Lock, Clock, Settings, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { UserProfile, CommentItem, CommentSettings } from '../types';
import { festStore } from '../lib/store';
import { ParticipantAvatar } from './ParticipantAvatar';

interface CommentSectionProps {
  currentUser: UserProfile | null;
  onLoginSuccess: (user: UserProfile) => void;
  onNavigate: (tab: string) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  currentUser,
  onLoginSuccess,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>(() => festStore.getComments());
  const [unreadCount, setUnreadCount] = useState<number>(() => festStore.getComments().length);
  const prevCommentsLengthRef = useRef<number>(comments.length);
  const [newCommentText, setNewCommentText] = useState('');

  // Comment Settings & Lock Cooldown States
  const [commentSettings, setCommentSettings] = useState<CommentSettings>(() => festStore.getCommentSettings());
  const [nowTime, setNowTime] = useState<number>(Date.now());
  const [showAdminQuickSettings, setShowAdminQuickSettings] = useState<boolean>(false);

  const feedRef = useRef<HTMLDivElement>(null);

  // Subscribe to live comments & comment settings, plus set up 1s live ticker & 30s auto-prune interval
  useEffect(() => {
    const updateStoreComments = () => {
      const updated = festStore.getComments();
      const settings = festStore.getCommentSettings();
      setCommentSettings(settings);

      const diff = updated.length - prevCommentsLengthRef.current;
      if (isOpen) {
        setUnreadCount(0);
      } else if (diff > 0) {
        setUnreadCount(prev => prev + diff);
      }
      prevCommentsLengthRef.current = updated.length;
      setComments(updated);
    };

    const unsubscribe = festStore.subscribe(updateStoreComments);

    // Run 1-second ticker for live cooldown countdown timer
    const ticker = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);

    // Run pruning check every 30 seconds to clean up comments older than 12 hours automatically
    const pruneTimer = setInterval(updateStoreComments, 30000);

    return () => {
      unsubscribe();
      clearInterval(ticker);
      clearInterval(pruneTimer);
    };
  }, [isOpen]);

  // Compute cooldown lock status for the current participant
  const currentUserId = currentUser?.userId || currentUser?.id || festStore.getClientDeviceId();
  const currentAuthorName = currentUser?.name;

  const lastCommentTime = useMemo(() => {
    const cleanUserId = currentUserId?.trim();
    const cleanAuthorName = currentAuthorName?.trim().toLowerCase();

    const userComments = comments.filter((c) => {
      if (cleanUserId && c.authorId && c.authorId === cleanUserId) return true;
      if (cleanAuthorName && c.authorName && c.authorName.trim().toLowerCase() === cleanAuthorName) return true;
      return false;
    });

    if (userComments.length === 0) return null;

    let newest = 0;
    for (const c of userComments) {
      if (c.createdAt) {
        const t = new Date(c.createdAt).getTime();
        if (!isNaN(t) && t > newest) {
          newest = t;
        }
      }
    }
    return newest > 0 ? newest : null;
  }, [comments, currentUserId, currentAuthorName]);

  const cooldownMinutes = typeof commentSettings.cooldownMinutes === 'number' ? commentSettings.cooldownMinutes : 10;
  const cooldownMs = cooldownMinutes * 60 * 1000;

  let remainingLockMs = 0;
  if (lastCommentTime) {
    remainingLockMs = Math.max(0, (lastCommentTime + cooldownMs) - nowTime);
  }

  const isLockedByCooldown = commentSettings.enabled && remainingLockMs > 0 && currentUser?.role !== 'admin';

  // Format lock countdown timer (MMm SSs)
  const formatLockTimer = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const handleToggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setUnreadCount(0);
    }
  };

  // Format relative timestamp
  const formatTimeAgo = (isoDate: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check global switch
    if (!commentSettings.enabled && currentUser?.role !== 'admin') {
      alert('Comments are currently turned off by the Festival Admin.');
      return;
    }

    // Check participant cooldown lock
    if (isLockedByCooldown) {
      alert(`Comment section is locked for you! Please wait ${formatLockTimer(remainingLockMs)} before posting again.`);
      return;
    }

    if (!newCommentText.trim()) return;

    const authorName = currentUser?.name || 'Festival Spectator';
    const authorRole = currentUser?.role || 'visitor';
    const groupName = currentUser?.groupName || (currentUser?.role === 'admin' ? 'Control Desk' : 'Audience');
    const groupColor = currentUser?.groupColor || (currentUser?.role === 'admin' ? '#8b5cf6' : '#10b981');

    festStore.addComment({
      authorId: currentUserId,
      authorName,
      authorPhotoUrl: currentUser?.photoUrl,
      authorRole,
      groupName,
      groupColor,
      text: newCommentText.trim()
    });

    setNewCommentText('');
    setNowTime(Date.now());
    
    // Scroll to top of feed
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  };

  return (
    <>
      {/* Custom Shake / Wiggle CSS */}
      <style>{`
        @keyframes floatShake {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-8deg) scale(1.05); }
          30% { transform: rotate(8deg) scale(1.05); }
          45% { transform: rotate(-6deg) scale(1.05); }
          60% { transform: rotate(6deg) scale(1.05); }
          75% { transform: rotate(-3deg) scale(1.02); }
        }
        .animate-shaking-chat {
          animation: floatShake 3s ease-in-out infinite;
        }
      `}</style>

      {/* FLOATING SHAKING CHAT BUTTON (LOWER RIGHT - ABOVE BOTTOM DOCK) */}
      <div className="fixed right-4 sm:right-6 bottom-20 sm:bottom-24 z-50 flex items-center gap-2 group">
        {/* Tooltip hint on hover */}
        <div className="hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg border border-purple-500/30 shadow-xl whitespace-nowrap backdrop-blur-md pointer-events-none">
          Live Discussion & Cheers 💬
        </div>

        <button
          onClick={handleToggleOpen}
          className="relative animate-shaking-chat p-2.5 sm:p-3 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-lg shadow-purple-600/40 hover:shadow-purple-500/60 border border-white/20 transition-all flex items-center justify-center cursor-pointer"
          title="Open Live Comments"
          aria-label="Open Live Comments"
        >
          <MessageSquare className="w-4 h-4 sm:w-5 h-5 text-white" />
          
          {/* Glowing pulse ring */}
          <span className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping -z-10" />

          {/* Unread badge count */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-extrabold text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5 border-2 border-[#0b0c16] shadow-md animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* SLIDE-OVER COMMENT DRAWER / MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn">
          {/* Dark Overlay Backdrop */}
          <div 
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Container */}
          <div className="relative w-full sm:w-[420px] bg-[#0d0e1b] border-l border-[#292d4a] shadow-2xl z-10 flex flex-col h-full overflow-hidden">
            
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-[#151728] border-b border-[#292d4a] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
                    Live Comments & Cheers
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </h3>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                    <span>{comments.length} live messages</span>
                    <span>•</span>
                    <span className="text-purple-300 font-semibold">{cooldownMinutes}m cooldown</span>
                    <span>•</span>
                    <span className="text-amber-300 font-semibold">Expires: {commentSettings.autoExpireHours || 12}h</span>
                    {!commentSettings.enabled && (
                      <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 rounded border border-rose-500/20">
                        OFF
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Admin Quick Control Gear Icon */}
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => setShowAdminQuickSettings(!showAdminQuickSettings)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      showAdminQuickSettings
                        ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30'
                        : 'text-slate-400 hover:text-white bg-[#0e101f] hover:bg-slate-800 border-[#292d4a]'
                    }`}
                    title="Admin Comment Settings & Cooldown Lock"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white bg-[#0e101f] hover:bg-slate-800 border border-[#292d4a] transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Admin Quick Settings Control Bar (Toggled by Gear Icon) */}
            {currentUser?.role === 'admin' && showAdminQuickSettings && (
              <div className="p-3.5 bg-purple-950/40 border-b border-purple-500/30 space-y-3 shrink-0 animate-fadeIn text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-purple-300 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5" />
                    Admin Comment Controls
                  </div>
                  <span className="text-[10px] text-slate-400">Instant Store Update</span>
                </div>

                {/* 1. Toggle ON / OFF */}
                <div className="flex items-center justify-between bg-[#101222] p-2 rounded-xl border border-[#292d4a]">
                  <span className="text-[11px] font-bold text-slate-300">Comment Section Status:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const updated = festStore.updateCommentSettings({ enabled: true });
                        setCommentSettings(updated);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                        commentSettings.enabled
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-[#181a2e] text-slate-400 hover:text-white'
                      }`}
                    >
                      ON
                    </button>
                    <button
                      onClick={() => {
                        const updated = festStore.updateCommentSettings({ enabled: false });
                        setCommentSettings(updated);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                        !commentSettings.enabled
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-[#181a2e] text-slate-400 hover:text-white'
                      }`}
                    >
                      OFF
                    </button>
                  </div>
                </div>

                {/* 2. Cooldown Duration Minutes */}
                <div className="flex items-center justify-between bg-[#101222] p-2 rounded-xl border border-[#292d4a]">
                  <span className="text-[11px] font-bold text-slate-300">Lock Cooldown Duration:</span>
                  <div className="flex items-center gap-1">
                    {[1, 5, 10, 15, 30].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => {
                          const updated = festStore.updateCommentSettings({ cooldownMinutes: mins });
                          setCommentSettings(updated);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                          commentSettings.cooldownMinutes === mins
                            ? 'bg-purple-600 text-white font-black'
                            : 'bg-[#181a2e] text-slate-400 hover:text-white'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Auto-Expires Duration Hours */}
                <div className="flex items-center justify-between bg-[#101222] p-2 rounded-xl border border-[#292d4a]">
                  <span className="text-[11px] font-bold text-slate-300">Auto-Expires Duration:</span>
                  <div className="flex items-center gap-1">
                    {[1, 3, 6, 12, 24, 48].map((hrs) => (
                      <button
                        key={hrs}
                        onClick={() => {
                          const updated = festStore.updateCommentSettings({ autoExpireHours: hrs });
                          setCommentSettings(updated);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                          (commentSettings.autoExpireHours || 12) === hrs
                            ? 'bg-amber-600 text-white font-black'
                            : 'bg-[#181a2e] text-slate-400 hover:text-white'
                        }`}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Comments Feed List */}
            <div 
              ref={feedRef}
              className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-purple-900"
            >
              {comments.length === 0 ? (
                <div className="text-center py-12 space-y-3 text-slate-400">
                  <MessageSquare className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs font-semibold">No comments posted yet.</p>
                  <p className="text-[11px] text-slate-500">Be the first participant to send a cheer!</p>
                </div>
              ) : (
                comments.map((cmt) => {
                  const isMe = currentUser && (currentUser.userId === cmt.authorId || currentUser.id === cmt.authorId);
                  
                  return (
                    <div 
                      key={cmt.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isMe 
                          ? 'bg-purple-950/20 border-purple-500/40' 
                          : 'bg-[#151728] border-[#292d4a]/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Shadow Head / Custom Profile Photo Avatar */}
                          <ParticipantAvatar
                            name={cmt.authorName}
                            photoUrl={cmt.authorPhotoUrl || festStore.getParticipantPhotoUrl(cmt.authorName, cmt.authorId)}
                            className="w-7 h-7 border border-white/20 shadow-sm shrink-0"
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-white truncate">
                                {cmt.authorName}
                              </span>
                              {cmt.authorRole === 'admin' && (
                                <span className="text-[9px] uppercase font-black bg-purple-600/30 text-purple-300 border border-purple-500/40 px-1.5 py-0.2 rounded shrink-0">
                                  ADMIN
                                </span>
                              )}
                              {cmt.authorRole === 'leader' && (
                                <span className="text-[9px] uppercase font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded shrink-0">
                                  LEADER
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                              <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: cmt.groupColor || '#a855f7' }} />
                              <span className="truncate">{cmt.groupName}</span>
                            </div>
                          </div>
                        </div>

                        {/* Top Right Header: Timestamp + Like Button + Delete Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {formatTimeAgo(cmt.createdAt)}
                          </span>

                          {/* Heart / Like Button */}
                          {(() => {
                            const currentUserId = currentUser?.userId || currentUser?.id || festStore.getClientDeviceId();
                            const isLikedByMe = Array.isArray(cmt.likedBy) && cmt.likedBy.includes(currentUserId);
                            const likeCount = typeof cmt.likes === 'number' ? cmt.likes : (cmt.likedBy?.length || 0);

                            return (
                              <button
                                type="button"
                                onClick={() => festStore.toggleLikeComment(cmt.id, currentUserId)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] transition-all cursor-pointer select-none active:scale-95 ${
                                  isLikedByMe
                                    ? 'text-rose-400 bg-rose-500/10 font-bold border border-rose-500/20 shadow-sm shadow-rose-500/10'
                                    : 'text-slate-400 hover:text-rose-400 hover:bg-white/5 border border-transparent'
                                }`}
                                title={isLikedByMe ? "You liked this (Click to unlike)" : "Like this cheer"}
                              >
                                <Heart className={`w-3.5 h-3.5 transition-transform ${isLikedByMe ? 'fill-rose-500 text-rose-500 scale-110' : ''}`} />
                                <span>{likeCount}</span>
                              </button>
                            );
                          })()}

                          {/* Delete Button */}
                          {(currentUser?.role === 'admin' || isMe) && (
                            <button
                              type="button"
                              onClick={() => festStore.deleteComment(cmt.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Comment Body */}
                      <p className="text-xs text-slate-200 pl-9 leading-relaxed break-words">
                        {cmt.text}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Posting Footer */}
            <div className="p-4 bg-[#151728] border-t border-[#292d4a] shrink-0 space-y-2.5">
              
              {/* Case 1: Comments Globally Turned Off by Admin */}
              {!commentSettings.enabled ? (
                currentUser?.role === 'admin' ? (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Comments turned OFF for users. Admin bypass active.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = festStore.updateCommentSettings({ enabled: true });
                          setCommentSettings(updated);
                        }}
                        className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-black text-[10px] hover:bg-amber-400 cursor-pointer"
                      >
                        Turn ON
                      </button>
                    </div>

                    <form onSubmit={handlePostComment} className="flex gap-2">
                      <input
                        type="text"
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Admin cheer message..."
                        className="flex-1 bg-[#0d0e1b] border border-purple-500/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                      />
                      <button
                        type="submit"
                        disabled={!newCommentText.trim()}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/30"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-2 text-rose-300 font-extrabold text-xs">
                      <Lock className="w-4 h-4" />
                      <span>Live Comments Turned OFF by Admin</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      The festival control desk has currently paused live comment posting for all participants.
                    </p>
                  </div>
                )
              ) : isLockedByCooldown ? (
                /* Case 2: Cooldown Lock Active for Participant */
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled
                      value=""
                      placeholder={`Locked: Wait ${formatLockTimer(remainingLockMs)} before posting next cheer...`}
                      className="flex-1 bg-[#0d0e1b] border border-purple-900/40 rounded-xl px-3 py-2 text-xs text-slate-400 placeholder-slate-500 cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2 rounded-xl bg-slate-800/80 text-purple-400 text-xs font-bold shrink-0 cursor-not-allowed flex items-center justify-center border border-purple-900/30"
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Case 3: Allowed to Post */
                <form onSubmit={handlePostComment} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={280}
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Type your comment or cheer..."
                      className="flex-1 bg-[#0d0e1b] border border-[#292d4a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={!newCommentText.trim()}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/30 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                    <span className="text-slate-400">
                      {newCommentText.length > 0 ? `${newCommentText.length}/280 chars` : 'Max 280 chars'}
                    </span>
                    {currentUser?.role === 'admin' && (
                      <span className="text-purple-400 font-bold flex items-center gap-1">
                        ⚡ Admin Posting Mode
                      </span>
                    )}
                  </div>
                </form>
              )}

            </div>

          </div>
        </div>
      )}
    </>
  );
};
