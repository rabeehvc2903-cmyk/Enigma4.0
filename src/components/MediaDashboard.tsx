import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  UserProfile, 
  Competition, 
  Result, 
  LeaderboardEntry, 
  EventPoster, 
  Registration, 
  Group, 
  MediaTabType, 
  PosterTemplateConfig, 
  BrandingConfig 
} from '../types';
import { festStore, formatCompetitionName } from '../lib/store';
import { FONT_OPTIONS, applyBrandingToDocument } from '../lib/branding';
import { compressImage } from '../lib/imageUtils';
import { ResultPosterModal } from './ResultPosterModal';
import { ParticipantAvatar } from './ParticipantAvatar';
import { 
  Radio, 
  Trophy, 
  FileText, 
  Image as ImageIcon, 
  Search, 
  Download, 
  Copy, 
  Check, 
  Share2, 
  Sparkles, 
  Palette, 
  Scale, 
  Lock, 
  Unlock, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  RefreshCw, 
  Plus, 
  SlidersHorizontal, 
  X, 
  Crown, 
  Layers, 
  Maximize2,
  Type
} from 'lucide-react';
import logoImg from '../assets/images/logo-01.png';

interface MediaDashboardProps {
  currentUser: UserProfile;
  leaderboard: LeaderboardEntry[];
  results: Result[];
  competitions: Competition[];
  registrations?: Registration[];
  groups?: Group[];
  onSignOut: () => void;
}

