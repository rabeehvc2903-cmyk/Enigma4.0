import React, { useState, useEffect, useMemo } from 'react';
import { Group, Competition, UserProfile, Registration, Result, LeaderboardEntry, CategoryType, CompCategory, FestNotification, AdminTabType, PerformancePointConfig, SocialLinksConfig } from '../types';
import { festStore, formatCompetitionName, formatStageName } from '../lib/store';
import { FONT_OPTIONS, applyBrandingToDocument } from '../lib/branding';
import { Shield, Plus, Award, Trophy, Users, Edit, Edit3, Check, CheckCircle2, AlertCircle, Trash2, KeyRound, X, Tag, Search, Filter, SlidersHorizontal, Sliders, Info, MinusCircle, Minus, MapPin, Layers, Sparkles, Image, Upload, Palette, BookOpen, Music, Clock, Bell, Megaphone, Lock, Unlock, MoreVertical, Eye, EyeOff, Calendar, Settings, LogOut, ClipboardList, Printer, Shuffle, RotateCcw, RefreshCw, FileText, CheckCircle, Wand2, LayoutDashboard, FileSpreadsheet, HardDrive, Download, Database, Scale, Radio, Type, Save, Landmark, MessageSquare, Instagram, Youtube, Facebook, Twitter, Globe, MessageCircle, Share2, QrCode, ChevronDown } from 'lucide-react';
import { compressImage } from '../lib/imageUtils';
import logoImg from '../assets/images/logo-01.png';
import { CompetitionScheduleView } from './CompetitionScheduleView';
import { CreateScheduleModal } from './CreateScheduleModal';
import { FestOverviewView } from './FestOverviewView';
import { PrintDayScheduleModal } from './PrintDayScheduleModal';
import { PrintParticipantsReportModal } from './PrintParticipantsReportModal';
import { PrintValuationSheetModal } from './PrintValuationSheetModal';
import { ParticipantAvatar } from './ParticipantAvatar';
import { ManageLimitsModal } from './ManageLimitsModal';
import { BulkQrExportModal } from './BulkQrExportModal';
import { downloadBulkQrZip, openPrintableQrSheet } from '../lib/qrExport';
import { formatDayDateWithWeekday, normalizeScheduleString } from '../lib/scheduler';

// Helper to parse existing scheduleTime string into components for date/time controls
const parseScheduleTime = (timeStr: string): { date: string; time: string } => {
  let date = '';
  let time = '';

  if (!timeStr) return { date: '', time: '' };

  // Check if string contains custom dd-mm-yy or dd-mm-yyyy date format
  const dmyMatch = timeStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    let y = dmyMatch[3];
    if (y.length === 2) y = '20' + y;
    date = `${y}-${m}-${d}`;
  } else {
    // Check for YYYY-MM-DD
    const isoMatch = timeStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      date = isoMatch[0];
    }
  }

  // Extract time parts (HH:mm:ss) or (HH:mm with AM/PM)
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (timeMatch) {
    let hrs = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2];
    const ampm = timeMatch[4];

    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hrs < 12) hrs += 12;
      if (ampm.toUpperCase() === 'AM' && hrs === 12) hrs = 0;
    }
    time = `${String(hrs).padStart(2, '0')}:${mins}`;
  }

  return { date, time };
};

// Helper to format date ("YYYY-MM-DD") and time ("HH:mm") into a combined "DD-MM-YYYY Weekday, HH:mm" string
const formatScheduleTime = (dateStr: string, timeStr: string): string => {
  if (!dateStr && !timeStr) return '';
  if (!dateStr) return timeStr || '';
  const formattedDay = formatDayDateWithWeekday(dateStr);
  if (!formattedDay) return timeStr || '';
  return timeStr ? `${formattedDay}, ${timeStr}` : formattedDay;
};

const isCompetitionScheduled = (comp: Competition): boolean => {
  if (comp.status === 'completed' || Boolean(comp.isPublishedResult)) return true;
  if (comp.scheduleTime && comp.scheduleTime.trim() && comp.scheduleTime !== 'Unscheduled / TBA') return true;
  if (comp.venue && comp.venue.trim()) return true;
  return false;
};

// Inline editable row component for Competition Schedule Table
const ScheduleTableRow: React.FC<{
  comp: Competition;
  stagesList: string[];
  onOpenEditModal: (comp: Competition) => void;
  onDeleteComp: (id: string, name: string) => void;
}> = ({ comp, stagesList, onOpenEditModal, onDeleteComp }) => {
  const parsed = parseScheduleTime(comp.scheduleTime);
  const [venue, setVenue] = useState(comp.venue || '');
  const [date, setDate] = useState(parsed.date);
  const [time, setTime] = useState(parsed.time);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const p = parseScheduleTime(comp.scheduleTime);
    setVenue(comp.venue || '');
    setDate(p.date);
    setTime(p.time);
  }, [comp.scheduleTime, comp.venue, stagesList]);

  const handleSave = (newVenue = venue, newDate = date, newTime = time) => {
    const formatted = formatScheduleTime(newDate, newTime);
    // Scheduled competitions only assigned to stages:
    const assignedVenue = formatted ? (newVenue || stagesList[0] || 'Stage 1') : '';
    festStore.updateCompetition({
      ...comp,
      venue: assignedVenue,
      scheduleTime: formatted,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <tr className="border-b border-[#292d4a]/60 hover:bg-[#181b30]/60 transition-colors">
      <td className="py-3 px-4">
        <div className="font-extrabold text-white text-sm leading-tight">{comp.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
            {comp.category}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {comp.type === 'Group' ? `Group (${comp.teamSize || 4} members)` : comp.type}
          </span>
        </div>
      </td>

      <td className="py-3 px-4">
        <select
          value={date && time ? venue : ''}
          onChange={(e) => {
            const v = e.target.value;
            setVenue(v);
            handleSave(v, date, time);
          }}
          disabled={!date || !time}
          title={!date || !time ? 'Set date & time first to schedule and assign a stage' : undefined}
          className="bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-bold focus:outline-none w-full max-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(!date || !time) && (
            <option value="">To Be Announced (Unscheduled)</option>
          )}
          {stagesList.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
          {venue && !stagesList.includes(venue) && (
            <option value={venue}>{venue}</option>
          )}
        </select>
      </td>

      <td className="py-3 px-4">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            const d = e.target.value;
            setDate(d);
            handleSave(venue, d, time);
          }}
          className="bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
        />
      </td>

      <td className="py-3 px-4">
        <input
          type="time"
          value={time}
          onChange={(e) => {
            const t = e.target.value;
            setTime(t);
            handleSave(venue, date, t);
          }}
          className="bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
        />
      </td>

      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {saved ? (
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          ) : (
            <button
              onClick={() => handleSave()}
              className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" /> Save
            </button>
          )}
          <button
            onClick={() => onOpenEditModal(comp)}
            className="p-1.5 rounded-lg bg-[#181b30] hover:bg-purple-500 text-slate-400 hover:text-white border border-[#292d4a] transition-all"
            title="Edit Full Details"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteComp(comp.id, comp.name)}
            className="p-1.5 rounded-lg bg-[#181b30] hover:bg-rose-500 text-slate-400 hover:text-white border border-[#292d4a] transition-all"
            title="Delete Competition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

const calculatePerformancePoints = (
  score: number,
  type: 'Individual' | 'Group',
  teamSize: number = 4
): { grade: string; points: number } => {
  const s = Math.round(score);
  const config = festStore.getPerformancePointConfig();
  const rules = config.rules || [];

  // Find matching rule based on score range
  let matchedRule = rules.find(r => s >= r.minScore && s <= r.maxScore);
  if (!matchedRule) {
    matchedRule = { grade: 'No Grade', minScore: 0, maxScore: 0, individual: 0, group2: 0, group3: 0, group4Plus: 0 };
  }

  const grade = matchedRule.grade;
  if (grade === 'No Grade' || matchedRule.minScore === 0 && matchedRule.maxScore === 0) {
    return { grade: 'No Grade', points: 0 };
  }

  let points = 0;
  if (type === 'Individual') {
    points = matchedRule.individual;
  } else {
    const size = teamSize || 4;
    if (size === 2) {
      points = matchedRule.group2;
    } else if (size === 3) {
      points = matchedRule.group3;
    } else {
      points = matchedRule.group4Plus;
    }
  }

  return { grade, points };
};

interface CodeLetterInputProps {
  initialValue: string;
  onSave: (val: string) => void;
  disabled?: boolean;
}

