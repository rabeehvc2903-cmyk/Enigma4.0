import React, { useState, useEffect } from 'react';
import { UserProfile, AdminTabType } from '../types';
import { Home, Calendar, Trophy, User, Shield, Users, HelpCircle, LogOut, Bell, Sparkles, UserCheck, Settings, Award, CheckCircle2, Palette, KeyRound, MoreVertical, ClipboardList, LayoutDashboard, HardDrive, RotateCcw, FileSpreadsheet, Scale, Radio, X } from 'lucide-react';
import { festStore } from '../lib/store';
import { NotificationModal } from './NotificationModal';
import { ParticipantAvatar } from './ParticipantAvatar';
import logoImg from '../assets/images/logo-01.png';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: UserProfile | null;
  onSignOut: () => void;
  onOpenGuide: () => void;
  adminActiveTab?: AdminTabType;
  setAdminActiveTab?: (tab: AdminTabType) => void;
  onOpenAdminCreds?: () => void;
  competitionsCount?: number;
  groupsCount?: number;
  registrationsCount?: number;
  notificationsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  onSignOut,
  onOpenGuide,
  adminActiveTab,
  setAdminActiveTab,
  onOpenAdminCreds,
  competitionsCount,
  groupsCount,
  registrationsCount,
  notificationsCount
}) => {
  const [branding, setBranding] = useState(() => festStore.getBrandingConfig());
  const [hasUnreadNotif, setHasUnreadNotif] = useState<boolean>(() => festStore.hasUnreadNotifications());
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      setBranding(festStore.getBrandingConfig());
      setHasUnreadNotif(festStore.hasUnreadNotifications());
    });
    return unsubscribe;
  }, []);

  const getPortalTab = () => {
    if (!currentUser) return 'auth';
    if (currentUser.role === 'admin') return 'admin';
    if (currentUser.role === 'judge') return 'judge';
    if (currentUser.role === 'media') return 'media';
    if (currentUser.role === 'leader') return 'leader';
    return 'participant';
  };

  const isPortalActive = ['auth', 'admin', 'judge', 'media', 'leader', 'participant'].includes(currentTab);

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0b0c16]/90 backdrop-blur-xl border-b border-[#292d4a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-16 sm:h-20">
            
            {/* Logo */}
            <div 
              onClick={() => setCurrentTab('home')}
              className="flex items-center gap-3 cursor-pointer group shrink-0"
            >
              <img 
                src={branding.logoUrl || logoImg} 
                alt="Festival Logo" 
                className="w-auto object-contain transition-all duration-300 group-hover:scale-105 shrink-0 max-h-10 sm:max-h-12 md:max-h-14"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            {/* Header Right Action Icons (Hidden when Admin Dashboard tab is active) */}
            {currentTab !== 'admin' ? (
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                {/* Announcement Bell Icon */}
                <button
                  onClick={() => {
                    setIsNotificationOpen(true);
                    festStore.markNotificationsAsRead();
                    setHasUnreadNotif(false);
                  }}
                  className="relative p-2 sm:p-2.5 rounded-2xl bg-[#181b30] hover:bg-[#202542] border border-[#292d4a] text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer"
                  title="Announcements"
                >
                  <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {hasUnreadNotif && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse border-2 border-[#0b0c16]" />
                  )}
                </button>

                {/* App User Manual Icon Button */}
                <button
                  onClick={onOpenGuide}
                  className="p-2 sm:p-2.5 rounded-2xl bg-[#181b30] hover:bg-[#202542] border border-[#292d4a] text-purple-400 hover:text-purple-300 transition-all shadow-sm flex items-center gap-1.5"
                  title="App User Manual"
                >
                  <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-xs font-semibold text-slate-300 hidden md:inline">User Manual</span>
                </button>

                {/* User Account / Sign Out status */}
                {currentUser ? (
                  <div className="flex items-center gap-1.5">
                    <ParticipantAvatar
                      name={currentUser.name}
                      photoUrl={currentUser.photoUrl}
                      className="w-8 h-8 border border-purple-500/40 shadow-sm"
                    />
                    <button
                      onClick={onSignOut}
                      className="p-2 sm:p-2.5 rounded-2xl bg-[#181b30] hover:bg-rose-500/20 border border-[#292d4a] text-slate-300 hover:text-rose-400 transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                      title="Sign Out"
                    >
                      <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCurrentTab('auth')}
                    className="poster-btn-primary py-1.5 px-2.5 sm:py-2 sm:px-3.5 text-[10px] sm:text-xs rounded-2xl shadow-purple-600/30 flex items-center gap-1 sm:gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Sign In</span>
                  </button>
                )}
              </div>
            ) : (
              /* Settings Button for Admin Dashboard - stuck top right in sticky header */
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="p-2.5 rounded-2xl bg-[#181b30] hover:bg-purple-600/20 text-slate-200 hover:text-white border border-[#292d4a] hover:border-purple-500/40 transition-all cursor-pointer shadow-md flex items-center gap-2 text-xs font-bold"
                  title="Admin Settings & Navigation"
                >
                  <Settings className="w-4 h-4 text-purple-400" />
                  <span>Settings</span>
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </button>

                {showSettingsMenu && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowSettingsMenu(false)}
                    />

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-72 bg-[#151728] border border-[#292d4a] rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn space-y-1">
                      <div className="px-3 py-2 border-b border-[#292d4a]/80 mb-1 flex items-center justify-between">
                        <div className="text-[10px] font-extrabold text-purple-400 uppercase tracking-wider">
                          Admin Navigation & Settings
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSettingsMenu(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-purple-600/20 transition-all cursor-pointer"
                          title="Close menu"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 1. Fest Overview */}
                      <button
                        onClick={() => { setAdminActiveTab?.('overview'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'overview'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <LayoutDashboard className="w-4 h-4 text-purple-400" /> Fest Overview
                        </span>
                        {adminActiveTab === 'overview' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* 2. Schedule Table & Clash Engine */}
                      <button
                        onClick={() => { setAdminActiveTab?.('schedule'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'schedule'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Calendar className="w-4 h-4 text-cyan-400" /> Schedule & Clash Engine
                        </span>
                        {adminActiveTab === 'schedule' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* 3. Enter Results */}
                      <button
                        onClick={() => { setAdminActiveTab?.('results'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'results'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Trophy className="w-4 h-4 text-amber-400" /> Enter Results
                        </span>
                        {adminActiveTab === 'results' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* 4. Participants Report */}
                      <button
                        onClick={() => { setAdminActiveTab?.('reporting'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'reporting'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <ClipboardList className="w-4 h-4 text-cyan-400" /> Participants Report
                        </span>
                        {adminActiveTab === 'reporting' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* Assign Valuation (Judge) */}
                      <button
                        onClick={() => { setAdminActiveTab?.('valuation'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'valuation'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Scale className="w-4 h-4 text-emerald-400" /> Assign Valuation (Judge)
                        </span>
                        {adminActiveTab === 'valuation' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* 5. Competitions */}
                      <button
                        onClick={() => { setAdminActiveTab?.('competitions'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'competitions'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Award className="w-4 h-4 text-purple-400" /> Competitions ({competitionsCount ?? 0})
                        </span>
                        {adminActiveTab === 'competitions' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* 6. Groups */}
                      <button
                        onClick={() => { setAdminActiveTab?.('groups'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'groups'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Users className="w-4 h-4 text-blue-400" /> Groups ({groupsCount ?? 0})
                        </span>
                        {adminActiveTab === 'groups' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* 4. Registrations */}
                      <button
                        onClick={() => { setAdminActiveTab?.('registrations'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'registrations'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Registrations ({registrationsCount ?? 0})
                        </span>
                        {adminActiveTab === 'registrations' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* 5. Competition & Event Update */}
                      <button
                        onClick={() => { setAdminActiveTab?.('updates'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'updates'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Sparkles className="w-4 h-4 text-amber-300" /> Competition & Event Update
                        </span>
                        {adminActiveTab === 'updates' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* 6. Announcements & Alerts */}
                      <button
                        onClick={() => { setAdminActiveTab?.('notifications'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'notifications'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Bell className="w-4 h-4 text-rose-400" /> Announcements & Alerts ({notificationsCount ?? 0})
                        </span>
                        {adminActiveTab === 'notifications' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* 7. Festival Branding & App Titles */}
                      <button
                        onClick={() => { setAdminActiveTab?.('branding'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'branding'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Palette className="w-4 h-4 text-purple-400" /> Festival Branding & Titles
                        </span>
                        {adminActiveTab === 'branding' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      {/* 8. Export & Restore */}
                      <button
                        onClick={() => { setAdminActiveTab?.('backup'); setShowSettingsMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          adminActiveTab === 'backup'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-[#181b30] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <HardDrive className="w-4 h-4 text-emerald-400" /> Export & Restore
                        </span>
                        {adminActiveTab === 'backup' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>

                      <div className="border-t border-[#292d4a]/80 my-1" />

                      {/* Edit Admin Password */}
                      <button
                        onClick={() => {
                          setShowSettingsMenu(false);
                          onOpenAdminCreds?.();
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-[#181b30] hover:text-white transition-all flex items-center gap-2.5"
                      >
                        <KeyRound className="w-4 h-4 text-amber-400" /> Edit Admin Password
                      </button>

                      <div className="border-t border-[#292d4a]/80 my-1" />

                      {/* Logout Button */}
                      <button
                        onClick={() => {
                          setShowSettingsMenu(false);
                          onSignOut();
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all flex items-center gap-2.5 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-400" /> Log Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </header>

      {/* Floating Bottom Navigation Bar (Icon Dock matching reference photo) */}
      <nav 
        aria-label="Main Dock Navigation"
        className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 glass-dock rounded-full px-5 sm:px-7 py-2.5 sm:py-3 flex items-center gap-6 sm:gap-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10"
      >
        {/* Home Button Icon */}
        <button
          onClick={() => setCurrentTab('home')}
          className="relative flex flex-col items-center group py-1"
          title="Festival Home"
        >
          <div className={`p-2.5 rounded-full transition-all duration-300 ${
            currentTab === 'home'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50 scale-110'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}>
            <Home className="w-5 h-5" />
          </div>
          {currentTab === 'home' && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 absolute -bottom-1 shadow-sm shadow-purple-400" />
          )}
        </button>

        {/* Competitions Button Icon */}
        <button
          onClick={() => setCurrentTab('competitions')}
          className="relative flex flex-col items-center group py-1"
          title="Competitions Schedule"
        >
          <div className={`p-2.5 rounded-full transition-all duration-300 ${
            currentTab === 'competitions'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50 scale-110'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}>
            <Calendar className="w-5 h-5" />
          </div>
          {currentTab === 'competitions' && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 absolute -bottom-1 shadow-sm shadow-purple-400" />
          )}
        </button>

        {/* Results / Leaderboard Button Icon */}
        <button
          onClick={() => setCurrentTab('results')}
          className="relative flex flex-col items-center group py-1"
          title="Group Leaderboard & Standings"
        >
          <div className={`p-2.5 rounded-full transition-all duration-300 ${
            currentTab === 'results'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50 scale-110'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}>
            <Trophy className="w-5 h-5" />
          </div>
          {currentTab === 'results' && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 absolute -bottom-1 shadow-sm shadow-purple-400" />
          )}
        </button>

        {/* Portal / Profile Button Icon */}
        <button
          onClick={() => setCurrentTab(getPortalTab())}
          className="relative flex flex-col items-center group py-1"
          title={currentUser ? `${currentUser.role.toUpperCase()} Dashboard` : 'Sign In Portal'}
        >
          <div className={`p-2.5 rounded-full transition-all duration-300 ${
            isPortalActive
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50 scale-110'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}>
            {currentUser?.role === 'admin' ? (
              <Shield className="w-5 h-5" />
            ) : currentUser?.role === 'judge' ? (
              <Scale className="w-5 h-5" />
            ) : currentUser?.role === 'media' ? (
              <Radio className="w-5 h-5" />
            ) : currentUser?.role === 'leader' ? (
              <Users className="w-5 h-5" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
          {isPortalActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 absolute -bottom-1 shadow-sm shadow-purple-400" />
          )}
        </button>
      </nav>

      {/* Notification Modal Popup */}
      <NotificationModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </>
  );
};

