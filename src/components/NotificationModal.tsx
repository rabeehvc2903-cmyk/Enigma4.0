import React, { useEffect, useState } from 'react';
import { Bell, X, Sparkles, Megaphone, Calendar, Clock, AlertTriangle, CheckCircle2, ShieldCheck, Tag } from 'lucide-react';
import { FestNotification } from '../types';
import { festStore } from '../lib/store';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [notifications, setNotifications] = useState<FestNotification[]>(() => festStore.getNotifications());

  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      setNotifications(festStore.getNotifications());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // When modal is opened, mark notifications as read
  useEffect(() => {
    if (isOpen) {
      festStore.markNotificationsAsRead();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  const getCategoryBadge = (category?: string) => {
    switch (category) {
      case 'Stage Alert':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          icon: <Megaphone className="w-3 h-3" />
        };
      case 'Result Published':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: <CheckCircle2 className="w-3 h-3" />
        };
      case 'Schedule Update':
        return {
          bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          icon: <Clock className="w-3 h-3" />
        };
      case 'Urgent':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          icon: <AlertTriangle className="w-3 h-3" />
        };
      default:
        return {
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          icon: <Tag className="w-3 h-3" />
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 animate-fadeIn">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-[#0f101d] border border-[#292d4a] rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[85vh] mt-12 sm:mt-0">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#151728] border-b border-[#292d4a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
                Announcements
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-[#0e101f] hover:bg-slate-800 border border-[#292d4a] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Announcements */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-purple-900">
          {notifications.length === 0 ? (
            <div className="text-center py-12 space-y-3 text-slate-400">
              <Bell className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-xs font-semibold">No announcements posted yet.</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const badge = getCategoryBadge(notif.category);
              return (
                <div 
                  key={notif.id}
                  className="p-4 rounded-2xl bg-[#151728] border border-[#292d4a] hover:border-purple-500/40 transition-all space-y-2 group shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                      {badge.icon}
                      {notif.category || 'General'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {formatTimeAgo(notif.createdAt)}
                    </span>
                  </div>

                  <h4 className="text-sm font-extrabold text-white group-hover:text-purple-300 transition-colors">
                    {notif.title}
                  </h4>

                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                    {notif.message}
                  </div>

                  {notif.createdBy && (
                    <div className="pt-2 border-t border-[#292d4a]/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 text-purple-400 font-semibold">
                        <ShieldCheck className="w-3 h-3 text-purple-400" />
                        {notif.createdBy}
                      </span>
                      <span className="text-slate-500 font-mono">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#151728] border-t border-[#292d4a] text-center shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all"
          >
            Close Announcements
          </button>
        </div>

      </div>
    </div>
  );
};