const CodeLetterInput: React.FC<CodeLetterInputProps> = ({
  initialValue,
  onSave,
  disabled
}) => {
  const [val, setVal] = useState(initialValue || '');

  useEffect(() => {
    setVal(initialValue || '');
  }, [initialValue]);

  const commit = (text: string) => {
    const trimmed = text.trim().toUpperCase();
    if (trimmed !== (initialValue || '').trim().toUpperCase()) {
      onSave(trimmed);
    }
  };

  return (
    <input
      type="text"
      maxLength={3}
      disabled={disabled}
      value={val}
      onChange={(e) => {
        const next = e.target.value.toUpperCase();
        setVal(next);
      }}
      onBlur={() => commit(val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      placeholder="—"
      className="w-10 text-center uppercase bg-[#151728] border border-cyan-500/40 focus:border-cyan-400 rounded-lg py-1 text-xs font-black text-cyan-300 focus:outline-none disabled:opacity-40"
      title="Edit Code Letter (Press Enter or click away to save)"
    />
  );
};

interface AdminDashboardProps {
  currentUser: UserProfile;
  groups: Group[];
  competitions: Competition[];
  registrations: Registration[];
  results: Result[];
  leaderboard: LeaderboardEntry[];
  onRefresh: () => void;
  onSignOut?: () => void;
  activeTab?: AdminTabType;
  setActiveTab?: (tab: AdminTabType) => void;
  showAdminCredModal?: boolean;
  setShowAdminCredModal?: (show: boolean) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  groups,
  competitions,
  registrations,
  results,
  leaderboard,
  onRefresh,
  onSignOut,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  showAdminCredModal: propShowAdminCredModal,
  setShowAdminCredModal: propSetShowAdminCredModal
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<AdminTabType>('overview');
  const activeTab = propActiveTab ?? internalActiveTab;
  const setActiveTab = propSetActiveTab ?? setInternalActiveTab;

  const [showOverviewPrintSchedule, setShowOverviewPrintSchedule] = useState(false);

  // --- ADMIN CREDENTIALS EDIT STATE ---
  const [internalShowAdminCredModal, setInternalShowAdminCredModal] = useState(false);
  const showAdminCredModal = propShowAdminCredModal ?? internalShowAdminCredModal;
  const setShowAdminCredModal = (show: boolean) => {
    if (propSetShowAdminCredModal) {
      propSetShowAdminCredModal(show);
    }
    setInternalShowAdminCredModal(show);
  };

  const [existingPassword, setExistingPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState(currentUser.userId || 'admin');
  const [adminPassword, setAdminPassword] = useState(currentUser.password || 'admin123');
  const [showExistingPassword, setShowExistingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [adminCredError, setAdminCredError] = useState('');
  const [adminCredSuccess, setAdminCredSuccess] = useState('');

  // --- BACKUP & RESTORE / RESET STATE ---
  const [backupToastMsg, setBackupToastMsg] = useState('');
  const [backupErrorMsg, setBackupErrorMsg] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetToastMsg, setResetToastMsg] = useState('');
  const [showBulkQrModal, setShowBulkQrModal] = useState(false);
  const [showPrintValuationModal, setShowPrintValuationModal] = useState(false);
  const [isBulkQrLoading, setIsBulkQrLoading] = useState(false);

  const downloadFile = (filename: string, content: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Sync state if currentUser changes
  useEffect(() => {
    if (currentUser) {
      setAdminUsername(currentUser.userId || 'admin');
      setAdminPassword(currentUser.password || 'admin123');
    }
    const jProf = festStore.getJudgeProfile();
    if (jProf?.password) setJudgePassword(jProf.password);
    const mProf = festStore.getMediaProfile();
    if (mProf?.password) setMediaPassword(mProf.password);
  }, [currentUser]);

  const [credModalTab, setCredModalTab] = useState<'admin' | 'judge' | 'media' | 'leaders'>('admin');
  const [judgePassword, setJudgePassword] = useState(() => festStore.getJudgeProfile()?.password || 'judge123');
  const [showJudgePassword, setShowJudgePassword] = useState(false);
  const [mediaPassword, setMediaPassword] = useState(() => festStore.getMediaProfile()?.password || 'media123');
  const [showMediaPassword, setShowMediaPassword] = useState(false);

  const handleSaveAdminCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminCredError('');
    setAdminCredSuccess('');

    const currentActualPassword = currentUser.password || 'admin123';

    if (!existingPassword.trim()) {
      setAdminCredError('Please enter your existing password to verify changes.');
      return;
    }

    if (existingPassword.trim() !== currentActualPassword) {
      setAdminCredError('Incorrect existing password. Authorization failed.');
      return;
    }

    if (!adminPassword.trim()) {
      setAdminCredError('New Admin Password cannot be empty.');
      return;
    }

    const result = festStore.updateProfileCredentials('usr-admin', {
      password: adminPassword.trim()
    });

    if (result.success) {
      setAdminCredSuccess('Admin credentials updated successfully!');
      setTimeout(() => {
        setShowAdminCredModal(false);
        setAdminCredSuccess('');
        setExistingPassword('');
        onRefresh();
      }, 1500);
    } else {
      setAdminCredError(result.message);
    }
  };

  const handleSaveJudgeCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminCredError('');
    setAdminCredSuccess('');

    if (!judgePassword.trim()) {
      setAdminCredError('Judge Password cannot be empty.');
      return;
    }

    const res = festStore.updateJudgePassword(judgePassword.trim());
    if (res.success) {
      setAdminCredSuccess('Judge password updated successfully!');
      setTimeout(() => {
        setAdminCredSuccess('');
        onRefresh();
      }, 1500);
    } else {
      setAdminCredError(res.message);
    }
  };

  const handleSaveMediaCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminCredError('');
    setAdminCredSuccess('');

    if (!mediaPassword.trim()) {
      setAdminCredError('Media Password cannot be empty.');
      return;
    }

    const res = festStore.updateMediaPassword(mediaPassword.trim());
    if (res.success) {
      setAdminCredSuccess('Media password updated successfully!');
      setTimeout(() => {
        setAdminCredSuccess('');
        onRefresh();
      }, 1500);
    } else {
      setAdminCredError(res.message);
    }
  };

  // --- NOTIFICATIONS MANAGEMENT STATE ---
  const [notifList, setNotifList] = useState<FestNotification[]>(() => festStore.getNotifications());
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifCategory, setNotifCategory] = useState('Stage Alert');
  const [editingNotifId, setEditingNotifId] = useState<string | null>(null);
  const [notifSuccessMsg, setNotifSuccessMsg] = useState('');

  // Keep notifList in sync
  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      setNotifList(festStore.getNotifications());
    });
    return unsubscribe;
  }, []);

  const handleSaveNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;

    if (editingNotifId) {
      festStore.updateNotification(editingNotifId, {
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        category: notifCategory,
      });
      setNotifSuccessMsg('Announcement updated successfully! Red dot alert triggered for all users.');
    } else {
      festStore.addNotification({
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        category: notifCategory,
        createdBy: currentUser.name || 'Admin Desk'
      });
      setNotifSuccessMsg('New announcement published! Red dot alert triggered for all users.');
    }

    setNotifTitle('');
    setNotifMessage('');
    setEditingNotifId(null);
    setTimeout(() => setNotifSuccessMsg(''), 4000);
  };

  const handleEditNotif = (notif: FestNotification) => {
    setEditingNotifId(notif.id);
    setNotifTitle(notif.title);
    setNotifMessage(notif.message);
    setNotifCategory(notif.category || 'Stage Alert');
    setNotifSuccessMsg('');
  };

  const handleCancelNotifEdit = () => {
    setEditingNotifId(null);
    setNotifTitle('');
    setNotifMessage('');
  };

  const handleDeleteNotif = (id: string) => {
    if (confirm('Delete this announcement?')) {
      festStore.deleteNotification(id);
    }
  };

  // --- LIVE COUNTDOWN CONFIG STATE ---
  const [countdownConfig, setCountdownConfig] = useState(() => festStore.getCountdownConfig());
  const [countdownTitle, setCountdownTitle] = useState(countdownConfig.title);
  const [countdownSubtitle, setCountdownSubtitle] = useState(countdownConfig.subtitle);
  const [countdownShow, setCountdownShow] = useState(countdownConfig.show);
  const [countdownTargetDate, setCountdownTargetDate] = useState(countdownConfig.targetDate || '2026-11-15T09:00');
  const [countdownDayLabel, setCountdownDayLabel] = useState(countdownConfig.dayLabel || 'Days');
  const [countdownHourLabel, setCountdownHourLabel] = useState(countdownConfig.hourLabel || 'Hours');
  const [countdownMinLabel, setCountdownMinLabel] = useState(countdownConfig.minLabel || 'Mins');
  const [countdownSecLabel, setCountdownSecLabel] = useState(countdownConfig.secLabel || 'Secs');
  const [countdownShowDays, setCountdownShowDays] = useState(countdownConfig.showDays ?? true);
  const [countdownShowHours, setCountdownShowHours] = useState(countdownConfig.showHours ?? true);
  const [countdownShowMinutes, setCountdownShowMinutes] = useState(countdownConfig.showMinutes ?? true);
  const [countdownShowSeconds, setCountdownShowSeconds] = useState(countdownConfig.showSeconds ?? true);
  const [countdownSuccessMsg, setCountdownSuccessMsg] = useState('');

  // --- SOCIAL MEDIA LINKS STATE ---
  const [socialLinks, setSocialLinks] = useState(() => festStore.getSocialLinks());
  const [socialInstagram, setSocialInstagram] = useState(socialLinks.instagram || '');
  const [socialYoutube, setSocialYoutube] = useState(socialLinks.youtube || '');
  const [socialWhatsapp, setSocialWhatsapp] = useState(socialLinks.whatsapp || '');
  const [socialFacebook, setSocialFacebook] = useState(socialLinks.facebook || '');
  const [socialTwitter, setSocialTwitter] = useState(socialLinks.twitter || '');
  const [socialWebsite, setSocialWebsite] = useState(socialLinks.website || '');
  const [socialSuccessMsg, setSocialSuccessMsg] = useState('');

  // Keep countdown controls & social links in sync if store or other components change
  useEffect(() => {
    const current = festStore.getCountdownConfig();
    setCountdownConfig(current);
    setCountdownTitle(current.title);
    setCountdownSubtitle(current.subtitle);
    setCountdownShow(current.show);
    setCountdownTargetDate(current.targetDate || '2026-11-15T09:00');
    setCountdownDayLabel(current.dayLabel || 'Days');
    setCountdownHourLabel(current.hourLabel || 'Hours');
    setCountdownMinLabel(current.minLabel || 'Mins');
    setCountdownSecLabel(current.secLabel || 'Secs');
    setCountdownShowDays(current.showDays ?? true);
    setCountdownShowHours(current.showHours ?? true);
    setCountdownShowMinutes(current.showMinutes ?? true);
    setCountdownShowSeconds(current.showSeconds ?? true);

    const links = festStore.getSocialLinks();
    setSocialLinks(links);
    setSocialInstagram(links.instagram || '');
    setSocialYoutube(links.youtube || '');
    setSocialWhatsapp(links.whatsapp || '');
    setSocialFacebook(links.facebook || '');
    setSocialTwitter(links.twitter || '');
    setSocialWebsite(links.website || '');
  }, [competitions]); // Sync whenever list refreshes

  const handleSaveSocialLinks = (e: React.FormEvent) => {
    e.preventDefault();
    festStore.updateSocialLinks({
      instagram: socialInstagram.trim(),
      youtube: socialYoutube.trim(),
      whatsapp: socialWhatsapp.trim(),
      facebook: socialFacebook.trim(),
      twitter: socialTwitter.trim(),
      website: socialWebsite.trim()
    });
    setSocialSuccessMsg('Festival social media channels updated successfully!');
    setTimeout(() => setSocialSuccessMsg(''), 4000);
    onRefresh();
  };

  const handleSaveCountdownConfig = (e: React.FormEvent) => {
    e.preventDefault();
    festStore.updateCountdownConfig({
      show: countdownShow,
      title: countdownTitle.trim(),
      subtitle: countdownSubtitle.trim(),
      targetDate: countdownTargetDate,
      dayLabel: countdownDayLabel.trim(),
      hourLabel: countdownHourLabel.trim(),
      minLabel: countdownMinLabel.trim(),
      secLabel: countdownSecLabel.trim(),
      showDays: countdownShowDays,
      showHours: countdownShowHours,
      showMinutes: countdownShowMinutes,
      showSeconds: countdownShowSeconds
    });
    setCountdownSuccessMsg('Live Countdown settings saved successfully!');
    setTimeout(() => setCountdownSuccessMsg(''), 4000);
    onRefresh();
  };

  // --- BRANDING & FESTIVAL INFO STATE ---
  const [brandingConfig, setBrandingConfig] = useState(() => festStore.getBrandingConfig());
  const [brandTitle, setBrandTitle] = useState(brandingConfig.title || 'Madani Art Fiesta');
  const [brandCollege, setBrandCollege] = useState(brandingConfig.college || 'Madani College');
  const [brandTag, setBrandTag] = useState(brandingConfig.tag || '2026');
  const [brandLogoUrl, setBrandLogoUrl] = useState(brandingConfig.logoUrl || '');
  const [brandSplashLogoUrl, setBrandSplashLogoUrl] = useState(brandingConfig.splashLogoUrl || '');
  const [brandFontFamily, setBrandFontFamily] = useState(brandingConfig.fontFamily || "'Plus Jakarta Sans', sans-serif");
  const [brandHeadingFontFamily, setBrandHeadingFontFamily] = useState(brandingConfig.headingFontFamily || "'Plus Jakarta Sans', sans-serif");
  const [brandSuccessMsg, setBrandSuccessMsg] = useState('');
  const brandLogoFileInputRef = React.useRef<HTMLInputElement>(null);
  const brandSplashLogoFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      const current = festStore.getBrandingConfig();
      setBrandingConfig(current);
      setBrandTitle(current.title || 'Madani Art Fiesta');
      setBrandCollege(current.college || 'Madani College');
      setBrandTag(current.tag || '2026');
      setBrandLogoUrl(current.logoUrl || '');
      setBrandSplashLogoUrl(current.splashLogoUrl || '');
      setBrandFontFamily(current.fontFamily || "'Plus Jakarta Sans', sans-serif");
      setBrandHeadingFontFamily(current.headingFontFamily || "'Plus Jakarta Sans', sans-serif");
    });
    return unsubscribe;
  }, []);

  const handleSaveBrandingConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...brandingConfig,
      title: brandTitle.trim(),
      college: brandCollege.trim(),
      tag: brandTag.trim(),
      logoUrl: brandLogoUrl.trim(),
      splashLogoUrl: brandSplashLogoUrl.trim(),
      fontFamily: brandFontFamily,
      headingFontFamily: brandHeadingFontFamily
    };
    festStore.updateBrandingConfig(updated);
    applyBrandingToDocument(updated);
    setBrandSuccessMsg('Festival titles, typography fonts, and branding updated across the entire application!');
    setTimeout(() => setBrandSuccessMsg(''), 4000);
    onRefresh();
  };

  // --- COMMENT SECTION, COOLDOWN LOCK & AUTO-EXPIRE SETTINGS STATE ---
  const [commentSettings, setCommentSettings] = useState(() => festStore.getCommentSettings());
  const [commentEnabled, setCommentEnabled] = useState(commentSettings.enabled);
  const [commentCooldownMinutes, setCommentCooldownMinutes] = useState(commentSettings.cooldownMinutes);
  const [commentAutoExpireHours, setCommentAutoExpireHours] = useState(commentSettings.autoExpireHours || 12);
  const [commentSuccessMsg, setCommentSuccessMsg] = useState('');

  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      const current = festStore.getCommentSettings();
      setCommentSettings(current);
      setCommentEnabled(current.enabled);
      setCommentCooldownMinutes(current.cooldownMinutes);
      setCommentAutoExpireHours(current.autoExpireHours || 12);
    });
    return unsubscribe;
  }, []);

  const handleSaveCommentSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const numMinutes = Math.max(0, Number(commentCooldownMinutes) || 0);
    const numHours = Math.max(1, Number(commentAutoExpireHours) || 12);
    festStore.updateCommentSettings({
      enabled: commentEnabled,
      cooldownMinutes: numMinutes,
      autoExpireHours: numHours
    });
    setCommentSuccessMsg(`Live comment settings updated! (Enabled: ${commentEnabled ? 'YES' : 'NO'}, Cooldown: ${numMinutes} mins, Auto-Expire: ${numHours} hrs)`);
    setTimeout(() => setCommentSuccessMsg(''), 4000);
    onRefresh();
  };

  // --- HOME SCREEN GROUP POINT STATUS VISIBILITY STATE ---
  const [showGroupPointStatus, setShowGroupPointStatus] = useState<boolean>(() => festStore.getShowGroupPointStatus());
  const [groupPointStatusMsg, setGroupPointStatusMsg] = useState<string>('');

  // --- TEAM POINTS CALCULATION MODE STATE ---
  const [calculateWithPerformancePoints, setCalculateWithPerformancePoints] = useState<boolean>(() => festStore.getCalculateWithPerformancePoints());
  const [calcModeMsg, setCalcModeMsg] = useState<string>('');

  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      setShowGroupPointStatus(festStore.getShowGroupPointStatus());
      setCalculateWithPerformancePoints(festStore.getCalculateWithPerformancePoints());
    });
    return unsubscribe;
  }, []);

  const handleToggleGroupPointStatus = (targetValue?: boolean) => {
    const current = festStore.getShowGroupPointStatus();
    const nextVal = typeof targetValue === 'boolean' ? targetValue : !current;
    festStore.setShowGroupPointStatus(nextVal);
    setShowGroupPointStatus(nextVal);
    setGroupPointStatusMsg(
      nextVal
        ? 'Group Point Status is now VISIBLE on the home screen!'
        : 'Group Point Status is now HIDDEN from the home screen!'
    );
    setTimeout(() => setGroupPointStatusMsg(''), 4000);
    onRefresh();
  };

  const handleToggleCalculatePerformancePoints = (enabled: boolean) => {
    festStore.setCalculateWithPerformancePoints(enabled);
    setCalculateWithPerformancePoints(enabled);
    setCalcModeMsg(
      enabled
        ? 'Team Point calculation mode set to: With Performance Points (Competition Points + Performance Grade Points)'
        : 'Team Point calculation mode set to: Without Performance Points (Only 1st, 2nd, 3rd Competition Points)'
    );
    setTimeout(() => setCalcModeMsg(''), 4000);
    onRefresh();
  };

  const handleBrandLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 400, 400, 0.85);
        setBrandLogoUrl(compressed);
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setBrandLogoUrl(base64);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleBrandSplashLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 500, 500, 0.85);
        setBrandSplashLogoUrl(compressed);
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setBrandSplashLogoUrl(base64);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // --- RESULT ENTRY ENGINE STATE ---
  const [selectedCompId, setSelectedCompId] = useState<string>('');
  const [firstPlaceRegId, setFirstPlaceRegId] = useState<string>('');
  const [secondPlaceRegId, setSecondPlaceRegId] = useState<string>('');
  const [thirdPlaceRegId, setThirdPlaceRegId] = useState<string>('');
  const [resultSuccessMsg, setResultSuccessMsg] = useState<string>('');
  const [resultErrorMsg, setResultErrorMsg] = useState<string>('');
  const [resultsCategoryFilter, setResultsCategoryFilter] = useState<string>('All');
  const [resultsStatusFilter, setResultsStatusFilter] = useState<'All' | 'Published' | 'Pending'>('All');
  const [resultsTableSearch, setResultsTableSearch] = useState<string>('');
  const [resultsCompSearch, setResultsCompSearch] = useState<string>('');
  const [showResultsCategoryFilter, setShowResultsCategoryFilter] = useState<boolean>(false);
  const [useDetailedPoints, setUseDetailedPoints] = useState<boolean>(true);
  const [perfPointConfigState, setPerfPointConfigState] = useState<PerformancePointConfig>(() => festStore.getPerformancePointConfig());
  const [showEditPerfModal, setShowEditPerfModal] = useState<boolean>(false);
  const [perfEditSuccessMsg, setPerfEditSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (selectedCompId) {
      const pubResult = results.find(r => r.competitionId === selectedCompId);
      if (pubResult) {
        setUseDetailedPoints(pubResult.useDetailedPoints ?? true);
        setFirstPlaceRegId(pubResult.firstPlaceRegId || '');
        setSecondPlaceRegId(pubResult.secondPlaceRegId || '');
        setThirdPlaceRegId(pubResult.thirdPlaceRegId || '');
      } else {
        setUseDetailedPoints(true);
        const compRegs = registrations.filter(r => r.competitionId === selectedCompId);
        const reportedRegs = compRegs.filter(r => r.isReported === true);
        const sortedScored = [...reportedRegs]
          .map(r => ({ r, score: Number(r.mark) || 0, rank: r.judgeRank || 999 }))
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.rank - b.rank;
          });
        
        setFirstPlaceRegId(sortedScored[0]?.r.id || '');
        setSecondPlaceRegId(sortedScored[1]?.r.id || '');
        setThirdPlaceRegId(sortedScored[2]?.r.id || '');
      }
    } else {
      setFirstPlaceRegId('');
      setSecondPlaceRegId('');
      setThirdPlaceRegId('');
    }
  }, [selectedCompId, results, registrations]);

  // --- PARTICIPANTS REPORT ENGINE STATE ---
  const [reportingCompId, setReportingCompId] = useState<string>('');
  const [reportingCategoryFilter, setReportingCategoryFilter] = useState<string>('All');
  const [reportingSearch, setReportingSearch] = useState<string>('');
  const [showCallSheetModal, setShowCallSheetModal] = useState<boolean>(false);
  const [reportingSuccessMsg, setReportingSuccessMsg] = useState<string>('');
  const [reportingStatusFilter, setReportingStatusFilter] = useState<'All' | 'Reported' | 'Absent'>('All');

  // --- VALUATION SHEET STATE ---
  const [valuationCompIds, setValuationCompIds] = useState<string[]>(() => festStore.getActiveValuationCompIds());
  const [valuationCompId, setValuationCompId] = useState<string>(() => festStore.getActiveValuationCompId());
  const [valuationCategoryFilter, setValuationCategoryFilter] = useState<string>('All');
  const [valuationStageFilter, setValuationStageFilter] = useState<string>('All');
  const [valuationDateFilter, setValuationDateFilter] = useState<string>('All');
  const [valuationSearch, setValuationSearch] = useState<string>('');
  const [valuationCompSearch, setValuationCompSearch] = useState<string>('');
  const [valuationSuccessMsg, setValuationSuccessMsg] = useState<string>('');

  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      const ids = festStore.getActiveValuationCompIds();
      setValuationCompIds(ids);
      setValuationCompId(prev => (ids.includes(prev) ? prev : (ids[0] || '')));
    });
    return unsubscribe;
  }, []);

  // --- COMPETITION & EVENT UPDATES STATE ---
  const [updatesSearch, setUpdatesSearch] = useState<string>('');
  const [updatesStatusFilter, setUpdatesStatusFilter] = useState<'All' | 'running' | 'pending' | 'completed'>('All');
  const [updatesCategoryFilter, setUpdatesCategoryFilter] = useState<string>('All');
  const [updatesStageFilter, setUpdatesStageFilter] = useState<string>('All');

  const scheduledUpdatesCompetitions = useMemo(() => {
    return competitions.filter(isCompetitionScheduled);
  }, [competitions]);

  const updatesCategories = useMemo(() => {
    const cats = new Set<string>();
    scheduledUpdatesCompetitions.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats).sort();
  }, [scheduledUpdatesCompetitions]);

  const updatesStages = useMemo(() => {
    const stg = new Set<string>();
    scheduledUpdatesCompetitions.forEach((c) => {
      if (c.venue) stg.add(c.venue);
    });
    return Array.from(stg).sort();
  }, [scheduledUpdatesCompetitions]);

  const filteredUpdatesCompetitions = useMemo(() => {
    const list = scheduledUpdatesCompetitions.filter((comp) => {
      // Status filter
      if (updatesStatusFilter !== 'All') {
        const isRunning = comp.status === 'running' || Boolean(comp.isRunning);
        const isCompleted = comp.status === 'completed' || Boolean(comp.isPublishedResult);
        const currentStatus = isCompleted ? 'completed' : isRunning ? 'running' : 'pending';
        if (currentStatus !== updatesStatusFilter) return false;
      }

      // Category filter
      if (updatesCategoryFilter !== 'All' && comp.category !== updatesCategoryFilter) {
        return false;
      }

      // Stage filter
      if (updatesStageFilter !== 'All' && comp.venue !== updatesStageFilter) {
        return false;
      }

      // Search query
      if (updatesSearch.trim()) {
        const q = updatesSearch.toLowerCase().trim();
        const matches =
          comp.name.toLowerCase().includes(q) ||
          Boolean(comp.category && comp.category.toLowerCase().includes(q)) ||
          Boolean(comp.venue && comp.venue.toLowerCase().includes(q)) ||
          Boolean(comp.type && comp.type.toLowerCase().includes(q)) ||
          Boolean(comp.status && comp.status.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });

    const statusRank: Record<'pending' | 'running' | 'completed', number> = {
      pending: 0,
      running: 1,
      completed: 2,
    };

    const getCompStatus = (c: Competition): 'pending' | 'running' | 'completed' => {
      if (c.status === 'completed' || Boolean(c.isPublishedResult)) return 'completed';
      if (c.status === 'running' || Boolean(c.isRunning)) return 'running';
      return 'pending';
    };

    return list.sort((a, b) => {
      const rankDiff = statusRank[getCompStatus(a)] - statusRank[getCompStatus(b)];
      if (rankDiff !== 0) return rankDiff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [scheduledUpdatesCompetitions, updatesStatusFilter, updatesCategoryFilter, updatesStageFilter, updatesSearch]);

  const updatesPendingCount = useMemo(() => scheduledUpdatesCompetitions.filter(c => c.status !== 'completed' && !c.isPublishedResult && c.status !== 'running' && !c.isRunning).length, [scheduledUpdatesCompetitions]);
  const updatesRunningCount = useMemo(() => scheduledUpdatesCompetitions.filter(c => (c.status === 'running' || Boolean(c.isRunning)) && c.status !== 'completed' && !c.isPublishedResult).length, [scheduledUpdatesCompetitions]);
  const updatesCompletedCount = useMemo(() => scheduledUpdatesCompetitions.filter(c => c.status === 'completed' || Boolean(c.isPublishedResult)).length, [scheduledUpdatesCompetitions]);
  const isUpdatesFiltered = Boolean(updatesSearch.trim() || updatesStatusFilter !== 'All' || updatesCategoryFilter !== 'All' || updatesStageFilter !== 'All');

  // --- ADD / EDIT COMPETITION STATE ---
  const [showCompModal, setShowCompModal] = useState(false);
  const [editingComp, setEditingComp] = useState<Competition | null>(null);
  const [newCompName, setNewCompName] = useState('');
  const [newCompCategory, setNewCompCategory] = useState<string>('General');
  const [newCompType, setNewCompType] = useState<'Individual' | 'Group'>('Individual');
  const [newCompTeamSize, setNewCompTeamSize] = useState<number>(4);
  const [newCompIsStage, setNewCompIsStage] = useState(true);
  const [newCompVenue, setNewCompVenue] = useState<string>('');
  const [newCompDate, setNewCompDate] = useState('');
  const [newCompTimeOnly, setNewCompTimeOnly] = useState('');
  const [newCompSpanTime, setNewCompSpanTime] = useState<number | string>(60);
  const [newCompLimit, setNewCompLimit] = useState(2);
  const [newCompP1, setNewCompP1] = useState(10);
  const [newCompP2, setNewCompP2] = useState(7);
  const [newCompP3, setNewCompP3] = useState(5);
  const [newCompDesc, setNewCompDesc] = useState('');
  const [newCompImageUrl, setNewCompImageUrl] = useState('');
  const [newCompImageType, setNewCompImageType] = useState<'painting' | 'writing' | 'mic' | 'dhuff' | 'custom'>('painting');

  // --- CATEGORY FILTERING & MANAGEMENT STATE ---
  const [compCategoryFilter, setCompCategoryFilter] = useState<string>('All');
  const [compSearchQuery, setCompSearchQuery] = useState<string>('');
  const [compViewMode, setCompViewMode] = useState<'scheduleTable' | 'cards'>('cards');
  const [showTopCreateScheduleModal, setShowTopCreateScheduleModal] = useState(false);

  // Category Manager State
  const [showManageLimitsModal, setShowManageLimitsModal] = useState(false);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
  const [newCatNameInput, setNewCatNameInput] = useState('');
  const [categoryActionMsg, setCategoryActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingCatName, setDeletingCatName] = useState<string | null>(null);

  // Stage Manager State
  const [showManageStagesModal, setShowManageStagesModal] = useState(false);
  const [newStageNameInput, setNewStageNameInput] = useState('');
  const [newStageIsStageInput, setNewStageIsStageInput] = useState(true);
  const [stageActionMsg, setStageActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingStageOldName, setEditingStageOldName] = useState<string | null>(null);
  const [editingStageNewName, setEditingStageNewName] = useState('');
  const [editingStageIsStage, setEditingStageIsStage] = useState(true);
  const [deletingStageName, setDeletingStageName] = useState<string | null>(null);

  // Level Manager State
  const [showManageLevelsModal, setShowManageLevelsModal] = useState(false);
  const [newLevelNameInput, setNewLevelNameInput] = useState('');
  const [levelActionMsg, setLevelActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingLevelOldName, setEditingLevelOldName] = useState<string | null>(null);
  const [editingLevelNewName, setEditingLevelNewName] = useState('');
  const [deletingLevelName, setDeletingLevelName] = useState<string | null>(null);

  // Quick Category Edit Modal State
  const [quickCategoryComp, setQuickCategoryComp] = useState<Competition | null>(null);
  const [quickCatSelect, setQuickCatSelect] = useState<string>('General');

  const categoriesList = festStore.getCategories();
  const availableCategories = ['All', ...categoriesList];

  const stageItems = festStore.getStageItems();
  const stagesList = festStore.getStages();

  // Synchronize newCompVenue state when stagesList changes reactively
  useEffect(() => {
    if (newCompVenue && stagesList.length > 0) {
      if (!stagesList.includes(newCompVenue)) {
        setNewCompVenue('');
      }
    }
  }, [stagesList, newCompVenue]);

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNameInput.trim()) return;

    const res = festStore.addCategory(newCatNameInput.trim());
    if (res.success) {
      setCategoryActionMsg({ type: 'success', text: res.message });
      setNewCatNameInput('');
      onRefresh();
    } else {
      setCategoryActionMsg({ type: 'error', text: res.message });
    }
  };

  const handleConfirmDeleteCategory = (catName: string) => {
    const res = festStore.deleteCategory(catName, 'General');
    if (res.affectedCount > 0) {
      setCategoryActionMsg({
        type: 'success',
        text: `Category "${catName}" deleted. ${res.affectedCount} competition(s) reassigned to "General".`
      });
    } else {
      setCategoryActionMsg({ type: 'success', text: `Category "${catName}" deleted successfully.` });
    }
    setDeletingCatName(null);
    onRefresh();
  };

  const handleAddStageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageNameInput.trim()) return;

    const res = festStore.addStage(newStageNameInput.trim(), newStageIsStageInput);
    if (res.success) {
      setStageActionMsg({ type: 'success', text: res.message });
      setNewStageNameInput('');
      setNewStageIsStageInput(true);
      onRefresh();
    } else {
      setStageActionMsg({ type: 'error', text: res.message });
    }
  };

  const handleSaveEditStage = (oldName: string) => {
    if (!editingStageNewName.trim()) return;
    const res = festStore.updateStage(oldName, editingStageNewName.trim(), editingStageIsStage);
    if (res.success) {
      setStageActionMsg({ type: 'success', text: res.message });
      setEditingStageOldName(null);
      setEditingStageNewName('');
      onRefresh();
    } else {
      setStageActionMsg({ type: 'error', text: res.message });
    }
  };

  const handleToggleStageType = (stageName: string, currentIsStage: boolean) => {
    const res = festStore.setStageType(stageName, !currentIsStage);
    if (res.success) {
      setStageActionMsg({ type: 'success', text: res.message });
      onRefresh();
    }
  };

  const handleConfirmDeleteStage = (stageName: string) => {
    const defaultTarget = stagesList.find(s => s.toLowerCase() !== stageName.toLowerCase()) || 'Stage 1';
    const res = festStore.deleteStage(stageName, defaultTarget);
    if (res.affectedCount > 0) {
      setStageActionMsg({
        type: 'success',
        text: `Stage "${stageName}" removed. ${res.affectedCount} competition(s) reassigned to "${defaultTarget}".`
      });
    } else {
      setStageActionMsg({ type: 'success', text: `Stage "${stageName}" removed successfully.` });
    }
    setDeletingStageName(null);
    onRefresh();
  };

  const levelsList = festStore.getLevels();

  const handleAddLevelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLevelNameInput.trim()) return;

    const res = festStore.addLevel(newLevelNameInput.trim());
    if (res.success) {
      setLevelActionMsg({ type: 'success', text: res.message });
      setNewLevelNameInput('');
      onRefresh();
    } else {
      setLevelActionMsg({ type: 'error', text: res.message });
    }
  };

  const handleUpdateLevelSubmit = (oldName: string, newName: string) => {
    if (!newName.trim()) return;
    const res = festStore.updateLevel(oldName, newName.trim());
    if (res.success) {
      setLevelActionMsg({ type: 'success', text: res.message });
      setEditingLevelOldName(null);
      setEditingLevelNewName('');
      onRefresh();
    } else {
      setLevelActionMsg({ type: 'error', text: res.message });
    }
  };

  const handleConfirmDeleteLevel = (levelName: string) => {
    const defaultTarget = levelsList.find(l => l.toLowerCase() !== levelName.toLowerCase()) || '1';
    const res = festStore.deleteLevel(levelName, defaultTarget);
    if (res.affectedCount > 0) {
      setLevelActionMsg({
        type: 'success',
        text: `Level "${levelName}" deleted. ${res.affectedCount} participant(s) reassigned to Level "${defaultTarget}".`
      });
    } else {
      setLevelActionMsg({ type: 'success', text: `Level "${levelName}" deleted successfully.` });
    }
    setDeletingLevelName(null);
    onRefresh();
  };

  // --- ADD GROUP STATE ---
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupLeaderName, setNewGroupLeaderName] = useState('');
  const [newGroupLeaderPass, setNewGroupLeaderPass] = useState('');
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#a855f7');

  // --- GROUP EDIT MODAL STATE (Group ID, Name, Leader Credentials) ---
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editGroupIdInput, setEditGroupIdInput] = useState('');
  const [editGroupNameInput, setEditGroupNameInput] = useState('');
  const [editGroupCodeInput, setEditGroupCodeInput] = useState('');
  const [editGroupLeaderNameInput, setEditGroupLeaderNameInput] = useState('');
  const [editGroupLeaderPasswordInput, setEditGroupLeaderPasswordInput] = useState('');
  const [editGroupColorInput, setEditGroupColorInput] = useState('#ffbe0b');
  const [editGroupErrorMsg, setEditGroupErrorMsg] = useState('');
  const [editGroupSuccessMsg, setEditGroupSuccessMsg] = useState('');

  // --- PARTICIPANT CREDENTIALS & ID EDIT MODAL STATE ---
  const [editingParticipant, setEditingParticipant] = useState<UserProfile | null>(null);
  const [editPartUserIdInput, setEditPartUserIdInput] = useState('');
  const [editPartNameInput, setEditPartNameInput] = useState('');
  const [editPartFatherNameInput, setEditPartFatherNameInput] = useState('');
  const [editPartGroupIdInput, setEditPartGroupIdInput] = useState('');
  const [editPartDeptInput, setEditPartDeptInput] = useState('1');
  const [editPartCatInput, setEditPartCatInput] = useState<CategoryType>('Senior');
  const [editPartErrorMsg, setEditPartErrorMsg] = useState('');
  const [editPartSuccessMsg, setEditPartSuccessMsg] = useState('');

  // --- PARTICIPANT CHEST NO AUTO-GENERATOR CONFIG STATE (Controlled by Admin) ---
  const [configGroupId, setConfigGroupId] = useState<string>(() => groups[0]?.id || '');
  const [partIdStartNum, setPartIdStartNum] = useState(() => {
    const initialGroupId = groups[0]?.id || '';
    return festStore.getParticipantIdConfig(initialGroupId || undefined).startNumber;
  });
  const [partIdDigits, setPartIdDigits] = useState(() => {
    const initialGroupId = groups[0]?.id || '';
    return festStore.getParticipantIdConfig(initialGroupId || undefined).digits;
  });
  const [partIdIsLocked, setPartIdIsLocked] = useState(() => {
    const initialGroupId = groups[0]?.id || '';
    return !!festStore.getParticipantIdConfig(initialGroupId || undefined).isLocked;
  });
  const [isCompRegLocked, setIsCompRegLocked] = useState(() => {
    const initialGroupId = groups[0]?.id || '';
    return !!festStore.getParticipantIdConfig(initialGroupId || undefined).isCompLocked;
  });
  const [partIdConfigSuccessMsg, setPartIdConfigSuccessMsg] = useState('');

  // Sync config when the target group changes or groups list loads
  useEffect(() => {
    if (!configGroupId && groups.length > 0) {
      setConfigGroupId(groups[0].id);
      return;
    }
    const isGlobal = configGroupId === 'global' || !configGroupId;
    const config = festStore.getParticipantIdConfig(isGlobal ? undefined : configGroupId);
    setPartIdStartNum(config.startNumber);
    setPartIdDigits(config.digits);
    setPartIdIsLocked(!!config.isLocked);
    setIsCompRegLocked(!!config.isCompLocked);
  }, [configGroupId, groups]);

  const handleSaveParticipantIdConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configGroupId) return;
    setPartIdConfigSuccessMsg('');
    const isGlobal = configGroupId === 'global';
    festStore.updateParticipantIdConfig({
      startNumber: Number(partIdStartNum) > 0 ? Number(partIdStartNum) : 1,
      digits: Number(partIdDigits) > 0 ? Number(partIdDigits) : 3,
      isLocked: partIdIsLocked,
      isCompLocked: isCompRegLocked,
    }, isGlobal ? undefined : configGroupId);
    
    const targetName = isGlobal ? 'All Groups' : (groups.find(g => g.id === configGroupId)?.name || 'the Group');
    setPartIdConfigSuccessMsg(`Participant Chest Number format and registration status saved for ${targetName}!`);
    setTimeout(() => {
      setPartIdConfigSuccessMsg('');
    }, 4000);
    onRefresh();
  };

  // Search & Filter for Participant IDs table in Admin Panel
  const [adminPartSearch, setAdminPartSearch] = useState('');
  const [adminPartGroupFilter, setAdminPartGroupFilter] = useState('All');

  // Search & Filter for All Festival Registrations overview in Admin Panel
  const [regSearchQuery, setRegSearchQuery] = useState('');
  const [regGroupFilter, setRegGroupFilter] = useState('All');
  const [regCompFilter, setRegCompFilter] = useState('All');
  const [regCompDropdownOpen, setRegCompDropdownOpen] = useState(false);
  const [regCompSearchText, setRegCompSearchText] = useState('');
  const [regCompCategoryTab, setRegCompCategoryTab] = useState('All');
  const regCompDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (regCompDropdownRef.current && !regCompDropdownRef.current.contains(event.target as Node)) {
        setRegCompDropdownOpen(false);
      }
    };
    if (regCompDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [regCompDropdownOpen]);

  const handleOpenEditGroupModal = (grp: Group) => {
    setEditingGroup(grp);
    setEditGroupIdInput(grp.id);
    setEditGroupNameInput(grp.name);
    setEditGroupCodeInput(grp.code);
    setEditGroupLeaderNameInput(grp.leaderName);
    setEditGroupLeaderPasswordInput(grp.leaderPassword || '');
    setEditGroupColorInput(grp.color || '#ffbe0b');
    setEditGroupErrorMsg('');
    setEditGroupSuccessMsg('');
  };

  const handleSaveEditGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    setEditGroupErrorMsg('');
    setEditGroupSuccessMsg('');

    const res = festStore.updateGroup(editingGroup.id, {
      newGroupId: editGroupIdInput.trim(),
      name: editGroupNameInput.trim(),
      code: editGroupCodeInput.trim(),
      leaderName: editGroupLeaderNameInput.trim(),
      leaderPassword: editGroupLeaderPasswordInput.trim(),
      color: editGroupColorInput
    });

    if (res.success) {
      setEditGroupSuccessMsg(res.message);
      setTimeout(() => {
        setEditingGroup(null);
        onRefresh();
      }, 1000);
    } else {
      setEditGroupErrorMsg(res.message);
    }
  };

  const handleOpenEditParticipantModal = (part: UserProfile) => {
    setEditingParticipant(part);
    setEditPartUserIdInput(part.userId);
    setEditPartNameInput(part.name);
    setEditPartFatherNameInput(part.fatherName || '');
    setEditPartGroupIdInput(part.groupId || (groups[0]?.id || ''));
    setEditPartDeptInput(part.department || '1');
    setEditPartCatInput(part.category || 'Senior');
    setEditPartErrorMsg('');
    setEditPartSuccessMsg('');
  };

  const handleSaveEditParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParticipant) return;
    setEditPartErrorMsg('');
    setEditPartSuccessMsg('');

    if (!editPartNameInput.trim()) {
      setEditPartErrorMsg('Participant Name is required');
      return;
    }

    if (!editPartFatherNameInput.trim()) {
      setEditPartErrorMsg('Second Name (Father Name) is required');
      return;
    }

    const res = festStore.updateProfileCredentials(editingParticipant.id, {
      userId: editPartUserIdInput.trim(),
      name: editPartNameInput.trim(),
      fatherName: editPartFatherNameInput.trim(),
      groupId: editPartGroupIdInput,
      department: editPartDeptInput,
      category: editPartCatInput
    });

    if (res.success) {
      setEditPartSuccessMsg(res.message);
      setTimeout(() => {
        setEditingParticipant(null);
        onRefresh();
      }, 1000);
    } else {
      setEditPartErrorMsg(res.message);
    }
  };

  const handleDeleteParticipant = (partId: string, partName: string) => {
    if (confirm(`Are you sure you want to delete participant profile "${partName}"?`)) {
      festStore.deleteProfile(partId);
      onRefresh();
    }
  };

  // --- DELETE CONFIRMATION STATE ---
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'competition' | 'group';
    id: string;
    name: string;
  } | null>(null);

  // Registered entries for selected competition
  const activeCompRegistrations = registrations.filter(r => r.competitionId === selectedCompId);
  const selectedCompetition = competitions.find(c => c.id === selectedCompId);

  // Delete Competition Handler
  const handleDeleteCompetition = (compId: string, compName: string) => {
    setDeleteConfirmTarget({
      type: 'competition',
      id: compId,
      name: compName
    });
  };

  // Delete Group Handler
  const handleDeleteGroup = (groupId: string, groupName: string) => {
    setDeleteConfirmTarget({
      type: 'group',
      id: groupId,
      name: groupName
    });
  };

  // Execute Deletion
  const executeDelete = () => {
    if (!deleteConfirmTarget) return;

    if (deleteConfirmTarget.type === 'competition') {
      festStore.deleteCompetition(deleteConfirmTarget.id);
      if (selectedCompId === deleteConfirmTarget.id) {
        setSelectedCompId('');
      }
    } else if (deleteConfirmTarget.type === 'group') {
      festStore.deleteGroup(deleteConfirmTarget.id);
    }

    setDeleteConfirmTarget(null);
    onRefresh();
  };

  // Handle Result Submission
  const handlePublishResult = (e: React.FormEvent) => {
    e.preventDefault();
    setResultSuccessMsg('');
    setResultErrorMsg('');

    if (!selectedCompId || !firstPlaceRegId) {
      setResultErrorMsg('Please select a competition and pick a 1st Place winner!');
      return;
    }

    const compRegs = registrations.filter(r => r.competitionId === selectedCompId);
    const reportedRegs = compRegs.filter(r => r.isReported === true);
    const isScoredByJudge = reportedRegs.length > 0 && reportedRegs.some(r => r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '');
    if (!isScoredByJudge) {
      setResultErrorMsg('Cannot publish results: This competition has not been evaluated and scored by the judge yet.');
      return;
    }

    try {
      let participantPointsMap: Record<string, {
        competitionPoints: number;
        performancePoints: number;
        totalPoints: number;
        grade: string;
        score: number;
      }> | undefined = undefined;

      if (useDetailedPoints) {
        participantPointsMap = {};
        const reportedCompRegistrations = activeCompRegistrations.filter(r => r.isReported === true);
        
        reportedCompRegistrations.forEach(reg => {
          const score = Number(reg.mark) || 0;
          const { grade, points: performancePoints } = calculatePerformancePoints(
            score,
            selectedCompetition?.type || 'Individual',
            selectedCompetition?.teamSize || 4
          );
          
          let competitionPoints = 0;
          if (reg.id === firstPlaceRegId) {
            competitionPoints = selectedCompetition?.points1st || 10;
          } else if (reg.id === secondPlaceRegId) {
            competitionPoints = selectedCompetition?.points2nd || 7;
          } else if (reg.id === thirdPlaceRegId) {
            competitionPoints = selectedCompetition?.points3rd || 5;
          }

          participantPointsMap![reg.id] = {
            competitionPoints,
            performancePoints,
            totalPoints: competitionPoints + performancePoints,
            grade,
            score
          };
        });
      }

      festStore.publishResult(
        selectedCompId,
        firstPlaceRegId,
        secondPlaceRegId || undefined,
        thirdPlaceRegId || undefined,
        useDetailedPoints,
        participantPointsMap
      );

      setResultSuccessMsg(`Result for "${selectedCompetition?.name}" published successfully! Live group points updated.`);
      setSelectedCompId('');
      setFirstPlaceRegId('');
      setSecondPlaceRegId('');
      setThirdPlaceRegId('');
      onRefresh();
    } catch (err: any) {
      setResultErrorMsg(err.message || 'Error publishing result');
    }
  };

  // Toggle Publish / Unpublish directly for a competition
  const handleTogglePublishResult = (comp: Competition) => {
    setResultSuccessMsg('');
    setResultErrorMsg('');

    if (comp.isPublishedResult) {
      // Unpublish
      try {
        festStore.unpublishResult(comp.id);
        setResultSuccessMsg(`Result for "${comp.name}" has been unpublished.`);
        onRefresh();
      } catch (err: any) {
        setResultErrorMsg(err.message || 'Error unpublishing result');
      }
    } else {
      // Publish automatically from judge marks
      const compRegs = registrations.filter(r => r.competitionId === comp.id);
      const reportedRegs = compRegs.filter(r => r.isReported === true);
      const scoredRegs = reportedRegs
        .filter(r => r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '')
        .map(r => ({ ...r, numMark: Number(r.mark) || 0, rank: r.judgeRank || 999 }))
        .sort((a, b) => {
          if (b.numMark !== a.numMark) return b.numMark - a.numMark;
          return a.rank - b.rank;
        });

      if (scoredRegs.length === 0) {
        setResultErrorMsg(`Cannot publish "${comp.name}": No judge scores recorded yet.`);
        return;
      }

      const p1 = scoredRegs[0]?.id;
      const p2 = scoredRegs[1]?.id;
      const p3 = scoredRegs[2]?.id;

      if (!p1) {
        setResultErrorMsg('Cannot publish result: 1st place winner could not be determined.');
        return;
      }

      try {
        let participantPointsMap: Record<string, {
          competitionPoints: number;
          performancePoints: number;
          totalPoints: number;
          grade: string;
          score: number;
        }> | undefined = undefined;

        if (useDetailedPoints) {
          participantPointsMap = {};
          reportedRegs.forEach(reg => {
            const score = Number(reg.mark) || 0;
            const { grade, points: performancePoints } = calculatePerformancePoints(
              score,
              comp.type || 'Individual',
              comp.teamSize || 4
            );

            let competitionPoints = 0;
            if (reg.id === p1) {
              competitionPoints = comp.points1st || 10;
            } else if (reg.id === p2) {
              competitionPoints = comp.points2nd || 7;
            } else if (reg.id === p3) {
              competitionPoints = comp.points3rd || 5;
            }

            participantPointsMap![reg.id] = {
              competitionPoints,
              performancePoints,
              totalPoints: competitionPoints + performancePoints,
              grade,
              score
            };
          });
        }

        festStore.publishResult(
          comp.id,
          p1,
          p2 || undefined,
          p3 || undefined,
          useDetailedPoints,
          participantPointsMap
        );

        setResultSuccessMsg(`Result for "${comp.name}" published successfully! Live group points updated.`);
        onRefresh();
      } catch (err: any) {
        setResultErrorMsg(err.message || 'Error publishing result');
      }
    }
  };

  // Open Create Competition Modal
  const handleOpenCreateCompModal = () => {
    setEditingComp(null);
    setNewCompName('');
    setNewCompCategory(categoriesList[0] || 'General');
    setNewCompType('Individual');
    setNewCompTeamSize(4);
    setNewCompIsStage(true);
    setNewCompVenue('');
    setNewCompDate('');
    setNewCompTimeOnly('');
    setNewCompSpanTime(60);
    setNewCompLimit(2);
    setNewCompP1(10);
    setNewCompP2(7);
    setNewCompP3(5);
    setNewCompDesc('');
    setNewCompImageUrl('');
    setNewCompImageType('painting');
    setShowCompModal(true);
  };

  // Open Edit Competition Modal
  const handleOpenEditCompModal = (comp: Competition) => {
    setEditingComp(comp);
    setNewCompName(comp.name);
    setNewCompCategory(comp.category || categoriesList[0] || 'General');
    setNewCompType(comp.type);
    setNewCompTeamSize(comp.teamSize || 4);
    setNewCompIsStage(comp.isStage);
    setNewCompVenue(comp.venue || '');
    const parsed = parseScheduleTime(comp.scheduleTime);
    setNewCompDate(parsed.date);
    setNewCompTimeOnly(parsed.time);
    setNewCompSpanTime(comp.timeSpan || 60);
    setNewCompLimit(comp.maxEntriesPerGroup);
    setNewCompP1(comp.points1st);
    setNewCompP2(comp.points2nd);
    setNewCompP3(comp.points3rd);
    setNewCompDesc(comp.description);
    setNewCompImageUrl(comp.imageUrl || '');
    setNewCompImageType(comp.imageType || 'painting');
    setShowCompModal(true);
  };

  // Quick Category Edit Handlers
  const handleOpenQuickCategory = (comp: Competition) => {
    setQuickCategoryComp(comp);
    setQuickCatSelect(comp.category || categoriesList[0] || 'General');
  };

  const handleSaveQuickCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCategoryComp) return;

    festStore.updateCompetition({
      ...quickCategoryComp,
      category: quickCatSelect
    });

    setQuickCategoryComp(null);
    onRefresh();
  };

  // Handle Save (Create/Update) Competition
  const handleSaveCompetition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName) return;

    const finalCategory = newCompCategory || 'General';
    const parsedSpan = typeof newCompSpanTime === 'number' ? newCompSpanTime : parseInt(String(newCompSpanTime), 10);
    const validSpanTime = !isNaN(parsedSpan) && parsedSpan > 0 ? parsedSpan : 60;

    if (editingComp) {
      festStore.updateCompetition({
        ...editingComp,
        name: newCompName,
        category: finalCategory,
        type: newCompType,
        isStage: newCompIsStage,
        timeSpan: validSpanTime,
        maxEntriesPerGroup: newCompLimit,
        points1st: newCompP1,
        points2nd: newCompP2,
        points3rd: newCompP3,
        description: newCompDesc || 'Official College Festival Event.',
        imageUrl: newCompImageUrl,
        imageType: newCompImageType,
        teamSize: newCompType === 'Group' ? newCompTeamSize : undefined
      });
    } else {
      festStore.addCompetition({
        name: newCompName,
        category: finalCategory,
        type: newCompType,
        isStage: newCompIsStage,
        venue: '',
        scheduleTime: '',
        timeSpan: validSpanTime,
        maxEntriesPerGroup: newCompLimit,
        points1st: newCompP1,
        points2nd: newCompP2,
        points3rd: newCompP3,
        description: newCompDesc || 'Official College Festival Event.',
        imageUrl: newCompImageUrl,
        imageType: newCompImageType,
        teamSize: newCompType === 'Group' ? newCompTeamSize : undefined
      });
    }

    setShowCompModal(false);
    setEditingComp(null);
    setNewCompName('');
    setNewCompDesc('');
    setNewCompImageUrl('');
    setNewCompImageType('painting');
    onRefresh();
  };

  // Handle Create Group
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName || !newGroupLeaderName || !newGroupLeaderPass) return;

    const grpCode = newGroupCode || newGroupName.substring(0, 4).toUpperCase();
    const autoLeaderId = `${grpCode}-LEADER-${Date.now().toString().slice(-4)}`;

    festStore.addGroup(
      newGroupName,
      newGroupLeaderName,
      autoLeaderId,
      newGroupLeaderPass,
      grpCode,
      newGroupColor
    );

    setShowGroupModal(false);
    setNewGroupName('');
    setNewGroupLeaderName('');
    setNewGroupLeaderPass('');
    onRefresh();
  };

  return (
    <div className="space-y-6 py-4 sm:py-6 pb-24">
      
      {/* TAB: FEST OVERVIEW DASHBOARD */}
      {activeTab === 'overview' && (
        <FestOverviewView
          competitions={competitions}
          registrations={registrations}
          groups={groups}
          results={results}
          leaderboard={leaderboard}
          stagesList={stagesList}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onOpenCreateScheduleModal={() => setShowTopCreateScheduleModal(true)}
          onOpenPrintScheduleModal={() => setShowOverviewPrintSchedule(true)}
          onRefresh={onRefresh}
        />
      )}

      {/* TAB: SCHEDULE TABLE & CLASH ENGINE */}
      {activeTab === 'schedule' && (
        <CompetitionScheduleView
          competitions={competitions}
          registrations={registrations}
          stagesList={stagesList}
          onOpenEditModal={handleOpenEditCompModal}
          onDeleteComp={handleDeleteCompetition}
          onOpenCallSheet={(comp) => {
            setReportingCompId(comp.id);
            setShowCallSheetModal(true);
          }}
          onOpenPrintSchedule={() => setShowOverviewPrintSchedule(true)}
          onRefresh={onRefresh}
        />
      )}

      {/* TAB 1: ENTER RESULTS ENGINE */}
      {activeTab === 'results' && (
        <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-400" />
              Publish Competition Results
            </h2>
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Home Screen Group Point Status Show/Hide Switch */}
              <div className="flex items-center bg-[#121422] p-1 rounded-xl border border-[#292d4a]">
                <button
                  type="button"
                  onClick={() => handleToggleGroupPointStatus(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    showGroupPointStatus
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Show Group Point Status on home screen"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Show</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleGroupPointStatus(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    !showGroupPointStatus
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hide Group Point Status from home screen"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPerfPointConfigState(festStore.getPerformancePointConfig());
                  setPerfEditSuccessMsg('');
                  setShowEditPerfModal(true);
                }}
                className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5 text-purple-300" />
                <span>Edit Scale</span>
              </button>
            </div>
          </div>

          {/* Point Calculation Mode Toggle on Top of Result Publish */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#121422] p-4 rounded-2xl border border-purple-500/30 shadow-inner">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                <span>Team Point Calculation Mode:</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {calculateWithPerformancePoints
                  ? 'Active: Team points include Performance Grade Points (A+, A, B, C) + Winner Points (1st, 2nd, 3rd).'
                  : 'Active: Team points calculate ONLY Competition Winner Points (1st, 2nd, 3rd), without performance points.'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-[#181b30] p-1 rounded-xl border border-[#292d4a] self-start lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => handleToggleCalculatePerformancePoints(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  calculateWithPerformancePoints
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Calculate team point with performance point"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>With Performance Point</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleCalculatePerformancePoints(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  !calculateWithPerformancePoints
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Without performance point - Competition points 1st, 2nd, 3rd only"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Without Performance Point (1st, 2nd, 3rd Only)</span>
              </button>
            </div>
          </div>

          {calcModeMsg && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/40 text-purple-300 font-semibold text-xs rounded-2xl flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-purple-400" />
              <span>{calcModeMsg}</span>
            </div>
          )}

          {groupPointStatusMsg && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/40 text-purple-300 font-semibold text-xs rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-purple-400" />
              <span>{groupPointStatusMsg}</span>
            </div>
          )}

          {resultSuccessMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-semibold text-xs rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {resultSuccessMsg}
            </div>
          )}

          {resultErrorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/40 text-rose-400 font-semibold text-xs rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {resultErrorMsg}
            </div>
          )}

          <form onSubmit={handlePublishResult} className="space-y-6">
            
            {/* 1. Select Competition */}
            <div>
              {/* Search and Filter option bar matching screenshot */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={resultsCompSearch}
                    onChange={(e) => setResultsCompSearch(e.target.value)}
                    placeholder="Search competitions, stages, descriptions..."
                    className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                  {resultsCompSearch && (
                    <button
                      type="button"
                      onClick={() => setResultsCompSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-sm font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowResultsCategoryFilter(!showResultsCategoryFilter)}
                  className={`p-2.5 rounded-xl border transition-all shrink-0 flex items-center justify-center ${
                    showResultsCategoryFilter || resultsCategoryFilter !== 'All'
                      ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                      : 'bg-[#181b30] border-[#292d4a] text-slate-300 hover:text-white hover:border-purple-500/50'
                  }`}
                  title="Category Filter Options"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </div>

              {/* Collapsible Category Filter Options */}
              {showResultsCategoryFilter && (
                <div className="p-3 bg-[#181b30] border border-[#292d4a] rounded-xl mb-3 flex flex-wrap items-center gap-1.5 animate-fadeIn">
                  <span className="text-[10px] font-bold uppercase text-purple-400 mr-1">Category:</span>
                  {availableCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setResultsCategoryFilter(cat)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        resultsCategoryFilter === cat
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-[#151728] text-slate-400 hover:text-white border border-[#292d4a]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {(() => {
                const availableResultsComps = competitions.filter(comp => {
                  const matchesCat = resultsCategoryFilter === 'All' || comp.category === resultsCategoryFilter;
                  const q = resultsCompSearch.toLowerCase().trim();
                  const matchesQuery = !q ||
                    comp.name.toLowerCase().includes(q) ||
                    comp.category.toLowerCase().includes(q) ||
                    (comp.venue && String(comp.venue).toLowerCase().includes(q)) ||
                    (comp.description && comp.description.toLowerCase().includes(q));
                  
                  // Filter: Scored and saved by judge competitions only (at least one reported participant has marks saved by judge)
                  const compRegs = registrations.filter(r => r.competitionId === comp.id);
                  const reportedRegs = compRegs.filter(r => r.isReported === true);
                  const isScoredAndSavedByJudge = reportedRegs.length > 0 && reportedRegs.some(r => r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '');
                  
                  return matchesCat && matchesQuery && isScoredAndSavedByJudge;
                });

                return (
                  <div className="space-y-2">
                    <select
                      required
                      value={selectedCompId}
                      onChange={(e) => {
                        setSelectedCompId(e.target.value);
                        setFirstPlaceRegId('');
                        setSecondPlaceRegId('');
                        setThirdPlaceRegId('');
                      }}
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-2xl p-3.5 text-sm text-white font-bold focus:outline-none"
                    >
                      <option value="">
                        {availableResultsComps.length > 0
                          ? `-- Choose Competition (${availableResultsComps.length} with Judge Scores) --`
                          : '-- No Competitions with Saved Judge Scores Available --'}
                      </option>
                      {availableResultsComps.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          [{comp.category}] {comp.name} {comp.isPublishedResult ? '✓ Published' : ''}
                        </option>
                      ))}
                    </select>

                    {/* Competition selector */}
                  </div>
                );
              })()}
            </div>

            {selectedCompId && (() => {
              const reportedCompRegistrations = activeCompRegistrations.filter(r => r.isReported === true);
              const unreportedCount = activeCompRegistrations.length - reportedCompRegistrations.length;

              const firstWinner = reportedCompRegistrations.find(r => r.id === firstPlaceRegId);
              const secondWinner = reportedCompRegistrations.find(r => r.id === secondPlaceRegId);
              const thirdWinner = reportedCompRegistrations.find(r => r.id === thirdPlaceRegId);

              return (
                <div className="p-5 bg-[#181b30] border border-amber-500/40 rounded-3xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold border-b border-[#292d4a] pb-2">
                    <span className="text-white uppercase">{selectedCompetition?.name}</span>
                  </div>

                  {activeCompRegistrations.length === 0 ? (
                    <p className="text-xs text-amber-400 font-semibold py-2">
                      ⚠️ No participants registered for this competition yet. Group leaders must register participants first.
                    </p>
                  ) : reportedCompRegistrations.length === 0 ? (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/40 rounded-2xl text-center space-y-3">
                      <p className="text-xs text-rose-300 font-bold">
                        ⚠️ No participants are marked as "Reported (Present)" for this competition.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Students must be marked as Reported in the Participants Report module before results can be published.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setReportingCompId(selectedCompId);
                          setActiveTab('reporting');
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md transition-all inline-flex items-center gap-1.5"
                      >
                        <ClipboardList className="w-4 h-4" /> Go to Participants Report Module
                      </button>
                    </div>
                  ) : !reportedCompRegistrations.some(r => r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '') ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-2xl text-center space-y-2">
                      <p className="text-xs text-amber-300 font-bold">
                        ⚠️ No judge scores recorded for this competition yet.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Judges must enter and save participant marks on the <strong>Judge Valuation Sheet</strong> before results can be published.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">

                      <div className="space-y-2">
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          🏆 Calculated Winners (Determined automatically by highest judge marks)
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          
                          {/* 1st Place */}
                          <div className="bg-[#181a33] border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full flex items-center justify-center font-extrabold text-amber-400/20 text-3xl">
                              1
                            </div>
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 text-[9px] bg-amber-500/10 text-amber-400 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-500/20">
                                  🥇 1st Place (+{selectedCompetition?.points1st || 10} Pts)
                                </span>
                                {firstWinner?.judgeRank === 1 && (
                                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                                    ⚖️ Judge Pick: 1st
                                  </span>
                                )}
                              </div>
                              <div className="mt-3">
                                {firstWinner ? (
                                  <>
                                    <div className="text-white font-black text-sm tracking-wide truncate">
                                      {firstWinner.codeLetter ? `[Code ${firstWinner.codeLetter}] ` : ''}{festStore.getParticipantFullName(firstWinner.participantName, firstWinner.id)}
                                    </div>
                                    <div className="text-[11px] text-slate-400 truncate mt-0.5 font-bold">
                                      {firstWinner.groupName}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-slate-500 text-xs italic py-1">No participant scored</div>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-[#292d4a]/40 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Judge Score</span>
                              <span className="text-xs font-mono font-extrabold text-amber-400">
                                {firstWinner?.mark ? `${firstWinner.mark} / 100` : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* 2nd Place */}
                          <div className="bg-[#181a33] border border-slate-400/20 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-slate-400/5 rounded-bl-full flex items-center justify-center font-extrabold text-slate-400/15 text-3xl">
                              2
                            </div>
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 text-[9px] bg-slate-400/10 text-slate-300 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-slate-400/20">
                                  🥈 2nd Place (+{selectedCompetition?.points2nd || 7} Pts)
                                </span>
                                {secondWinner?.judgeRank === 2 && (
                                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                                    ⚖️ Judge Pick: 2nd
                                  </span>
                                )}
                              </div>
                              <div className="mt-3">
                                {secondWinner ? (
                                  <>
                                    <div className="text-white font-black text-sm tracking-wide truncate">
                                      {secondWinner.codeLetter ? `[Code ${secondWinner.codeLetter}] ` : ''}{festStore.getParticipantFullName(secondWinner.participantName, secondWinner.id)}
                                    </div>
                                    <div className="text-[11px] text-slate-400 truncate mt-0.5 font-bold">
                                      {secondWinner.groupName}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-slate-500 text-xs italic py-1">No participant scored</div>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-[#292d4a]/40 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Judge Score</span>
                              <span className="text-xs font-mono font-extrabold text-slate-300">
                                {secondWinner?.mark ? `${secondWinner.mark} / 100` : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* 3rd Place */}
                          <div className="bg-[#181a33] border border-amber-700/20 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-700/5 rounded-bl-full flex items-center justify-center font-extrabold text-amber-700/15 text-3xl">
                              3
                            </div>
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 text-[9px] bg-amber-700/10 text-amber-600 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-700/25">
                                  🥉 3rd Place (+{selectedCompetition?.points3rd || 5} Pts)
                                </span>
                                {thirdWinner?.judgeRank === 3 && (
                                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                                    ⚖️ Judge Pick: 3rd
                                  </span>
                                )}
                              </div>
                              <div className="mt-3">
                                {thirdWinner ? (
                                  <>
                                    <div className="text-white font-black text-sm tracking-wide truncate">
                                      {thirdWinner.codeLetter ? `[Code ${thirdWinner.codeLetter}] ` : ''}{festStore.getParticipantFullName(thirdWinner.participantName, thirdWinner.id)}
                                    </div>
                                    <div className="text-[11px] text-slate-400 truncate mt-0.5 font-bold">
                                      {thirdWinner.groupName}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-slate-500 text-xs italic py-1">No participant scored</div>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-[#292d4a]/40 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Judge Score</span>
                              <span className="text-xs font-mono font-extrabold text-amber-600">
                                {thirdWinner?.mark ? `${thirdWinner.mark} / 100` : 'N/A'}
                              </span>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Participant Point Calculation Live Preview Table */}
                      <div className="space-y-3 pt-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="text-xs font-bold text-purple-400 uppercase tracking-wide flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-purple-400" />
                              <span>Participant Point Calculation Live Preview</span>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-400">
                              Mode: {calculateWithPerformancePoints ? '✨ With Performance Points' : '🏆 Competition Points Only (1st, 2nd, 3rd)'}
                            </span>
                          </div>
                          
                          <div className="overflow-x-auto rounded-2xl border border-[#292d4a] bg-[#151728]">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-[#181b30] border-b border-[#292d4a] text-[10px] font-bold text-slate-400 uppercase">
                                  <th className="py-2.5 px-3">Rank / Participant</th>
                                  <th className="py-2.5 px-3 text-center">Judge Score</th>
                                  <th className="py-2.5 px-3 text-center">Grade</th>
                                  <th className="py-2.5 px-3 text-center">Comp Pts</th>
                                  <th className="py-2.5 px-3 text-center">
                                    {calculateWithPerformancePoints ? 'Perf Pts' : 'Perf Pts (Disabled)'}
                                  </th>
                                  <th className="py-2.5 px-3 text-right">Team Contribution</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#292d4a]/50 text-slate-300 font-medium">
                                {[...reportedCompRegistrations]
                                  .map(reg => {
                                    const score = Number(reg.mark) || 0;
                                    const { grade, points: rawPerformancePoints } = calculatePerformancePoints(
                                      score,
                                      selectedCompetition?.type || 'Individual',
                                      selectedCompetition?.teamSize || 4
                                    );
                                    
                                    const performancePoints = calculateWithPerformancePoints ? rawPerformancePoints : 0;

                                    let competitionPoints = 0;
                                    let rankBadge = '';

                                    if (reg.id === firstPlaceRegId) {
                                      competitionPoints = selectedCompetition?.points1st || 10;
                                      rankBadge = '🥇';
                                    } else if (reg.id === secondPlaceRegId) {
                                      competitionPoints = selectedCompetition?.points2nd || 7;
                                      rankBadge = '🥈';
                                    } else if (reg.id === thirdPlaceRegId) {
                                      competitionPoints = selectedCompetition?.points3rd || 5;
                                      rankBadge = '🥉';
                                    } else {
                                      competitionPoints = 0;
                                    }

                                    return {
                                      reg,
                                      score,
                                      grade,
                                      rawPerformancePoints,
                                      performancePoints,
                                      competitionPoints,
                                      totalPoints: competitionPoints + performancePoints,
                                      rankBadge
                                    };
                                  })
                                  .sort((a, b) => b.score - a.score)
                                  .map((item, idx) => {
                                    return (
                                      <tr key={item.reg.id} className="hover:bg-[#1f223d]/40 transition-colors">
                                        <td className="py-2.5 px-3">
                                          <div className="flex items-center gap-1.5">
                                            <span className="w-6 font-mono font-bold text-slate-400">
                                              {item.rankBadge || `${idx + 1}th`}
                                            </span>
                                            <div>
                                              <span className="text-white font-bold block">
                                                {item.reg.codeLetter ? `[Code ${item.reg.codeLetter}] ` : ''}{festStore.getParticipantFullName(item.reg.participantName, item.reg.id)}
                                              </span>
                                              <span className="text-[10px] text-slate-400 block">
                                                {item.reg.groupName} {selectedCompetition?.type === 'Group' && `(No. of members: ${selectedCompetition?.teamSize || 4})`}
                                              </span>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                                          {item.score} / 100
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            item.grade === 'A+' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                                            item.grade === 'A' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' :
                                            item.grade === 'B' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                                            item.grade === 'C' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                                            'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                                          }`}>
                                            {item.grade}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-400">
                                          +{item.competitionPoints}
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-400">
                                          {calculateWithPerformancePoints ? `+${item.rawPerformancePoints}` : <span className="text-slate-500 text-[10px]">0 (Disabled)</span>}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-400">
                                          {item.totalPoints} pts
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                    </div>
                  )}

                  {reportedCompRegistrations.length > 0 && (
                    <button type="submit" className="poster-btn-primary w-full py-3.5 text-xs rounded-2xl mt-2">
                      <Trophy className="w-4 h-4" />
                      <span>Publish Result & Update Live Scores</span>
                    </button>
                  )}

                </div>
              );
            })()}

          </form>

          {/* Published & Not Published Competition Results Table */}
          <div className="pt-6 border-t border-[#292d4a] space-y-4">
            {/* Badges / Stats */}
            {(() => {
              const isScoredByJudge = (comp: Competition) => {
                const compRegs = registrations.filter(r => r.competitionId === comp.id);
                const reportedRegs = compRegs.filter(r => r.isReported === true);
                return reportedRegs.length > 0 && reportedRegs.some(r => r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '');
              };

              const judgedComps = competitions.filter(isScoredByJudge);
              const publishedComps = judgedComps.filter(c => {
                const publishedResult = results.find(r => r.competitionId === c.id);
                return c.isPublishedResult || !!publishedResult;
              });
              const pendingComps = judgedComps.filter(c => {
                const publishedResult = results.find(r => r.competitionId === c.id);
                return !c.isPublishedResult && !publishedResult;
              });

              return (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Evaluated Competitions</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        (Only competitions with saved judge scores)
                      </span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold shrink-0">
                    <span className="px-3 py-1 rounded-full bg-[#181b30] border border-[#292d4a] text-slate-300">
                      Total Evaluated: {judgedComps.length}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      ✓ Published: {publishedComps.length}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      ⏳ Pending Publish: {pendingComps.length}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#181b30] p-3 rounded-2xl border border-[#292d4a]">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search evaluated competition name, category, stage..."
                  value={resultsTableSearch}
                  onChange={(e) => setResultsTableSearch(e.target.value)}
                  className="w-full bg-[#151728] border border-[#292d4a] focus:border-purple-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
                />
                {resultsTableSearch && (
                  <button
                    onClick={() => setResultsTableSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {(['All', 'Published', 'Pending'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setResultsStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                      resultsStatusFilter === status
                        ? status === 'Published'
                          ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                          : status === 'Pending'
                          ? 'bg-amber-600 border-amber-500 text-white shadow-md'
                          : 'bg-purple-600 border-purple-500 text-white shadow-md'
                        : 'bg-[#151728] border-[#292d4a] text-slate-400 hover:text-white'
                    }`}
                  >
                    {status === 'Published' && '✓ '}
                    {status === 'Pending' && '⏳ '}
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#292d4a] bg-[#181b30]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#151728] border-b border-[#292d4a] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Competition</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Winners Summary</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#292d4a] text-xs font-medium text-slate-200">
                  {(() => {
                    const judgedCompsList = competitions.filter((comp) => {
                      const compRegs = registrations.filter(r => r.competitionId === comp.id);
                      const reportedRegs = compRegs.filter(r => r.isReported === true);
                      const isScoredByJudge = reportedRegs.length > 0 && reportedRegs.some(r => r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '');
                      if (!isScoredByJudge) return false;

                      const publishedResult = results.find((r) => r.competitionId === comp.id);
                      const isPublished = (comp.isPublishedResult || !!publishedResult);

                      const matchesCategory =
                        resultsCategoryFilter === 'All' || comp.category === resultsCategoryFilter;
                      const matchesStatus =
                        resultsStatusFilter === 'All' ||
                        (resultsStatusFilter === 'Published' && isPublished) ||
                        (resultsStatusFilter === 'Pending' && !isPublished);
                      const query = resultsTableSearch.trim().toLowerCase();
                      const matchesQuery =
                        !query ||
                        comp.name.toLowerCase().includes(query) ||
                        comp.category.toLowerCase().includes(query) ||
                        (comp.venue && comp.venue.toLowerCase().includes(query));

                      return matchesCategory && matchesStatus && matchesQuery;
                    });

                    if (judgedCompsList.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-slate-400">
                            <Trophy className="w-8 h-8 text-amber-500/30 mx-auto mb-2" />
                            <p className="font-bold text-slate-300 text-sm">No Judge-Evaluated Competitions</p>
                            <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                              Competitions will automatically appear here once the judge enters and saves marks on the <strong>Judge Valuation Sheet</strong>.
                            </p>
                          </td>
                        </tr>
                      );
                    }

                    return judgedCompsList.map((comp) => {
                      const publishedResult = results.find((r) => r.competitionId === comp.id);
                      const isPublished = comp.isPublishedResult || !!publishedResult;

                      return (
                        <tr key={comp.id} className="hover:bg-[#1f223d] transition-colors">
                          <td className="py-3 px-4 font-bold text-white">
                            {comp.name}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {comp.type === 'Group' ? `Group (${comp.teamSize || 4} members)` : comp.type} • {comp.isStage ? 'Stage' : 'Off-Stage'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 text-[11px] font-semibold">
                              {comp.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 text-xs">
                            {comp.venue && formatStageName(comp.venue) ? (
                              formatStageName(comp.venue)
                            ) : (
                              <span className="text-slate-400 italic">To Be Announced</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isPublished ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold text-[11px]">
                                <CheckCircle2 className="w-3 h-3" />
                                Published
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-[11px]">
                                ⏳ Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {publishedResult ? (
                              <div className="space-y-0.5">
                                {publishedResult.firstPlaceParticipantName && (
                                  <div className="text-amber-300 font-semibold flex items-center gap-1">
                                    <span>🥇</span>
                                    <span>{festStore.getParticipantFullName(publishedResult.firstPlaceParticipantName, publishedResult.firstPlaceRegId)}</span>
                                    <span className="text-slate-400 text-[10px]">({publishedResult.firstPlaceGroupName})</span>
                                  </div>
                                )}
                                {publishedResult.secondPlaceParticipantName && (
                                  <div className="text-slate-300 flex items-center gap-1">
                                    <span>🥈</span>
                                    <span>{festStore.getParticipantFullName(publishedResult.secondPlaceParticipantName, publishedResult.secondPlaceRegId)}</span>
                                    <span className="text-slate-400 text-[10px]">({publishedResult.secondPlaceGroupName})</span>
                                  </div>
                                )}
                                {publishedResult.thirdPlaceParticipantName && (
                                  <div className="text-amber-600 flex items-center gap-1">
                                    <span>🥉</span>
                                    <span>{festStore.getParticipantFullName(publishedResult.thirdPlaceParticipantName, publishedResult.thirdPlaceRegId)}</span>
                                    <span className="text-slate-400 text-[10px]">({publishedResult.thirdPlaceGroupName})</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Not published yet</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleTogglePublishResult(comp)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-end gap-1.5 ml-auto ${
                                isPublished
                                  ? 'bg-rose-500/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                              }`}
                            >
                              {isPublished ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>Unpublish</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Publish</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PARTICIPANTS REPORT & CODE LETTER SYSTEM */}
      {activeTab === 'reporting' && (() => {
        const scheduledComps = competitions.filter(isCompetitionScheduled);
        const selectedRepComp = scheduledComps.find(c => c.id === reportingCompId);
        const compRegistrations = reportingCompId ? registrations.filter(r => r.competitionId === reportingCompId) : [];

        const compCategoryList = Array.from(new Set(scheduledComps.map(c => c.category || 'General')));
        const reportingCategories = ['All', ...compCategoryList];

        const filteredCandidates = [...compRegistrations].sort((a, b) => {
          const aReported = a.isReported === true ? 1 : 0;
          const bReported = b.isReported === true ? 1 : 0;
          if (aReported !== bReported) {
            return bReported - aReported; // Reported participants move to top
          }
          if (a.isReported && b.isReported && a.codeLetter && b.codeLetter) {
            return a.codeLetter.localeCompare(b.codeLetter);
          }
          return 0;
        });

        // Group color helper
        const getGroupColor = (gId?: string) => {
          const grp = groups.find(g => g.id === gId);
          return grp?.color || '#8b5cf6';
        };

        return (
          <div className="space-y-6">
            <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl">
              
              {/* Header Title */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
                    <ClipboardList className="w-6 h-6 text-cyan-400" />
                    Participants Report
                  </h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedRepComp && (
                    <button
                      type="button"
                      onClick={() => {
                        const newStatus = selectedRepComp.reportingStatus === 'closed' ? 'open' : 'closed';
                        festStore.updateCompetition({
                          ...selectedRepComp,
                          reportingStatus: newStatus
                        });
                        setReportingSuccessMsg(`Reporting successfully ${newStatus === 'closed' ? 'CLOSED' : 'OPENED'} for ${selectedRepComp.name}.`);
                        onRefresh();
                      }}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-2xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-lg ${
                        selectedRepComp.reportingStatus === 'closed'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25 shadow-rose-500/5'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 shadow-emerald-500/5'
                      }`}
                    >
                      {selectedRepComp.reportingStatus === 'closed' ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-rose-400" />
                          Reporting: Closed
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                          Reporting: Open
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setReportingCompId('All');
                      setReportingCategoryFilter('All');
                      setShowCallSheetModal(true);
                    }}
                    className="px-3.5 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all shrink-0 cursor-pointer"
                    title="Print / Export Participants Report Sheet"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Report Sheet</span>
                  </button>
                </div>
              </div>

              {reportingSuccessMsg && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 font-semibold text-xs rounded-2xl flex items-center justify-between gap-2 animate-fadeIn">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {reportingSuccessMsg}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReportingSuccessMsg('')}
                    className="text-emerald-400 hover:text-white text-xs font-bold"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Competition Selector */}
              <div className="space-y-3">
                {/* Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                  {reportingCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setReportingCategoryFilter(cat)}
                      className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                        reportingCategoryFilter === cat
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <select
                  value={reportingCompId}
                  onChange={(e) => {
                    setReportingCompId(e.target.value);
                    setReportingSuccessMsg('');
                  }}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-cyan-500 rounded-2xl p-3.5 text-sm text-white font-bold focus:outline-none transition-all"
                >
                  <option value="">-- Choose Competition to Manage Reporting --</option>
                  {scheduledComps
                    .filter(comp => reportingCategoryFilter === 'All' || comp.category === reportingCategoryFilter)
                    .map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* When Event is Selected */}
              {selectedRepComp ? (
                <div className="space-y-6 py-0">
                  {/* Candidates Table */}
                  {filteredCandidates.length === 0 ? (
                    <div className="p-8 text-center bg-[#181b30] rounded-2xl border border-[#292d4a] text-slate-400">
                      <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                      <p className="text-sm font-bold text-slate-300">No participants registered for this event yet.</p>
                      <p className="text-xs text-slate-500 mt-1">Group leaders must register participants first.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-[#292d4a] bg-[#181b30]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#292d4a] bg-[#151728] text-slate-400 font-extrabold uppercase text-[10px]">
                            <th className="py-3.5 px-4 w-12 text-center">#</th>
                            <th className="py-3.5 px-4 w-28">Code Letter</th>
                            <th className="py-3.5 px-4">Chest No / ID</th>
                            <th className="py-3.5 px-4">Participant Name</th>
                            <th className="py-3.5 px-4">Group</th>
                            <th className="py-3.5 px-4 text-center">Report Status</th>
                            <th className="py-3.5 px-4 text-right">Generate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#292d4a]/50">
                          {filteredCandidates.map((reg, idx) => {
                            const isPresent = reg.isReported === true;
                            const grpColor = getGroupColor(reg.groupId);

                            return (
                              <tr
                                key={reg.id}
                                className={`transition-colors ${
                                  isPresent ? 'hover:bg-white/[0.02]' : 'bg-rose-500/5 hover:bg-rose-500/10'
                                }`}
                              >
                                <td className="py-3 px-4 text-center text-slate-500 font-mono font-bold">
                                  {idx + 1}
                                </td>

                                {/* Code Letter Column */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1.5">
                                    <CodeLetterInput
                                      initialValue={reg.codeLetter || ''}
                                      onSave={(newLetter) => {
                                        festStore.updateRegistrationCodeLetter(reg.id, newLetter);
                                        onRefresh();
                                      }}
                                    />
                                    <span className="text-[10px] text-slate-500 font-mono">Code</span>
                                  </div>
                                </td>

                                {/* Chest No */}
                                <td className="py-3 px-4 font-mono font-bold text-white">
                                  {reg.participantUserId || 'N/A'}
                                </td>

                                {/* Name */}
                                <td className="py-3 px-4 font-bold text-slate-200">
                                  <div className="flex items-center gap-2">
                                    <ParticipantAvatar
                                      name={festStore.getParticipantFullName(reg.participantName, reg.id)}
                                      photoUrl={festStore.getParticipantPhotoUrl(reg.participantName, reg.id)}
                                      className="w-6 h-6 border border-purple-500/30 shrink-0"
                                    />
                                    <span>{festStore.getParticipantFullName(reg.participantName, reg.id)}</span>
                                    {!isPresent && (
                                      <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[9px] font-extrabold uppercase">
                                        Absent
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Group */}
                                <td className="py-3 px-4">
                                  <span
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-block border"
                                    style={{
                                      backgroundColor: `${grpColor}20`,
                                      borderColor: `${grpColor}50`,
                                      color: grpColor
                                    }}
                                  >
                                    {reg.groupName}
                                  </span>
                                </td>

                                {/* Attendance Toggle / Report Status */}
                                <td className="py-3 px-4 text-center">
                                  {(() => {
                                    const isClosed = selectedRepComp.reportingStatus === 'closed';

                                    if (isClosed) {
                                      return (
                                        <div
                                          className={`p-2 rounded-xl font-extrabold text-xs inline-flex items-center justify-center opacity-40 cursor-not-allowed select-none ${
                                            isPresent
                                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                          }`}
                                          title="Reporting is Closed: Report status cannot be changed"
                                        >
                                          {isPresent ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                          ) : (
                                            <AlertCircle className="w-4 h-4 text-rose-400" />
                                          )}
                                        </div>
                                      );
                                    }

                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          festStore.updateRegistrationReporting(reg.id, !isPresent);
                                          onRefresh();
                                        }}
                                        className={`p-2 rounded-xl font-extrabold text-xs transition-all inline-flex items-center justify-center cursor-pointer ${
                                          isPresent
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                                        }`}
                                        title={
                                          isPresent
                                            ? 'Reported (Present) - Click to mark Absent'
                                            : 'Not Reported (Absent) - Click to mark Present'
                                        }
                                      >
                                        {isPresent ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        ) : (
                                          <AlertCircle className="w-4 h-4 text-rose-400" />
                                        )}
                                      </button>
                                    );
                                  })()}
                                </td>

                                {/* Quick Actions */}
                                <td className="py-3 px-4 text-right">
                                  {(() => {
                                    const isClosed = selectedRepComp.reportingStatus === 'closed';
                                    const isAbsent = !isPresent;
                                    const isGenerateDisabled = isAbsent && isClosed;

                                    let tooltip = reg.codeLetter
                                      ? `Assigned: ${reg.codeLetter}. Click to re-roll random code letter.`
                                      : "Generate Random Blind Code Letter";
                                    if (isAbsent && isClosed) {
                                      tooltip = "Reporting is closed for absent participants";
                                    }

                                    return (
                                      <button
                                        type="button"
                                        disabled={isGenerateDisabled}
                                        onClick={() => {
                                          if (isGenerateDisabled) return;

                                          const getCodeLetterForIndex = (i: number): string => {
                                            let letter = '';
                                            let temp = i;
                                            while (temp >= 0) {
                                              letter = String.fromCharCode((temp % 26) + 65) + letter;
                                              temp = Math.floor(temp / 26) - 1;
                                            }
                                            return letter;
                                          };

                                          // Count of present (reported) candidates for this competition
                                          const reportedRegs = compRegistrations.filter(r => r.isReported === true || r.id === reg.id);
                                          const totalPresentCount = Math.max(reportedRegs.length, 1);

                                          // Pool of allowed letters based on present candidates count (e.g. 5 present -> A, B, C, D, E)
                                          const allowedPool = Array.from({ length: totalPresentCount }, (_, i) => getCodeLetterForIndex(i));

                                          // Letters already assigned to other participants
                                          const usedLetters = new Set(
                                            compRegistrations
                                              .filter(r => r.id !== reg.id && r.codeLetter && r.codeLetter.trim() !== '')
                                              .map(r => r.codeLetter!.trim().toUpperCase())
                                          );

                                          // Filter pool for available unused letters
                                          const availableInPool = allowedPool.filter(l => !usedLetters.has(l));

                                          let generatedLetter = '';
                                          if (availableInPool.length > 0) {
                                            // Pick randomly from the available letters in the present pool
                                            generatedLetter = availableInPool[Math.floor(Math.random() * availableInPool.length)];
                                          } else {
                                            // If pool is exhausted, pick the next available unused letter overall
                                            let k = 0;
                                            while (usedLetters.has(getCodeLetterForIndex(k))) {
                                              k++;
                                            }
                                            generatedLetter = getCodeLetterForIndex(k);
                                          }

                                          if (!reg.isReported) {
                                            festStore.updateRegistrationReporting(reg.id, true);
                                          }
                                          festStore.updateRegistrationCodeLetter(reg.id, generatedLetter);
                                          setReportingSuccessMsg(`Assigned code letter "${generatedLetter}" to ${reg.participantName}.`);
                                          onRefresh();
                                        }}
                                        className={`p-2 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center ${
                                          isGenerateDisabled
                                            ? 'bg-slate-800/40 text-slate-500 border border-[#292d4a] cursor-not-allowed opacity-50'
                                            : reg.codeLetter
                                            ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 cursor-pointer'
                                            : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 cursor-pointer'
                                        }`}
                                        title={tooltip}
                                      >
                                        <Wand2 className={`w-4 h-4 ${isGenerateDisabled ? 'text-slate-500' : reg.codeLetter ? 'text-purple-300' : 'text-cyan-400'}`} />
                                      </button>
                                    );
                                  })()}
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
                <div className="p-10 text-center bg-[#181b30] rounded-3xl border border-[#292d4a] space-y-3">
                  <ClipboardList className="w-12 h-12 text-cyan-400/50 mx-auto" />
                  <h3 className="text-base font-extrabold text-white">Select a Competition Above</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Choose any competition from the list above to view registered participants, assign blind code letters (A, B, C...), mark presence, and generate printable call sheets.
                  </p>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* TAB: VALUATION SHEET / JUDGE ASSIGNMENT */}
      {activeTab === 'valuation' && (() => {
        const scheduledComps = competitions.filter(c => isCompetitionScheduled(c) && c.reportingStatus === 'closed');
        const assignedComps = scheduledComps.filter(c => valuationCompIds.includes(c.id));
        const selectedValComp = scheduledComps.find(c => c.id === valuationCompId) || (assignedComps.length > 0 ? assignedComps[0] : null);

        const getCompStage = (c: Competition): string => {
          if (c.venue && c.venue.trim()) return formatStageName(c.venue.trim());
          if (c.isStage === false) return 'Off-Stage';
          return 'General Stage';
        };

        const getCompDate = (c: Competition): string => {
          if (!c.scheduleTime) return 'Unscheduled';
          const { dayDate } = normalizeScheduleString(c.scheduleTime);
          if (dayDate) {
            const formatted = formatDayDateWithWeekday(dayDate);
            if (formatted) return formatted;
            return dayDate;
          }
          const parts = c.scheduleTime.split(',');
          if (parts.length > 0 && parts[0].trim()) {
            return parts[0].trim();
          }
          return 'Unscheduled';
        };

        const festivalDays = festStore.getFestivalDays();
        const festDayDates = festivalDays.map(d => formatDayDateWithWeekday(d.date, d.label) || d.label || d.date).filter(Boolean);
        const compDates = scheduledComps.map(c => getCompDate(c)).filter(Boolean);
        const availableValuationDates = Array.from(new Set([...festDayDates, ...compDates]));

        const compMatchesDate = (c: Competition, targetDate: string): boolean => {
          if (targetDate === 'All') return true;
          const cDate = getCompDate(c);
          if (cDate === targetDate) return true;
          if (c.scheduleTime && c.scheduleTime.toLowerCase().includes(targetDate.toLowerCase())) return true;
          return false;
        };

        const allKnownStages = Array.from(new Set([
          ...stagesList.map(s => formatStageName(s)),
          ...scheduledComps.map(c => getCompStage(c))
        ])).filter(Boolean);
        const availableValuationStages = allKnownStages;

        const filteredComps = scheduledComps.filter(c => {
          if (valuationStageFilter && valuationStageFilter !== 'All' && getCompStage(c) !== valuationStageFilter) return false;
          if (valuationDateFilter && valuationDateFilter !== 'All' && !compMatchesDate(c, valuationDateFilter)) return false;
          if (valuationCompSearch.trim()) {
            const q = valuationCompSearch.toLowerCase().trim();
            return c.name.toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q) || (c.venue || '').toLowerCase().includes(q) || (c.scheduleTime || '').toLowerCase().includes(q);
          }
          return true;
        });

        // Group assigned competitions by Stage
        const assignedCompsByStage: { [stage: string]: Competition[] } = {};
        assignedComps.forEach(comp => {
          const stg = getCompStage(comp);
          if (!assignedCompsByStage[stg]) assignedCompsByStage[stg] = [];
          assignedCompsByStage[stg].push(comp);
        });
        const assignedStagesList = Object.keys(assignedCompsByStage);

        // Group filtered competitions by Stage into separate sections
        const targetStages = (valuationStageFilter && valuationStageFilter !== 'All') ? [valuationStageFilter] : allKnownStages;
        const stageSections = targetStages.map(stg => {
          const stageComps = filteredComps.filter(c => getCompStage(c) === stg);
          return {
            stageName: stg,
            comps: stageComps
          };
        }).filter(sec => sec.comps.length > 0);

        // Include any remaining competitions whose stage was not listed
        const accountedIds = new Set(stageSections.flatMap(s => s.comps.map(c => c.id)));
        const unassignedStageComps = filteredComps.filter(c => !accountedIds.has(c.id));
        if (unassignedStageComps.length > 0) {
          stageSections.push({
            stageName: 'General Stage',
            comps: unassignedStageComps
          });
        }

        const handleToggleComp = (compId: string) => {
          const comp = scheduledComps.find(c => c.id === compId);
          if (!comp) return;
          const compStage = getCompStage(comp);
          const currentIds = festStore.getActiveValuationCompIds();
          const isAssigned = currentIds.includes(compId);

          let newIds: string[];
          if (isAssigned) {
            newIds = currentIds.filter(id => id !== compId);
            setValuationSuccessMsg(`Removed "${comp.name}" from Judge Desk.`);
          } else {
            // Remove any existing active competition in the SAME stage
            const otherStageIds = currentIds.filter(id => {
              const otherComp = scheduledComps.find(c => c.id === id);
              return otherComp ? getCompStage(otherComp) !== compStage : false;
            });
            newIds = [...otherStageIds, compId];
            setValuationCompId(compId);
            setValuationSuccessMsg(`Assigned "${comp.name}" to Judge Desk for ${compStage} (replaced active event in this stage).`);
          }

          festStore.setActiveValuationCompIds(newIds);
          setValuationCompIds(newIds);
          setTimeout(() => setValuationSuccessMsg(''), 4000);
          onRefresh();
        };

        const handleAddSingleComp = (compId: string) => {
          if (!compId) return;
          handleToggleComp(compId);
        };

        const handleRemoveComp = (compId: string) => {
          festStore.removeValuationCompId(compId);
          const ids = festStore.getActiveValuationCompIds();
          setValuationCompIds(ids);
          if (valuationCompId === compId) {
            setValuationCompId(ids[0] || '');
          }
          setValuationSuccessMsg('Competition removed from Judge Desk.');
          setTimeout(() => setValuationSuccessMsg(''), 4000);
          onRefresh();
        };

        const handleClearStage = (stageName: string) => {
          const stageComps = scheduledComps.filter(c => getCompStage(c) === stageName);
          const stageIds = new Set(stageComps.map(c => c.id));
          const remaining = valuationCompIds.filter(id => !stageIds.has(id));
          festStore.setActiveValuationCompIds(remaining);
          setValuationCompIds(remaining);
          if (stageIds.has(valuationCompId)) {
            setValuationCompId(remaining[0] || '');
          }
          setValuationSuccessMsg(`Cleared active competition in ${stageName} from Judge Desk.`);
          setTimeout(() => setValuationSuccessMsg(''), 4000);
          onRefresh();
        };

        const handleSelectAllFiltered = () => {
          const filteredIds = filteredComps.map(c => c.id);
          const combined = Array.from(new Set([...valuationCompIds, ...filteredIds]));
          festStore.setActiveValuationCompIds(combined);
          setValuationCompIds(combined);
          if (filteredIds.length > 0 && !combined.includes(valuationCompId)) {
            setValuationCompId(filteredIds[0]);
          }
          setValuationSuccessMsg(`Assigned ${filteredIds.length} competition(s) to Judge Valuation Sheet!`);
          setTimeout(() => setValuationSuccessMsg(''), 4000);
          onRefresh();
        };

        const handleClearAllAssigned = () => {
          festStore.clearValuationCompIds();
          setValuationCompIds([]);
          setValuationCompId('');
          setValuationSuccessMsg('All competitions cleared from Judge Valuation Desk.');
          setTimeout(() => setValuationSuccessMsg(''), 4000);
          onRefresh();
        };

        return (
          <div className="space-y-6">
            <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl">
              
              {/* Header Title & Print Valuation Sheet Action */}
              <div className="border-b border-[#292d4a] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
                    <Scale className="w-6 h-6 text-emerald-400" />
                    Assign Competitions for Judge Valuation
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Assign closed-reporting events to active judge desk or print official mark sheets for manual evaluation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPrintValuationModal(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Valuation Sheet</span>
                </button>
              </div>

              {/* Alert Feedback Messages */}
              {valuationSuccessMsg && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 font-semibold flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{valuationSuccessMsg}</span>
                </div>
              )}

              {scheduledComps.length === 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 font-semibold flex items-center gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>No closed-reporting competitions are available. To make a competition available for Judge Valuation, please mark attendance and <strong>Close Reporting</strong> (Reporting: Closed) in the <em>Participants Report</em> tab first.</span>
                </div>
              )}



              {/* STAGE-BY-STAGE COMPETITION ASSIGNMENT */}
              <div className="space-y-4 pt-1">
                {/* Filters & Search Row */}
                <div className="space-y-3">
                  {/* Date & Stage Filter Pills */}
                  <div className="space-y-2.5">
                    {/* Date Filter Pills */}
                    {availableValuationDates.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {availableValuationDates.map(dt => {
                          const count = scheduledComps.filter(c => compMatchesDate(c, dt)).length;
                          const isSelected = valuationDateFilter === dt;
                          return (
                            <button
                              key={dt}
                              type="button"
                              onClick={() => setValuationDateFilter(prev => prev === dt ? 'All' : dt)}
                              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30 ring-1 ring-cyan-400'
                                  : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                              }`}
                            >
                              <span>{dt}</span>
                              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                                isSelected ? 'bg-black/30 text-white' : 'bg-[#121424] text-slate-400'
                              }`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Stage Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {availableValuationStages.map(stg => {
                        const count = scheduledComps.filter(c => {
                          if (valuationDateFilter !== 'All' && !compMatchesDate(c, valuationDateFilter)) return false;
                          return getCompStage(c) === stg;
                        }).length;
                        const isSelected = valuationStageFilter === stg;
                        return (
                          <button
                            key={stg}
                            type="button"
                            onClick={() => setValuationStageFilter(prev => prev === stg ? 'All' : stg)}
                            className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400'
                                : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                            }`}
                          >
                            <span>{stg}</span>
                            <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                              isSelected ? 'bg-black/30 text-white' : 'bg-[#121424] text-slate-400'
                            }`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* SEPARATE SECTION FOR EACH STAGE */}
                {stageSections.length === 0 ? (
                  <div className="p-8 text-center bg-[#181b30] rounded-2xl border border-dashed border-[#292d4a] space-y-2">
                    <p className="text-xs text-slate-400">No competitions found matching current Stage and Category filters.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {stageSections.map((section) => {
                      const stageComps = section.comps;
                      const activeCompInStage = stageComps.find(c => valuationCompIds.includes(c.id));
                      const anyStageAssigned = !!activeCompInStage;

                      return (
                        <div 
                          key={section.stageName}
                          className="p-5 bg-[#181b30] rounded-3xl border border-[#292d4a] space-y-4 shadow-lg transition-all"
                        >
                          {/* Stage Section Header */}
                          <div className="flex items-center justify-between border-b border-[#292d4a] pb-3.5">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                <Landmark className="w-5 h-5" />
                              </div>
                              <h4 className="text-base font-black text-white">
                                {section.stageName}
                              </h4>
                            </div>
                          </div>

                          {/* Stage Competitions Table */}
                          <div className="overflow-x-auto rounded-2xl border border-[#292d4a]">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-[#121424] text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#292d4a]">
                                <tr>
                                  <th className="py-3 px-4 w-12 text-center">Active</th>
                                  <th className="py-3 px-4">Competition Name</th>
                                  <th className="py-3 px-4">Category</th>
                                  <th className="py-3 px-4 text-center">Reported Candidates</th>
                                  <th className="py-3 px-4 text-right">Judge Desk Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#292d4a] bg-[#121424]/60">
                                {stageComps.map((comp) => {
                                  const isAssigned = valuationCompIds.includes(comp.id);
                                  const compRegs = registrations.filter(r => r.competitionId === comp.id && r.isReported === true);
                                  const hasMarks = compRegs.length > 0 && compRegs.some(r => r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '');
                                  const isValuationDone = comp.status === 'completed' || comp.isPublishedResult || hasMarks;

                                  return (
                                    <tr
                                      key={comp.id}
                                      className={`transition-colors ${
                                        isAssigned 
                                          ? 'bg-emerald-950/20 hover:bg-emerald-950/30' 
                                          : isValuationDone
                                            ? 'bg-emerald-950/10 hover:bg-emerald-950/20'
                                            : 'hover:bg-[#181b30]/50'
                                      }`}
                                    >
                                      <td className="py-3 px-4 text-center">
                                        <input
                                          type="radio"
                                          name={`stage-${section.stageName}`}
                                          checked={isAssigned}
                                          onChange={() => handleToggleComp(comp.id)}
                                          className="w-4 h-4 border-[#292d4a] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                      </td>

                                      <td className="py-3 px-4">
                                        <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                                          <span>{comp.name}</span>
                                          {isValuationDone && (
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                                              <CheckCircle2 className="w-3 h-3" /> Valuation Done
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      <td className="py-3 px-4">
                                        <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                                          {comp.category}
                                        </span>
                                      </td>

                                      <td className="py-3 px-4 text-center font-bold text-emerald-400">
                                        {compRegs.length} Reported
                                      </td>

                                      <td className="py-3 px-4 text-right">
                                        {isAssigned ? (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleComp(comp.id)}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                          >
                                            Deactivate
                                          </button>
                                        ) : isValuationDone ? (
                                          <div className="flex items-center justify-end gap-2">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
                                              <CheckCircle2 className="w-3.5 h-3.5" />
                                              <span>Valuation Done</span>
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => handleToggleComp(comp.id)}
                                              className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-300 hover:text-white bg-[#181b30] hover:bg-[#202442] border border-[#292d4a] transition-all cursor-pointer"
                                              title="Re-assign to Judge Desk"
                                            >
                                              Re-assign
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleComp(comp.id)}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                                          >
                                            + Add to Desk
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Confidentiality & Sync Notice */}
              <div className="p-5 rounded-2xl bg-[#121424] border border-[#292d4a] space-y-2 mt-4">
                <div className="flex items-center gap-2 text-slate-300 font-bold text-xs">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Official Judge Evaluation Security & Blind Evaluation</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  In accordance with fest rules, candidate valuation scoring sheets and mark inputs are accessible <strong>exclusively by the Official Fest Judge</strong> on their Judge Portal. Candidates are evaluated anonymously using blind code letters (A, B, C...). Multiple assigned competitions across different stages are synchronized live to the Judge Desk.
                </p>
              </div>

            </div>
          </div>
        );
      })()}

      {/* TAB 3: COMPETITIONS LIST & MANAGEMENT */}
      {activeTab === 'competitions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                Fest Competitions List ({competitions.length})
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
              <button
                onClick={() => setShowManageLimitsModal(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>Manage Limit</span>
              </button>
              <button
                onClick={() => {
                  setCategoryActionMsg(null);
                  setShowManageCategoriesModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                <Tag className="w-4 h-4 text-purple-400" />
                <span>Manage Categories</span>
              </button>
              <button
                onClick={() => {
                  setLevelActionMsg(null);
                  setShowManageLevelsModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
              >
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Manage Levels</span>
              </button>
              <button
                onClick={() => {
                  setStageActionMsg(null);
                  setShowManageStagesModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
              >
                <MapPin className="w-4 h-4 text-purple-400" />
                <span>Manage Stages</span>
              </button>
              <button onClick={handleOpenCreateCompModal} className="poster-btn-primary text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 shrink-0">
                <Plus className="w-4 h-4" /> Add Competition
              </button>
            </div>
          </div>

          {/* CARDS GRID VIEW */}
          <div className="space-y-4">
              {/* Search & Category Filter Toolbar for Cards */}
              <div className="p-4 bg-[#151728] border border-[#292d4a] rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search competition by name, category, stage..."
                      value={compSearchQuery}
                      onChange={(e) => setCompSearchQuery(e.target.value)}
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl pl-10 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
                    />
                    {compSearchQuery && (
                      <button onClick={() => setCompSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <span className="text-[11px] font-bold uppercase text-slate-400 mr-1 flex items-center gap-1 shrink-0">
                    <Filter className="w-3 h-3 text-purple-400" /> Category:
                  </span>
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCompCategoryFilter(cat)}
                      className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-all ${
                        compCategoryFilter === cat
                          ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                          : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {competitions.filter(comp => {
                const matchesCategory = compCategoryFilter === 'All' || comp.category === compCategoryFilter;
                const matchesSearch = comp.name.toLowerCase().includes(compSearchQuery.toLowerCase()) ||
                                      comp.category.toLowerCase().includes(compSearchQuery.toLowerCase()) ||
                                      comp.venue.toLowerCase().includes(compSearchQuery.toLowerCase());
                return matchesCategory && matchesSearch;
              }).length === 0 ? (
                <div className="p-8 text-center bg-[#151728] border border-[#292d4a] rounded-3xl text-slate-400 text-xs">
                  No competitions found matching category "{compCategoryFilter}" {compSearchQuery && `or search "${compSearchQuery}"`}.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fadeIn">
                  {competitions.filter(comp => {
                    const matchesCategory = compCategoryFilter === 'All' || comp.category === compCategoryFilter;
                    const matchesSearch = comp.name.toLowerCase().includes(compSearchQuery.toLowerCase()) ||
                                          comp.category.toLowerCase().includes(compSearchQuery.toLowerCase()) ||
                                          comp.venue.toLowerCase().includes(compSearchQuery.toLowerCase());
                    return matchesCategory && matchesSearch;
                  }).map((comp) => (
                    <div key={comp.id} className="poster-card p-5 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-2.5 flex flex-col justify-between hover:border-purple-500/40 transition-all">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2 text-xs font-bold">
                          {/* Category Badge */}
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-bold">
                            <Tag className="w-3 h-3 text-purple-400" />
                            <span>{comp.category}</span>
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {comp.venue && formatStageName(comp.venue) ? (
                              <span className="text-[11px] text-slate-400 bg-[#181b30] px-2 py-0.5 rounded-lg border border-[#292d4a]">{formatStageName(comp.venue)}</span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic bg-[#181b30] px-2 py-0.5 rounded-lg border border-[#292d4a]/60">Stage: To Be Announced</span>
                            )}
                            <button
                              onClick={() => handleOpenEditCompModal(comp)}
                              className="p-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white transition-all border border-purple-500/20 cursor-pointer"
                              title="Full Edit Competition"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCompetition(comp.id, comp.name)}
                              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all border border-rose-500/20 cursor-pointer"
                              title="Delete Competition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h3 className="font-extrabold text-white text-base leading-snug">
                          {formatCompetitionName(comp.name, comp.category)}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-2">
                          <span>{comp.type === 'Group' ? `Group (${comp.teamSize || 4} members)` : comp.type}</span>
                          {comp.scheduleTime ? <span>• {comp.scheduleTime}</span> : null}
                        </p>
                      </div>

                      <div className="text-xs font-mono text-amber-400 pt-2.5 border-t border-[#292d4a] flex items-center justify-between">
                        <span>Scale: {comp.points1st}/{comp.points2nd}/{comp.points3rd} pts</span>
                        <span className="text-slate-400 text-[11px]">Max {comp.maxEntriesPerGroup}/grp</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>
      )}

      {/* TAB 3: GROUPS LIST & CREDENTIALS CONTROL */}
      {activeTab === 'groups' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Section 0: Participant Chest No Auto-Generator Admin Control */}
          <div className="poster-card p-6 bg-[#151728] rounded-3xl border border-purple-500/30 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#292d4a] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  Auto-Generated Default Participant Chest No Control
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Admin settings for auto-generating participant Chest Numbers (e.g. <code className="text-purple-300 font-bold font-mono">014</code>) in the Group Leader Dashboard.
                </p>
              </div>

              {/* Live Preview Pill */}
              {(() => {
                const previewNumStr = String(partIdStartNum || 1).padStart(Number(partIdDigits) || 3, '0');
                const livePreviewId = previewNumStr;
                return (
                  <div className="bg-[#181b30] px-4 py-2 rounded-2xl border border-purple-500/30 flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Next Chest No Preview:</span>
                    <span className="text-sm font-mono font-extrabold text-amber-300 bg-purple-500/20 px-2.5 py-0.5 rounded-lg border border-purple-500/30">
                      {livePreviewId}
                    </span>
                  </div>
                );
              })()}
            </div>

            {partIdConfigSuccessMsg && (
              <div className="p-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{partIdConfigSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveParticipantIdConfig} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Target Group
                </label>
                <select
                  value={configGroupId}
                  onChange={(e) => setConfigGroupId(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-purple-300 font-bold focus:outline-none"
                >
                  {groups.map((grp) => (
                    <option key={grp.id} value={grp.id}>
                      {grp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Default Start Sequence
                </label>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  required
                  value={partIdStartNum}
                  onChange={(e) => setPartIdStartNum(Number(e.target.value))}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold focus:outline-none"
                  placeholder="e.g. 14"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Zero Padding Digits
                </label>
                <select
                  value={partIdDigits}
                  onChange={(e) => setPartIdDigits(Number(e.target.value))}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                >
                  <option value={2}>2 Digits (01, 02...)</option>
                  <option value={3}>3 Digits (001, 014...)</option>
                  <option value={4}>4 Digits (0001, 0014...)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Participant Add Status
                </label>
                <button
                  type="button"
                  onClick={() => setPartIdIsLocked(!partIdIsLocked)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer h-9 ${
                    partIdIsLocked
                      ? 'bg-rose-600/10 text-rose-400 border-rose-500/20 hover:bg-rose-600/20'
                      : 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-600/20'
                  }`}
                >
                  {partIdIsLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                      Closed (Locked)
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      Open (Active)
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Comp Reg Status
                </label>
                <button
                  type="button"
                  onClick={() => setIsCompRegLocked(!isCompRegLocked)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer h-9 ${
                    isCompRegLocked
                      ? 'bg-rose-600/10 text-rose-400 border-rose-500/20 hover:bg-rose-600/20'
                      : 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-600/20'
                  }`}
                >
                  {isCompRegLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                      Closed (Locked)
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      Open (Active)
                    </>
                  )}
                </button>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-1.5 cursor-pointer h-9"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save Settings
                </button>
              </div>
            </form>
          </div>



          {/* Section 1: Registered Groups & Leader Credentials */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  Registered Groups & Leader Credentials
                </h2>
                <p className="text-xs text-slate-400">
                  Admin control panel to edit Group Name, Theme Color, and Leader Password.
                </p>
              </div>
              <button
                onClick={() => setShowGroupModal(true)}
                className="poster-btn-accent text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add New Group
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {groups.map((grp) => (
                <div key={grp.id} className="poster-card p-5 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-3 flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-xl">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: grp.color }} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditGroupModal(grp)}
                          className="p-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-600 text-purple-300 hover:text-white transition-all border border-purple-500/20 cursor-pointer"
                          title="Edit Group Name & Leader Credentials"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(grp.id, grp.name)}
                          className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all border border-rose-500/20 cursor-pointer"
                          title="Delete Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-extrabold text-white leading-tight">{grp.name}</h3>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1.5 bg-[#181b30] p-3 rounded-2xl border border-[#292d4a]">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Group Leader Credentials</div>
                      <div>Leader: <span className="font-bold text-white">{grp.leaderName}</span></div>
                      <div>Leader Pass: <code className="text-amber-400 font-mono font-bold">{grp.leaderPassword || '••••••'}</code></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#292d4a] text-xs">
                    <button
                      onClick={() => handleOpenEditGroupModal(grp)}
                      className="text-purple-400 hover:text-purple-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Edit Group & Credentials
                    </button>
                    <span className="font-mono text-amber-400 font-bold">{grp.totalPoints} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Participant Chest No & Credentials Management Table */}
          <div className="poster-card p-6 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-5 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  Participant Chest Numbers & Profiles Control
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  View, edit, or search Participant Chest Numbers (e.g. 014), group assignments, and competition levels.
                </p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by ID or Name..."
                    value={adminPartSearch}
                    onChange={(e) => setAdminPartSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#181b30] border border-[#292d4a] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-48 font-medium"
                  />
                </div>

                <select
                  value={adminPartGroupFilter}
                  onChange={(e) => setAdminPartGroupFilter(e.target.value)}
                  className="bg-[#181b30] border border-[#292d4a] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                >
                  <option value="All">All Groups</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table of Participant Credentials */}
            <div className="overflow-x-auto">
              {(() => {
                const profiles = festStore.getProfiles().filter(p => p.role === 'participant');
                const filteredParts = profiles.filter(p => {
                  const fullName = `${p.name} ${p.fatherName || ''}`.trim();
                  const matchSearch = fullName.toLowerCase().includes(adminPartSearch.toLowerCase()) ||
                                      p.name.toLowerCase().includes(adminPartSearch.toLowerCase()) ||
                                      p.userId.toLowerCase().includes(adminPartSearch.toLowerCase());
                  const matchGroup = adminPartGroupFilter === 'All' || p.groupId === adminPartGroupFilter;
                  return matchSearch && matchGroup;
                }).sort((a, b) => {
                  const numA = parseInt(a.userId?.replace(/\D/g, '') || '', 10);
                  const numB = parseInt(b.userId?.replace(/\D/g, '') || '', 10);
                  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                    return numA - numB;
                  }
                  return (a.userId || '').localeCompare(b.userId || '', undefined, { numeric: true, sensitivity: 'base' });
                });

                if (filteredParts.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No participant profiles found.
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#181b30] text-slate-400 font-bold uppercase border-b border-[#292d4a]">
                      <tr>
                        <th className="p-3">Participant Chest No</th>
                        <th className="p-3">Full Name</th>
                        <th className="p-3">Assigned Group</th>
                        <th className="p-3">Level</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#292d4a] text-slate-200 font-medium">
                      {filteredParts.map((part) => (
                        <tr key={part.id} className="hover:bg-[#181b30] transition-colors">
                          <td className="p-3 font-mono font-extrabold text-purple-400">
                            <span className="bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
                              {part.userId}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-white">
                            <div className="flex items-center gap-2.5">
                              <ParticipantAvatar name={part.name} photoUrl={part.photoUrl} className="w-7 h-7 border border-purple-500/30 shrink-0" />
                              <div>{part.name}{part.fatherName ? ` ${part.fatherName}` : ''}</div>
                            </div>
                          </td>
                          <td className="p-3 text-slate-300">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {part.groupName || 'Unassigned'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 font-mono">Level {part.department || '1'}</td>
                          <td className="p-3 text-amber-400 font-semibold">{part.category || 'Senior'}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEditParticipantModal(part)}
                                className="px-2.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Edit Participant Chest No & Details"
                              >
                                <Edit className="w-3 h-3" />
                                Edit Chest No
                              </button>
                              <button
                                onClick={() => handleDeleteParticipant(part.id, part.name)}
                                className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all border border-rose-500/20 cursor-pointer"
                                title="Delete Participant Profile"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REGISTRATIONS OVERVIEW */}
      {activeTab === 'registrations' && (
        <div className="poster-card p-6 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-4 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-white">All Festival Registrations</h2>
            </div>

            {/* Filters & Search Bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search participant, Chest No., group..."
                  value={regSearchQuery}
                  onChange={(e) => setRegSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-[#181b30] border border-[#292d4a] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-52 sm:w-60 font-medium"
                />
              </div>

              {/* Group Filter */}
              <div className="flex items-center gap-1.5 bg-[#181b30] border border-[#292d4a] rounded-xl px-2.5 py-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <select
                  value={regGroupFilter}
                  onChange={(e) => setRegGroupFilter(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none font-semibold cursor-pointer"
                >
                  <option value="All" className="bg-[#181b30]">All Groups</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id} className="bg-[#181b30]">{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Searchable Competition Filter with Global Search Bar Inside */}
              <div className="relative" ref={regCompDropdownRef}>
                <button
                  type="button"
                  onClick={() => setRegCompDropdownOpen(!regCompDropdownOpen)}
                  className={`flex items-center gap-2 bg-[#181b30] border transition-all rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer max-w-[240px] ${
                    regCompFilter !== 'All'
                      ? 'border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                      : 'border-[#292d4a] text-white hover:border-slate-600'
                  }`}
                  title="Filter by competition"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {regCompFilter === 'All'
                      ? 'All Competitions'
                      : competitions.find((c) => c.id === regCompFilter)?.name || 'Competition'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto transition-transform ${regCompDropdownOpen ? 'rotate-180 text-amber-400' : ''}`} />
                </button>

                {/* Dropdown Popover with Search Bar Inside */}
                {regCompDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#16182a] border border-[#2e3357] rounded-2xl shadow-2xl z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                    {/* Search Bar Inside Dropdown */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        value={regCompSearchText}
                        onChange={(e) => setRegCompSearchText(e.target.value)}
                        placeholder="Search competitions, category..."
                        className="w-full pl-8 pr-7 py-1.5 bg-[#121424] border border-[#2e3357] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
                      />
                      {regCompSearchText && (
                        <button
                          type="button"
                          onClick={() => setRegCompSearchText('')}
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
                          onClick={() => setRegCompCategoryTab(cat)}
                          className={`px-2 py-0.5 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                            regCompCategoryTab === cat
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
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
                          setRegCompFilter('All');
                          setRegCompDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                          regCompFilter === 'All'
                            ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                            : 'text-slate-300 hover:bg-[#1f233f] hover:text-white font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Trophy className="w-3.5 h-3.5 text-amber-400" />
                          <span>All Competitions</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {registrations.length} regs
                        </span>
                      </button>

                      {/* Filtered list of competitions */}
                      {(() => {
                        const term = regCompSearchText.trim().toLowerCase();
                        const matches = competitions.filter((comp) => {
                          const matchesCat = regCompCategoryTab === 'All' || comp.category === regCompCategoryTab;
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
                          const isSelected = regCompFilter === comp.id;
                          const regCount = registrations.filter((r) => r.competitionId === comp.id).length;
                          return (
                            <button
                              key={comp.id}
                              type="button"
                              onClick={() => {
                                setRegCompFilter(comp.id);
                                setRegCompDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
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
                                  {regCount} regs
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Reset button */}
              {(regSearchQuery || regGroupFilter !== 'All' || regCompFilter !== 'All') && (
                <button
                  onClick={() => {
                    setRegSearchQuery('');
                    setRegGroupFilter('All');
                    setRegCompFilter('All');
                  }}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-[#181b30] hover:bg-slate-800 border border-[#292d4a] rounded-xl transition-all cursor-pointer font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Registrations List / Table */}
          {(() => {
            const filteredRegs = registrations.filter(reg => {
              const comp = competitions.find(c => c.id === reg.competitionId);
              const compName = comp?.name || '';
              
              const fullName = festStore.getParticipantFullName(reg.participantName, reg.id);
              const matchSearch = 
                fullName.toLowerCase().includes(regSearchQuery.toLowerCase()) ||
                reg.participantName.toLowerCase().includes(regSearchQuery.toLowerCase()) ||
                reg.participantUserId.toLowerCase().includes(regSearchQuery.toLowerCase()) ||
                reg.groupName.toLowerCase().includes(regSearchQuery.toLowerCase()) ||
                compName.toLowerCase().includes(regSearchQuery.toLowerCase());
              
              const matchGroup = regGroupFilter === 'All' || reg.groupId === regGroupFilter;
              const matchComp = regCompFilter === 'All' || reg.competitionId === regCompFilter;
              
              return matchSearch && matchGroup && matchComp;
            });

            if (filteredRegs.length === 0) {
              return (
                <div className="text-center py-12 bg-[#181b30]/50 rounded-2xl border border-[#292d4a]/50 text-slate-400 text-sm">
                  No registrations found matching the specified filters.
                </div>
              );
            }

            return (
              <div className="space-y-2">
                <div className="text-right text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Showing {filteredRegs.length} of {registrations.length} registrations
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#181b30] text-slate-400 font-bold uppercase border-b border-[#292d4a]">
                      <tr>
                        <th className="p-3">Participant</th>
                        <th className="p-3">Chest No.</th>
                        <th className="p-3">Group</th>
                        <th className="p-3">Competition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#292d4a] text-slate-200 font-medium">
                      {filteredRegs.map((reg) => (
                        <tr key={reg.id} className="hover:bg-[#181b30]/30 transition-colors">
                          <td className="p-3 font-bold text-white">
                            <div className="flex items-center gap-2.5">
                              <ParticipantAvatar
                                name={festStore.getParticipantFullName(reg.participantName, reg.id)}
                                photoUrl={festStore.getParticipantPhotoUrl(reg.participantName, reg.id)}
                                className="w-7 h-7 border border-purple-500/30 shrink-0"
                              />
                              <span>{festStore.getParticipantFullName(reg.participantName, reg.id)}</span>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-purple-400">{reg.participantUserId}</td>
                          <td className="p-3">{reg.groupName}</td>
                          <td className="p-3 font-bold text-amber-400">
                            {competitions.find(c => c.id === reg.competitionId)?.name || 'Competition'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 5: COMPETITION & EVENT UPDATE */}
      {activeTab === 'updates' && (
        <div className="poster-card p-6 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl animate-fadeIn">
          {/* Header Row with Search & Bulk Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="shrink-0">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Competition & Event Updates
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Control live event statuses displayed on the public portal
              </p>
            </div>

            {/* Search Bar (exact location highlighted by user) */}
            <div className="relative flex-1 max-w-lg min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search competition, category, stage..."
                value={updatesSearch}
                onChange={(e) => setUpdatesSearch(e.target.value)}
                className="w-full bg-[#101222] border border-[#292d4a] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder-slate-400 focus:outline-none transition-all shadow-inner"
              />
              {updatesSearch && (
                <button
                  type="button"
                  onClick={() => setUpdatesSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            {/* Bulk actions */}
            <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  const targets = isUpdatesFiltered ? filteredUpdatesCompetitions : scheduledUpdatesCompetitions;
                  targets.forEach(c => {
                    festStore.updateCompetition({ ...c, status: 'running', isRunning: true });
                  });
                  onRefresh();
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                {isUpdatesFiltered ? `Set Filtered Running (${filteredUpdatesCompetitions.length})` : 'Set All Running'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const targets = isUpdatesFiltered ? filteredUpdatesCompetitions : scheduledUpdatesCompetitions;
                  targets.forEach(c => {
                    festStore.updateCompetition({ ...c, status: 'pending', isRunning: false });
                  });
                  onRefresh();
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                {isUpdatesFiltered ? `Reset Filtered Pending (${filteredUpdatesCompetitions.length})` : 'Reset All Pending'}
              </button>
            </div>
          </div>

          {/* Filter Toolbar (Status pills, Category filter, Stage filter, Clear) */}
          <div className="p-3 bg-[#101222]/80 rounded-2xl border border-[#292d4a] flex flex-wrap items-center justify-between gap-3">
            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-purple-400" />
                Status:
              </span>
              <button
                type="button"
                onClick={() => setUpdatesStatusFilter('All')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  updatesStatusFilter === 'All'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                }`}
              >
                <span>All</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {scheduledUpdatesCompetitions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUpdatesStatusFilter('pending')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  updatesStatusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-[#181b30] text-amber-400/80 hover:text-amber-300 border border-amber-500/20'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Pending</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                  {updatesPendingCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUpdatesStatusFilter('running')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  updatesStatusFilter === 'running'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-[#181b30] text-emerald-400/80 hover:text-emerald-300 border border-emerald-500/20'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Running</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                  {updatesRunningCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUpdatesStatusFilter('completed')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  updatesStatusFilter === 'completed'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-[#181b30] text-rose-400/80 hover:text-rose-300 border border-rose-500/20'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Completed</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-mono">
                  {updatesCompletedCount}
                </span>
              </button>
            </div>

            {/* Category & Stage Dropdowns + Reset */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Dropdown */}
              <div className="flex items-center gap-1.5 bg-[#181b30] border border-[#292d4a] rounded-xl px-2.5 py-1">
                <Tag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <select
                  value={updatesCategoryFilter}
                  onChange={(e) => setUpdatesCategoryFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="All" className="bg-[#151728] text-white">All Categories</option>
                  {updatesCategories.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#151728] text-white">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage Dropdown */}
              <div className="flex items-center gap-1.5 bg-[#181b30] border border-[#292d4a] rounded-xl px-2.5 py-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <select
                  value={updatesStageFilter}
                  onChange={(e) => setUpdatesStageFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="All" className="bg-[#151728] text-white">All Stages</option>
                  {updatesStages.map((stage) => (
                    <option key={stage} value={stage} className="bg-[#151728] text-white">
                      {stage}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters Button */}
              {isUpdatesFiltered && (
                <button
                  type="button"
                  onClick={() => {
                    setUpdatesSearch('');
                    setUpdatesStatusFilter('All');
                    setUpdatesCategoryFilter('All');
                    setUpdatesStageFilter('All');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1 border border-slate-700 cursor-pointer"
                  title="Reset search and filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Results Summary Bar */}
          {isUpdatesFiltered && (
            <div className="text-xs text-slate-400 flex items-center justify-between px-1">
              <span>
                Showing <strong className="text-white">{filteredUpdatesCompetitions.length}</strong> of <strong className="text-white">{scheduledUpdatesCompetitions.length}</strong> scheduled competitions
              </span>
              <button
                type="button"
                onClick={() => {
                  setUpdatesSearch('');
                  setUpdatesStatusFilter('All');
                  setUpdatesCategoryFilter('All');
                  setUpdatesStageFilter('All');
                }}
                className="text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Alert box */}
          <div className="p-4 bg-purple-950/40 border border-purple-800/40 rounded-2xl flex items-start gap-3">
            <Info className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <div className="text-xs text-purple-200">
              <span className="font-bold">Home Page Integration:</span> Only competitions set to <strong>"Running"</strong> status will be displayed under the <strong>Running Competitions</strong> section on the public homepage.
            </div>
          </div>

          {/* Table of competitions to manage */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#181b30] text-slate-400 font-bold uppercase border-b border-[#292d4a]">
                <tr>
                  <th className="p-3">Competition</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3 text-center">Current Status</th>
                  <th className="p-3 text-center">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292d4a] text-slate-200 font-medium">
                {filteredUpdatesCompetitions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                      {scheduledUpdatesCompetitions.length === 0 ? (
                        <span>No scheduled competitions found. Go to "Schedule & Clash Engine" tab to assign dates, times, and stages first!</span>
                      ) : (
                        <div className="py-4 space-y-3">
                          <p className="text-slate-300 text-sm">No competitions found matching your search and filter criteria.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setUpdatesSearch('');
                              setUpdatesStatusFilter('All');
                              setUpdatesCategoryFilter('All');
                              setUpdatesStageFilter('All');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Search & Filters</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredUpdatesCompetitions.map((comp) => (
                        <tr key={comp.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-white text-sm">{comp.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{comp.type === 'Group' ? `Group (${comp.teamSize || 4} members)` : comp.type} Competition</div>
                          </td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1d1f38] text-purple-300 border border-purple-900/50">
                              {comp.category}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-300">
                            {comp.venue}
                          </td>
                          <td className="p-3 text-center">
                            {comp.status === 'running' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Running
                              </span>
                            ) : comp.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center justify-center gap-1 bg-[#101222] p-1 rounded-xl border border-[#292d4a]">
                              <button
                                onClick={() => {
                                  festStore.updateCompetition({ ...comp, status: 'pending', isRunning: false });
                                  onRefresh();
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                  comp.status === 'pending' || !comp.status
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow'
                                    : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Pending
                              </button>

                              <button
                                onClick={() => {
                                  festStore.updateCompetition({ ...comp, status: 'running', isRunning: true });
                                  onRefresh();
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                  comp.status === 'running'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow'
                                    : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
                                }`}
                              >
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Running
                              </button>

                              <button
                                onClick={() => {
                                  festStore.updateCompetition({ ...comp, status: 'completed', isRunning: false });
                                  onRefresh();
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                  comp.status === 'completed'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow'
                                    : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Completed
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Section: Live Countdown Card Settings */}
              <div className="border-t border-[#292d4a] pt-6 space-y-4" id="manage-live-countdown-admin">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Live Countdown Card Settings
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Show or hide the Live Countdown card, adjust the target date & time, and customize titles and day/hour/min/sec labels and visibility.
                  </p>
                </div>

                <form onSubmit={handleSaveCountdownConfig} className="space-y-4 p-4 bg-[#181b30] rounded-2xl border border-[#292d4a]">
                  {countdownSuccessMsg && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-bold animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4" />
                      {countdownSuccessMsg}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 p-3 bg-black/20 rounded-xl border border-[#292d4a]">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={countdownShow}
                        onChange={(e) => setCountdownShow(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white"></div>
                      <span className="ml-3 text-xs font-extrabold text-slate-300">
                        {countdownShow ? 'Live Countdown Card is Active (Visible)' : 'Live Countdown Card is Hidden (Inactive)'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Countdown Title
                      </label>
                      <input
                        type="text"
                        value={countdownTitle}
                        onChange={(e) => setCountdownTitle(e.target.value)}
                        placeholder="e.g. Tick-Tock, It’s Fest O’Clock!"
                        required
                        className="w-full bg-black/40 border border-[#292d4a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Target Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={countdownTargetDate}
                        onChange={(e) => setCountdownTargetDate(e.target.value)}
                        required
                        className="w-full bg-black/40 border border-[#292d4a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Countdown Subtitle / Description
                    </label>
                    <textarea
                      value={countdownSubtitle}
                      onChange={(e) => setCountdownSubtitle(e.target.value)}
                      placeholder="Enter countdown description..."
                      rows={2}
                      required
                      className="w-full bg-black/40 border border-[#292d4a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
                    />
                  </div>

                  {/* Day, Hour, Min, Sec Customization */}
                  <div className="pt-2 border-t border-[#292d4a] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] uppercase font-bold text-purple-300 tracking-wider">
                        Customize Units & Display Labels (Day, Hour, Min, Sec)
                      </label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Day unit */}
                      <div className="p-2.5 bg-black/30 border border-[#292d4a] rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-400">Days Unit</span>
                          <input
                            type="checkbox"
                            checked={countdownShowDays}
                            onChange={(e) => setCountdownShowDays(e.target.checked)}
                            className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                            title="Show/Hide Days"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-400 uppercase font-semibold">Custom Label</label>
                          <input
                            type="text"
                            value={countdownDayLabel}
                            onChange={(e) => setCountdownDayLabel(e.target.value)}
                            placeholder="Days"
                            className="w-full bg-black/50 border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>

                      {/* Hour unit */}
                      <div className="p-2.5 bg-black/30 border border-[#292d4a] rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-400">Hours Unit</span>
                          <input
                            type="checkbox"
                            checked={countdownShowHours}
                            onChange={(e) => setCountdownShowHours(e.target.checked)}
                            className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                            title="Show/Hide Hours"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-400 uppercase font-semibold">Custom Label</label>
                          <input
                            type="text"
                            value={countdownHourLabel}
                            onChange={(e) => setCountdownHourLabel(e.target.value)}
                            placeholder="Hours"
                            className="w-full bg-black/50 border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>

                      {/* Min unit */}
                      <div className="p-2.5 bg-black/30 border border-[#292d4a] rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-400">Mins Unit</span>
                          <input
                            type="checkbox"
                            checked={countdownShowMinutes}
                            onChange={(e) => setCountdownShowMinutes(e.target.checked)}
                            className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                            title="Show/Hide Minutes"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-400 uppercase font-semibold">Custom Label</label>
                          <input
                            type="text"
                            value={countdownMinLabel}
                            onChange={(e) => setCountdownMinLabel(e.target.value)}
                            placeholder="Mins"
                            className="w-full bg-black/50 border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>

                      {/* Sec unit */}
                      <div className="p-2.5 bg-black/30 border border-[#292d4a] rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">Secs Unit</span>
                          <input
                            type="checkbox"
                            checked={countdownShowSeconds}
                            onChange={(e) => setCountdownShowSeconds(e.target.checked)}
                            className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                            title="Show/Hide Seconds"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-400 uppercase font-semibold">Custom Label</label>
                          <input
                            type="text"
                            value={countdownSecLabel}
                            onChange={(e) => setCountdownSecLabel(e.target.value)}
                            placeholder="Secs"
                            className="w-full bg-black/50 border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-purple-900/30 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Save Countdown Settings
                    </button>
                  </div>
                </form>
              </div>

              {/* Section: Social Media Links & Channels Settings */}
              <div className="border-t border-[#292d4a] pt-6 space-y-4" id="manage-social-media-admin">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-pink-400" />
                    Festival Social Media Channels & Links
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Configure official festival social media profiles (Instagram, YouTube, WhatsApp, Facebook, Twitter/X, Website). These links are published in the website footer and student portals.
                  </p>
                </div>

                <form onSubmit={handleSaveSocialLinks} className="space-y-4 p-4 bg-[#181b30] rounded-2xl border border-[#292d4a]">
                  {socialSuccessMsg && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-bold animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4" />
                      {socialSuccessMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {/* Instagram */}
                    <div className="p-3 bg-black/30 border border-[#292d4a] rounded-xl space-y-1.5 focus-within:border-pink-500/60 transition-all">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-pink-400">
                        <Instagram className="w-3.5 h-3.5 text-pink-400" />
                        Instagram
                      </label>
                      <input
                        type="text"
                        value={socialInstagram}
                        onChange={(e) => setSocialInstagram(e.target.value)}
                        placeholder="e.g. https://instagram.com/fest or @fest"
                        className="w-full bg-black/50 border border-[#292d4a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 font-medium"
                      />
                    </div>

                    {/* YouTube */}
                    <div className="p-3 bg-black/30 border border-[#292d4a] rounded-xl space-y-1.5 focus-within:border-red-500/60 transition-all">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                        <Youtube className="w-3.5 h-3.5 text-red-400" />
                        YouTube Channel
                      </label>
                      <input
                        type="text"
                        value={socialYoutube}
                        onChange={(e) => setSocialYoutube(e.target.value)}
                        placeholder="e.g. https://youtube.com/@fest"
                        className="w-full bg-black/50 border border-[#292d4a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 font-medium"
                      />
                    </div>

                    {/* WhatsApp */}
                    <div className="p-3 bg-black/30 border border-[#292d4a] rounded-xl space-y-1.5 focus-within:border-emerald-500/60 transition-all">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        WhatsApp Group / Channel
                      </label>
                      <input
                        type="text"
                        value={socialWhatsapp}
                        onChange={(e) => setSocialWhatsapp(e.target.value)}
                        placeholder="e.g. https://chat.whatsapp.com/... or +919876543210"
                        className="w-full bg-black/50 border border-[#292d4a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>

                    {/* Facebook */}
                    <div className="p-3 bg-black/30 border border-[#292d4a] rounded-xl space-y-1.5 focus-within:border-blue-500/60 transition-all">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                        <Facebook className="w-3.5 h-3.5 text-blue-400" />
                        Facebook Page
                      </label>
                      <input
                        type="text"
                        value={socialFacebook}
                        onChange={(e) => setSocialFacebook(e.target.value)}
                        placeholder="e.g. https://facebook.com/fest"
                        className="w-full bg-black/50 border border-[#292d4a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                      />
                    </div>

                    {/* Twitter / X */}
                    <div className="p-3 bg-black/30 border border-[#292d4a] rounded-xl space-y-1.5 focus-within:border-sky-500/60 transition-all">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                        <Twitter className="w-3.5 h-3.5 text-sky-400" />
                        Twitter / X
                      </label>
                      <input
                        type="text"
                        value={socialTwitter}
                        onChange={(e) => setSocialTwitter(e.target.value)}
                        placeholder="e.g. https://x.com/fest or @fest"
                        className="w-full bg-black/50 border border-[#292d4a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-medium"
                      />
                    </div>

                    {/* Official Website */}
                    <div className="p-3 bg-black/30 border border-[#292d4a] rounded-xl space-y-1.5 focus-within:border-purple-500/60 transition-all">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                        <Globe className="w-3.5 h-3.5 text-purple-400" />
                        Official College / Fest Website
                      </label>
                      <input
                        type="text"
                        value={socialWebsite}
                        onChange={(e) => setSocialWebsite(e.target.value)}
                        placeholder="e.g. https://sayyidmadani.edu"
                        className="w-full bg-black/50 border border-[#292d4a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all shadow-md shadow-pink-900/30 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Save Social Media Links
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

      {/* TAB 6: ANNOUNCEMENTS MANAGEMENT */}
      {activeTab === 'notifications' && (
        <div className="poster-card p-6 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-rose-400 animate-pulse" />
                Manage Announcements & Stage Alerts
              </h2>
            </div>

            {editingNotifId && (
              <button
                onClick={handleCancelNotifEdit}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-xs font-bold transition-all self-start sm:self-auto"
              >
                Cancel Editing
              </button>
            )}
          </div>

          {/* Post / Update Form */}
          <form onSubmit={handleSaveNotification} className="p-4 bg-[#181b30] rounded-2xl border border-[#292d4a] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              {editingNotifId ? 'Edit / Update Existing Announcement' : 'Create & Publish New Announcement'}
            </h3>

            {notifSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-bold animate-fadeIn">
                <CheckCircle2 className="w-4 h-4" />
                {notifSuccessMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="e.g. Stage 1 Inauguration or Oppana Senior Results"
                  className="w-full bg-[#0d0e1b] border border-[#292d4a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Category Tag
                </label>
                <select
                  value={notifCategory}
                  onChange={(e) => setNotifCategory(e.target.value)}
                  className="w-full bg-[#0d0e1b] border border-[#292d4a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Stage Alert">Stage Alert 📣</option>
                  <option value="Result Published">Result Published 🏆</option>
                  <option value="Schedule Update">Schedule Update ⏰</option>
                  <option value="General">General Announcement 📢</option>
                  <option value="Urgent">Urgent Notice 🚨</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Detailed Message
                </label>
                <span className="text-[10px] text-slate-400">
                  Enters & paragraph breaks preserved
                </span>
              </div>
              <textarea
                required
                rows={4}
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Type the complete announcement details for participants (with enters, bullet points, paragraphs)..."
                className="w-full bg-[#0d0e1b] border border-[#292d4a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 whitespace-pre-wrap leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2"
              >
                <Megaphone className="w-4 h-4" />
                {editingNotifId ? 'Update Announcement & Alert All' : 'Publish Announcement & Trigger Alert'}
              </button>
            </div>
          </form>

          {/* Existing Announcements List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-300">
              Published Announcements ({notifList.length})
            </h3>

            {notifList.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No announcements published yet.
              </div>
            ) : (
              <div className="space-y-3">
                {notifList.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-4 rounded-2xl bg-[#181b30] border border-[#292d4a] hover:border-purple-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {notif.category || 'General'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(notif.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-white">
                        {notif.title}
                      </h4>
                      <div className="text-xs text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                        {notif.message}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEditNotif(notif)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteNotif(notif.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: FESTIVAL BRANDING & APP TITLES EDIT ENGINE */}
      {activeTab === 'branding' && (
        <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl animate-fadeIn">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
              <Palette className="w-6 h-6 text-purple-400" />
              Festival Branding, College & App Titles
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Customize the college name, festival title, edition tag, and official logo displayed across all headers, cards, print sheets, and posters.
            </p>
          </div>

          {brandSuccessMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2.5 text-emerald-400 text-xs font-bold animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{brandSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveBrandingConfig} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* 1. Festival Title */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Festival Title
                </label>
                <p className="text-[10px] text-slate-500">
                  Main festival name displayed in Navbar, splash screen, and posters.
                </p>
                <input
                  type="text"
                  required
                  value={brandTitle}
                  onChange={(e) => setBrandTitle(e.target.value)}
                  placeholder="e.g. Madani College Fest"
                  className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* 2. College / Institution Name */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  College / Institution Name
                </label>
                <p className="text-[10px] text-slate-500">
                  Institution or campus name printed on official certificates and sheets.
                </p>
                <input
                  type="text"
                  required
                  value={brandCollege}
                  onChange={(e) => setBrandCollege(e.target.value)}
                  placeholder="e.g. Madani College"
                  className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* 3. Edition / Festival Tag */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Edition Tag / Year
                </label>
                <p className="text-[10px] text-slate-500">
                  Tagline or season label displayed alongside the festival title.
                </p>
                <input
                  type="text"
                  required
                  value={brandTag}
                  onChange={(e) => setBrandTag(e.target.value)}
                  placeholder="e.g. FEST 2026"
                  className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Logo Uploaders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Official Navbar & Header Logo Uploader */}
              <div className="p-5 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Official Header & Navbar Logo
                  </label>
                  <span className="text-[10px] text-purple-400 font-semibold bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                    Header Logo
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-[#121424] border border-[#292d4a] flex items-center justify-center p-2.5 shrink-0 relative group">
                    <img
                      src={brandLogoUrl || logoImg}
                      alt="Navbar Logo Preview"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = logoImg;
                      }}
                    />
                  </div>

                  <div className="flex-1 space-y-3 w-full">
                    <input
                      type="file"
                      ref={brandLogoFileInputRef}
                      onChange={handleBrandLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => brandLogoFileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload Header Logo
                      </button>

                      {brandLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setBrandLogoUrl('')}
                          className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Reset
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400">
                      Displayed on the navigation bar and header banners.
                    </p>
                  </div>
                </div>
              </div>

              {/* Splash Screen Logo Uploader */}
              <div className="p-5 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Official Splash Screen Logo (PNG)
                  </label>
                  <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    Startup Splash
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-[#121424] border border-[#292d4a] flex items-center justify-center p-2.5 shrink-0 relative group">
                    {brandSplashLogoUrl ? (
                      <img
                        src={brandSplashLogoUrl}
                        alt="Splash Logo Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center px-1">
                        Blank
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-3 w-full">
                    <input
                      type="file"
                      ref={brandSplashLogoFileInputRef}
                      onChange={handleBrandSplashLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => brandSplashLogoFileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload Splash Logo
                      </button>

                      {brandSplashLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setBrandSplashLogoUrl('')}
                          className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Reset
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400">
                      PNG/SVG logo displayed centrally on the startup splash screen.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Whole App Font Customization */}
            <div className="p-5 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Type className="w-4 h-4 text-purple-400" />
                  Application Typography & Font Family
                </label>
                <span className="text-[10px] text-purple-400 font-semibold bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                  Whole App Font Preset
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Body Font Family */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 block">
                    Primary App Font Family (Body & Controls)
                  </span>
                  <select
                    value={brandFontFamily}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      setBrandFontFamily(newFont);
                      applyBrandingToDocument({ ...brandingConfig, fontFamily: newFont, headingFontFamily: brandHeadingFontFamily });
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
                    value={brandFontFamily}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      setBrandFontFamily(newFont);
                      applyBrandingToDocument({ ...brandingConfig, fontFamily: newFont, headingFontFamily: brandHeadingFontFamily });
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
                    value={brandHeadingFontFamily}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      setBrandHeadingFontFamily(newFont);
                      applyBrandingToDocument({ ...brandingConfig, fontFamily: brandFontFamily, headingFontFamily: newFont });
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
                    value={brandHeadingFontFamily}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      setBrandHeadingFontFamily(newFont);
                      applyBrandingToDocument({ ...brandingConfig, fontFamily: brandFontFamily, headingFontFamily: newFont });
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
                  The Quick Brown Fox Jumps Over The Lazy Dog — {brandTitle || 'Festival 2026'}
                </div>
                <div className="text-xs text-slate-400">
                  0123456789 • Winner Announced • Official Call Sheet & Certificates
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save Festival Titles & Branding
              </button>
            </div>
          </form>

          {/* LIVE COMMENTS & CHEERS ACCESS & LOCK COOLDOWN ENGINE */}
          <div className="pt-6 border-t border-[#292d4a] space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                Live Comments & Cheers Controls & Cooldown Lock Engine
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Control participant comment posting privileges and set the lock cooldown period between consecutive comments for each participant.
              </p>
            </div>

            {commentSuccessMsg && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2.5 text-emerald-400 text-xs font-bold animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{commentSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveCommentSettings} className="space-y-6 bg-[#181b30] p-6 rounded-2xl border border-[#292d4a]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Global Comment Section On / Off Switch */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Comment Section Status
                    </label>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                      commentEnabled 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}>
                      {commentEnabled ? '🟢 Enabled' : '🔴 Disabled'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Switch comments ON or OFF for all participants across the festival.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCommentEnabled(true)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        commentEnabled
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 font-extrabold'
                          : 'bg-[#121424] text-slate-400 border-[#292d4a] hover:bg-slate-800'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      ON (Enable)
                    </button>

                    <button
                      type="button"
                      onClick={() => setCommentEnabled(false)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        !commentEnabled
                          ? 'bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-600/30 font-extrabold'
                          : 'bg-[#121424] text-slate-400 border-[#292d4a] hover:bg-slate-800'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      OFF (Disable)
                    </button>
                  </div>
                </div>

                {/* 2. Cooldown Lock Time Between Comments */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Lock Duration (Minutes)
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Minutes each participant must wait before posting again. Default: <strong>10m</strong>.
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      value={commentCooldownMinutes}
                      onChange={(e) => setCommentCooldownMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-28 bg-[#121424] border border-[#292d4a] rounded-xl px-3 py-2 text-sm text-white font-extrabold focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-xs font-bold text-purple-300">Min Cooldown</span>
                  </div>

                  {/* Preset Quick Selection Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Quick:</span>
                    {[1, 2, 5, 10, 15, 30, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setCommentCooldownMinutes(mins)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                          commentCooldownMinutes === mins
                            ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                            : 'bg-[#121424] text-slate-400 border-[#292d4a] hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Auto-Expires Duration for Comments (Hours) */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Auto-Expires Duration (Hours)
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Hours after which posted comments auto-expire & self-delete. Default: <strong>12h</strong>.
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={commentAutoExpireHours}
                      onChange={(e) => setCommentAutoExpireHours(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-28 bg-[#121424] border border-[#292d4a] rounded-xl px-3 py-2 text-sm text-white font-extrabold focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-xs font-bold text-amber-300">Hours Expiry</span>
                  </div>

                  {/* Preset Quick Selection Buttons for Hours */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Presets:</span>
                    {[1, 2, 6, 12, 24, 48, 72].map((hrs) => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setCommentAutoExpireHours(hrs)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                          commentAutoExpireHours === hrs
                            ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30'
                            : 'bg-[#121424] text-slate-400 border-[#292d4a] hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-2 border-t border-[#292d4a]">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save Comment Section & Expiry Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 8: EXPORT & RESTORE (BACKUP) */}
      {activeTab === 'backup' && (
        <div className="poster-card p-6 sm:p-8 bg-[#151728] rounded-3xl border border-[#292d4a] space-y-6 shadow-xl animate-fadeIn">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
              <HardDrive className="w-6 h-6 text-emerald-400" />
              Export & Restore Festival Data
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Keep a dated backup or move the whole festival desk to another browser.
            </p>
          </div>

          {backupToastMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-emerald-400 text-xs font-bold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{backupToastMsg}</span>
            </div>
          )}

          {backupErrorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-400 text-xs font-bold animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{backupErrorMsg}</span>
            </div>
          )}

          {/* Cloud Database & Real-Time Sync Status Card */}
          <div className="p-5 bg-[#181b30] rounded-2xl border border-[#292d4a] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className={`p-3 rounded-xl border shrink-0 ${
                festStore.getServerSyncStatus().status === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : festStore.getServerSyncStatus().status === 'initializing'
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                <Radio className={`w-5 h-5 ${festStore.getServerSyncStatus().status === 'connected' ? 'animate-pulse' : ''}`} />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-white">Supabase Realtime Cloud Sync</h3>
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider ${
                    festStore.getServerSyncStatus().status === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : festStore.getServerSyncStatus().status === 'initializing'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {festStore.getServerSyncStatus().status === 'connected' 
                      ? 'Connected & Live' 
                      : festStore.getServerSyncStatus().status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Real-time synchronization active across all devices via Supabase Realtime WebSocket engine (<span className="font-mono text-slate-300 font-bold">fest_data</span> table).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  const success = await festStore.forcePullFromCloud();
                  if (success) {
                    setBackupToastMsg('Successfully refreshed all records from Supabase Realtime Database!');
                  } else {
                    setBackupToastMsg('Refreshed connection with Supabase Database.');
                  }
                  setTimeout(() => setBackupToastMsg(''), 4000);
                }}
                className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Pull from Cloud</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await festStore.forcePushToCloud();
                  setBackupToastMsg('Synchronized latest festival state to Supabase Database!');
                  setTimeout(() => setBackupToastMsg(''), 4000);
                }}
                className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm active:scale-95"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Force Push to Cloud</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN: EXPORT BACKUP */}
            <div className="space-y-6">
              {/* 1. Full JSON Export */}
              <div className="p-5 bg-[#181b30] rounded-2xl border border-[#292d4a] space-y-4 shadow-md">
                <div className="flex items-center gap-3 border-b border-[#292d4a] pb-3">
                  <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Full Festival Desk JSON Backup</h3>
                    <p className="text-[11px] text-slate-400">Export complete database structure with all records</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Downloads a complete <span className="font-mono text-purple-300 font-bold">.json</span> file containing groups, participant profiles, competitions, registrations, results, announcements, and theme configurations. Perfect for migrating to another computer or archiving after the event.
                </p>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const jsonStr = festStore.exportJSON();
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`festival_desk_backup_${dateStr}.json`, jsonStr, 'application/json');
                      setBackupToastMsg('Full JSON backup downloaded successfully!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all active:scale-95 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>
              </div>

              {/* 2. CSV Exports */}
              <div className="p-5 bg-[#181b30] rounded-2xl border border-[#292d4a] space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-[#292d4a] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-600/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">Export Tabular CSV Reports</h3>
                      <p className="text-[11px] text-slate-400">Download separate CSV spreadsheets for each section</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const dateStr = new Date().toISOString().split('T')[0];
                      const reports: Array<{ type: Parameters<typeof festStore.exportCSV>[0]; name: string }> = [
                        { type: 'participants', name: `participants_${dateStr}.csv` },
                        { type: 'groups', name: `groups_standings_${dateStr}.csv` },
                        { type: 'competitions', name: `competitions_${dateStr}.csv` },
                        { type: 'registrations', name: `registrations_${dateStr}.csv` },
                        { type: 'results', name: `results_${dateStr}.csv` },
                        { type: 'marks', name: `judge_marks_${dateStr}.csv` },
                        { type: 'stages', name: `stages_venues_${dateStr}.csv` },
                        { type: 'comments', name: `comments_${dateStr}.csv` },
                        { type: 'notifications', name: `announcements_${dateStr}.csv` },
                        { type: 'categories', name: `categories_${dateStr}.csv` },
                        { type: 'levels', name: `levels_${dateStr}.csv` },
                      ];
                      setBackupToastMsg('Exporting all separate CSV reports...');
                      for (let i = 0; i < reports.length; i++) {
                        const r = reports[i];
                        const csvStr = festStore.exportCSV(r.type);
                        downloadFile(r.name, csvStr, 'text/csv');
                        await new Promise((resolve) => setTimeout(resolve, 200));
                      }
                      setBackupToastMsg('All 11 CSV reports exported successfully!');
                      setTimeout(() => setBackupToastMsg(''), 4500);
                    }}
                    className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Download all separate CSV reports at once"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download All (11 CSVs)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('participants');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`participants_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Participants CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-cyan-600/20 border border-[#292d4a] hover:border-cyan-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Participants</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {festStore.getProfiles().length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('groups');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`groups_standings_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Groups & Standings CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-indigo-600/20 border border-[#292d4a] hover:border-indigo-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Groups & Standings</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {festStore.getGroups().length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('competitions');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`competitions_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Competitions CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-purple-600/20 border border-[#292d4a] hover:border-purple-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Competitions</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {competitions.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('registrations');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`registrations_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Registrations CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-emerald-600/20 border border-[#292d4a] hover:border-emerald-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Registrations</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      {registrations.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('results');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`results_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Results CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-amber-600/20 border border-[#292d4a] hover:border-amber-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Results & Winners</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {results.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('marks');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`judge_marks_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Judge Marks CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-rose-600/20 border border-[#292d4a] hover:border-rose-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Judge Scores & Marks</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      {registrations.filter((r) => r.mark).length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('stages');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`stages_venues_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Stages & Venues CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-teal-600/20 border border-[#292d4a] hover:border-teal-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>Stages & Venues</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      {festStore.getStages().length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('comments');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`comments_stream_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Comments CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-pink-600/20 border border-[#292d4a] hover:border-pink-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-pink-400 shrink-0" />
                      <span>Live Comments Stream</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20">
                      {festStore.getComments().length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('notifications');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`announcements_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Announcements CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-yellow-600/20 border border-[#292d4a] hover:border-yellow-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-yellow-400 shrink-0" />
                      <span>Announcements</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
                      {festStore.getNotifications().length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('categories');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`categories_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Categories CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-blue-600/20 border border-[#292d4a] hover:border-blue-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Categories</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {festStore.getCategories().length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvStr = festStore.exportCSV('levels');
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadFile(`levels_departments_${dateStr}.csv`, csvStr, 'text/csv');
                      setBackupToastMsg('Levels/Departments CSV exported!');
                      setTimeout(() => setBackupToastMsg(''), 4000);
                    }}
                    className="p-3 bg-[#111322] hover:bg-violet-600/20 border border-[#292d4a] hover:border-violet-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-400 shrink-0" />
                      <span>Levels & Departments</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                      {festStore.getLevels().length}
                    </span>
                  </button>

                  {/* QR Code Quick Button in Grid */}
                  <button
                    type="button"
                    onClick={() => setShowBulkQrModal(true)}
                    className="p-3 bg-[#111322] hover:bg-purple-600/20 border border-purple-500/30 hover:border-purple-500/50 text-purple-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Participant QR Codes</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {festStore.getProfiles().filter(p => p.role === 'participant').length}
                    </span>
                  </button>
                </div>
              </div>

              {/* 3. Bulk Participant QR Codes Export */}
              <div className="p-5 bg-[#181b30] rounded-2xl border border-purple-500/30 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-[#292d4a] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">Bulk Participant QR Codes Export</h3>
                      <p className="text-[11px] text-slate-400">Download high-res JPG QR codes in a ZIP or print badge sheets</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                    {festStore.getProfiles().filter(p => p.role === 'participant').length} Participants
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Export all participant login QR codes at once. Each QR code is encoded with the participant's Chest Number for instant scanning on the login screen. Exported images are cleanly named by Chest Number only (e.g. 101.jpg). You can download a structured ZIP archive of high-res JPGs or generate ready-to-print multi-badge sheets.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isBulkQrLoading}
                    onClick={async () => {
                      const participants = festStore.getProfiles().filter(p => p.role === 'participant').sort((a, b) => {
                        const numA = parseInt(a.userId?.replace(/\D/g, '') || '', 10);
                        const numB = parseInt(b.userId?.replace(/\D/g, '') || '', 10);
                        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                          return numA - numB;
                        }
                        return (a.userId || '').localeCompare(b.userId || '', undefined, { numeric: true, sensitivity: 'base' });
                      });
                      if (participants.length === 0) {
                        setBackupErrorMsg('No participant profiles found to export QR codes.');
                        setTimeout(() => setBackupErrorMsg(''), 4000);
                        return;
                      }
                      setIsBulkQrLoading(true);
                      setBackupToastMsg(`Generating ZIP archive of ${participants.length} QR codes...`);
                      const res = await downloadBulkQrZip(participants, 'all_participants_qr_codes', {
                        includeLabel: true,
                        size: 512,
                        imageFormat: 'jpg',
                        namingFormat: 'chestNoOnly',
                      });
                      setIsBulkQrLoading(false);
                      if (res.success) {
                        setBackupToastMsg(`Successfully downloaded ZIP containing ${res.count} participant QR codes!`);
                        setTimeout(() => setBackupToastMsg(''), 5000);
                      } else {
                        setBackupErrorMsg(res.error || 'Failed to download QR code ZIP.');
                        setTimeout(() => setBackupErrorMsg(''), 5000);
                      }
                    }}
                    className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isBulkQrLoading ? 'Generating ZIP...' : 'Download All QR ZIP'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBulkQrModal(true)}
                    className="p-3 bg-[#111322] hover:bg-purple-600/20 border border-purple-500/30 hover:border-purple-500/50 text-purple-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Filter & Print Badges</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: RESTORE IMPORT JSON */}
            <div className="space-y-6">
              <div className="p-5 bg-[#181b30] rounded-2xl border border-[#292d4a] space-y-4 shadow-md h-full flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-[#292d4a] pb-3">
                    <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">Import JSON Backup</h3>
                      <p className="text-[11px] text-slate-400">Restore or load festival data from a JSON file</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Select a previously exported <span className="font-mono text-emerald-300 font-bold">.json</span> file to restore all groups, profiles, competitions, and scores to this browser.
                  </p>

                  {/* File Upload Drop Area */}
                  <label className="border-2 border-dashed border-[#292d4a] hover:border-emerald-500/50 bg-[#111322] rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center gap-2 group block">
                    <Upload className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                    <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                      {importFile ? importFile.name : 'Click to Choose JSON Backup File'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Accepts .json backup files</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImportFile(file);
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const text = evt.target?.result as string;
                            setImportJsonText(text);
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>

                  {importJsonText && (
                    <div className="p-3 bg-[#111322] border border-emerald-500/30 rounded-xl text-xs space-y-1.5 animate-fadeIn">
                      <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Valid JSON file loaded!
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono">
                        Ready to restore state. Click button below to complete.
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    disabled={!importJsonText}
                    onClick={() => {
                      if (!importJsonText) return;
                      const res = festStore.importJSON(importJsonText);
                      if (res.success) {
                        setBackupToastMsg(res.message);
                        setImportFile(null);
                        setImportJsonText('');
                        onRefresh();
                        setTimeout(() => setBackupToastMsg(''), 5000);
                      } else {
                        setBackupErrorMsg(res.message);
                        setTimeout(() => setBackupErrorMsg(''), 5000);
                      }
                    }}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                      importJsonText
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-600/30'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import & Restore JSON</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* DANGER ZONE: FACTORY RESET DATA */}
          <div className="p-6 bg-[#181b30] rounded-2xl border border-rose-500/30 space-y-5 mt-6">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                Reset Festival Data
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Revert all festival records back to initial factory defaults or wipe state.
              </p>
            </div>

            {resetToastMsg && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-emerald-400 text-xs font-bold animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{resetToastMsg}</span>
              </div>
            )}

            {/* Warning Banner */}
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-rose-200">
                <div className="font-bold text-rose-300 uppercase tracking-wider text-[11px]">Warning: Irreversible Data Reset</div>
                <p className="leading-relaxed">
                  Resetting your data will erase or revert all custom registrations, competition edits, published results, and custom leaderboards. Make sure to export a JSON backup first if you wish to preserve your current festival records.
                </p>
              </div>
            </div>

            {/* Current State Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#111322] rounded-xl border border-[#292d4a]">
                <div className="text-[10px] uppercase font-bold text-slate-400">Competitions</div>
                <div className="text-base font-black text-white mt-0.5">{competitions.length}</div>
              </div>
              <div className="p-3 bg-[#111322] rounded-xl border border-[#292d4a]">
                <div className="text-[10px] uppercase font-bold text-slate-400">Participants</div>
                <div className="text-base font-black text-white mt-0.5">{festStore.getProfiles().length}</div>
              </div>
              <div className="p-3 bg-[#111322] rounded-xl border border-[#292d4a]">
                <div className="text-[10px] uppercase font-bold text-slate-400">Registrations</div>
                <div className="text-base font-black text-white mt-0.5">{registrations.length}</div>
              </div>
              <div className="p-3 bg-[#111322] rounded-xl border border-[#292d4a]">
                <div className="text-[10px] uppercase font-bold text-slate-400">Results</div>
                <div className="text-base font-black text-white mt-0.5">{results.length}</div>
              </div>
            </div>

            {/* Action Confirmation Form */}
            <div className="p-4 bg-[#111322] rounded-xl border border-rose-500/20 space-y-3">
              <p className="text-xs text-slate-300">
                To prevent accidental deletion, please type <span className="font-mono font-bold text-rose-400">RESET</span> in the input box below to confirm:
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Type RESET to confirm"
                  className="px-3.5 py-2.5 bg-[#181b30] border border-[#292d4a] focus:border-rose-500 text-slate-100 rounded-xl text-xs outline-none font-mono tracking-widest uppercase sm:max-w-xs"
                />

                <button
                  type="button"
                  disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
                  onClick={() => {
                    festStore.resetToDefaults();
                    setResetConfirmText('');
                    setResetToastMsg('Festival data successfully reset to factory defaults!');
                    onRefresh();
                    setTimeout(() => setResetToastMsg(''), 5000);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                    resetConfirmText.trim().toUpperCase() === 'RESET'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-rose-600/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Reset Data to Factory Defaults</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* CREATE / EDIT COMPETITION MODAL */}
      {showCompModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="poster-card max-w-lg w-full bg-[#151728] border border-purple-500/50 p-6 rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#292d4a] pb-3">
              <h3 className="text-lg font-extrabold text-white">
                {editingComp ? 'Edit Competition' : 'Create New Competition'}
              </h3>
              <button onClick={() => { setShowCompModal(false); setEditingComp(null); }} className="p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompetition} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-300 mb-1">Competition Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mappilappattu Solo"
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <select
                    value={newCompCategory}
                    onChange={(e: any) => setNewCompCategory(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] p-3 rounded-2xl text-white focus:outline-none"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Type</label>
                  <select
                    value={newCompType}
                    onChange={(e: any) => setNewCompType(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] p-3 rounded-2xl text-white focus:outline-none"
                  >
                    <option value="Individual">Individual</option>
                    <option value="Group">Group</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Event Format</label>
                  <select
                    value={newCompIsStage ? 'stage' : 'offstage'}
                    onChange={(e) => setNewCompIsStage(e.target.value === 'stage')}
                    className="w-full bg-[#181b30] border border-[#292d4a] p-3 rounded-2xl text-white focus:outline-none"
                  >
                    <option value="stage">Stage (On-Stage)</option>
                    <option value="offstage">Off-Stage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold text-xs uppercase tracking-wider">Span Time (in Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={newCompSpanTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setNewCompSpanTime('');
                      } else {
                        const parsed = parseInt(val, 10);
                        setNewCompSpanTime(isNaN(parsed) ? '' : Math.max(1, parsed));
                      }
                    }}
                    placeholder="e.g. 1, 2, 3, 10, 60..."
                    className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white font-semibold font-mono focus:outline-none transition-all"
                  />
                  <span className="text-[10px] text-slate-400 font-normal mt-1 block">
                    Duration in minutes (1, 2, 3, 4, 5... any number)
                  </span>
                </div>
              </div>

              {newCompType === 'Group' && (
                <div className="p-3.5 bg-[#121424] border border-purple-500/20 rounded-2xl space-y-2">
                  <div className="text-purple-300 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <span>👥 Numbers of team members</span>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 text-xs font-semibold">No. of members</label>
                    <input
                      type="number"
                      min={1}
                      value={newCompTeamSize}
                      onChange={(e) => setNewCompTeamSize(Number(e.target.value))}
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-2.5 rounded-xl text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Max/Group</label>
                  <input
                    type="number"
                    value={newCompLimit}
                    onChange={(e) => setNewCompLimit(Number(e.target.value))}
                    className="w-full bg-[#181b30] border border-[#292d4a] p-2.5 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-amber-400 mb-1">1st Pts</label>
                  <input
                    type="number"
                    value={newCompP1}
                    onChange={(e) => setNewCompP1(Number(e.target.value))}
                    className="w-full bg-[#181b30] border border-[#292d4a] p-2.5 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">2nd Pts</label>
                  <input
                    type="number"
                    value={newCompP2}
                    onChange={(e) => setNewCompP2(Number(e.target.value))}
                    className="w-full bg-[#181b30] border border-[#292d4a] p-2.5 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-amber-600 mb-1">3rd Pts</label>
                  <input
                    type="number"
                    value={newCompP3}
                    onChange={(e) => setNewCompP3(Number(e.target.value))}
                    className="w-full bg-[#181b30] border border-[#292d4a] p-2.5 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-bold text-xs uppercase tracking-wider">
                    Description & Guidelines
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Line breaks & spaces preserved
                  </span>
                </div>
                <textarea
                  value={newCompDesc}
                  onChange={(e) => setNewCompDesc(e.target.value)}
                  placeholder="Paste or type competition rules, guidelines, marks criteria with line breaks and paragraphs..."
                  rows={4}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white text-xs sm:text-sm min-h-[100px] whitespace-pre-wrap font-sans focus:outline-none transition-all leading-relaxed"
                />
              </div>

              <button type="submit" className="poster-btn-primary w-full py-3 text-xs rounded-2xl">
                <span>{editingComp ? 'Update Competition' : 'Save Competition'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROLE & ADMIN CREDENTIALS MODAL */}
      {showAdminCredModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="poster-card max-w-lg w-full bg-[#151728] border border-rose-500/50 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#292d4a] pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-400" />
                <h3 className="text-lg font-extrabold text-white">Manage System Passwords</h3>
              </div>
              <button 
                onClick={() => {
                  setShowAdminCredModal(false);
                  setAdminCredError('');
                  setAdminCredSuccess('');
                }} 
                className="p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Select Tabs inside Modal */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#121424] rounded-2xl border border-[#292d4a]">
              <button
                type="button"
                onClick={() => {
                  setCredModalTab('admin');
                  setAdminCredError('');
                  setAdminCredSuccess('');
                }}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  credModalTab === 'admin'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setCredModalTab('judge');
                  setAdminCredError('');
                  setAdminCredSuccess('');
                }}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  credModalTab === 'judge'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Judge
              </button>
              <button
                type="button"
                onClick={() => {
                  setCredModalTab('media');
                  setAdminCredError('');
                  setAdminCredSuccess('');
                }}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  credModalTab === 'media'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Media
              </button>
              <button
                type="button"
                onClick={() => {
                  setCredModalTab('leaders');
                  setAdminCredError('');
                  setAdminCredSuccess('');
                }}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  credModalTab === 'leaders'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Leaders
              </button>
            </div>

            {adminCredError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-2xl text-xs font-semibold text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {adminCredError}
              </div>
            )}

            {adminCredSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl text-xs font-semibold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {adminCredSuccess}
              </div>
            )}

            {/* TAB 1: ADMIN PASSWORD */}
            {credModalTab === 'admin' && (
              <form onSubmit={handleSaveAdminCredentials} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-300 mb-1.5 font-bold">
                    Existing / Current Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showExistingPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter existing password"
                      value={existingPassword}
                      onChange={(e) => setExistingPassword(e.target.value)}
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-rose-500 rounded-2xl pl-4 pr-10 py-3 text-sm text-white font-mono focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowExistingPassword(!showExistingPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showExistingPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-bold">New Admin Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="New password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-rose-500 rounded-2xl pl-4 pr-10 py-3 text-sm text-white font-mono focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminCredModal(false)}
                    className="w-1/2 py-3 rounded-2xl border border-[#292d4a] bg-[#181b30] hover:bg-slate-800 text-slate-300 transition-all text-xs uppercase tracking-wider font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white transition-all text-xs uppercase tracking-wider font-bold border border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: JUDGE PASSWORD */}
            {credModalTab === 'judge' && (
              <form onSubmit={handleSaveJudgeCredentials} className="space-y-4 text-xs font-semibold">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] text-emerald-300">
                  Judges use these credentials to log in, evaluate reported candidates, and input blind valuation marks.
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-bold">Judge Username (Fixed)</label>
                  <input
                    type="text"
                    disabled
                    value="judge"
                    className="w-full bg-[#181b30]/60 border border-[#292d4a] rounded-2xl px-4 py-3 text-sm text-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-bold">Judge Access Password</label>
                  <div className="relative">
                    <input
                      type={showJudgePassword ? 'text' : 'password'}
                      required
                      placeholder="Enter new Judge password"
                      value={judgePassword}
                      onChange={(e) => setJudgePassword(e.target.value)}
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-emerald-500 rounded-2xl pl-4 pr-10 py-3 text-sm text-white font-mono focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowJudgePassword(!showJudgePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showJudgePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminCredModal(false)}
                    className="w-1/2 py-3 rounded-2xl border border-[#292d4a] bg-[#181b30] hover:bg-slate-800 text-slate-300 transition-all text-xs uppercase tracking-wider font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all text-xs uppercase tracking-wider font-bold border border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  >
                    Update Judge Password
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: MEDIA PASSWORD */}
            {credModalTab === 'media' && (
              <form onSubmit={handleSaveMediaCredentials} className="space-y-4 text-xs font-semibold">
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-[11px] text-cyan-300">
                  Media representatives use these credentials to log in, syndicate live results, and copy standings for press coverage.
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-bold">Media Username (Fixed)</label>
                  <input
                    type="text"
                    disabled
                    value="media"
                    className="w-full bg-[#181b30]/60 border border-[#292d4a] rounded-2xl px-4 py-3 text-sm text-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-bold">Media Access Password</label>
                  <div className="relative">
                    <input
                      type={showMediaPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter new Media password"
                      value={mediaPassword}
                      onChange={(e) => setMediaPassword(e.target.value)}
                      className="w-full bg-[#181b30] border border-[#292d4a] focus:border-cyan-500 rounded-2xl pl-4 pr-10 py-3 text-sm text-white font-mono focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMediaPassword(!showMediaPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showMediaPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminCredModal(false)}
                    className="w-1/2 py-3 rounded-2xl border border-[#292d4a] bg-[#181b30] hover:bg-slate-800 text-slate-300 transition-all text-xs uppercase tracking-wider font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white transition-all text-xs uppercase tracking-wider font-bold border border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  >
                    Update Media Password
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: GROUP LEADERS PASSWORDS QUICK VIEW */}
            {credModalTab === 'leaders' && (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  Select a group below or edit their leader password directly:
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {groups.map(grp => (
                    <div key={grp.id} className="p-3 rounded-2xl bg-[#181b30] border border-[#292d4a] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: grp.color }} />
                          {grp.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Leader: {grp.leaderName} • Pass: <code className="text-amber-400 font-mono">{grp.leaderPassword || '••••'}</code>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminCredModal(false);
                          handleOpenEditGroupModal(grp);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white text-[10px] font-bold transition-all border border-purple-500/30 cursor-pointer"
                      >
                        Edit Pass
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdminCredModal(false)}
                  className="w-full py-2.5 rounded-2xl border border-[#292d4a] bg-[#181b30] hover:bg-slate-800 text-slate-300 transition-all text-xs uppercase tracking-wider font-bold"
                >
                  Close
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="poster-card max-w-md w-full bg-[#151728] border border-purple-500/50 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#292d4a] pb-3">
              <h3 className="text-lg font-extrabold text-white">Add Group & Leader</h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-300 mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Platinum Group"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Leader Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Faisal Khan"
                  value={newGroupLeaderName}
                  onChange={(e) => setNewGroupLeaderName(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Leader Password</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. plat123"
                  value={newGroupLeaderPass}
                  onChange={(e) => setNewGroupLeaderPass(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 p-3 rounded-2xl text-white font-mono focus:outline-none"
                />
              </div>

              <button type="submit" className="poster-btn-accent w-full py-3 text-xs rounded-2xl">
                <span>Save Group</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-md w-full bg-[#151728] border border-rose-500/40 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-3.5 text-rose-400">
              <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">
                  Delete {deleteConfirmTarget.type === 'competition' ? 'Competition' : 'Group'}
                </h3>
                <p className="text-xs text-rose-300">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-[#181b30] p-4 rounded-2xl border border-[#292d4a]">
              Are you sure you want to delete <strong className="text-white">"{deleteConfirmTarget.name}"</strong>?
              {deleteConfirmTarget.type === 'competition'
                ? ' This will permanently remove the competition along with all enrolled registrations and published results.'
                : ' This will permanently remove the group, all its members, registrations, and associated leaderboard points.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202440] text-slate-300 hover:text-white text-xs font-bold transition-all border border-[#292d4a]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CATEGORY EDIT MODAL */}
      {quickCategoryComp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-md w-full bg-[#151728] border border-purple-500/50 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#292d4a] pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-extrabold">
                <Tag className="w-5 h-5" />
                <h3 className="text-base font-extrabold text-white">Edit Category</h3>
              </div>
              <button
                onClick={() => setQuickCategoryComp(null)}
                className="p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Updating category for <strong className="text-white">"{quickCategoryComp.name}"</strong>:
            </p>

            <form onSubmit={handleSaveQuickCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-2 font-bold uppercase">Select Category</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {categoriesList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setQuickCatSelect(cat)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        quickCatSelect === cat
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                          : 'bg-[#181b30] text-slate-300 border-[#292d4a] hover:bg-[#202542]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickCategoryComp(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202440] text-slate-300 hover:text-white font-bold border border-[#292d4a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="poster-btn-primary px-5 py-2.5 rounded-xl font-bold flex items-center gap-1.5"
                >
                  <Tag className="w-4 h-4" />
                  <span>Update Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE CATEGORIES MODAL */}
      {showManageCategoriesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-lg w-full bg-[#151728] border border-purple-500/50 p-6 rounded-3xl space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#292d4a] pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-extrabold">
                <Tag className="w-5 h-5" />
                <h3 className="text-lg font-extrabold text-white">Manage Competition Categories</h3>
              </div>
              <button
                onClick={() => {
                  setShowManageCategoriesModal(false);
                  setCategoryActionMsg(null);
                }}
                className="p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback Banner */}
            {categoryActionMsg && (
              <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                categoryActionMsg.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {categoryActionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{categoryActionMsg.text}</span>
              </div>
            )}

            {/* Add Category Form */}
            <form onSubmit={handleAddCategorySubmit} className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-3">
              <label className="block text-xs font-bold uppercase text-slate-300">Add New Category</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. Off-Stage, Quiz, Islamic Arts, IT..."
                  value={newCatNameInput}
                  onChange={(e) => setNewCatNameInput(e.target.value)}
                  className="flex-1 bg-[#131524] border border-[#292d4a] focus:border-purple-500 p-2.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none font-semibold"
                />
                <button
                  type="submit"
                  className="poster-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Category</span>
                </button>
              </div>
            </form>

            {/* Existing Categories List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Active Categories ({categoriesList.length})</span>
                <span>Assigned Events</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {categoriesList.map((cat) => {
                  const assignedCount = competitions.filter(c => c.category.toLowerCase() === cat.toLowerCase()).length;
                  return (
                    <div
                      key={cat}
                      className="p-3 bg-[#181b30] border border-[#292d4a] hover:border-purple-500/30 rounded-2xl flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                        <span className="text-sm font-bold text-white">{cat}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#131524] text-slate-300 border border-[#292d4a]">
                          {assignedCount} {assignedCount === 1 ? 'event' : 'events'}
                        </span>

                        <button
                          type="button"
                          onClick={() => setDeletingCatName(cat)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all border border-rose-500/20 flex items-center gap-1 text-xs font-bold"
                          title={`Remove category ${cat}`}
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-[#292d4a] text-right">
              <button
                type="button"
                onClick={() => setShowManageCategoriesModal(false)}
                className="px-5 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202440] text-slate-300 font-bold text-xs border border-[#292d4a]"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CATEGORY MODAL */}
      {deletingCatName && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-md w-full bg-[#151728] border border-rose-500/50 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Delete Category?</h3>
                <p className="text-xs text-rose-300">This action will remove the category.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete category <strong className="text-white font-bold">"{deletingCatName}"</strong>?
            </p>

            {competitions.filter(c => c.category.toLowerCase() === deletingCatName.toLowerCase()).length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Notice:</strong> {competitions.filter(c => c.category.toLowerCase() === deletingCatName.toLowerCase()).length} competition(s) currently belong to this category and will be automatically reassigned to <strong>"General"</strong>.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCatName(null)}
                className="px-4 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202440] text-slate-300 text-xs font-bold border border-[#292d4a]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteCategory(deletingCatName)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Category</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE LEVELS MODAL */}
      {showManageLevelsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-lg w-full bg-[#151728] border border-purple-500/50 p-6 rounded-3xl space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#292d4a] pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-extrabold">
                <Layers className="w-5 h-5" />
                <h3 className="text-lg font-extrabold text-white">Manage Student Levels</h3>
              </div>
              <button
                onClick={() => {
                  setShowManageLevelsModal(false);
                  setLevelActionMsg(null);
                }}
                className="p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback Banner */}
            {levelActionMsg && (
              <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                levelActionMsg.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {levelActionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{levelActionMsg.text}</span>
              </div>
            )}

            {/* Add Level Form */}
            <form onSubmit={handleAddLevelSubmit} className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-3">
              <label className="block text-xs font-bold uppercase text-slate-300">Add New Level</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. 5, 6, 7..."
                  value={newLevelNameInput}
                  onChange={(e) => setNewLevelNameInput(e.target.value)}
                  className="flex-1 bg-[#131524] border border-[#292d4a] focus:border-purple-500 p-2.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none font-semibold"
                />
                <button
                  type="submit"
                  className="poster-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Level</span>
                </button>
              </div>
            </form>

            {/* Existing Levels List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Active Levels ({levelsList.length})</span>
                <span>Assigned Students</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {levelsList.map((lvl) => {
                  const profiles = festStore.getProfiles();
                  const assignedCount = profiles.filter(p => p.department && p.department.toLowerCase() === lvl.toLowerCase()).length;
                  const isEditing = editingLevelOldName === lvl;

                  return (
                    <div
                      key={lvl}
                      className="p-3 bg-[#181b30] border border-[#292d4a] hover:border-purple-500/30 rounded-2xl flex items-center justify-between transition-all gap-2"
                    >
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleUpdateLevelSubmit(lvl, editingLevelNewName);
                          }}
                          className="flex-1 flex items-center gap-2"
                        >
                          <input
                            type="text"
                            required
                            value={editingLevelNewName}
                            onChange={(e) => setEditingLevelNewName(e.target.value)}
                            className="flex-1 bg-[#131524] border border-purple-500 p-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none font-bold"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-purple-600/30 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLevelOldName(null);
                              setEditingLevelNewName('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#131524] hover:bg-[#202440] text-slate-400 font-bold text-xs border border-[#292d4a] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                            <span className="text-sm font-bold text-white">{lvl}</span>
                          </div>

                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#131524] text-slate-300 border border-[#292d4a]">
                              {assignedCount} {assignedCount === 1 ? 'student' : 'students'}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingLevelOldName(lvl);
                                setEditingLevelNewName(lvl);
                                setLevelActionMsg(null);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white transition-all border border-purple-500/20 flex items-center gap-1 text-xs font-bold cursor-pointer"
                              title={`Edit Level ${lvl}`}
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingLevelName(lvl)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all border border-rose-500/20 flex items-center gap-1 text-xs font-bold cursor-pointer"
                              title={`Remove Level ${lvl}`}
                            >
                              <MinusCircle className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-[#292d4a] text-right">
              <button
                type="button"
                onClick={() => setShowManageLevelsModal(false)}
                className="px-5 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202440] text-slate-300 font-bold text-xs border border-[#292d4a]"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE LEVEL MODAL */}
      {deletingLevelName && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-md w-full bg-[#151728] border border-rose-500/50 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Delete Level?</h3>
                <p className="text-xs text-rose-300">This action will remove the Level.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete Level <strong className="text-white font-bold">"{deletingLevelName}"</strong>?
            </p>

            {(() => {
              const profiles = festStore.getProfiles();
              const affectedCount = profiles.filter(p => p.department && p.department.toLowerCase() === deletingLevelName.toLowerCase()).length;
              const defaultTarget = levelsList.find(l => l.toLowerCase() !== deletingLevelName.toLowerCase()) || '1';
              if (affectedCount > 0) {
                return (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Notice:</strong> {affectedCount} participant(s) currently belong to this Level and will be automatically reassigned to Level <strong>"{defaultTarget}"</strong>.
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLevelName(null)}
                className="px-4 py-2 text-xs font-bold bg-[#181b30] hover:bg-[#202440] text-slate-300 border border-[#292d4a] rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteLevel(deletingLevelName)}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md shadow-rose-600/30"
              >
                Yes, Delete Level
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE SCHEDULE & AUTO-DISTRIBUTE MODAL */}
      {showTopCreateScheduleModal && (
        <CreateScheduleModal
          isOpen={showTopCreateScheduleModal}
          competitions={competitions}
          registrations={registrations}
          stagesList={stagesList}
          onClose={() => setShowTopCreateScheduleModal(false)}
          onScheduleApplied={() => {
            setShowTopCreateScheduleModal(false);
            onRefresh();
          }}
        />
      )}

      {/* MANAGE STAGES MODAL */}
      {showManageStagesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-xl w-full bg-[#151728] border border-purple-500/50 p-6 rounded-3xl space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#292d4a] pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-extrabold">
                <MapPin className="w-5 h-5" />
                <h3 className="text-lg font-extrabold text-white">Manage Festival Stages</h3>
              </div>
              <button
                onClick={() => {
                  setShowManageStagesModal(false);
                  setStageActionMsg(null);
                  setEditingStageOldName(null);
                }}
                className="p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback Banner */}
            {stageActionMsg && (
              <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                stageActionMsg.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {stageActionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{stageActionMsg.text}</span>
              </div>
            )}

            {/* Add Stage Form */}
            <form onSubmit={handleAddStageSubmit} className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Add New Stage / Venue</label>
                <span className="text-[11px] text-slate-400 font-medium">Choose Classification</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
                <input
                  type="text"
                  required
                  placeholder="e.g. Stage 1, Stage 2, Auditorium, Hall A..."
                  value={newStageNameInput}
                  onChange={(e) => setNewStageNameInput(e.target.value)}
                  className="flex-1 bg-[#131524] border border-[#292d4a] focus:border-purple-500 p-2.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none font-semibold min-w-0"
                />
                <div className="flex items-center gap-1 bg-[#131524] p-1 rounded-xl border border-[#292d4a] shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setNewStageIsStageInput(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      newStageIsStageInput
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Stage
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStageIsStageInput(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !newStageIsStageInput
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Off-Stage
                  </button>
                </div>
                <button
                  type="submit"
                  className="poster-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap shadow-md shadow-purple-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Stage</span>
                </button>
              </div>
            </form>

            {/* Existing Stages List */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                <span>Active Stages ({stageItems.length})</span>
                <span>Classification & Actions</span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {stageItems.map((st) => {
                  const isEditing = editingStageOldName === st.name;

                  return (
                    <div
                      key={st.id || st.name}
                      className="p-3.5 bg-[#181b30] border border-[#292d4a] hover:border-purple-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                    >
                      {isEditing ? (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 w-full">
                          <input
                            type="text"
                            value={editingStageNewName}
                            onChange={(e) => setEditingStageNewName(e.target.value)}
                            className="bg-[#131524] border border-purple-500/60 p-2.5 rounded-xl text-xs text-white focus:outline-none flex-1 font-semibold min-w-0"
                            placeholder="Stage Name"
                            autoFocus
                          />
                          <div className="flex items-center gap-1 bg-[#131524] p-1 rounded-xl border border-[#292d4a] shrink-0 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setEditingStageIsStage(true)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                editingStageIsStage
                                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Stage
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStageIsStage(false)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                !editingStageIsStage
                                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Off-Stage
                            </button>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSaveEditStage(st.name)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStageOldName(null)}
                              className="px-3 py-2 rounded-xl bg-[#131524] hover:bg-[#202440] text-slate-400 text-xs font-bold border border-[#292d4a] whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Left side: Indicator dot + Stage Name + Classification Toggle */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.isStage ? 'bg-purple-400 shadow-sm shadow-purple-400/50' : 'bg-amber-400 shadow-sm shadow-amber-400/50'}`}></span>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-bold text-white tracking-wide truncate block">{formatStageName(st.name)}</span>
                              {st.name !== formatStageName(st.name) && (
                                <span className="text-[10px] text-slate-500 font-mono">({st.name})</span>
                              )}
                            </div>

                            {/* Interactive Stage / Off-Stage Switch */}
                            <button
                              type="button"
                              onClick={() => handleToggleStageType(st.name, st.isStage)}
                              className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                                st.isStage
                                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                              }`}
                              title={`Click to switch to ${st.isStage ? 'Off-Stage' : 'Stage (On-Stage)'}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${st.isStage ? 'bg-purple-400' : 'bg-amber-400'}`}></span>
                              <span>{st.isStage ? 'Stage' : 'Off-Stage'}</span>
                            </button>
                          </div>

                          {/* Right side: Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStageOldName(st.name);
                                setEditingStageNewName(st.name);
                                setEditingStageIsStage(st.isStage);
                                setStageActionMsg(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500 text-purple-300 hover:text-white transition-all border border-purple-500/20 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap"
                              title={`Edit ${st.name}`}
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingStageName(st.name)}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all border border-rose-500/20 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap"
                              title={`Remove stage ${st.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-[#292d4a] text-right">
              <button
                type="button"
                onClick={() => {
                  setShowManageStagesModal(false);
                  setEditingStageOldName(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202440] text-slate-300 font-bold text-xs border border-[#292d4a]"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE STAGE MODAL */}
      {deletingStageName && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-md w-full bg-[#151728] border border-rose-500/50 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Delete Stage?</h3>
                <p className="text-xs text-rose-300">This action will remove the stage option.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete stage <strong className="text-white font-bold">"{deletingStageName}"</strong>?
            </p>

            {competitions.filter(c => c.venue && c.venue.toLowerCase() === deletingStageName.toLowerCase()).length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Notice:</strong> {competitions.filter(c => c.venue && c.venue.toLowerCase() === deletingStageName.toLowerCase()).length} competition(s) assigned to this stage will be automatically reassigned to <strong>"{stagesList.find(s => s.toLowerCase() !== deletingStageName.toLowerCase()) || 'Stage 1'}"</strong>.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStageName(null)}
                className="px-4 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202440] text-slate-300 text-xs font-bold border border-[#292d4a]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteStage(deletingStageName)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Stage</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT GROUP & LEADER CREDENTIALS MODAL */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-lg w-full bg-[#151728] border border-purple-500/50 p-6 rounded-3xl space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#292d4a] pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-extrabold">
                <Shield className="w-5 h-5" />
                <h3 className="text-lg font-extrabold text-white">Edit Group Name & Leader Credentials</h3>
              </div>
              <button
                onClick={() => setEditingGroup(null)}
                className="p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editGroupSuccessMsg && (
              <div className="p-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{editGroupSuccessMsg}</span>
              </div>
            )}

            {editGroupErrorMsg && (
              <div className="p-3 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editGroupErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditGroup} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  value={editGroupNameInput}
                  onChange={(e) => setEditGroupNameInput(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none"
                  placeholder="e.g. Ruby Group"
                />
              </div>

              <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Leader Credentials Control
                </h4>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Group Leader Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editGroupLeaderNameInput}
                    onChange={(e) => setEditGroupLeaderNameInput(e.target.value)}
                    className="w-full bg-[#131524] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Leader Password
                  </label>
                  <input
                    type="text"
                    required
                    value={editGroupLeaderPasswordInput}
                    onChange={(e) => setEditGroupLeaderPasswordInput(e.target.value)}
                    className="w-full bg-[#131524] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold focus:outline-none"
                    placeholder="Leader password"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Group Theme Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editGroupColorInput}
                    onChange={(e) => setEditGroupColorInput(e.target.value)}
                    className="w-10 h-9 bg-transparent border border-[#292d4a] rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-300">{editGroupColorInput}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#292d4a]">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202440] text-slate-300 text-xs font-bold border border-[#292d4a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30"
                >
                  Save Group Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PARTICIPANT CREDENTIALS & ID MODAL */}
      {editingParticipant && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="poster-card max-w-md w-full bg-[#151728] border border-purple-500/50 p-6 rounded-3xl space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#292d4a] pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-extrabold">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-extrabold text-white">Edit Participant Chest No & Profile</h3>
              </div>
              <button
                onClick={() => setEditingParticipant(null)}
                className="p-1.5 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editPartSuccessMsg && (
              <div className="p-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{editPartSuccessMsg}</span>
              </div>
            )}

            {editPartErrorMsg && (
              <div className="p-3 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editPartErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditParticipant} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Participant Chest No
                </label>
                <input
                  type="text"
                  required
                  value={editPartUserIdInput}
                  onChange={(e) => setEditPartUserIdInput(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono font-bold focus:outline-none"
                  placeholder="e.g. 014"
                />
                <p className="text-[10px] text-slate-500">Participants use this exact Chest No to log in.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Participant Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editPartNameInput}
                  onChange={(e) => setEditPartNameInput(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none"
                  placeholder="Type Name"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Second Name (Father Name) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editPartFatherNameInput}
                  onChange={(e) => setEditPartFatherNameInput(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none"
                  placeholder="Type Father Name"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Assigned Group
                </label>
                <select
                  value={editPartGroupIdInput}
                  onChange={(e) => setEditPartGroupIdInput(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none"
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Level
                  </label>
                  <select
                    value={editPartDeptInput}
                    onChange={(e) => setEditPartDeptInput(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {levelsList.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Category
                  </label>
                  <select
                    value={editPartCatInput}
                    onChange={(e) => setEditPartCatInput(e.target.value as CategoryType)}
                    className="w-full bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Senior">Senior</option>
                    <option value="Junior">Junior</option>
                    <option value="Sub-Junior">Sub-Junior</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#292d4a]">
                <button
                  type="button"
                  onClick={() => setEditingParticipant(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202440] text-slate-300 text-xs font-bold border border-[#292d4a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT PARTICIPANTS REPORT MODAL */}
      <PrintParticipantsReportModal
        isOpen={showCallSheetModal}
        onClose={() => setShowCallSheetModal(false)}
        competitions={competitions}
        registrations={registrations}
        groups={groups}
        initialCompId={reportingCompId}
        initialCategory={reportingCategoryFilter}
      />

      {/* PRINT DAY SCHEDULE MODAL */}
      <PrintDayScheduleModal
        isOpen={showOverviewPrintSchedule}
        onClose={() => setShowOverviewPrintSchedule(false)}
        competitions={competitions}
        registrations={registrations}
        stagesList={stagesList}
      />

      {/* EDIT PERFORMANCE POINT SCALE MODAL */}
      {showEditPerfModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121420] border border-[#292d4a] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 bg-[#181b30] border-b border-[#292d4a] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Configure Performance Point Scale</h3>
                  <p className="text-[11px] text-slate-400">Customize grade point allotments for individual and group categories</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditPerfModal(false)}
                className="p-2 hover:bg-[#202440] text-slate-400 hover:text-white rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {perfEditSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{perfEditSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  <span className="col-span-1">Grade</span>
                  <span className="col-span-1">Min Score</span>
                  <span className="col-span-1">Max Score</span>
                  <span className="col-span-1 text-center">Individual</span>
                  <span className="col-span-1 text-center">Group (2)</span>
                  <span className="col-span-1 text-center">Group (3)</span>
                  <span className="col-span-1 text-center">Group (4+)</span>
                </div>

                {perfPointConfigState.rules.map((rule, idx) => (
                  <div key={idx} className="grid grid-cols-7 gap-2 items-center bg-[#181b30] p-2.5 rounded-xl border border-[#292d4a]">
                    <div className="col-span-1">
                      <input
                        type="text"
                        value={rule.grade}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPerfPointConfigState(prev => {
                            const nextRules = [...prev.rules];
                            nextRules[idx] = { ...nextRules[idx], grade: val };
                            return { ...prev, rules: nextRules };
                          });
                        }}
                        className="w-full bg-[#121420] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-bold text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={rule.minScore}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPerfPointConfigState(prev => {
                            const nextRules = [...prev.rules];
                            nextRules[idx] = { ...nextRules[idx], minScore: val };
                            return { ...prev, rules: nextRules };
                          });
                        }}
                        className="w-full bg-[#121420] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={rule.maxScore}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPerfPointConfigState(prev => {
                            const nextRules = [...prev.rules];
                            nextRules[idx] = { ...nextRules[idx], maxScore: val };
                            return { ...prev, rules: nextRules };
                          });
                        }}
                        className="w-full bg-[#121420] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={rule.individual}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPerfPointConfigState(prev => {
                            const nextRules = [...prev.rules];
                            nextRules[idx] = { ...nextRules[idx], individual: val };
                            return { ...prev, rules: nextRules };
                          });
                        }}
                        className="w-full bg-[#121420] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={rule.group2}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPerfPointConfigState(prev => {
                            const nextRules = [...prev.rules];
                            nextRules[idx] = { ...nextRules[idx], group2: val };
                            return { ...prev, rules: nextRules };
                          });
                        }}
                        className="w-full bg-[#121420] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={rule.group3}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPerfPointConfigState(prev => {
                            const nextRules = [...prev.rules];
                            nextRules[idx] = { ...nextRules[idx], group3: val };
                            return { ...prev, rules: nextRules };
                          });
                        }}
                        className="w-full bg-[#121420] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={rule.group4Plus}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPerfPointConfigState(prev => {
                            const nextRules = [...prev.rules];
                            nextRules[idx] = { ...nextRules[idx], group4Plus: val };
                            return { ...prev, rules: nextRules };
                          });
                        }}
                        className="w-full bg-[#121420] border border-[#292d4a] rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#181b30] border-t border-[#292d4a] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  festStore.updatePerformancePointConfig(perfPointConfigState);
                  setPerfEditSuccessMsg('Performance Point Scale updated successfully! All team scores re-calculated.');
                  setTimeout(() => {
                    setShowEditPerfModal(false);
                    onRefresh();
                  }, 1200);
                }}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Scale Changes</span>
              </button>
              <button
                type="button"
                onClick={() => setShowEditPerfModal(false)}
                className="px-4 py-2.5 bg-[#202440] hover:bg-[#282d52] text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE LIMITS MODAL */}
      <ManageLimitsModal
        isOpen={showManageLimitsModal}
        onClose={() => {
          setShowManageLimitsModal(false);
          onRefresh();
        }}
      />

      {/* BULK QR CODE EXPORT MODAL */}
      <BulkQrExportModal
        isOpen={showBulkQrModal}
        onClose={() => setShowBulkQrModal(false)}
        branding={festStore.getBrandingConfig()}
      />

      {/* PRINT VALUATION SHEET MODAL */}
      <PrintValuationSheetModal
        isOpen={showPrintValuationModal}
        onClose={() => setShowPrintValuationModal(false)}
        competitions={competitions}
        registrations={registrations}
        groups={groups}
        initialCompId={valuationCompId || 'All'}
      />

    </div>
  );
};
