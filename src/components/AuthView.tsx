import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { festStore } from '../lib/store';
import { QrScanner } from './QrScanner';
import { Shield, Users, User, LogIn, UserPlus, KeyRound, AlertCircle, Sparkles, CheckCircle2, Scale, Radio, QrCode, ScanLine, Camera, ChevronDown } from 'lucide-react';

interface AuthViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const parseParticipantKeyFromQr = (raw: string): string => {
  if (!raw) return '';
  let str = raw.trim();

  // 1. Try JSON
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed.chestNo) return String(parsed.chestNo).trim();
      if (parsed.userId) return String(parsed.userId).trim();
      if (parsed.id) return String(parsed.id).trim();
      if (parsed.chest) return String(parsed.chest).trim();
    } catch {}
  }

  // 2. Try URL
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const url = new URL(str);
      const chestParam = url.searchParams.get('chest') || 
                         url.searchParams.get('chestNo') || 
                         url.searchParams.get('id') || 
                         url.searchParams.get('user') ||
                         url.searchParams.get('userId');
      if (chestParam) return chestParam.trim();

      // Check hash params e.g. #/participant/EM-001 or #EM-001
      if (url.hash) {
        const hashClean = url.hash.replace(/^#\/?(participant\/)?/, '').trim();
        if (hashClean) return hashClean;
      }

      // Check last pathname segment
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        const last = segments[segments.length - 1];
        if (last && !['home', 'auth', 'login', 'participant'].includes(last.toLowerCase())) {
          return last.trim();
        }
      }
    } catch {}
  }

  return str;
};

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [activeMode, setActiveMode] = useState<'signin' | 'register_group'>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>('participant');
  const [isMoreLoginOpen, setIsMoreLoginOpen] = useState<boolean>(false);

  // Credentials
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannedParticipant, setScannedParticipant] = useState<UserProfile | null>(null);

  // Group Leader Registration State
  const [regGroupName, setRegGroupName] = useState('');
  const [regLeaderName, setRegLeaderName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regGroupCode, setRegGroupCode] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState('');

  const handleQrScanned = (decodedData: string) => {
    setErrorMsg('');
    const rawKey = parseParticipantKeyFromQr(decodedData);
    if (!rawKey) {
      setErrorMsg('No valid Participant Chest No or QR code detected. Please try scanning again.');
      return;
    }

    const normKey = rawKey.trim().toLowerCase();
    const profiles = festStore.getProfiles();

    const match = profiles.find((p) => {
      if (p.role !== 'participant') return false;

      const pUserId = (p.userId || '').trim().toLowerCase();
      const pId = (p.id || '').trim().toLowerCase();
      const pChestNo = p.chestNo ? String(p.chestNo).trim().toLowerCase() : '';
      const pPass = (p.password || '').trim().toLowerCase();

      // 1. Exact string match
      if (pUserId === normKey || pId === normKey || pChestNo === normKey || pPass === normKey) {
        return true;
      }

      // 2. Exact numeric value match (e.g. chest "01" or "1" equals numeric 1)
      const keyNum = parseInt(normKey, 10);
      if (!isNaN(keyNum)) {
        const pUserNum = parseInt(pUserId.replace(/^[^\d]+/, ''), 10);
        const pChestNum = parseInt(pChestNo, 10);

        if ((!isNaN(pUserNum) && pUserNum === keyNum) || (!isNaN(pChestNum) && pChestNum === keyNum)) {
          return true;
        }
      }

      return false;
    });

    if (!match) {
      setErrorMsg(`Participant ID / Chest No "${rawKey}" not found. Please ensure this ID card is registered for the festival.`);
      return;
    }

    setScannedParticipant(match);
    setIsScannerOpen(false);

    // Auto-login after brief confirmation feedback
    setTimeout(() => {
      onLoginSuccess(match);
    }, 600);
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanPassword = passwordInput.trim();
    const profiles = festStore.getProfiles();

    if (selectedRole === 'participant') {
      setIsScannerOpen(true);
      return;
    }

    if (selectedRole === 'admin') {
      if (!cleanPassword) {
        setErrorMsg('Please enter the Admin Password.');
        return;
      }

      const match = profiles.find(
        p => p.role === 'admin' && p.password === cleanPassword
      );

      if (!match) {
        setErrorMsg('Invalid Admin Password. Please check and try again.');
        return;
      }

      onLoginSuccess(match);
      return;
    }

    if (selectedRole === 'leader') {
      if (!cleanPassword) {
        setErrorMsg('Please enter your Group Leader Password.');
        return;
      }

      const match = profiles.find(
        p => p.role === 'leader' && p.password === cleanPassword
      );

      if (!match) {
        setErrorMsg('Invalid Leader Password. Please check your group password and try again.');
        return;
      }

      onLoginSuccess(match);
      return;
    }

    if (selectedRole === 'judge') {
      if (!cleanPassword) {
        setErrorMsg('Please enter the Judge Password.');
        return;
      }

      const match = profiles.find(
        p => p.role === 'judge' && p.password === cleanPassword
      );

      if (!match && cleanPassword === 'judge123') {
        onLoginSuccess({
          id: 'usr-judge',
          userId: 'judge',
          password: 'judge123',
          name: 'Official Fest Judge',
          role: 'judge'
        });
        return;
      }

      if (!match) {
        setErrorMsg('Invalid Judge Password. Please check and try again.');
        return;
      }

      onLoginSuccess(match);
      return;
    }

    if (selectedRole === 'media') {
      if (!cleanPassword) {
        setErrorMsg('Please enter the Media Password.');
        return;
      }

      const match = profiles.find(
        p => p.role === 'media' && p.password === cleanPassword
      );

      if (!match) {
        setErrorMsg('Invalid Media Password. Please check and try again.');
        return;
      }

      onLoginSuccess(match);
      return;
    }
  };

  const handleGroupRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setRegSuccessMsg('');

    if (!regGroupName || !regLeaderName || !regPassword) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    const code = regGroupCode ? regGroupCode.toUpperCase() : regGroupName.substring(0, 4).toUpperCase();
    const autoLeaderId = `${code}-LEADER-${Date.now().toString().slice(-4)}`;

    const newGroup = festStore.addGroup(
      regGroupName,
      regLeaderName,
      autoLeaderId,
      regPassword,
      code,
      '#a855f7'
    );

    setRegSuccessMsg(`Group "${newGroup.name}" registered successfully! You can now sign in using your Leader Password.`);
    
    // Auto-fill signin form
    setSelectedRole('leader');
    setPasswordInput(regPassword);
    
    setTimeout(() => {
      setActiveMode('signin');
    }, 1500);
  };

  return (
    <div className="max-w-xl mx-auto py-6 pb-24">
      
      {/* Container Card */}
      <div className="poster-card bg-[#151728] border border-[#292d4a] p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl">
        
        {/* SIGN IN FORM */}
        {activeMode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-6">
            
            {/* Header: Login */}
            <div className="text-center space-y-1">
              <h2 className="text-[17px] font-black text-white tracking-tight uppercase">
                Login
              </h2>
              <p className="text-xs text-slate-400">
                Choose your portal below to sign in
              </p>
            </div>

            {/* Selector Section: Participant + More Login (stacked vertically) */}
            <div className="flex flex-col items-center justify-center gap-2 pb-2 w-full">
              {/* Participant Login (Primary Glowing Button - Centered) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('participant');
                  setIsMoreLoginOpen(false);
                  setErrorMsg('');
                  setPasswordInput('');
                  setIsScannerOpen(false);
                }}
                className={`relative w-full max-w-xs sm:max-w-sm px-5 py-2.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border overflow-hidden cursor-pointer ${
                  selectedRole === 'participant'
                    ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.7)] scale-[1.02]'
                    : 'bg-purple-950/20 text-purple-300 border-purple-500/20 hover:bg-purple-950/40 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                }`}
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span className="truncate">Participant</span>
                <span className="absolute inset-0 bg-white/5 opacity-0 hover:opacity-100 transition-opacity" />
              </button>

              {/* More Login Toggle Button (Placed Down Below Participant) */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreLoginOpen(prev => !prev);
                }}
                className={`relative w-full max-w-xs sm:max-w-sm px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 border-0 border-none cursor-pointer ${
                  selectedRole !== 'participant'
                    ? 'bg-[#1e223d] text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.25)] font-extrabold'
                    : isMoreLoginOpen
                    ? 'bg-[#181b30] text-white'
                    : 'bg-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">More Login</span>
                {selectedRole !== 'participant' && (
                  <span className="capitalize text-[10px] sm:text-xs font-black px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border-0 border-none shrink-0">
                    {selectedRole}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                    isMoreLoginOpen ? 'rotate-180 text-purple-400' : 'text-slate-400'
                  }`}
                />
              </button>

              {/* Sub-menu containing all other logins: Leader, Judge, Media, Admin */}
              {isMoreLoginOpen && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 p-1.5 bg-[#121424] border border-[#292d4a] rounded-2xl shadow-inner animate-fadeIn w-full max-w-md mt-1">
                  
                  {/* Leader Login */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('leader');
                      setIsMoreLoginOpen(false);
                      setErrorMsg('');
                      setPasswordInput('');
                      setIsScannerOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      selectedRole === 'leader'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm font-extrabold'
                        : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#181b30]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Leader</span>
                  </button>

                  {/* Judge Login */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('judge');
                      setIsMoreLoginOpen(false);
                      setErrorMsg('');
                      setPasswordInput('');
                      setIsScannerOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      selectedRole === 'judge'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm font-extrabold'
                        : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#181b30]'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Judge</span>
                  </button>

                  {/* Media Login */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('media');
                      setIsMoreLoginOpen(false);
                      setErrorMsg('');
                      setPasswordInput('');
                      setIsScannerOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      selectedRole === 'media'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm font-extrabold'
                        : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#181b30]'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Media</span>
                  </button>

                  {/* Admin Login */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('admin');
                      setIsMoreLoginOpen(false);
                      setErrorMsg('');
                      setPasswordInput('');
                      setIsScannerOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      selectedRole === 'admin'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm font-extrabold'
                        : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#181b30]'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-rose-400" />
                    <span>Admin</span>
                  </button>

                </div>
              )}
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-2xl text-xs font-semibold text-rose-400 flex items-center gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Scanned Participant Success Banner */}
            {scannedParticipant && (
              <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-xs font-bold text-emerald-300 flex items-center gap-3 animate-fadeIn shadow-lg shadow-emerald-900/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-extrabold text-sm text-white">Welcome, {scannedParticipant.name}!</p>
                  <p className="text-[11px] text-emerald-300 font-mono">
                    Chest No: {scannedParticipant.userId} • Logging in...
                  </p>
                </div>
              </div>
            )}

            {/* SEPARATE LOGIN CARDS */}
            {selectedRole === 'participant' && (
              <div className="bg-[#181b30] border border-purple-500/40 rounded-3xl p-5 sm:p-6 shadow-[0_0_20px_rgba(168,85,247,0.15)] flex flex-col justify-between items-center gap-4 min-h-[280px] sm:min-h-[300px]">
                {isScannerOpen ? (
                  <QrScanner
                    onScanSuccess={handleQrScanned}
                    onClose={() => setIsScannerOpen(false)}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col justify-between items-center gap-4 flex-1">
                    {/* Visual Frame Container */}
                    <div className="w-full flex-1 min-h-[130px] bg-[#111322]/70 border border-purple-500/20 rounded-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden shadow-inner group">
                      {/* Subtle Ambient Radial Glow */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15)_0%,transparent_70%)] pointer-events-none" />
                      
                      {/* Viewfinder corner accents */}
                      <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-purple-500/40 rounded-tl pointer-events-none" />
                      <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-purple-500/40 rounded-tr pointer-events-none" />
                      <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-purple-500/40 rounded-bl pointer-events-none" />
                      <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-purple-500/40 rounded-br pointer-events-none" />

                      {/* QR Badge Icon */}
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-fuchsia-600/30 border border-purple-500/40 flex items-center justify-center shadow-[0_0_25px_rgba(168,85,247,0.35)] shrink-0 transition-transform group-hover:scale-105">
                        <QrCode className="w-8 h-8 sm:w-10 sm:h-10 text-purple-300" />
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                        </span>
                      </div>
                    </div>

                    {/* Scan QR Button */}
                    <div className="w-full shrink-0">
                      <button 
                        type="button"
                        onClick={() => {
                          setErrorMsg('');
                          setIsScannerOpen(true);
                        }}
                        className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 border border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-all active:scale-95 cursor-pointer hover:shadow-[0_0_30px_rgba(168,85,247,0.7)]"
                      >
                        <ScanLine className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
                        <span>Scan QR to Login</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedRole === 'leader' && (
              <div className="bg-[#181b30] border border-amber-500/40 rounded-3xl p-5 sm:p-6 space-y-5 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-300 mb-1.5 tracking-wider">
                      Leader Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter Leader Password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-[#121424] border border-[#292d4a] focus:border-amber-500 rounded-2xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-all"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all active:scale-95 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Log In</span>
                  </button>
                </div>
              </div>
            )}

            {/* JUDGE LOGIN CARD */}
            {selectedRole === 'judge' && (
              <div className="bg-[#181b30] border border-emerald-500/40 rounded-3xl p-5 sm:p-6 space-y-5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-300 mb-1.5 tracking-wider">
                      Judge Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter Judge Password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-[#121424] border border-[#292d4a] focus:border-emerald-500 rounded-2xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-all"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all active:scale-95 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Log In</span>
                  </button>
                </div>
              </div>
            )}

            {/* MEDIA LOGIN CARD */}
            {selectedRole === 'media' && (
              <div className="bg-[#181b30] border border-cyan-500/40 rounded-3xl p-5 sm:p-6 space-y-5 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-300 mb-1.5 tracking-wider">
                      Media Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter Media Password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-[#121424] border border-[#292d4a] focus:border-cyan-500 rounded-2xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-all"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-3.5 px-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all active:scale-95 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Log In</span>
                  </button>
                </div>
              </div>
            )}

            {selectedRole === 'admin' && (
              <div className="bg-[#181b30] border border-rose-500/40 rounded-3xl p-5 sm:p-6 space-y-5 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-300 mb-1.5 tracking-wider">
                      Admin Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter Admin Password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-[#121424] border border-[#292d4a] focus:border-rose-500 rounded-2xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-all"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)] transition-all active:scale-95 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Log In</span>
                  </button>
                </div>
              </div>
            )}

          </form>
        )}

      </div>
    </div>
  );
};

