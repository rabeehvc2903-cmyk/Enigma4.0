import React, { useState, useEffect } from 'react';
import { UserProfile, Competition, Registration, CategoryType, Group } from '../types';
import { festStore, formatCompetitionName } from '../lib/store';
import { Users, UserPlus, Trophy, CheckCircle2, AlertCircle, Key, Calendar, ShieldCheck, Trash2, Search, Lock, ChevronDown, Filter, X, Pencil, CheckSquare, Square, CheckCheck, Check } from 'lucide-react';
import { ParticipantAvatar } from './ParticipantAvatar';

interface LeaderDashboardProps {
  currentUser: UserProfile;
  groups: Group[];
  competitions: Competition[];
  registrations: Registration[];
  profiles: UserProfile[];
  onRefresh: () => void;
}

export const LeaderDashboard: React.FC<LeaderDashboardProps> = ({
  currentUser,
  groups,
  competitions,
  registrations,
  profiles,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'register_event'>('roster');

  // Find assigned group
  const myGroup = groups.find(g => g.id === currentUser.groupId) || groups[0];
  const [, setStoreVer] = useState(0);

  useEffect(() => {
    const unsub = festStore.subscribe(() => {
      setStoreVer(v => v + 1);
    });
    return unsub;
  }, []);

  const groupConfig = festStore.getParticipantIdConfig(myGroup?.id);
  const isPartAddLocked = !!groupConfig.isLocked;
  const isCompRegLocked = !!groupConfig.isCompLocked;

  // Filter participants in leader's group
  const myParticipants = profiles.filter(
    p => p.role === 'participant' && p.groupId === myGroup.id
  );

  // Search/Dropdown States for Competition Enrollment
  const [compSearchQuery, setCompSearchQuery] = useState('');
  const [compCategoryFilter, setCompCategoryFilter] = useState('All');
  const [compTypeFilter, setCompTypeFilter] = useState('All');

  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [partCategoryFilter, setPartCategoryFilter] = useState('All');
  const [partLevelFilter, setPartLevelFilter] = useState('All');

  const [isCompDropdownOpen, setIsCompDropdownOpen] = useState(false);
  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState(false);

  // --- ADD PARTICIPANT FORM STATE ---
  const categoriesList = festStore.getCategories().filter(cat => cat.toLowerCase() !== 'general');
  const levelsList = festStore.getLevels();
  const [partName, setPartName] = useState('');
  const [partFatherName, setPartFatherName] = useState('');
  const [partDept, setPartDept] = useState(levelsList[0] || '1');
  const [partCategory, setPartCategory] = useState<CategoryType>(categoriesList[0] || 'Senior');

  // Keep partCategory and partDept in sync with updates from admin
  useEffect(() => {
    const list = festStore.getCategories().filter(cat => cat.toLowerCase() !== 'general');
    if (list.length > 0) {
      if (!partCategory || partCategory.toLowerCase() === 'general' || !list.includes(partCategory)) {
        setPartCategory(list[0]);
      }
    }
  }, [categoriesList.join(',')]);

  useEffect(() => {
    const list = festStore.getLevels();
    if (list.length > 0) {
      if (!partDept || !list.includes(partDept)) {
        setPartDept(list[0]);
      }
    }
  }, [levelsList.join(',')]);
  const [createdStudent, setCreatedStudent] = useState<{ name: string; fatherName?: string; userId: string; pass?: string } | null>(null);
  const [partError, setPartError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('All');
  const [isPartFilterOpen, setIsPartFilterOpen] = useState(false);
  const activePartFiltersCount = (selectedCategoryFilter !== 'All' ? 1 : 0) + (selectedLevelFilter !== 'All' ? 1 : 0);
  const [enrollmentCompFilter, setEnrollmentCompFilter] = useState<string>('All');
  const [enrollmentSearchQuery, setEnrollmentSearchQuery] = useState<string>('');
  const [enrollmentCompDropdownOpen, setEnrollmentCompDropdownOpen] = useState(false);
  const [enrollmentCompSearchText, setEnrollmentCompSearchText] = useState('');
  const [enrollmentCompCategoryTab, setEnrollmentCompCategoryTab] = useState('All');
  const enrollmentCompDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (enrollmentCompDropdownRef.current && !enrollmentCompDropdownRef.current.contains(event.target as Node)) {
        setEnrollmentCompDropdownOpen(false);
      }
    };
    if (enrollmentCompDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [enrollmentCompDropdownOpen]);

  const filteredParticipants = myParticipants.filter(p => {
    // 1. Search term filter
    const term = participantSearch.trim().toLowerCase();
    if (term) {
      const match = (
        p.name.toLowerCase().includes(term) ||
        (p.fatherName && p.fatherName.toLowerCase().includes(term)) ||
        p.userId.toLowerCase().includes(term) ||
        (p.department && p.department.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term))
      );
      if (!match) return false;
    }

    // 2. Category filter
    if (selectedCategoryFilter !== 'All') {
      if (!p.category || p.category.toLowerCase() !== selectedCategoryFilter.toLowerCase()) {
        return false;
      }
    }

    // 3. Level filter
    if (selectedLevelFilter !== 'All') {
      if (!p.department || p.department.toLowerCase() !== selectedLevelFilter.toLowerCase()) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    const numA = parseInt(a.userId?.replace(/\D/g, '') || '', 10);
    const numB = parseInt(b.userId?.replace(/\D/g, '') || '', 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return (a.userId || '').localeCompare(b.userId || '', undefined, { numeric: true, sensitivity: 'base' });
  });

  // --- EDIT PARTICIPANT MODAL STATE ---
  const [editingParticipant, setEditingParticipant] = useState<UserProfile | null>(null);
  const [editPartName, setEditPartName] = useState('');
  const [editPartFatherName, setEditPartFatherName] = useState('');
  const [editPartDept, setEditPartDept] = useState('');
  const [editPartCat, setEditPartCat] = useState<CategoryType>('Senior');
  const [editPartError, setEditPartError] = useState('');
  const [editPartSuccess, setEditPartSuccess] = useState('');

  // Automatically close edit modal if Participant Add Status becomes locked
  useEffect(() => {
    if (isPartAddLocked && editingParticipant) {
      setEditingParticipant(null);
    }
  }, [isPartAddLocked, editingParticipant]);

  const handleStartEditParticipant = (part: UserProfile) => {
    if (isPartAddLocked) {
      alert('Participant editing is locked because Participant Add Status is closed by the Administrator.');
      return;
    }
    setEditingParticipant(part);
    setEditPartName(part.name || '');
    setEditPartFatherName(part.fatherName || '');
    setEditPartDept(part.department || levelsList[0] || '1');
    setEditPartCat((part.category as CategoryType) || (categoriesList[0] as CategoryType) || 'Senior');
    setEditPartError('');
    setEditPartSuccess('');
  };

  const handleSaveEditParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    setEditPartError('');
    setEditPartSuccess('');

    if (isPartAddLocked) {
      setEditPartError('Participant editing is locked because Participant Add Status is closed by the Administrator.');
      return;
    }

    if (!editPartName.trim()) {
      setEditPartError('Participant Name is required');
      return;
    }

    if (!editPartFatherName.trim()) {
      setEditPartError('Second Name (Father Name) is required');
      return;
    }

    if (!editingParticipant) return;

    try {
      const res = festStore.updateProfileCredentials(editingParticipant.id, {
        userId: editingParticipant.userId,
        name: editPartName.trim(),
        fatherName: editPartFatherName.trim(),
        department: editPartDept,
        category: editPartCat,
      });

      if (res.success) {
        setEditPartSuccess(res.message);
        setTimeout(() => {
          setEditingParticipant(null);
          onRefresh();
        }, 500);
      } else {
        setEditPartError(res.message);
      }
    } catch (err: any) {
      setEditPartError(err.message || 'Failed to update participant');
    }
  };

  const handleDeleteParticipant = (profileId: string) => {
    if (isPartAddLocked) {
      alert('Participant deletion is locked because Participant Add Status is closed by the Administrator.');
      return;
    }
    festStore.deleteProfile(profileId);
    onRefresh();
    setConfirmDeleteId(null);
  };

  // --- REGISTER COMPETITION FORM STATE ---
  const [selectedCompId, setSelectedCompId] = useState('');
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [regMsg, setRegMsg] = useState<{ success: boolean; text: string } | null>(null);

  const toggleSelectParticipant = (partId: string) => {
    setSelectedPartIds(prev => 
      prev.includes(partId) ? prev.filter(id => id !== partId) : [...prev, partId]
    );
  };

  const selectAllFilteredParticipants = (filteredIds: string[]) => {
    setSelectedPartIds(prev => {
      const set = new Set([...prev, ...filteredIds]);
      return Array.from(set);
    });
  };

  const deselectFilteredParticipants = (filteredIds: string[]) => {
    setSelectedPartIds(prev => prev.filter(id => !filteredIds.includes(id)));
  };

  const clearAllSelectedParticipants = () => {
    setSelectedPartIds([]);
  };

  // Add Participant Handler
  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    setPartError('');
    setCreatedStudent(null);

    if (!partName.trim()) {
      setPartError('Please fill out Participant Name');
      return;
    }

    if (!partFatherName.trim()) {
      setPartError('Please fill out Second Name(Father Name)');
      return;
    }

    try {
      const newPart = festStore.addParticipant(
        myGroup.id,
        partName.trim(),
        partDept || levelsList[0] || '1',
        partCategory,
        undefined,
        partFatherName.trim()
      );

      setCreatedStudent({
        name: newPart.name,
        fatherName: newPart.fatherName,
        userId: newPart.userId
      });

      setPartName('');
      setPartFatherName('');
      onRefresh();
    } catch (err: any) {
      setPartError(err.message || 'Error creating participant');
    }
  };

  // Register Participant to Competition Handler
  const handleRegisterToComp = (e: React.FormEvent) => {
    e.preventDefault();
    setRegMsg(null);

    if (!selectedCompId || selectedPartIds.length === 0) {
      setRegMsg({ success: false, text: 'Please select both competition and at least one participant.' });
      return;
    }

    const res = festStore.registerMultipleParticipantsToComp(selectedCompId, selectedPartIds);
    setRegMsg({ success: res.success, text: res.summary });

    if (res.success) {
      setSelectedCompId('');
      setSelectedPartIds([]);
      onRefresh();
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 py-2 sm:py-6 pb-24">
      
      {/* Group Banner */}
      <div 
        className="poster-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-purple-500/40 bg-gradient-to-br from-[#151728] via-[#17192f] to-[#121422] shadow-2xl relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Group Info */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div 
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-lg border border-white/15 flex items-center justify-center shrink-0 text-white font-black text-lg sm:text-xl select-none"
              style={{ backgroundColor: myGroup.color || '#a855f7' }}
            >
              {myGroup.name ? myGroup.name.trim().charAt(0).toUpperCase() : 'G'}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-400 truncate">
                Group Leader Dashboard
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white truncate tracking-tight leading-tight">
                {myGroup.name}
              </h1>
              <p className="text-xs text-slate-300 truncate">
                Leader: <span className="font-semibold text-white">{myGroup.leaderName}</span>
              </p>
            </div>
          </div>

          {/* Right: Points & Medals Badge */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-center sm:flex-col sm:items-end gap-2.5 sm:gap-1 bg-[#181b30]/90 sm:bg-[#181b30] px-4 py-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-[#292d4a]">
            <div className="flex items-baseline gap-1.5 sm:text-right">
              <span className="text-[11px] font-semibold text-slate-400 sm:hidden">Score:</span>
              <div className="text-xl sm:text-2xl font-black font-mono text-purple-300">
                {myGroup.totalPoints} <span className="text-xs font-sans font-bold text-slate-400">PTS</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-2 text-[11px] font-bold text-slate-300">
              <span className="inline-flex items-center gap-1 bg-[#151728] sm:bg-transparent px-2 py-0.5 sm:p-0 rounded-lg">
                <span>🥇</span> <span>{myGroup.goldCount}</span>
              </span>
              <span className="inline-flex items-center gap-1 bg-[#151728] sm:bg-transparent px-2 py-0.5 sm:p-0 rounded-lg">
                <span>🥈</span> <span>{myGroup.silverCount}</span>
              </span>
              <span className="inline-flex items-center gap-1 bg-[#151728] sm:bg-transparent px-2 py-0.5 sm:p-0 rounded-lg">
                <span>🥉</span> <span>{myGroup.bronzeCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 border-b border-[#292d4a] pb-3 text-xs font-bold uppercase">
        <button
          onClick={() => setActiveTab('roster')}
          className={`w-full sm:w-auto px-3 sm:px-4 py-2.5 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center gap-2 text-center cursor-pointer min-h-[42px] ${
            activeTab === 'roster'
              ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/40'
              : 'text-slate-400 hover:text-white bg-[#181b30]'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span className="truncate">Team Participants ({myParticipants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('register_event')}
          className={`w-full sm:w-auto px-3 sm:px-4 py-2.5 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center gap-2 text-center cursor-pointer min-h-[42px] ${
            activeTab === 'register_event'
              ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/40'
              : 'text-slate-400 hover:text-white bg-[#181b30]'
          }`}
        >
          <Trophy className="w-4 h-4 shrink-0" />
          <span className="truncate">Competition Enrollments</span>
        </button>
      </div>

      {/* TAB 1: TEAM PARTICIPANTS & ADD PARTICIPANT */}
      {activeTab === 'roster' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Participant Form */}
          <div className="poster-card p-4 sm:p-6 bg-[#151728] rounded-2xl sm:rounded-3xl border border-[#292d4a] space-y-4 h-fit shadow-xl">
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-400" />
                Add Team Participant
              </h2>
            </div>

            {partError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/40 text-rose-400 font-semibold text-xs rounded-2xl">
                {partError}
              </div>
            )}

            {/* Created Student Badge Notification */}
            {createdStudent && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400 uppercase">
                  <span>Participant Added!</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-1 font-mono text-white">
                  <div>Participant Name: <strong className="text-white">{createdStudent.name} {createdStudent.fatherName || ''}</strong></div>
                  <div>Chest No: <strong className="text-purple-400 font-bold">{createdStudent.userId}</strong></div>
                </div>
              </div>
            )}

            {isPartAddLocked ? (
              <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-center space-y-3 flex flex-col items-center justify-center py-10">
                <Lock className="w-10 h-10 text-rose-500" />
                <div className="space-y-1">
                  <h4 className="font-extrabold text-white text-sm">Registration Closed</h4>
                  <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed mx-auto">
                    Participant registration has been closed by the Admin. Adding new participants is currently locked.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddParticipant} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block uppercase text-slate-300 mb-1">
                    Participant Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Type Name"
                    value={partName}
                    onChange={(e) => setPartName(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block uppercase text-slate-300 mb-1">
                    Second Name(Father Name) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Type Father Name"
                    value={partFatherName}
                    onChange={(e) => setPartFatherName(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block uppercase text-slate-300 mb-1">Level</label>
                  <select
                    value={partDept}
                    onChange={(e) => setPartDept(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white text-sm focus:outline-none"
                  >
                    {levelsList.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block uppercase text-slate-300 mb-1">Category</label>
                  <select
                    value={partCategory}
                    onChange={(e: any) => setPartCategory(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] p-3 rounded-2xl text-white text-sm focus:outline-none"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="poster-btn-primary w-full py-3 text-xs rounded-2xl">
                  <span>Add Participant</span>
                </button>
              </form>
            )}
          </div>

          {/* Participant Table */}
          <div className="lg:col-span-2 poster-card p-4 sm:p-6 bg-[#151728] rounded-2xl sm:rounded-3xl border border-[#292d4a] space-y-4 shadow-xl">
            {isPartAddLocked && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-rose-300 text-xs font-semibold">
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Participant Add Status is Closed. Participant editing and additions are locked by the Administrator.</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">Team Participants</h2>
                <span className="text-xs font-mono text-slate-400">Total: {myParticipants.length}</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Filter Button & Popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsPartFilterOpen(!isPartFilterOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      activePartFiltersCount > 0
                        ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/25'
                        : isPartFilterOpen
                        ? 'bg-[#292d4a] border-purple-500 text-white'
                        : 'bg-[#181b30] border-[#292d4a] text-slate-300 hover:text-white hover:border-purple-500/50'
                    }`}
                    title="Filter Participants"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter</span>
                    {activePartFiltersCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-white text-purple-700 text-[10px] font-black leading-none">
                        {activePartFiltersCount}
                      </span>
                    )}
                  </button>

                  {/* Filter Dropdown Popover */}
                  {isPartFilterOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20 cursor-default"
                        onClick={() => setIsPartFilterOpen(false)}
                      />
                      <div className="absolute left-0 z-30 mt-2 w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] bg-[#151728] border border-[#292d4a] rounded-2xl shadow-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="flex items-center justify-between pb-2 border-b border-[#292d4a]/60">
                          <div className="flex items-center gap-1.5">
                            <Filter className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Filter Participants</span>
                          </div>
                          {activePartFiltersCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategoryFilter('All');
                                setSelectedLevelFilter('All');
                              }}
                              className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold hover:underline cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {/* Category Filter */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Category
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedCategoryFilter('All')}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                selectedCategoryFilter === 'All'
                                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                                  : 'bg-[#181b30] hover:bg-[#292d4a] text-slate-400 hover:text-white border-[#292d4a]'
                              }`}
                            >
                              All Categories
                            </button>
                            {categoriesList.map(cat => (
                              <button
                                type="button"
                                key={cat}
                                onClick={() => setSelectedCategoryFilter(cat)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                  selectedCategoryFilter === cat
                                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                                    : 'bg-[#181b30] hover:bg-[#292d4a] text-slate-400 hover:text-white border-[#292d4a]'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Level Filter */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Level
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedLevelFilter('All')}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                selectedLevelFilter === 'All'
                                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                                  : 'bg-[#181b30] hover:bg-[#292d4a] text-slate-400 hover:text-white border-[#292d4a]'
                              }`}
                            >
                              All Levels
                            </button>
                            {levelsList.map(lvl => (
                              <button
                                type="button"
                                key={lvl}
                                onClick={() => setSelectedLevelFilter(lvl)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                  selectedLevelFilter === lvl
                                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                                    : 'bg-[#181b30] hover:bg-[#292d4a] text-slate-400 hover:text-white border-[#292d4a]'
                                }`}
                              >
                                {lvl.replace(/^Level\s+/i, '')}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#292d4a]/60 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setIsPartFilterOpen(false)}
                            className="px-3 py-1 bg-[#181b30] hover:bg-[#292d4a] text-slate-300 hover:text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Search Filter Input */}
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by name, level, chest no..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                  {participantSearch && (
                    <button
                      type="button"
                      onClick={() => setParticipantSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[10px] text-slate-500 hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Active Filters Bar */}
            {activePartFiltersCount > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs pt-0.5">
                <span className="text-slate-400 text-[11px] font-medium">Active filters:</span>
                {selectedCategoryFilter !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800 text-[11px] font-bold">
                    Category: {selectedCategoryFilter}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-white ml-0.5"
                      onClick={() => setSelectedCategoryFilter('All')}
                    />
                  </span>
                )}
                {selectedLevelFilter !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800 text-[11px] font-bold">
                    Level: {selectedLevelFilter.replace(/^Level\s+/i, '')}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-white ml-0.5"
                      onClick={() => setSelectedLevelFilter('All')}
                    />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryFilter('All');
                    setSelectedLevelFilter('All');
                  }}
                  className="text-[11px] text-purple-400 hover:text-purple-300 hover:underline font-semibold cursor-pointer ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#181b30] text-slate-400 font-bold uppercase border-b border-[#292d4a]">
                  <tr>
                    <th className="p-3">Chest No</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Level</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#292d4a] text-slate-200 font-medium">
                  {filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                        No participants found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredParticipants.map((part) => (
                      <tr key={part.id} className="hover:bg-[#181b30]">
                        <td className="p-3 font-mono font-bold text-purple-400">{part.userId}</td>
                        <td className="p-3 font-bold text-white">
                          <div className="flex items-center gap-2.5">
                            <ParticipantAvatar name={part.name} photoUrl={part.photoUrl} className="w-7 h-7 border border-purple-500/30" />
                            <div>{part.name}{part.fatherName ? ` ${part.fatherName}` : ''}</div>
                          </div>
                        </td>
                        <td className="p-3 text-slate-400">{part.department.replace(/^Level\s+/i, '')}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {part.category || 'N/A'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {isPartAddLocked ? (
                            <div className="flex items-center justify-end">
                              <span
                                className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold cursor-not-allowed select-none"
                                title="Participant editing and deletion are locked because Participant Add Status is closed by Admin"
                              >
                                <Lock className="w-3 h-3 text-rose-400" />
                                <span>Edit Locked</span>
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditParticipant(part)}
                                className="p-1.5 bg-[#181b30] hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 rounded-lg transition-all border border-[#292d4a] cursor-pointer"
                                title="Edit Participant"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {confirmDeleteId === part.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParticipant(part.id)}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-1 bg-[#292d4a] hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(part.id)}
                                  className="p-1.5 bg-[#181b30] hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition-all border border-[#292d4a] cursor-pointer"
                                  title="Delete Participant"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ENROLL PARTICIPANT INTO COMPETITION */}
      {activeTab === 'register_event' && (
        <div className="poster-card p-4 sm:p-6 bg-[#151728] rounded-2xl sm:rounded-3xl border border-[#292d4a] space-y-6 shadow-xl">
          {regMsg && (
            <div className={`p-3 border rounded-2xl text-xs font-semibold flex items-center gap-2 ${
              regMsg.success 
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
            }`}>
              {regMsg.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {regMsg.text}
            </div>
          )}

          {isCompRegLocked ? (
            <div className="p-8 bg-rose-500/5 border border-rose-500/20 rounded-3xl text-center space-y-3 flex flex-col items-center justify-center py-12">
              <Lock className="w-12 h-12 text-rose-500" />
              <div className="space-y-1">
                <h4 className="font-extrabold text-white text-base">Competition Registration Closed</h4>
                <p className="text-xs text-slate-400 max-w-[320px] leading-relaxed mx-auto">
                  Competition registration is currently closed by the Admin. Enrolling or changing participant nominations is locked.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegisterToComp} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Select Competition */}
                <div className="relative">
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-2">
                    1. Pick Competition
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompDropdownOpen(!isCompDropdownOpen);
                        setIsPartDropdownOpen(false);
                      }}
                      className="w-full bg-[#181b30] border border-[#292d4a] hover:border-purple-500/50 rounded-2xl p-3 text-sm text-white font-bold text-left focus:outline-none flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span className="truncate">
                        {selectedCompId ? (() => {
                          const comp = competitions.find(c => c.id === selectedCompId);
                          if (!comp) return 'Choose Competition';
                          return (
                            <span className="flex items-center gap-2 truncate">
                              <span className="truncate">{comp.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-normal shrink-0">
                                {comp.category || 'General'} • {comp.type}
                              </span>
                            </span>
                          );
                        })() : 'Choose Competition'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>

                    {isCompDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-20 cursor-default" 
                          onClick={() => setIsCompDropdownOpen(false)} 
                        />
                        <div className="absolute z-30 w-full mt-2 bg-[#151728] border border-[#292d4a] rounded-2xl shadow-2xl p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
                          {/* Search Input */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="Type to search competition..."
                              value={compSearchQuery}
                              onChange={(e) => setCompSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                              autoFocus
                            />
                          </div>

                          {/* Filter Options inside Dropdown */}
                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Filter Category</label>
                              <select
                                value={compCategoryFilter}
                                onChange={(e) => setCompCategoryFilter(e.target.value)}
                                className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-2 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
                              >
                                <option value="All">All Categories</option>
                                {festStore.getCategories().map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Filter Type</label>
                              <select
                                value={compTypeFilter}
                                onChange={(e) => setCompTypeFilter(e.target.value)}
                                className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-2 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
                              >
                                <option value="All">All Types</option>
                                <option value="Individual">Individual</option>
                                <option value="Group">Group</option>
                              </select>
                            </div>
                          </div>

                          {/* Results List */}
                          <div className="max-h-52 overflow-y-auto divide-y divide-[#292d4a]/50 pr-1">
                            {(() => {
                              const filteredComps = competitions.filter(comp => {
                                const matchQuery = comp.name.toLowerCase().includes(compSearchQuery.toLowerCase());
                                const matchCategory = compCategoryFilter === 'All' || (comp.category && comp.category.toLowerCase() === compCategoryFilter.toLowerCase());
                                const matchType = compTypeFilter === 'All' || comp.type === compTypeFilter;
                                return matchQuery && matchCategory && matchType;
                              });

                              if (filteredComps.length === 0) {
                                return <div className="text-xs text-slate-500 italic p-3 text-center">No competitions found</div>;
                              }

                              return filteredComps.map((comp) => (
                                <button
                                  type="button"
                                  key={comp.id}
                                  onClick={() => {
                                    setSelectedCompId(comp.id);
                                    setIsCompDropdownOpen(false);
                                    setCompSearchQuery('');
                                    if (comp.category && comp.category.toLowerCase() !== 'general') {
                                      setPartCategoryFilter(comp.category);
                                    }
                                  }}
                                  className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all hover:bg-purple-600/20 hover:text-white cursor-pointer flex items-center justify-between gap-2 ${
                                    selectedCompId === comp.id ? 'bg-purple-600 text-white' : 'text-slate-300'
                                  }`}
                                >
                                  <span className="truncate">{comp.name}</span>
                                  <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                                    {comp.category && (
                                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">{comp.category}</span>
                                    )}
                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">{comp.type}</span>
                                  </div>
                                </button>
                              ));
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Select Participant (Multi-select) */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase text-slate-300">
                      2. Pick Team Participant(s)
                    </label>
                    {selectedPartIds.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllSelectedParticipants}
                        className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer transition-colors"
                      >
                        Clear All ({selectedPartIds.length})
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPartDropdownOpen(!isPartDropdownOpen);
                        setIsCompDropdownOpen(false);
                      }}
                      className="w-full bg-[#181b30] border border-[#292d4a] hover:border-purple-500/50 rounded-2xl p-3 text-sm text-white font-bold text-left focus:outline-none flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span className="truncate">
                        {selectedPartIds.length === 0 ? (
                          <span className="text-slate-400 font-normal">Choose Participant(s)...</span>
                        ) : selectedPartIds.length === 1 ? (() => {
                          const p = myParticipants.find(part => part.id === selectedPartIds[0]);
                          if (!p) return 'Choose Participant(s)...';
                          return (
                            <span className="flex items-center gap-2 truncate">
                              <span className="truncate">{p.name}{p.fatherName ? ` ${p.fatherName}` : ''}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-normal shrink-0 font-mono">
                                Chest No: {p.userId}
                              </span>
                            </span>
                          );
                        })() : (
                          <span className="flex items-center gap-2 truncate">
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-black">
                              {selectedPartIds.length} Selected
                            </span>
                            <span className="text-xs text-slate-300 truncate font-normal">
                              {selectedPartIds.map(id => myParticipants.find(p => p.id === id)?.name).filter(Boolean).slice(0, 3).join(', ')}
                              {selectedPartIds.length > 3 ? ` +${selectedPartIds.length - 3} more` : ''}
                            </span>
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {selectedPartIds.length > 0 && (
                          <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-black flex items-center justify-center">
                            {selectedPartIds.length}
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isPartDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Selected Participant Chips List */}
                    {selectedPartIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {selectedPartIds.map(id => {
                          const p = myParticipants.find(part => part.id === id);
                          if (!p) return null;
                          return (
                            <div 
                              key={id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#1c203a] border border-purple-500/30 text-slate-200 text-xs shadow-sm animate-in fade-in zoom-in-95 duration-100"
                            >
                              <span className="font-bold text-white text-[11px] truncate max-w-[140px]">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-purple-300 font-mono">
                                #{p.userId}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectParticipant(id);
                                }}
                                className="w-4 h-4 rounded-full bg-slate-700/80 hover:bg-rose-500/80 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer ml-0.5"
                                title="Remove participant"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isPartDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-20 cursor-default" 
                          onClick={() => setIsPartDropdownOpen(false)} 
                        />
                        <div className="absolute z-30 w-full mt-2 bg-[#151728] border border-[#292d4a] rounded-2xl shadow-2xl p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
                          {/* Search Input */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="Type to search participant name, chest no..."
                              value={partSearchQuery}
                              onChange={(e) => setPartSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-7 py-2 bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                              autoFocus
                            />
                            {partSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setPartSearchQuery('')}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Filter Options inside Dropdown */}
                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Filter Category</label>
                              <select
                                value={partCategoryFilter}
                                onChange={(e) => setPartCategoryFilter(e.target.value)}
                                className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-2 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
                              >
                                <option value="All">All Categories</option>
                                {categoriesList.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Filter Level</label>
                              <select
                                value={partLevelFilter}
                                onChange={(e) => setPartLevelFilter(e.target.value)}
                                className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-2 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
                              >
                                <option value="All">All Levels</option>
                                {levelsList.map(lvl => (
                                  <option key={lvl} value={lvl}>{lvl}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Multi-Select Toolbar (Select All / Clear / Done) */}
                          {(() => {
                            const filteredParts = myParticipants.filter(part => {
                              const matchQuery = 
                                part.name.toLowerCase().includes(partSearchQuery.toLowerCase()) ||
                                (part.fatherName && part.fatherName.toLowerCase().includes(partSearchQuery.toLowerCase())) ||
                                part.userId.toLowerCase().includes(partSearchQuery.toLowerCase()) ||
                                (part.department && part.department.toLowerCase().includes(partSearchQuery.toLowerCase()));
                              const matchCategory = partCategoryFilter === 'All' || (part.category && part.category.toLowerCase() === partCategoryFilter.toLowerCase());
                              const matchLevel = partLevelFilter === 'All' || (part.department && part.department.toLowerCase() === partLevelFilter.toLowerCase());
                              return matchQuery && matchCategory && matchLevel;
                            });

                            const filteredIds = filteredParts.map(p => p.id);
                            const areAllFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedPartIds.includes(id));

                            return (
                              <>
                                <div className="flex items-center justify-between pt-1 border-t border-[#292d4a]/60 text-xs">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (areAllFilteredSelected) {
                                          deselectFilteredParticipants(filteredIds);
                                        } else {
                                          selectAllFilteredParticipants(filteredIds);
                                        }
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
                                    >
                                      <CheckCheck className="w-3.5 h-3.5" />
                                      <span>{areAllFilteredSelected ? 'Unselect Filtered' : `Select All Filtered (${filteredParts.length})`}</span>
                                    </button>

                                    {selectedPartIds.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={clearAllSelectedParticipants}
                                        className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setIsPartDropdownOpen(false)}
                                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shadow-sm transition-all cursor-pointer"
                                  >
                                    Done ({selectedPartIds.length})
                                  </button>
                                </div>

                                {/* Results List */}
                                <div className="max-h-56 overflow-y-auto divide-y divide-[#292d4a]/50 pr-1 custom-scrollbar">
                                  {filteredParts.length === 0 ? (
                                    <div className="text-xs text-slate-500 italic p-3 text-center">No participants found</div>
                                  ) : (
                                    filteredParts.map((part) => {
                                      const isSelected = selectedPartIds.includes(part.id);
                                      return (
                                        <button
                                          type="button"
                                          key={part.id}
                                          onClick={() => toggleSelectParticipant(part.id)}
                                          className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all hover:bg-purple-600/20 cursor-pointer flex items-center justify-between gap-2.5 ${
                                            isSelected 
                                              ? 'bg-purple-600/20 text-white border border-purple-500/40' 
                                              : 'text-slate-300 hover:text-white'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="shrink-0 text-purple-400">
                                              {isSelected ? (
                                                <CheckSquare className="w-4 h-4 text-purple-400" />
                                              ) : (
                                                <Square className="w-4 h-4 text-slate-500" />
                                              )}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="truncate font-bold text-white">
                                                {part.name}{part.fatherName ? ` ${part.fatherName}` : ''}
                                              </div>
                                              <div className="text-[10px] text-purple-300 font-mono font-semibold">
                                                Chest No: {part.userId}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex flex-col items-end gap-1 text-[10px] shrink-0">
                                            {part.category && (
                                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
                                                {part.category}
                                              </span>
                                            )}
                                            {part.department && (
                                              <span className="px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-300">
                                                {part.department.replace(/^Level\s+/i, 'Lvl ')}
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                </div>

                {/* Selected Participant(s) Limit Quota Status */}
                {selectedPartIds.length > 0 && (() => {
                  const selectedComp = competitions.find(c => c.id === selectedCompId);
                  const isGroupComp = selectedComp?.type === 'Group';
                  const isCompStage = selectedComp ? (selectedComp.isStage !== undefined ? selectedComp.isStage : festStore.isStageVenue(selectedComp.venue)) : null;

                  if (selectedPartIds.length === 1) {
                    const part = myParticipants.find(p => p.id === selectedPartIds[0]);
                    if (!part) return null;
                    const stats = festStore.getParticipantEnrollmentStats(part.id);

                    return (
                      <div className="p-3.5 rounded-2xl bg-[#141626] border border-[#262a47] space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                          <span className="font-bold text-slate-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-400" />
                            {part.name}{part.fatherName ? ` ${part.fatherName}` : ''} ({stats.category}) Individual Limits
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            {stats.groupEventsCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-semibold">
                                {stats.groupEventsCount} Group Event{stats.groupEventsCount > 1 ? 's' : ''} (Free)
                              </span>
                            )}
                            <span>
                              Individual: {stats.totalCount} / {stats.stageLimit + stats.offStageLimit}
                            </span>
                          </div>
                        </div>

                        {isGroupComp && (
                          <div className="p-2 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              Selected: Group Competition ({selectedComp?.name})
                            </span>
                            <span className="text-[10px] uppercase font-bold text-blue-300 px-1.5 py-0.5 rounded bg-blue-500/20">
                              Unlimited per student
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <div className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                            stats.isStageLimitReached
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              : isCompStage === true && !isGroupComp
                              ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                              : 'bg-[#181b30] border-[#22253f] text-slate-300'
                          }`}>
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Stage (Ind.)</div>
                              <div className="font-black text-sm">
                                {stats.stageCount} / {stats.stageLimit}
                              </div>
                            </div>
                            {stats.isStageLimitReached ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">Max Reached</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">{stats.stageLimit - stats.stageCount} left</span>
                            )}
                          </div>

                          <div className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                            stats.isOffStageLimitReached
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              : isCompStage === false && !isGroupComp
                              ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                              : 'bg-[#181b30] border-[#22253f] text-slate-300'
                          }`}>
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Off-Stage (Ind.)</div>
                              <div className="font-black text-sm">
                                {stats.offStageCount} / {stats.offStageLimit}
                              </div>
                            </div>
                            {stats.isOffStageLimitReached ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">Max Reached</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">{stats.offStageLimit - stats.offStageCount} left</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Multiple participants selected overview
                  return (
                    <div className="p-3.5 rounded-2xl bg-[#141626] border border-[#262a47] space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-400" />
                          {selectedPartIds.length} Selected Participants Quota Overview
                        </span>
                        {isGroupComp ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">
                            Group Event (No Limit Deduction)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Checking individual event quotas
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {selectedPartIds.map(id => {
                          const part = myParticipants.find(p => p.id === id);
                          if (!part) return null;
                          const stats = festStore.getParticipantEnrollmentStats(part.id);
                          const isBlocked = !isGroupComp && (
                            (isCompStage === true && stats.isStageLimitReached) ||
                            (isCompStage === false && stats.isOffStageLimitReached)
                          );

                          return (
                            <div 
                              key={id}
                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                isBlocked 
                                  ? 'bg-rose-950/20 border-rose-500/40' 
                                  : 'bg-[#181b30] border-[#22253f]'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate text-[11px]">{part.name}</div>
                                <div className="text-[10px] text-purple-300 font-mono">#{part.userId} • {stats.category}</div>
                              </div>
                              <div className="text-right shrink-0">
                                {isBlocked ? (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                                    Limit Full
                                  </span>
                                ) : (
                                  <div className="text-[10px] text-slate-300">
                                    <span className="text-purple-300 font-bold">{stats.stageLimit - stats.stageCount}</span> stg / <span className="text-indigo-300 font-bold">{stats.offStageLimit - stats.offStageCount}</span> off
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <button 
                  type="submit" 
                  disabled={selectedPartIds.length === 0 || !selectedCompId}
                  className="poster-btn-primary w-full py-3.5 text-xs rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {selectedPartIds.length === 0 
                      ? 'Enroll Participant(s) Into Competition' 
                      : selectedPartIds.length === 1 
                      ? 'Enroll 1 Participant Into Competition' 
                      : `Enroll ${selectedPartIds.length} Participants Into Competition`}
                  </span>
                </button>
              </form>
            )}

          {/* Current Group Enrollments Table */}
          <div className="pt-6 border-t border-[#292d4a] space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Current Group Enrollments</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#181b30] border border-[#292d4a] text-purple-300 font-mono font-bold">
                  {registrations.filter(r => r.groupId === myGroup.id).length}
                </span>
              </div>
              
              {/* Search & Competition Filter Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Enrollments Input */}
                <div className="relative min-w-[200px] sm:min-w-[240px] flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by student, chest no, or event..."
                    value={enrollmentSearchQuery}
                    onChange={(e) => setEnrollmentSearchQuery(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                  {enrollmentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setEnrollmentSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Searchable Competition Filter with Global Search Bar Inside */}
                <div className="relative flex items-center gap-2" ref={enrollmentCompDropdownRef}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 hidden sm:inline">Filter:</span>
                  <button
                    type="button"
                    onClick={() => setEnrollmentCompDropdownOpen(!enrollmentCompDropdownOpen)}
                    className={`flex items-center gap-2 bg-[#181b30] border transition-all rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer max-w-[240px] ${
                      enrollmentCompFilter !== 'All'
                        ? 'border-purple-500/60 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                        : 'border-[#292d4a] text-white hover:border-slate-600'
                    }`}
                    title="Filter enrollments by competition"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">
                      {enrollmentCompFilter === 'All'
                        ? 'All Competitions'
                        : competitions.find((c) => c.id === enrollmentCompFilter)?.name || 'Competition'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto transition-transform ${enrollmentCompDropdownOpen ? 'rotate-180 text-purple-400' : ''}`} />
                  </button>

                  {/* Dropdown Popover with Search Bar Inside */}
                  {enrollmentCompDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#16182a] border border-[#2e3357] rounded-2xl shadow-2xl z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                      {/* Search Bar Inside Dropdown */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-purple-400 absolute left-3 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          autoFocus
                          value={enrollmentCompSearchText}
                          onChange={(e) => setEnrollmentCompSearchText(e.target.value)}
                          placeholder="Search competitions, category..."
                          className="w-full pl-8 pr-7 py-1.5 bg-[#121424] border border-[#2e3357] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
                        />
                        {enrollmentCompSearchText && (
                          <button
                            type="button"
                            onClick={() => setEnrollmentCompSearchText('')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Category Filter Pills Inside Dropdown */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[10px]">
                        {['All', ...Array.from(new Set(competitions.map((c) => c.category).filter(Boolean)))].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setEnrollmentCompCategoryTab(cat)}
                            className={`px-2 py-0.5 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                              enrollmentCompCategoryTab === cat
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f233f]'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Competitions List */}
                      <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {/* All Competitions Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setEnrollmentCompFilter('All');
                            setEnrollmentCompDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                            enrollmentCompFilter === 'All'
                              ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                              : 'text-slate-300 hover:bg-[#1f233f] hover:text-white font-medium'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            <span>All Competitions</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {registrations.filter((r) => r.groupId === myGroup.id).length} regs
                          </span>
                        </button>

                        {/* Filtered list of competitions */}
                        {(() => {
                          const term = enrollmentCompSearchText.trim().toLowerCase();
                          const matches = competitions.filter((comp) => {
                            const matchesCat = enrollmentCompCategoryTab === 'All' || comp.category === enrollmentCompCategoryTab;
                            if (!matchesCat) return false;
                            if (!term) return true;
                            return (
                              comp.name.toLowerCase().includes(term) ||
                              (comp.category && comp.category.toLowerCase().includes(term)) ||
                              (comp.venue && comp.venue.toLowerCase().includes(term)) ||
                              (comp.code && comp.code.toLowerCase().includes(term))
                            );
                          });

                          if (matches.length === 0) {
                            return (
                              <div className="py-4 text-center text-xs text-slate-400">
                                No competitions found
                              </div>
                            );
                          }

                          return matches.map((comp) => {
                            const isSelected = enrollmentCompFilter === comp.id;
                            const groupRegCount = registrations.filter(
                              (r) => r.groupId === myGroup.id && r.competitionId === comp.id
                            ).length;
                            return (
                              <button
                                key={comp.id}
                                type="button"
                                onClick={() => {
                                  setEnrollmentCompFilter(comp.id);
                                  setEnrollmentCompDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                                  isSelected
                                    ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                                    : 'text-slate-300 hover:bg-[#1f233f] hover:text-white font-medium'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="truncate">{comp.name}</div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                    <span className="px-1.5 py-0.2 rounded bg-[#121424] text-slate-300 border border-[#2e3357]">
                                      {comp.category}
                                    </span>
                                    {comp.venue && <span className="truncate">{comp.venue}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {groupRegCount} enrolled
                                  </span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#181b30] text-slate-400 font-bold uppercase border-b border-[#292d4a]">
                  <tr>
                    <th className="p-3">Competition</th>
                    <th className="p-3">Participant</th>
                    <th className="p-3">Chest No.</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#292d4a] text-slate-200">
                  {(() => {
                    const filteredRegs = registrations.filter(r => {
                      if (r.groupId !== myGroup.id) return false;
                      if (enrollmentCompFilter !== 'All' && r.competitionId !== enrollmentCompFilter) return false;
                      if (enrollmentSearchQuery.trim()) {
                        const q = enrollmentSearchQuery.trim().toLowerCase();
                        const compObj = competitions.find(c => c.id === r.competitionId);
                        const compName = (compObj?.name || '').toLowerCase();
                        const compCat = (compObj?.category || '').toLowerCase();
                        const partName = (r.participantName || '').toLowerCase();
                        const chestNo = (r.participantUserId || '').toLowerCase();
                        const fullPartName = festStore.getParticipantFullName(r.participantName, r.id).toLowerCase();
                        
                        const matches = 
                          compName.includes(q) || 
                          compCat.includes(q) || 
                          partName.includes(q) || 
                          fullPartName.includes(q) || 
                          chestNo.includes(q);
                        
                        if (!matches) return false;
                      }
                      return true;
                    });

                    if (filteredRegs.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500 italic">
                            {enrollmentSearchQuery.trim() || enrollmentCompFilter !== 'All' 
                              ? 'No enrollments found matching your search or filter criteria.'
                              : 'No enrollments recorded for your group yet.'}
                          </td>
                        </tr>
                      );
                    }
                    return filteredRegs.map((reg) => (
                      <tr key={reg.id} className="hover:bg-purple-950/20 transition-colors">
                        <td className="p-3 font-bold text-amber-400">
                          {competitions.find(c => c.id === reg.competitionId)?.name}
                        </td>
                        <td className="p-3 font-bold text-white">{festStore.getParticipantFullName(reg.participantName, reg.id)}</td>
                        <td className="p-3 font-mono text-purple-400 font-bold">{reg.participantUserId}</td>
                        <td className="p-3 text-right">
                          {isCompRegLocked ? (
                            <span 
                              className="inline-flex items-center gap-1 text-slate-500 text-[10px] uppercase font-bold bg-[#181b30] border border-slate-700/30 px-2 py-1 rounded-lg cursor-not-allowed select-none"
                              title="Withdrawal is locked because Competition Registration is closed by Admin"
                            >
                              <Lock className="w-3 h-3 text-slate-500" />
                              <span>Locked</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (isCompRegLocked) {
                                  alert('Withdrawal is locked because Competition Registration is closed by Admin.');
                                  return;
                                }
                                festStore.cancelRegistration(reg.id);
                                onRefresh();
                              }}
                              className="text-rose-400 hover:text-rose-300 text-[11px] uppercase font-bold cursor-pointer hover:underline"
                            >
                              Withdraw
                            </button>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* EDIT PARTICIPANT MODAL */}
      {editingParticipant && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-md w-full bg-[#151728] border border-purple-500/50 p-6 rounded-3xl space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#292d4a] pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-extrabold">
                <Pencil className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-lg font-extrabold text-white">Edit Team Participant</h3>
                  <div className="text-[11px] font-mono text-purple-400 font-bold">Chest No: {editingParticipant.userId}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingParticipant(null)}
                className="p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editPartSuccess && (
              <div className="p-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{editPartSuccess}</span>
              </div>
            )}

            {editPartError && (
              <div className="p-3 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editPartError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditParticipant} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="block uppercase text-slate-300">
                  Participant Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editPartName}
                  onChange={(e) => setEditPartName(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white text-sm focus:outline-none"
                  placeholder="Type Name"
                />
              </div>

              <div className="space-y-1">
                <label className="block uppercase text-slate-300">
                  Second Name (Father Name) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editPartFatherName}
                  onChange={(e) => setEditPartFatherName(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white text-sm focus:outline-none"
                  placeholder="Type Father Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block uppercase text-slate-300">Level</label>
                  <select
                    value={editPartDept}
                    onChange={(e) => setEditPartDept(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white text-sm focus:outline-none"
                  >
                    {levelsList.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block uppercase text-slate-300">Category</label>
                  <select
                    value={editPartCat}
                    onChange={(e: any) => setEditPartCat(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white text-sm focus:outline-none"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#292d4a]">
                <button
                  type="button"
                  onClick={() => setEditingParticipant(null)}
                  className="px-4 py-2.5 rounded-2xl bg-[#181b30] hover:bg-[#202440] text-slate-300 text-xs font-bold border border-[#292d4a] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="poster-btn-primary px-5 py-2.5 text-xs rounded-2xl cursor-pointer"
                >
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
