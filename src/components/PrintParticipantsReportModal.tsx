import React, { useState, useMemo, useRef } from 'react';
import { Competition, Registration, Group } from '../types';
import { festStore, formatCompetitionName, formatStageName } from '../lib/store';
import { EnigmaPrintHeader, EnigmaPrintFooter } from './EnigmaPrintTemplate';
import logoImg from '../assets/images/logo-01.png';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import {
  Download,
  Printer,
  X,
  ClipboardList,
  Award,
  Loader2,
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Trophy,
  ChevronDown,
  Check,
  Layers,
  Filter,
  CheckSquare,
  Square,
  ListChecks,
} from 'lucide-react';

interface PrintParticipantsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitions: Competition[];
  registrations: Registration[];
  groups?: Group[];
  initialCompId?: string;
  initialCategory?: string;
}

export const PrintParticipantsReportModal: React.FC<PrintParticipantsReportModalProps> = ({
  isOpen,
  onClose,
  competitions = [],
  registrations = [],
  groups = [],
  initialCompId = '',
  initialCategory = 'All',
}) => {
  const safeRegistrations = useMemo(() => Array.isArray(registrations) ? registrations : [], [registrations]);
  const safeCompetitions = useMemo(() => Array.isArray(competitions) ? competitions : [], [competitions]);
  const safeGroups = useMemo(() => Array.isArray(groups) ? groups : [], [groups]);

  // Helper to test if a competition is genuinely scheduled
  const isScheduledCompetition = (comp: Competition): boolean => {
    return Boolean(comp.scheduleTime && comp.scheduleTime.trim());
  };

  // Only scheduled competitions
  const scheduledCompetitions = useMemo(() => {
    return safeCompetitions.filter(isScheduledCompetition);
  }, [safeCompetitions]);

  // Available competitions for report sheet printing - strictly only scheduled competitions
  const availableCompetitions = useMemo(() => {
    if (scheduledCompetitions.length > 0) {
      if (initialCompId && initialCompId !== 'All') {
        const specific = safeCompetitions.find((c) => c.id === initialCompId);
        if (specific && !scheduledCompetitions.some((c) => c.id === initialCompId)) {
          return [specific, ...scheduledCompetitions];
        }
      }
      return scheduledCompetitions;
    }
    return safeCompetitions;
  }, [scheduledCompetitions, safeCompetitions, initialCompId]);

  // Available categories among the scheduled competitions
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    availableCompetitions.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats);
  }, [availableCompetitions]);

  // Whether "All Competitions" mode is active (default is true unless specific single competition provided)
  const [isAllCompetitions, setIsAllCompetitions] = useState<boolean>(() => {
    return !initialCompId || initialCompId === 'All';
  });

  // Selected competition IDs for multi-selection
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>(() => {
    if (initialCompId && initialCompId !== 'All') {
      return [initialCompId];
    }
    return availableCompetitions.map(c => c.id);
  });

  const [showSignatures, setShowSignatures] = useState<boolean>(true);

  // Search state for the report
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  // Attendance status filter state: 'All' | 'Reported' | 'Absent'
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<'All' | 'Reported' | 'Absent'>('All');

  // Dropdown popover state for competition multi-selector
  const [compDropdownOpen, setCompDropdownOpen] = useState(false);
  const [compSearchTerm, setCompSearchTerm] = useState('');
  const [compFilterTab, setCompFilterTab] = useState('All');
  const compDropdownRef = useRef<HTMLDivElement>(null);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const brandingConfig = festStore.getBrandingConfig();

  // If initialCompId changed from props when opened
  React.useEffect(() => {
    if (initialCompId && initialCompId !== 'All') {
      setIsAllCompetitions(false);
      setSelectedCompIds([initialCompId]);
    } else if (initialCompId === 'All' || !initialCompId) {
      setIsAllCompetitions(true);
      setSelectedCompIds(availableCompetitions.map(c => c.id));
    }
  }, [initialCompId, availableCompetitions]);

  // Multi-select helpers
  const toggleCompetitionSelection = (compId: string) => {
    if (isAllCompetitions) {
      // Switching from ALL to custom selection with this item unchecked
      const updated = availableCompetitions.map(c => c.id).filter(id => id !== compId);
      setSelectedCompIds(updated);
      setIsAllCompetitions(false);
    } else {
      let updated: string[];
      if (selectedCompIds.includes(compId)) {
        updated = selectedCompIds.filter(id => id !== compId);
      } else {
        updated = [...selectedCompIds, compId];
      }
      setSelectedCompIds(updated);
      if (updated.length === availableCompetitions.length) {
        setIsAllCompetitions(true);
      }
    }
  };

  const selectOnlyCompetition = (compId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsAllCompetitions(false);
    setSelectedCompIds([compId]);
  };

  const handleSelectAllCompetitions = () => {
    setIsAllCompetitions(true);
    setSelectedCompIds(availableCompetitions.map(c => c.id));
    setReportSearchQuery('');
  };

  const handleDeselectAllCompetitions = () => {
    setIsAllCompetitions(false);
    setSelectedCompIds([]);
  };

  const handleSelectCategoryCompetitions = (cat: string) => {
    if (cat === 'All') {
      handleSelectAllCompetitions();
      return;
    }
    const catCompIds = availableCompetitions.filter(c => c.category === cat).map(c => c.id);
    setIsAllCompetitions(false);
    setSelectedCompIds(catCompIds);
  };

  // Handle click outside to close competition dropdown
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (compDropdownRef.current && !compDropdownRef.current.contains(e.target as Node)) {
        setCompDropdownOpen(false);
      }
    };
    if (compDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [compDropdownOpen]);

  // Filtered competitions for the dropdown search
  const filteredDropdownComps = useMemo(() => {
    let comps = availableCompetitions;
    if (compFilterTab !== 'All') {
      comps = comps.filter(c => c.category === compFilterTab);
    }
    const q = compSearchTerm.trim().toLowerCase();
    if (q) {
      comps = comps.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.venue && c.venue.toLowerCase().includes(q)) ||
        (c.scheduleTime && c.scheduleTime.toLowerCase().includes(q)) ||
        ((c as any).code && String((c as any).code).toLowerCase().includes(q))
      );
    }
    return comps;
  }, [availableCompetitions, compFilterTab, compSearchTerm]);

  // Selected competitions to render in the print sheet
  const targetCompetitions = useMemo(() => {
    let comps: Competition[] = [];

    // 1. Multiple or All competition filtering
    if (isAllCompetitions) {
      comps = [...availableCompetitions];
    } else {
      const selectedSet = new Set(selectedCompIds);
      comps = availableCompetitions.filter(c => selectedSet.has(c.id));
    }

    // 2. Filter by candidate status if requested ('Reported' or 'Absent')
    if (candidateStatusFilter !== 'All') {
      comps = comps.filter(comp => {
        const compRegs = safeRegistrations.filter(r => r.competitionId === comp.id);
        if (candidateStatusFilter === 'Reported') {
          return compRegs.some(r => r.isReported === true);
        } else {
          return compRegs.some(r => r.isReported !== true);
        }
      });
    }

    // 3. Global report search query across competitions & candidates
    const term = reportSearchQuery.trim().toLowerCase();
    if (term) {
      comps = comps.filter(comp => {
        // Match competition metadata
        const matchesComp =
          comp.name.toLowerCase().includes(term) ||
          (comp.category && comp.category.toLowerCase().includes(term)) ||
          (comp.venue && comp.venue.toLowerCase().includes(term)) ||
          (comp.scheduleTime && comp.scheduleTime.toLowerCase().includes(term)) ||
          ((comp as any).code && String((comp as any).code).toLowerCase().includes(term));

        if (matchesComp) return true;

        // Or match any registered participant in this competition (respecting status filter)
        let compRegs = safeRegistrations.filter(r => r.competitionId === comp.id);
        if (candidateStatusFilter === 'Reported') {
          compRegs = compRegs.filter(r => r.isReported === true);
        } else if (candidateStatusFilter === 'Absent') {
          compRegs = compRegs.filter(r => r.isReported !== true);
        }

        const matchesReg = compRegs.some(r => {
          const fullName = festStore.getParticipantFullName(r.participantName, r.id).toLowerCase();
          const rawName = (r.participantName || '').toLowerCase();
          const chestNo = (r.participantUserId || '').toLowerCase();
          const code = (r.codeLetter || '').toLowerCase();
          const grp = (r.groupName || '').toLowerCase();
          const dept = ((r as any).department || '').toLowerCase();
          return (
            fullName.includes(term) ||
            rawName.includes(term) ||
            chestNo.includes(term) ||
            code.includes(term) ||
            grp.includes(term) ||
            dept.includes(term)
          );
        });

        return matchesReg;
      });
    }

    return comps;
  }, [availableCompetitions, isAllCompetitions, selectedCompIds, candidateStatusFilter, reportSearchQuery, safeRegistrations]);

  // Calculate overall metrics
  const sheetStats = useMemo(() => {
    const compIds = new Set(targetCompetitions.map(c => c.id));
    let totalEntries = 0;
    let reportedCount = 0;
    let absentCount = 0;

    for (const reg of safeRegistrations) {
      if (compIds.has(reg.competitionId)) {
        if (reg.isReported === true) {
          reportedCount++;
        } else {
          absentCount++;
        }
        if (candidateStatusFilter === 'All') {
          totalEntries++;
        } else if (candidateStatusFilter === 'Reported' && reg.isReported === true) {
          totalEntries++;
        } else if (candidateStatusFilter === 'Absent' && reg.isReported !== true) {
          totalEntries++;
        }
      }
    }

    return {
      totalCompetitions: targetCompetitions.length,
      totalEntries,
      reportedCount,
      absentCount,
    };
  }, [targetCompetitions, safeRegistrations, candidateStatusFilter]);

  // Direct PDF Download with jsPDF and html-to-image (renders each competition page cleanly with exact A4 aspect ratio)
  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const container = printAreaRef.current;
      const pageElements = Array.from(container.querySelectorAll<HTMLElement>('.competition-a4-page'));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      if (pageElements.length === 0) {
        // Fallback if no specific pages found
        const imgData = await toPng(container, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          skipFonts: true,
          cacheBust: false,
        });

        const img = new Image();
        img.src = imgData;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const imgWidth = pdfWidth;
        const imgHeight = (img.naturalHeight * imgWidth) / img.naturalWidth;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
          heightLeft -= pdfHeight;
        }
      } else {
        // Render each separate competition A4 page element directly preserving aspect ratio
        for (let i = 0; i < pageElements.length; i++) {
          const pageEl = pageElements[i] as HTMLElement;
          const imgData = await toPng(pageEl, {
            quality: 0.98,
            pixelRatio: 2.5,
            backgroundColor: '#ffffff',
            skipFonts: true,
            cacheBust: false,
          });

          const img = new Image();
          img.src = imgData;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          if (i > 0) {
            pdf.addPage('a4', 'portrait');
          }

          // Check if content exceeds standard single A4 page height
          const pageHeightRatio = (img.naturalHeight * pdfWidth) / (img.naturalWidth * pdfHeight);

          if (pageHeightRatio > 1.08) {
            // Multi-page content: render smoothly across consecutive A4 pages
            const imgWidth = pdfWidth;
            const imgHeight = (img.naturalHeight * imgWidth) / img.naturalWidth;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
              position = heightLeft - imgHeight;
              pdf.addPage('a4', 'portrait');
              pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
              heightLeft -= pdfHeight;
            }
          } else {
            // Standard A4 portrait single page: clean 1:1 fit without letterboxing
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
          }
        }
      }

      const compSlug = isAllCompetitions || selectedCompIds.length === availableCompetitions.length
        ? 'All_Scheduled_Competitions'
        : selectedCompIds.length === 1
        ? (availableCompetitions.find(c => c.id === selectedCompIds[0])?.name || 'Event').replace(/[^a-zA-Z0-9-]/g, '_')
        : `${selectedCompIds.length}_Competitions`;

      pdf.save(`Participants_Report_${compSlug}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 22mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #participants-report-print-container {
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .competition-a4-page {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: 253mm !important;
            max-height: 253mm !important;
            min-height: 253mm !important;
            page-break-after: always !important;
            break-after: page !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
      <div className="bg-[#0f111c] border border-[#292d4a] rounded-3xl w-full max-w-7xl shadow-2xl flex flex-col h-full max-h-[96vh] overflow-hidden">
        
        {/* TOP MODAL TOOLBAR */}
        <div className="p-4 sm:p-5 bg-[#121424] border-b border-[#292d4a] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-600/30 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Print Participants Report Sheet
              </h2>
              <p className="text-xs text-slate-400">
                Official stage call sheet, attendance record, blind code letters & judging scoring list
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Quick Direct Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="p-2.5 rounded-2xl bg-[#181b30] hover:bg-purple-600/20 text-slate-300 hover:text-purple-300 border border-[#292d4a] hover:border-purple-500/40 transition-all cursor-pointer"
              title="Direct Print"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Primary Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#292d4a] hover:border-rose-500/40 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* FILTER & OPTION CONTROLS BAR */}
        <div className="p-3.5 sm:p-4 bg-[#151728] border-b border-[#292d4a] flex flex-col gap-3 shrink-0 text-xs">
          {/* TOP ROW: Global Search Bar + Category Filter Pills */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Global Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                placeholder="Search across all competitions, participants, chest numbers, venues..."
                className="w-full pl-10 pr-9 py-2 bg-[#1e223d] border border-[#292d4a] focus:border-purple-500 rounded-xl text-xs text-white placeholder-slate-400 font-medium focus:outline-none transition-all shadow-inner"
              />
              {reportSearchQuery && (
                <button
                  type="button"
                  onClick={() => setReportSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => handleSelectCategoryCompetitions('All')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  isAllCompetitions
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-[#1e223d] text-slate-400 hover:text-white border border-[#292d4a]'
                }`}
              >
                All Categories ({availableCompetitions.length})
              </button>
              {availableCategories.map((cat) => {
                const count = availableCompetitions.filter((c) => c.category === cat).length;
                const isSelectedCat =
                  !isAllCompetitions &&
                  selectedCompIds.length === count &&
                  availableCompetitions
                    .filter((c) => c.category === cat)
                    .every((c) => selectedCompIds.includes(c.id));

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectCategoryCompetitions(cat)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      isSelectedCat
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                        : 'bg-[#1e223d] text-slate-400 hover:text-white border border-[#292d4a]'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* BOTTOM ROW: Select Multiple Competitions (Dropdown) + Options */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Searchable Multi-Select Competition Dropdown */}
            <div className="relative flex-1 max-w-xl" ref={compDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Select Competitions
                </label>
                <span className="text-[10px] text-purple-400 font-bold">
                  {isAllCompetitions
                    ? `All ${availableCompetitions.length} Scheduled`
                    : `${selectedCompIds.length} of ${availableCompetitions.length} Scheduled`}
                </span>
              </div>
              
              <button
                type="button"
                onClick={() => setCompDropdownOpen(!compDropdownOpen)}
                className={`w-full flex items-center justify-between gap-2 bg-[#1e223d] border rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                  compDropdownOpen
                    ? 'border-purple-500 text-white ring-2 ring-purple-500/20'
                    : isAllCompetitions || selectedCompIds.length === availableCompetitions.length
                    ? 'border-purple-500/60 text-purple-200'
                    : selectedCompIds.length > 0
                    ? 'border-indigo-500/70 text-indigo-100'
                    : 'border-rose-500/50 text-rose-300 hover:border-rose-400'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {isAllCompetitions || selectedCompIds.length === availableCompetitions.length
                      ? `All Scheduled Competitions (${availableCompetitions.length})`
                      : selectedCompIds.length === 1
                      ? availableCompetitions.find((c) => c.id === selectedCompIds[0])?.name || '1 Competition Selected'
                      : selectedCompIds.length > 1
                      ? `${selectedCompIds.length} Competitions Selected`
                      : 'None Selected (Click to Select)'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono font-bold">
                    {isAllCompetitions ? availableCompetitions.length : selectedCompIds.length}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      compDropdownOpen ? 'rotate-180 text-purple-400' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Dropdown Popover with Multi-select capabilities */}
              {compDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 max-w-[94vw] bg-[#121424] border border-[#292d4a] rounded-2xl shadow-2xl z-50 p-3 space-y-2.5">
                  {/* Search inside dropdown */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={compSearchTerm}
                      onChange={(e) => setCompSearchTerm(e.target.value)}
                      placeholder="Filter scheduled competitions by name, stage, time..."
                      className="w-full pl-8 pr-3 py-1.5 bg-[#1a1d33] border border-[#292d4a] focus:border-purple-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
                      autoFocus
                    />
                  </div>

                  {/* Multi-Select Action Controls: Select All vs Clear */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllCompetitions}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Select All ({availableCompetitions.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeselectAllCompetitions}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Deselect All</span>
                    </button>
                  </div>

                  {/* Category Filter Tabs inside dropdown */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] scrollbar-thin">
                    <button
                      type="button"
                      onClick={() => setCompFilterTab('All')}
                      className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        compFilterTab === 'All'
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#1e223d] text-slate-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    {availableCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCompFilterTab(cat)}
                        className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          compFilterTab === cat
                            ? 'bg-purple-600 text-white'
                            : 'bg-[#1e223d] text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* If a category tab is selected, show quick "Select category" action */}
                  {compFilterTab !== 'All' && (
                    <div className="flex items-center justify-between px-2.5 py-1 bg-purple-950/40 border border-purple-800/40 rounded-lg text-[10px] text-purple-300">
                      <span>Showing {compFilterTab} events</span>
                      <button
                        type="button"
                        onClick={() => handleSelectCategoryCompetitions(compFilterTab)}
                        className="font-bold underline hover:text-white cursor-pointer"
                      >
                        Select All {compFilterTab}
                      </button>
                    </div>
                  )}

                  <div className="border-t border-[#292d4a]/70 my-1" />

                  {/* List of competitions with individual checkboxes & 'Only' button */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {filteredDropdownComps.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-500">
                        No scheduled competitions match "{compSearchTerm}"
                      </div>
                    ) : (
                      filteredDropdownComps.map((comp) => {
                        const isChecked = isAllCompetitions || selectedCompIds.includes(comp.id);
                        const regCount = safeRegistrations.filter((r) => r.competitionId === comp.id).length;

                        return (
                          <div
                            key={comp.id}
                            onClick={() => toggleCompetitionSelection(comp.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-all cursor-pointer group select-none ${
                              isChecked
                                ? 'bg-purple-600/20 border border-purple-500/40 text-white font-medium'
                                : 'hover:bg-white/5 border border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              {/* Custom Checkbox */}
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                                  isChecked
                                    ? 'bg-purple-600 border-purple-500 text-white'
                                    : 'border-slate-600 group-hover:border-slate-400 bg-[#1e223d]'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 text-white stroke-[3]" />}
                              </div>

                              <div className="truncate">
                                <div className={`truncate font-bold text-xs ${isChecked ? 'text-white' : 'text-slate-300'}`}>
                                  {comp.name}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                  <span className="font-semibold text-purple-400">{comp.category}</span>
                                  {comp.venue && <span>• {formatStageName(comp.venue)}</span>}
                                  {comp.scheduleTime && (
                                    <span className="text-sky-400 font-mono text-[9px] bg-sky-950/50 px-1 rounded border border-sky-800/40">
                                      {comp.scheduleTime}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-[#1e223d] text-slate-400 border border-[#292d4a]">
                                {regCount}
                              </span>
                              {/* "Only" button to quickly select single competition exclusively */}
                              <button
                                type="button"
                                onClick={(e) => selectOnlyCompetition(comp.id, e)}
                                className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-white/10 hover:bg-purple-600 text-[10px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                                title="Select only this competition"
                              >
                                Only
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer inside dropdown */}
                  <div className="border-t border-[#292d4a]/70 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {isAllCompetitions
                        ? `All ${availableCompetitions.length} selected`
                        : `${selectedCompIds.length} of ${availableCompetitions.length} selected`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCompDropdownOpen(false)}
                      className="px-3.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Candidate Attendance Status Filter & Options */}
            <div className="flex flex-wrap items-center gap-3 py-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
                  Attendance:
                </span>
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter('All')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    candidateStatusFilter === 'All'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-[#1e223d] text-slate-400 hover:text-white border border-[#292d4a]'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter('Reported')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    candidateStatusFilter === 'Reported'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-[#1e223d] text-slate-400 hover:text-emerald-300 border border-[#292d4a]'
                  }`}
                >
                  Reported Only
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter('Absent')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    candidateStatusFilter === 'Absent'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'bg-[#1e223d] text-slate-400 hover:text-rose-300 border border-[#292d4a]'
                  }`}
                >
                  Absent Only
                </button>
              </div>

              <div className="h-4 w-px bg-[#292d4a] hidden sm:block" />

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white font-bold text-xs">
                <input
                  type="checkbox"
                  checked={showSignatures}
                  onChange={(e) => setShowSignatures(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span>Signature Box</span>
              </label>
            </div>
          </div>

          {/* Active Search & Filter Indicator Bar */}
          {(reportSearchQuery || candidateStatusFilter !== 'All' || !isAllCompetitions) && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 px-1 pt-1.5 border-t border-[#292d4a]/60">
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  Showing <strong className="text-white font-mono">{targetCompetitions.length}</strong> events (
                  <strong className="text-white font-mono">{sheetStats.totalEntries}</strong> participants)
                </span>
                {reportSearchQuery && (
                  <span className="inline-flex items-center gap-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded-md font-medium">
                    Search: &ldquo;{reportSearchQuery}&rdquo;
                  </span>
                )}
                {candidateStatusFilter !== 'All' && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    candidateStatusFilter === 'Reported'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                  }`}>
                    {candidateStatusFilter} Only
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setReportSearchQuery('');
                  setCandidateStatusFilter('All');
                  handleSelectAllCompetitions();
                }}
                className="text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer shrink-0"
              >
                Reset All Filters
              </button>
            </div>
          )}

          {/* Selected Competitions Chips / Badge Tray (when a customized subset is selected) */}
          {!isAllCompetitions && selectedCompIds.length > 0 && selectedCompIds.length < availableCompetitions.length && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#292d4a]/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mr-1 flex items-center gap-1">
                <CheckSquare className="w-3 h-3" /> Selected ({selectedCompIds.length}):
              </span>
              {selectedCompIds.map((cid) => {
                const comp = availableCompetitions.find((c) => c.id === cid);
                if (!comp) return null;
                return (
                  <span
                    key={cid}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[11px] font-semibold"
                  >
                    <span className="truncate max-w-[150px]">{comp.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleCompetitionSelection(cid)}
                      className="text-purple-400 hover:text-white hover:bg-purple-600/40 rounded-full p-0.5 cursor-pointer"
                      title="Remove"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                onClick={handleSelectAllCompetitions}
                className="text-[10px] font-bold text-slate-400 hover:text-white underline ml-1 cursor-pointer"
              >
                Show All Scheduled
              </button>
            </div>
          )}
        </div>

        {/* PRINTABLE PREVIEW SHEET CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0b0c16] flex justify-center custom-scrollbar print:bg-white print:p-0 print:overflow-visible">
          <div
            ref={printAreaRef}
            id="participants-report-print-container"
            className="w-full flex flex-col items-center gap-8 print:gap-0 print:m-0 print:p-0"
          >
            {targetCompetitions.length === 0 ? (
              <div className="bg-white text-slate-900 shadow-xl rounded-2xl p-12 text-center border border-slate-300 space-y-3">
                <ClipboardList className="w-10 h-10 mx-auto text-slate-400" />
                <p className="font-bold text-sm text-slate-700">
                  {availableCompetitions.length === 0
                    ? 'No scheduled competitions found. Please schedule competitions in the Competition Schedule section first.'
                    : 'No competitions currently selected or matching filter.'}
                </p>
                {availableCompetitions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllCompetitions}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Select All Scheduled Competitions</span>
                  </button>
                )}
              </div>
            ) : (
              targetCompetitions.map((comp, pageIndex) => {
                let compRegs = safeRegistrations.filter((r) => r.competitionId === comp.id);

                // Filter by candidate status if active
                if (candidateStatusFilter === 'Reported') {
                  compRegs = compRegs.filter((r) => r.isReported === true);
                } else if (candidateStatusFilter === 'Absent') {
                  compRegs = compRegs.filter((r) => r.isReported !== true);
                }

                // Filter candidates by search term if search query is active
                const term = reportSearchQuery.trim().toLowerCase();
                if (term) {
                  const isCompMatch =
                    comp.name.toLowerCase().includes(term) ||
                    (comp.category && comp.category.toLowerCase().includes(term)) ||
                    (comp.venue && comp.venue.toLowerCase().includes(term)) ||
                    (comp.scheduleTime && comp.scheduleTime.toLowerCase().includes(term)) ||
                    ((comp as any).code && String((comp as any).code).toLowerCase().includes(term));

                  if (!isCompMatch) {
                    compRegs = compRegs.filter((r) => {
                      const fullName = festStore.getParticipantFullName(r.participantName, r.id).toLowerCase();
                      const rawName = (r.participantName || '').toLowerCase();
                      const chestNo = (r.participantUserId || '').toLowerCase();
                      const code = (r.codeLetter || '').toLowerCase();
                      const grp = (r.groupName || '').toLowerCase();
                      const dept = ((r as any).department || '').toLowerCase();
                      return (
                        fullName.includes(term) ||
                        rawName.includes(term) ||
                        chestNo.includes(term) ||
                        code.includes(term) ||
                        grp.includes(term) ||
                        dept.includes(term)
                      );
                    });
                  }
                }

                // Sort: Reported candidates first sorted by Code letter, then Unreported
                compRegs.sort((a, b) => {
                  const aReported = a.isReported === true ? 1 : 0;
                  const bReported = b.isReported === true ? 1 : 0;
                  if (aReported !== bReported) return bReported - aReported;
                  if (a.isReported && b.isReported && a.codeLetter && b.codeLetter) {
                    return a.codeLetter.localeCompare(b.codeLetter);
                  }
                  return 0;
                });

                const reportedInComp = compRegs.filter((r) => r.isReported === true).length;
                const absentInComp = compRegs.length - reportedInComp;

                return (
                  <div
                    key={comp.id}
                    className="competition-a4-page bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300 print:border-none print:shadow-none print:rounded-none print:m-0 flex flex-col justify-between break-after-page page-break-after"
                    style={{
                      width: '210mm',
                      maxWidth: '100%',
                      minHeight: '297mm',
                      padding: '22mm',
                      boxSizing: 'border-box',
                      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                    }}
                  >
                    {/* Top Section: Header, Title, Metadata & Candidate Table */}
                    <div className="flex flex-col w-full">
                      {/* 1. Standard Enigma Print Header */}
                      <EnigmaPrintHeader
                        title="ENIGMA ‘26"
                        compact={true}
                        className="!mb-2.5"
                        rightElement={
                          <span className="text-[10px] font-mono font-bold text-slate-700 uppercase">
                            {new Date().toLocaleDateString('en-GB')}
                          </span>
                        }
                      />

                      {/* 2. Competition Header: Title, Category badge, Venue and Scheduled Time */}
                      <div className="border-b border-black pb-2 mb-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                          <span className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-950 font-sans">
                            {formatCompetitionName(comp.name)}
                          </span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 uppercase whitespace-nowrap shrink-0">
                            {comp.category}
                          </span>
                          {candidateStatusFilter !== 'All' && (
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border uppercase whitespace-nowrap shrink-0 ${
                              candidateStatusFilter === 'Reported'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-rose-100 text-rose-900 border-rose-300'
                            }`}>
                              {candidateStatusFilter} Only
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-900 shrink-0">
                          {comp.venue && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 font-extrabold uppercase whitespace-nowrap shrink-0">
                              {formatStageName(comp.venue)}
                            </span>
                          )}
                          {comp.scheduleTime && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-300 font-mono font-bold whitespace-nowrap shrink-0">
                              {comp.scheduleTime}
                            </span>
                          )}
                          <span className="text-[9px] text-slate-600 font-mono font-bold whitespace-nowrap shrink-0">
                            PAGE {pageIndex + 1} OF {targetCompetitions.length}
                          </span>
                        </div>
                      </div>

                      {/* 3. Candidate Table */}
                      <div className="border border-black rounded overflow-hidden shadow-xs mb-3">
                        <table className="w-full text-left border-collapse text-[10px] border border-black">
                          <thead>
                            <tr className="bg-slate-900 text-white font-bold uppercase text-[9px] tracking-wider border-b border-black">
                              <th className="py-1 px-1.5 border-r border-b border-black text-center w-8">Sl</th>
                              <th className="py-1 px-2 border-r border-b border-black text-center w-20">Chest No</th>
                              <th className="py-1 px-2.5 border-r border-b border-black">Participant Name</th>
                              <th className="py-1 px-2 border-r border-b border-black w-32">Group</th>
                              <th className="py-1 px-2 border-r border-b border-black text-center w-16">Code</th>
                              <th className="py-1 px-2 border-b border-black text-center w-28">Signature</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black">
                            {compRegs.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-4 text-center text-slate-500 font-semibold italic border-b border-black text-[10px]">
                                  No registered candidates found for this competition.
                                </td>
                              </tr>
                            ) : (
                              compRegs.map((reg, idx) => {
                                return (
                                  <tr key={reg.id} className="hover:bg-slate-50 border-b border-black">
                                    <td className="py-1 px-1.5 border-r border-b border-black text-center font-mono font-bold text-slate-900 text-[10px]">
                                      {idx + 1}
                                    </td>
                                    <td className="py-1 px-2 border-r border-b border-black text-center font-mono font-black text-slate-900 text-[10px]">
                                      {reg.participantUserId || '—'}
                                    </td>
                                    <td className="py-1 px-2.5 border-r border-b border-black font-bold text-slate-900 text-[10.5px]">
                                      {festStore.getParticipantFullName(reg.participantName, reg.id)}
                                    </td>
                                    <td className="py-1 px-2 border-r border-b border-black font-semibold text-slate-800 text-[10px]">
                                      {reg.groupName}
                                    </td>
                                    <td className="py-1 px-2 border-r border-b border-black text-center font-mono font-bold text-[11px] text-slate-900">
                                      {reg.codeLetter || ''}
                                    </td>
                                    <td className="py-1 px-2 border-b border-black text-center align-middle h-6">
                                      {/* Blank space for physical candidate signature */}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Bottom Section: Official Signatures & Standard Footer */}
                    <div className="space-y-2.5 pt-2 mt-auto">
                      {showSignatures && (
                        <div className="pt-2 border-t border-black flex items-end justify-between gap-4 page-break-inside-avoid">
                          <div className="text-center w-28 sm:w-32">
                            <div className="h-7 border-b border-dashed border-black mb-1" />
                            <span className="text-[9px] font-black uppercase text-slate-900 tracking-tight">Stage Manager</span>
                          </div>
                          <div className="text-center w-28 sm:w-32">
                            <div className="h-7 border-b border-dashed border-black mb-1" />
                            <span className="text-[9px] font-black uppercase text-slate-900 tracking-tight">Tabulation Officer</span>
                          </div>
                          <div className="text-center w-28 sm:w-32">
                            <div className="h-7 border-b border-dashed border-black mb-1" />
                            <span className="text-[9px] font-black uppercase text-slate-900 tracking-tight">Chief Judge / Convener</span>
                          </div>
                        </div>
                      )}

                      {/* Standard Enigma Print Footer with dynamic Page Numbering */}
                      <EnigmaPrintFooter pageNumber={pageIndex + 1} compact={true} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
export default PrintParticipantsReportModal;