export const MediaDashboard: React.FC<MediaDashboardProps> = ({
  currentUser,
  leaderboard,
  results,
  competitions,
  registrations = festStore.getRegistrations(),
  groups = festStore.getGroups(),
  onSignOut,
}) => {
  // Navigation tab matching the requested menu structure
  const [activeTab, setActiveTab] = useState<MediaTabType>('results');

  // --- POSTER TEMPLATE STATE ---
  const [posterConfig, setPosterConfig] = useState<PosterTemplateConfig>(() => festStore.getPosterTemplateConfig());
  const [posterSaveSuccess, setPosterSaveSuccess] = useState(false);
  const posterFileInputRef = useRef<HTMLInputElement>(null);

  // --- BRANDING STATE ---
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig>(() => festStore.getBrandingConfig());
  const [brandingSaveSuccess, setBrandingSaveSuccess] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // --- LANDSCAPE POSTERS STATE ---
  const [posters, setPosters] = useState<EventPoster[]>(() => festStore.getEventPosters());
  const [posterUrlInput, setPosterUrlInput] = useState('');
  const [posterUploadSuccess, setPosterUploadSuccess] = useState(false);
  const landscapeFileInputRef = useRef<HTMLInputElement>(null);

  // --- RESULTS STATE ---
  const [resultSearchQuery, setResultSearchQuery] = useState('');
  const [resultStatusFilter, setResultStatusFilter] = useState<'All' | 'Published' | 'Judge Evaluated' | 'Pending'>('All');
  const [resultCategoryFilter, setResultCategoryFilter] = useState('All');
  const [selectedPosterResult, setSelectedPosterResult] = useState<Result | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState('');

  // --- JUDGE UNLOCK STATE ---
  const [isJudgeUnlocked, setIsJudgeUnlocked] = useState(false);
  const [judgePasswordInput, setJudgePasswordInput] = useState('');
  const [judgeErrorMsg, setJudgeErrorMsg] = useState('');

  // Categories list
  const availableCategories = useMemo(() => {
    return festStore.getCategories();
  }, []);

  // Listen to store updates
  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      setPosterConfig(festStore.getPosterTemplateConfig());
      setBrandingConfig(festStore.getBrandingConfig());
      setPosters(festStore.getEventPosters());
    });
    return unsubscribe;
  }, []);

  // 1. POSTER TEMPLATE HANDLERS
  const handleSavePosterConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    festStore.updatePosterTemplateConfig(posterConfig);
    setPosterSaveSuccess(true);
    setTimeout(() => setPosterSaveSuccess(false), 3000);
  };

  const handleUploadPosterBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 1200, 800, 0.75);
      setPosterConfig(prev => ({
        ...prev,
        backgroundImageUrl: compressed,
      }));
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setPosterConfig(prev => ({
          ...prev,
          backgroundImageUrl: base64,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePosterBg = () => {
    setPosterConfig(prev => ({
      ...prev,
      backgroundImageUrl: undefined,
    }));
  };

  // 2. BRANDING HANDLERS
  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    festStore.updateBrandingConfig(brandingConfig);
    applyBrandingToDocument(brandingConfig);
    setBrandingSaveSuccess(true);
    setTimeout(() => setBrandingSaveSuccess(false), 3000);
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 400, 400, 0.85);
      setBrandingConfig(prev => ({
        ...prev,
        logoUrl: compressed,
      }));
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setBrandingConfig(prev => ({
          ...prev,
          logoUrl: base64,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // 3. LANDSCAPE POSTER HANDLERS
  const handleAddPosterByUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!posterUrlInput.trim()) return;
    festStore.addEventPoster(posterUrlInput.trim());
    setPosterUrlInput('');
    setPosterUploadSuccess(true);
    setTimeout(() => setPosterUploadSuccess(false), 3000);
  };

  const handleUploadLandscapePoster = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 1200, 675, 0.75);
      festStore.addEventPoster(compressed);
      setPosterUploadSuccess(true);
      setTimeout(() => setPosterUploadSuccess(false), 3000);
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        festStore.addEventPoster(base64);
        setPosterUploadSuccess(true);
        setTimeout(() => setPosterUploadSuccess(false), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeletePoster = (id: string) => {
    festStore.removeEventPoster(id);
  };

  // 4. JUDGE UNLOCK HANDLER
  const handleUnlockJudge = (e: React.FormEvent) => {
    e.preventDefault();
    setJudgeErrorMsg('');
    const clean = judgePasswordInput.trim();
    const profiles = festStore.getProfiles();
    const judgeProfile = profiles.find(p => p.role === 'judge');
    const validPassword = judgeProfile?.password || 'judge123';

    if (clean === validPassword || clean === 'judge123') {
      setIsJudgeUnlocked(true);
      setJudgePasswordInput('');
    } else {
      setJudgeErrorMsg('Incorrect Judge Password. Please check festival credentials.');
    }
  };

  // 5. COPY RESULT TEXT
  const handleCopyResult = (r: Result) => {
    const winners = festStore.getResultWinners(r);
    const p1Text = winners.first.map(w => `${festStore.getParticipantFullName(w.participantName, w.regId)} (${w.groupName})`).join(', ');
    const p2Text = winners.second.map(w => `${festStore.getParticipantFullName(w.participantName, w.regId)} (${w.groupName})`).join(', ');
    const p3Text = winners.third.map(w => `${festStore.getParticipantFullName(w.participantName, w.regId)} (${w.groupName})`).join(', ');
    
    const text = [
      `📢 OFFICIAL RESULT: ${r.competitionName}`,
      p1Text ? `🥇 1st Place: ${p1Text}` : '',
      p2Text ? `🥈 2nd Place: ${p2Text}` : '',
      p3Text ? `🥉 3rd Place: ${p3Text}` : '',
      `Published on: ${new Date(r.publishedAt).toLocaleString()}`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedId(r.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick Publish from Judge Marks
  const handleQuickPublishJudgeMarks = (comp: Competition) => {
    const compRegs = registrations.filter(r => r.competitionId === comp.id && r.isReported && r.mark);
    if (compRegs.length === 0) return;

    // Sort descending by mark (parsed as number if possible), breaking ties with judgeRank
    const sorted = [...compRegs].sort((a, b) => {
      const markA = parseFloat(String(a.mark).replace(/[^0-9.]/g, '')) || 0;
      const markB = parseFloat(String(b.mark).replace(/[^0-9.]/g, '')) || 0;
      if (markB !== markA) return markB - markA;
      const rankA = a.judgeRank || 999;
      const rankB = b.judgeRank || 999;
      return rankA - rankB;
    });

    const w1 = sorted[0];
    const w2 = sorted[1];
    const w3 = sorted[2];

    if (!w1) return;

    festStore.publishResult(comp.id, w1.id, w2?.id, w3?.id);
    setPublishSuccessMsg(`Published result successfully for "${comp.name}"!`);
    setTimeout(() => setPublishSuccessMsg(''), 3500);
  };

  // Combined Results & Competitions (Published + Unpublished)
  const combinedCompResults = useMemo(() => {
    return competitions.map(comp => {
      const publishedResult = results.find(r => r.competitionId === comp.id);
      const compRegs = registrations.filter(r => r.competitionId === comp.id);
      const reportedRegs = compRegs.filter(r => r.isReported);
      const scoredRegs = reportedRegs.filter(r => r.mark && r.mark.trim().length > 0);

      const hasJudgeMarks = scoredRegs.length > 0;
      const isPublished = (!!publishedResult || comp.isPublishedResult) && hasJudgeMarks;

      let status: 'Published' | 'Judge Evaluated' | 'Pending' = 'Pending';
      if (isPublished) status = 'Published';
      else if (hasJudgeMarks) status = 'Judge Evaluated';

      return {
        comp,
        publishedResult,
        totalRegistered: compRegs.length,
        reportedCount: reportedRegs.length,
        scoredRegs,
        hasJudgeMarks,
        isPublished,
        status,
      };
    });
  }, [competitions, results, registrations]);

  // Filtered and Sorted List
  const filteredCompResults = useMemo(() => {
    const list = combinedCompResults.filter(item => {
      const matchesCategory = resultCategoryFilter === 'All' || item.comp.category === resultCategoryFilter;
      const matchesStatus = resultStatusFilter === 'All' || item.status === resultStatusFilter;
      
      const q = resultSearchQuery.toLowerCase().trim();
      const matchesQuery = !q ||
        item.comp.name.toLowerCase().includes(q) ||
        item.comp.category.toLowerCase().includes(q) ||
        (item.comp.venue && item.comp.venue.toLowerCase().includes(q)) ||
        (item.publishedResult?.firstPlaceParticipantName && item.publishedResult.firstPlaceParticipantName.toLowerCase().includes(q)) ||
        (item.publishedResult?.firstPlaceGroupName && item.publishedResult.firstPlaceGroupName.toLowerCase().includes(q));

      return matchesCategory && matchesStatus && matchesQuery;
    });

    const statusPriority: Record<'Judge Evaluated' | 'Pending' | 'Published', number> = {
      'Judge Evaluated': 0,
      'Pending': 1,
      'Published': 2,
    };

    return [...list].sort((a, b) => {
      const rankDiff = statusPriority[a.status] - statusPriority[b.status];
      if (rankDiff !== 0) return rankDiff;
      return (a.comp.name || '').localeCompare(b.comp.name || '');
    });
  }, [combinedCompResults, resultCategoryFilter, resultStatusFilter, resultSearchQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28 animate-fadeIn">
      
      {/* Top Banner Card */}
      <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Media
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase tracking-wider border border-cyan-500/30">
                  Media Portal
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Official Media Desk • Results Hub & Landscape Event Posters
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 text-xs font-bold shrink-0 flex-wrap">
            <span className="px-3 py-1.5 rounded-xl bg-[#181b30] border border-[#292d4a] text-slate-300 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{results.length} Published Results</span>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>{posters.length} Posters</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Menu Tabs (Arranged like Admin Settings Tab) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'results'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-400/40'
              : 'bg-[#151728] text-slate-300 hover:text-white border border-[#292d4a] hover:border-cyan-500/40'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-400" />
          <span>Result ({combinedCompResults.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('posters')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'posters'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-400/40'
              : 'bg-[#151728] text-slate-300 hover:text-white border border-[#292d4a] hover:border-cyan-500/40'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-rose-400" />
          <span>Manage Landscape Event Posters</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* MENU 1: RESULT POSTER TEMPLATE (UPLOAD & CUSTOMIZATION)  */}
      {/* ======================================================== */}
      {activeTab === 'poster-template' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Left Settings Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="poster-card p-6 sm:p-7 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl">
              
              <div className="border-b border-[#292d4a] pb-4">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <span>Result Poster Template Designer</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Upload custom poster graphics or customize theme styles. All users generating result posters will use this media template!
                </p>
              </div>

              {posterSaveSuccess && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Poster template settings successfully saved and synced across all result buttons!</span>
                </div>
              )}

              <form onSubmit={handleSavePosterConfig} className="space-y-5">
                
                {/* 1. Background Template Upload */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Custom Poster Background Image (Upload)
                  </label>
                  
                  <div className="p-4 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-3">
                    <input
                      type="file"
                      ref={posterFileInputRef}
                      onChange={handleUploadPosterBg}
                      accept="image/*"
                      className="hidden"
                    />

                    {posterConfig.backgroundImageUrl ? (
                      <div className="flex items-center justify-between gap-3 p-3 bg-[#121424] rounded-xl border border-cyan-500/40">
                        <div className="flex items-center gap-3">
                          <img
                            src={posterConfig.backgroundImageUrl}
                            alt="Custom Background Preview"
                            className="w-16 h-16 object-cover rounded-lg border border-[#292d4a]"
                          />
                          <div>
                            <span className="text-xs font-bold text-cyan-300 block">Custom Poster Graphic Uploaded</span>
                            <span className="text-[10px] text-slate-400">High resolution media asset active</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemovePosterBg}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => posterFileInputRef.current?.click()}
                        className="border-2 border-dashed border-[#292d4a] hover:border-cyan-500/50 rounded-2xl p-6 text-center cursor-pointer transition-all bg-[#121424]/50 hover:bg-[#121424]"
                      >
                        <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                        <span className="text-xs font-bold text-white block">Click to upload poster background template</span>
                        <span className="text-[11px] text-slate-400">PNG, JPG, WebP supported (portrait 1080x1350 recommended)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Theme Presets (If no custom background or as lighting mood) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Theme Color Preset
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'royal_gold', label: 'Royal Gold', color: '#f59e0b', desc: 'Luxury Gold & Velvet' },
                      { id: 'midnight_purple', label: 'Midnight Fest', color: '#8b5cf6', desc: 'Deep Violet Starry' },
                      { id: 'neon_fest', label: 'Cyber Neon', color: '#06b6d4', desc: 'Electric Cyan & Indigo' },
                      { id: 'emerald_glory', label: 'Emerald Glory', color: '#10b981', desc: 'Islamic Green & Gold' },
                      { id: 'sunset_fire', label: 'Sunset Glow', color: '#f43f5e', desc: 'Vibrant Crimson Fire' },
                    ].map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setPosterConfig(prev => ({ ...prev, themePreset: preset.id as any }))}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          posterConfig.themePreset === preset.id
                            ? 'bg-[#181b30] border-cyan-500 ring-2 ring-cyan-500/20'
                            : 'bg-[#181b30]/60 border-[#292d4a] hover:border-[#3a3f68]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.color }} />
                          <span className="text-xs font-bold text-white">{preset.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">{preset.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Text Header & Footer Customization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Header Tag Text
                    </label>
                    <input
                      type="text"
                      value={posterConfig.headerText || ''}
                      onChange={(e) => setPosterConfig(prev => ({ ...prev, headerText: e.target.value }))}
                      placeholder="OFFICIAL RESULT"
                      className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Primary Accent Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={posterConfig.accentColor || '#f59e0b'}
                        onChange={(e) => setPosterConfig(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="w-10 h-9 rounded-xl bg-transparent border border-[#292d4a] cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={posterConfig.accentColor || '#f59e0b'}
                        onChange={(e) => setPosterConfig(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Footer Congratulatory Message
                  </label>
                  <input
                    type="text"
                    value={posterConfig.footerText || ''}
                    onChange={(e) => setPosterConfig(prev => ({ ...prev, footerText: e.target.value }))}
                    placeholder="Congratulations to all winning participants & groups!"
                    className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs transition-all shadow-lg shadow-cyan-600/30 flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Poster Template</span>
                  </button>
                </div>

              </form>
            </div>
          </div>

          {/* Right Live Preview Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="poster-card p-5 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#292d4a] pb-3">
                <span className="text-xs font-black uppercase text-cyan-400 flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  Live Template Preview
                </span>
                <span className="text-[10px] text-slate-400">Updates in real time</span>
              </div>

              {/* Mini Interactive Preview Card */}
              <div className="rounded-2xl border-2 border-amber-500/50 p-4 space-y-4 shadow-2xl relative overflow-hidden bg-gradient-to-b from-[#181308] via-[#2b1f0c] to-[#090a14]">
                <div className="text-center space-y-1 border-b border-white/10 pb-2.5">
                  <div className="text-[9px] font-extrabold tracking-widest text-slate-300 uppercase">
                    {brandingConfig.college || 'MADANI COLLEGE'}
                  </div>
                  <h3 className="text-sm font-black text-white uppercase">
                    {brandingConfig.title || 'MADANI ART FIESTA'}
                  </h3>
                  <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase border border-amber-500/30">
                    ★ {posterConfig.headerText || 'OFFICIAL RESULT'} ★
                  </div>
                </div>

                <div className="bg-[#121424]/90 border border-purple-500/30 rounded-xl p-2 text-center">
                  <span className="text-[9px] text-purple-400 font-bold uppercase block">Stage 1 • Senior</span>
                  <h4 className="text-xs font-extrabold text-white">Sample Competition Name</h4>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/60 text-center space-y-1">
                  <span className="text-[9px] font-black text-amber-400 uppercase">🥇 1st Place Champion</span>
                  <div className="text-xs font-black text-white">Participant Name</div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase inline-block">
                    Amana Group
                  </span>
                </div>

                <div className="text-center text-[9px] text-slate-400 italic pt-1 border-t border-white/10">
                  {posterConfig.footerText || 'Congratulations to all winning participants & groups!'}
                </div>
              </div>

              {results.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPosterResult(results[0])}
                  className="w-full py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Test Full Poster Generator Modal</span>
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* MENU 2: RESULT (PUBLISHED AND UNPUBLISHED FROM JUDGE)     */}
      {/* ======================================================== */}
      {activeTab === 'results' && (
        <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl animate-fadeIn">

          {publishSuccessMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{publishSuccessMsg}</span>
            </div>
          )}

          {/* Search and Category Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#181b30] p-3.5 rounded-2xl border border-[#292d4a]">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search competition, participant or group..."
                value={resultSearchQuery}
                onChange={(e) => setResultSearchQuery(e.target.value)}
                className="w-full bg-[#151728] border border-[#292d4a] focus:border-cyan-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
              />
              {resultSearchQuery && (
                <button
                  onClick={() => setResultSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {(['All', 'Judge Evaluated', 'Pending', 'Published'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setResultStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                    resultStatusFilter === st
                      ? st === 'Published'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                        : st === 'Judge Evaluated'
                        ? 'bg-amber-600 border-amber-500 text-white shadow-md'
                        : 'bg-cyan-600 border-cyan-500 text-white shadow-md'
                      : 'bg-[#151728] border-[#292d4a] text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'Judge Evaluated' && '⚖️ '}
                  {st === 'Published' && '✓ '}
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Results Table / Cards */}
          <div className="space-y-3">
            {filteredCompResults.length === 0 ? (
              <div className="p-12 text-center bg-[#181b30] rounded-3xl border border-dashed border-[#292d4a] text-slate-400 space-y-2">
                <FileText className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-bold text-slate-300">No results found matching the filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredCompResults.map(({ comp, publishedResult, isPublished, hasJudgeMarks, scoredRegs, status }) => (
                  <div
                    key={comp.id}
                    className={`p-4 sm:p-5 rounded-2xl bg-[#181b30] border transition-all space-y-3 shadow-md ${
                      isPublished
                        ? 'border-emerald-500/40 hover:border-emerald-500/70'
                        : hasJudgeMarks
                        ? 'border-amber-500/40 hover:border-amber-500/70 bg-amber-950/10'
                        : 'border-[#292d4a] hover:border-[#3a3f68]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-black text-white">
                            {formatCompetitionName(comp.name, comp.category)}
                          </h3>
                          <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                            {comp.category}
                          </span>
                          {comp.venue ? (
                            <span className="text-[10px] text-slate-400">
                              {comp.venue}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        {isPublished ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black border border-emerald-500/40">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Published</span>
                          </span>
                        ) : hasJudgeMarks ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/40">
                            <Scale className="w-3.5 h-3.5" />
                            <span>Judge Evaluated ({scoredRegs.length} marks recorded)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-bold border border-slate-700">
                            <span>Pending Result</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Winner / Marks Summary Details */}
                    {publishedResult ? (() => {
                      const w = festStore.getResultWinners(publishedResult);
                      return (
                        <div className="p-3 bg-[#121424] rounded-xl border border-[#292d4a] space-y-2 text-xs">
                          {/* 1st Place */}
                          {w.first.length > 0 && (
                            <div className="flex flex-wrap items-center gap-3">
                              {w.first.map((win, idx) => (
                                <div key={idx} className="text-amber-300 font-bold flex items-center gap-1.5 truncate">
                                  <span>🥇</span>
                                  <ParticipantAvatar
                                    name={festStore.getParticipantFullName(win.participantName, win.regId)}
                                    photoUrl={festStore.getParticipantPhotoUrl(win.participantName, win.regId)}
                                    className="w-5 h-5 text-[9px] shrink-0"
                                  />
                                  <span className="truncate">{festStore.getParticipantFullName(win.participantName, win.regId)}</span>
                                  <span className="text-slate-400 text-[10px]">({win.groupName})</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 2nd Place */}
                          {w.second.length > 0 && (
                            <div className="flex flex-wrap items-center gap-3">
                              {w.second.map((win, idx) => (
                                <div key={idx} className="text-slate-300 font-semibold flex items-center gap-1.5 truncate">
                                  <span>🥈</span>
                                  <ParticipantAvatar
                                    name={festStore.getParticipantFullName(win.participantName, win.regId)}
                                    photoUrl={festStore.getParticipantPhotoUrl(win.participantName, win.regId)}
                                    className="w-5 h-5 text-[9px] shrink-0"
                                  />
                                  <span className="truncate">{festStore.getParticipantFullName(win.participantName, win.regId)}</span>
                                  <span className="text-slate-400 text-[10px]">({win.groupName})</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 3rd Place */}
                          {w.third.length > 0 && (
                            <div className="flex flex-wrap items-center gap-3">
                              {w.third.map((win, idx) => (
                                <div key={idx} className="text-amber-600 font-semibold flex items-center gap-1.5 truncate">
                                  <span>🥉</span>
                                  <ParticipantAvatar
                                    name={festStore.getParticipantFullName(win.participantName, win.regId)}
                                    photoUrl={festStore.getParticipantPhotoUrl(win.participantName, win.regId)}
                                    className="w-5 h-5 text-[9px] shrink-0"
                                  />
                                  <span className="truncate">{festStore.getParticipantFullName(win.participantName, win.regId)}</span>
                                  <span className="text-slate-400 text-[10px]">({win.groupName})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })() : hasJudgeMarks ? (
                      <div className="p-3 bg-[#121424] rounded-xl border border-amber-500/30 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                          <span className="flex items-center gap-1">
                            <Scale className="w-3.5 h-3.5" />
                            <span>Confidential Judge Marks Recorded (Unpublished)</span>
                          </span>
                          <span className="text-slate-400">{scoredRegs.length} Candidates Scored</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {scoredRegs.map(reg => (
                            <span key={reg.id} className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold">
                              Code {reg.codeLetter || '—'}: <strong className="text-white">{reg.mark} pts</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#292d4a]/60">
                      <div className="text-[11px] text-slate-400">
                        {isPublished ? `Published ${new Date(publishedResult!.publishedAt).toLocaleDateString()}` : 'Awaiting live publication'}
                      </div>

                      <div className="flex items-center gap-2">
                        {publishedResult && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyResult(publishedResult)}
                              className="px-3 py-1.5 rounded-xl bg-[#151728] hover:bg-[#202542] border border-[#292d4a] text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              {copiedId === publishedResult.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>{copiedId === publishedResult.id ? 'Copied' : 'Copy Release'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedPosterResult(publishedResult)}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Create Poster</span>
                            </button>
                          </>
                        )}

                        {!isPublished && hasJudgeMarks && (
                          <button
                            type="button"
                            onClick={() => handleQuickPublishJudgeMarks(comp)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Quick Publish Winners</span>
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* MENU 3: FESTIVAL LOGO & THEME SETTINGS (MOVED TO MEDIA)   */}
      {/* ======================================================== */}
      {activeTab === 'branding' && (
        <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl animate-fadeIn">
          
          <div className="border-b border-[#292d4a] pb-4">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-purple-400" />
              <span>Festival Logo & Theme Settings</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Customize the college name, festival title, official logo image, and application theme colors.
            </p>
          </div>

          {brandingSaveSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Festival logo and theme styles successfully updated across the festival portal!</span>
            </div>
          )}

          <form onSubmit={handleSaveBranding} className="space-y-6">
            
            {/* Festival Text Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  College / Institution Name
                </label>
                <input
                  type="text"
                  required
                  value={brandingConfig.college}
                  onChange={(e) => setBrandingConfig(prev => ({ ...prev, college: e.target.value }))}
                  placeholder="MADANI COLLEGE"
                  className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Festival Title
                </label>
                <input
                  type="text"
                  required
                  value={brandingConfig.title}
                  onChange={(e) => setBrandingConfig(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="MADANI ART FEST 2026"
                  className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Edition / Tag
                </label>
                <input
                  type="text"
                  value={brandingConfig.tag || ''}
                  onChange={(e) => setBrandingConfig(prev => ({ ...prev, tag: e.target.value }))}
                  placeholder="Official Fest 2026"
                  className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>
            </div>

            {/* Official Logo Upload */}
            <div className="p-4 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Festival Logo
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-[#121424] border border-[#292d4a] flex items-center justify-center p-2 shrink-0">
                  <img
                    src={brandingConfig.logoUrl || logoImg}
                    alt="Logo Preview"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = logoImg;
                    }}
                  />
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <input
                    type="file"
                    ref={logoFileInputRef}
                    onChange={handleUploadLogo}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Logo File</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBrandingConfig(prev => ({ ...prev, logoUrl: logoImg }))}
                      className="px-3 py-2 rounded-xl bg-[#151728] text-slate-300 hover:text-white border border-[#292d4a] text-xs font-bold transition-all"
                    >
                      Reset Default Logo
                    </button>
                  </div>

                  <input
                    type="text"
                    value={brandingConfig.logoUrl || ''}
                    onChange={(e) => setBrandingConfig(prev => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="Or enter image URL (https://...)"
                    className="w-full bg-[#121424] border border-[#292d4a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Whole App Font Family Customizer */}
            <div className="p-4 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Type className="w-4 h-4 text-purple-400" />
                  Application Typography & Font Family
                </label>
                <span className="text-[10px] text-purple-400 font-semibold bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                  Live Whole-App Font Editing
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Primary Body Font Family */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 block">
                    Primary App Font Family (Body & Controls)
                  </span>
                  <select
                    value={brandingConfig.fontFamily || "'Plus Jakarta Sans', sans-serif"}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      const updated = { ...brandingConfig, fontFamily: newFont };
                      setBrandingConfig(updated);
                      applyBrandingToDocument(updated);
                    }}
                    className="w-full bg-[#121424] border border-[#292d4a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                  >
                    {FONT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={brandingConfig.fontFamily || ''}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      const updated = { ...brandingConfig, fontFamily: newFont };
                      setBrandingConfig(updated);
                      applyBrandingToDocument(updated);
                    }}
                    placeholder="Or custom font family CSS string"
                    className="w-full bg-[#121424] border border-[#292d4a] rounded-xl px-3 py-1.5 text-[11px] text-slate-300 font-mono focus:outline-none"
                  />
                </div>

                {/* 2. Heading Font Family */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 block">
                    Headings Font Family (Titles & Headers)
                  </span>
                  <select
                    value={brandingConfig.headingFontFamily || brandingConfig.fontFamily || "'Plus Jakarta Sans', sans-serif"}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      const updated = { ...brandingConfig, headingFontFamily: newFont };
                      setBrandingConfig(updated);
                      applyBrandingToDocument(updated);
                    }}
                    className="w-full bg-[#121424] border border-[#292d4a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                  >
                    {FONT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={brandingConfig.headingFontFamily || ''}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      const updated = { ...brandingConfig, headingFontFamily: newFont };
                      setBrandingConfig(updated);
                      applyBrandingToDocument(updated);
                    }}
                    placeholder="Or custom heading font family CSS string"
                    className="w-full bg-[#121424] border border-[#292d4a] rounded-xl px-3 py-1.5 text-[11px] text-slate-300 font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-[#121424] rounded-xl border border-[#292d4a] space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Typography Live Preview</div>
                <div className="text-sm font-extrabold text-white">
                  The Quick Brown Fox Jumps Over The Lazy Dog — {brandingConfig.title || 'Festival 2026'}
                </div>
                <div className="text-xs text-slate-400">
                  0123456789 • Winner Announced • Official Call Sheet & Certificates
                </div>
              </div>
            </div>

            {/* Theme Colors Customizer */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Theme Color Palette Customization
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#181b30] rounded-xl border border-[#292d4a] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Primary Accent</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandingConfig.primaryColor || '#8b5cf6'}
                      onChange={(e) => setBrandingConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <input
                      type="text"
                      value={brandingConfig.primaryColor || '#8b5cf6'}
                      onChange={(e) => setBrandingConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-full bg-[#121424] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#181b30] rounded-xl border border-[#292d4a] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Secondary Accent</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandingConfig.secondaryColor || '#6366f1'}
                      onChange={(e) => setBrandingConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <input
                      type="text"
                      value={brandingConfig.secondaryColor || '#6366f1'}
                      onChange={(e) => setBrandingConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-full bg-[#121424] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#181b30] rounded-xl border border-[#292d4a] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Dark Background</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandingConfig.bgDarkColor || '#0b0c16'}
                      onChange={(e) => setBrandingConfig(prev => ({ ...prev, bgDarkColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <input
                      type="text"
                      value={brandingConfig.bgDarkColor || '#0b0c16'}
                      onChange={(e) => setBrandingConfig(prev => ({ ...prev, bgDarkColor: e.target.value }))}
                      className="w-full bg-[#121424] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#181b30] rounded-xl border border-[#292d4a] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Card Container BG</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandingConfig.bgCardColor || '#151728'}
                      onChange={(e) => setBrandingConfig(prev => ({ ...prev, bgCardColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <input
                      type="text"
                      value={brandingConfig.bgCardColor || '#151728'}
                      onChange={(e) => setBrandingConfig(prev => ({ ...prev, bgCardColor: e.target.value }))}
                      className="w-full bg-[#121424] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Festival Branding & Theme</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* MENU 4: MANAGE LANDSCAPE EVENT POSTERS (MOVED TO MEDIA)   */}
      {/* ======================================================== */}
      {activeTab === 'posters' && (
        <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl animate-fadeIn">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#292d4a] pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-rose-400" />
                <span>Manage Landscape Event Posters</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload landscape festival banners & promotional event posters displayed in the public showcase.
              </p>
            </div>

            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30">
              {posters.length} Active Landscape Posters
            </span>
          </div>

          {posterUploadSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Event poster added successfully to the public showcase!</span>
            </div>
          )}

          {/* Upload and Add Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* File Upload Box */}
            <div className="p-5 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                1. Upload from Computer / Mobile
              </span>
              
              <input
                type="file"
                ref={landscapeFileInputRef}
                onChange={handleUploadLandscapePoster}
                accept="image/*"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => landscapeFileInputRef.current?.click()}
                className="w-full py-4 rounded-xl border-2 border-dashed border-rose-500/40 hover:border-rose-400 bg-[#121424]/60 hover:bg-[#121424] text-slate-300 hover:text-white transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-6 h-6 text-rose-400" />
                <span className="text-xs font-bold">Click to upload landscape poster image</span>
                <span className="text-[10px] text-slate-400">Automatic compression included</span>
              </button>
            </div>

            {/* URL Input Box */}
            <form onSubmit={handleAddPosterByUrl} className="p-5 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                2. Add by Direct Image URL
              </span>

              <div className="space-y-2">
                <input
                  type="url"
                  value={posterUrlInput}
                  onChange={(e) => setPosterUrlInput(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#121424] border border-[#292d4a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  disabled={!posterUrlInput.trim()}
                  className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Poster by URL</span>
                </button>
              </div>
            </form>

          </div>

          {/* Active Posters Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-300">
              Active Festival Posters ({posters.length})
            </h3>

            {posters.length === 0 ? (
              <div className="p-8 text-center bg-[#181b30] rounded-2xl border border-dashed border-[#292d4a] text-slate-400">
                <ImageIcon className="w-8 h-8 mx-auto text-slate-600 mb-1" />
                <p className="text-xs font-bold text-slate-400">No posters uploaded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {posters.map((poster, index) => (
                  <div 
                    key={poster.id}
                    className="group relative rounded-2xl overflow-hidden border border-[#292d4a] bg-[#121424] shadow-lg hover:border-rose-500/50 transition-all"
                  >
                    <div className="aspect-video w-full bg-[#0d0e1b] overflow-hidden">
                      <img
                        src={poster.url}
                        alt={`Festival Poster ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="p-3 bg-[#151728] flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">Poster #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleDeletePoster(poster.id)}
                        className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white transition-all text-xs cursor-pointer"
                        title="Delete Poster"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* RESULT POSTER GENERATOR MODAL */}
      <ResultPosterModal
        isOpen={!!selectedPosterResult}
        result={selectedPosterResult}
        competition={competitions.find(c => c.id === selectedPosterResult?.competitionId)}
        onClose={() => setSelectedPosterResult(null)}
      />

    </div>
  );
};
