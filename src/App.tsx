import React, { useState, useEffect } from 'react';
import { UserProfile, Group, Competition, Registration, Result, LeaderboardEntry, AdminTabType } from './types';
import { festStore } from './lib/store';
import { applyBrandingToDocument } from './lib/branding';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { PublicHome } from './components/PublicHome';
import { CompetitionsView } from './components/CompetitionsView';
import { ResultsView } from './components/ResultsView';
import { AuthView } from './components/AuthView';
import { AdminDashboard } from './components/AdminDashboard';
import { LeaderDashboard } from './components/LeaderDashboard';
import { ParticipantDashboard } from './components/ParticipantDashboard';
import { JudgeDashboard } from './components/JudgeDashboard';
import { MediaDashboard } from './components/MediaDashboard';
import { SetupGuideModal, UserManualTab } from './components/SetupGuideModal';
import { CommentSection } from './components/CommentSection';
import { AppSplashScreen } from './components/AppSplashScreen';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideInitialTab, setGuideInitialTab] = useState<UserManualTab>('roles');
  const [syncStatus, setSyncStatus] = useState(() => festStore.getServerSyncStatus());
  const [showSplash, setShowSplash] = useState(true);

  // Admin Dashboard Active Tab State
  const [adminActiveTab, setAdminActiveTab] = useState<AdminTabType>('overview');
  const [showAdminCredModal, setShowAdminCredModal] = useState(false);

  // Live state from festStore
  const [groups, setGroups] = useState<Group[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [branding, setBranding] = useState(() => festStore.getBrandingConfig());

  const loadStoreData = () => {
    setGroups(festStore.getGroups());
    setProfiles(festStore.getProfiles());
    setCompetitions(festStore.getCompetitions());
    setRegistrations(festStore.getRegistrations());
    setResults(festStore.getResults());
    setLeaderboard(festStore.getLeaderboard());
    const bConfig = festStore.getBrandingConfig();
    setBranding(bConfig);
    applyBrandingToDocument(bConfig);
  };

  useEffect(() => {
    loadStoreData();
    const unsubscribe = festStore.subscribe(() => {
      loadStoreData();
      setSyncStatus(festStore.getServerSyncStatus());
      
      setCurrentUser(prevUser => {
        if (!prevUser) return null;
        const freshProfiles = festStore.getProfiles();
        const updated = freshProfiles.find(p => p.id === prevUser.id);
        return updated || prevUser;
      });
    });
    return unsubscribe;
  }, []);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.role === 'admin') setCurrentTab('admin');
    else if (user.role === 'leader') setCurrentTab('leader');
    else if (user.role === 'judge') setCurrentTab('judge');
    else if (user.role === 'media') setCurrentTab('media');
    else if (user.role === 'participant') setCurrentTab('participant');
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setCurrentTab('home');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-slate-100 selection:bg-[#ff2a5f] selection:text-white">
      
      {/* Dynamic Branding Styles */}
      <style>{`
        :root {
          --bg-dark: ${branding.bgDarkColor || '#0b0c16'} !important;
          --bg-card: ${branding.bgCardColor || '#151728'} !important;
          --accent-purple: ${branding.primaryColor || '#8b5cf6'} !important;
          --accent-indigo: ${branding.secondaryColor || '#6366f1'} !important;
          --border-glow: ${branding.primaryColor || '#8b5cf6'} !important;
          
          --bg-card-hover: color-mix(in srgb, ${branding.bgCardColor || '#151728'} 88%, white 12%) !important;
          --bg-card-alt: color-mix(in srgb, ${branding.bgCardColor || '#151728'} 92%, white 8%) !important;
          --border-subtle: color-mix(in srgb, ${branding.bgCardColor || '#151728'} 80%, white 20%) !important;
        }

        /* Override background of the main outer container */
        body, .min-h-screen {
          background-color: ${branding.bgDarkColor || '#0b0c16'} !important;
        }

        /* Override dynamic purple utility styles */
        .bg-purple-600 {
          background-color: ${branding.primaryColor || '#8b5cf6'} !important;
        }
        .text-purple-300 {
          color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 80%, white 20%) !important;
        }
        .text-purple-400 {
          color: ${branding.primaryColor || '#8b5cf6'} !important;
        }
        .border-purple-500 {
          border-color: ${branding.primaryColor || '#8b5cf6'} !important;
        }
        .border-purple-900\\/50 {
          border-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 30%, transparent) !important;
        }
        .border-purple-500\\/30 {
          border-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 30%, transparent) !important;
        }
        .border-purple-500\\/20 {
          border-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 20%, transparent) !important;
        }
        .bg-purple-600\\/20, .bg-purple-500\\/20 {
          background-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 20%, transparent) !important;
        }
        .bg-purple-600\\/10 {
          background-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 10%, transparent) !important;
        }
        .bg-purple-500\\/10 {
          background-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 10%, transparent) !important;
        }
        .bg-purple-500\\/15 {
          background-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 15%, transparent) !important;
        }
        .bg-purple-950\\/40 {
          background-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 20%, transparent) !important;
        }
        .bg-purple-950\\/60 {
          background-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 30%, transparent) !important;
        }
        .bg-purple-950\\/80 {
          background-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 40%, transparent) !important;
        }
        .bg-purple-950\\/90 {
          background-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 50%, transparent) !important;
        }
        .shadow-purple-600\\/40 {
          box-shadow: 0 10px 15px -3px color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 40%, transparent) !important;
        }
        .shadow-purple-600\\/30 {
          box-shadow: 0 10px 15px -3px color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 30%, transparent) !important;
        }
        .shadow-purple-900\\/30 {
          box-shadow: 0 10px 15px -3px color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 30%, transparent) !important;
        }
        .peer-checked\\:bg-purple-600:checked + div, .peer-checked\\:bg-purple-600 {
          background-color: ${branding.primaryColor || '#8b5cf6'} !important;
        }
        .hover\\:bg-purple-600:hover {
          background-color: ${branding.primaryColor || '#8b5cf6'} !important;
          color: white !important;
        }
        .hover\\:bg-purple-700:hover {
          background-color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 80%, black 20%) !important;
        }
        .hover\\:text-purple-300:hover {
          color: color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 80%, white 20%) !important;
        }

        /* Dynamic Button Overrides */
        .poster-btn-primary {
          background: linear-gradient(135deg, ${branding.primaryColor || '#8b5cf6'} 0%, ${branding.secondaryColor || '#6366f1'} 100%) !important;
        }
        .poster-btn-primary:hover {
          background: linear-gradient(135deg, color-mix(in srgb, ${branding.primaryColor || '#8b5cf6'} 85%, white 15%) 0%, ${branding.secondaryColor || '#6366f1'} 100%) !important;
        }
      `}</style>

      {/* Splash / Initial Loading Screen */}
      {showSplash && (
        <AppSplashScreen
          branding={branding}
          syncStatus={syncStatus}
          onFinish={() => setShowSplash(false)}
        />
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onOpenGuide={() => setIsGuideOpen(true)}
        adminActiveTab={adminActiveTab}
        setAdminActiveTab={setAdminActiveTab}
        onOpenAdminCreds={() => setShowAdminCredModal(true)}
        competitionsCount={competitions.length}
        groupsCount={groups.length}
        registrationsCount={registrations.length}
        notificationsCount={festStore.getNotifications().length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        
        {/* Real-time Firebase Sync Status Indicators */}
        {syncStatus.status === 'quota-exceeded' && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-200 shadow-lg">
            <div className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-300">
                    Firestore Free-Tier Daily Quota Limit Reached
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Local Mode Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  The application is safely running in offline local mode. All scores, registrations, and changes are fully saved on this device. Cloud sync will automatically resume when the daily quota resets.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button 
                onClick={async () => {
                  await festStore.forcePullFromCloud();
                }}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl transition-colors cursor-pointer font-semibold"
              >
                Retry Cloud Connection
              </button>
            </div>
          </div>
        )}

        {syncStatus.status === 'error' && (
          <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-200 shadow-lg">
            <div className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-rose-300">
                  {syncStatus.error || 'Connection to Firebase Firestore was interrupted.'}
                </span>
                {syncStatus.error?.includes('permissions') && (
                  <p className="text-[11px] text-slate-400">
                    Your Firestore rules need to be published to allow real-time sync.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button 
                onClick={() => {
                  setGuideInitialTab('roles');
                  setIsGuideOpen(true);
                }}
                className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1.5"
              >
                User Manual
              </button>
              <button 
                onClick={async () => {
                  await festStore.forcePullFromCloud();
                }}
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl transition-colors cursor-pointer font-semibold"
              >
                Reconnect
              </button>
            </div>
          </div>
        )}
        
        {/* PUBLIC HOME */}
        {currentTab === 'home' && (
          <PublicHome
            leaderboard={leaderboard}
            competitions={competitions}
            onNavigate={(tab) => setCurrentTab(tab)}
          />
        )}

        {/* COMPETITIONS VIEW */}
        {currentTab === 'competitions' && (
          <CompetitionsView competitions={competitions} />
        )}

        {/* RESULTS & LEADERBOARD VIEW */}
        {currentTab === 'results' && (
          <ResultsView
            leaderboard={leaderboard}
            results={results}
            competitions={competitions}
            onRefresh={loadStoreData}
          />
        )}

        {/* AUTH SIGN IN / GROUP REGISTRATION VIEW */}
        {currentTab === 'auth' && (
          <AuthView onLoginSuccess={handleLoginSuccess} />
        )}

        {/* ADMIN DASHBOARD */}
        {currentTab === 'admin' && (
          currentUser && currentUser.role === 'admin' ? (
            <AdminDashboard
              currentUser={currentUser}
              groups={groups}
              competitions={competitions}
              registrations={registrations}
              results={results}
              leaderboard={leaderboard}
              onRefresh={loadStoreData}
              onSignOut={handleSignOut}
              activeTab={adminActiveTab}
              setActiveTab={setAdminActiveTab}
              showAdminCredModal={showAdminCredModal}
              setShowAdminCredModal={setShowAdminCredModal}
            />
          ) : (
            <AuthView onLoginSuccess={handleLoginSuccess} />
          )
        )}

        {/* GROUP LEADER DASHBOARD */}
        {currentTab === 'leader' && (
          currentUser && currentUser.role === 'leader' ? (
            <LeaderDashboard
              currentUser={currentUser}
              groups={groups}
              competitions={competitions}
              registrations={registrations}
              profiles={profiles}
              onRefresh={loadStoreData}
            />
          ) : (
            <AuthView onLoginSuccess={handleLoginSuccess} />
          )
        )}

        {/* PARTICIPANT DASHBOARD */}
        {currentTab === 'participant' && (
          currentUser && currentUser.role === 'participant' ? (
            <ParticipantDashboard
              currentUser={currentUser}
              competitions={competitions}
              registrations={registrations}
              results={results}
              groups={groups}
              onUserUpdated={(updatedUser) => {
                setCurrentUser(updatedUser);
                loadStoreData();
              }}
            />
          ) : (
            <AuthView onLoginSuccess={handleLoginSuccess} />
          )
        )}

        {/* JUDGE DASHBOARD */}
        {currentTab === 'judge' && (
          currentUser && currentUser.role === 'judge' ? (
            <JudgeDashboard
              currentUser={currentUser}
              competitions={competitions}
              registrations={registrations}
              groups={groups}
              onSignOut={handleSignOut}
            />
          ) : (
            <AuthView onLoginSuccess={handleLoginSuccess} />
          )
        )}

        {/* MEDIA DASHBOARD */}
        {currentTab === 'media' && (
          currentUser && currentUser.role === 'media' ? (
            <MediaDashboard
              currentUser={currentUser}
              leaderboard={leaderboard}
              results={results}
              competitions={competitions}
              registrations={registrations}
              groups={groups}
              onSignOut={handleSignOut}
            />
          ) : (
            <AuthView onLoginSuccess={handleLoginSuccess} />
          )
        )}

      </main>

      {/* Floating Live Comments & Cheers Drawer */}
      <CommentSection
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
        onNavigate={(tab) => setCurrentTab(tab)}
      />

      {/* Setup Guide Modal */}
      <SetupGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialTab={guideInitialTab}
      />

      {/* Footer */}
      <Footer
        onNavigate={(tab) => setCurrentTab(tab)}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

    </div>
  );
}
