import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Competition, Registration, Group, Result, WinnerDetail } from '../types';
import { festStore, formatCompetitionName, formatStageName } from '../lib/store';
import { EnigmaPrintHeader, EnigmaPrintFooter } from './EnigmaPrintTemplate';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import {
  Download,
  Printer,
  X,
  Trophy,
  Award,
  Loader2,
  Search,
  ChevronDown,
  Check,
  Layers,
  CheckSquare,
  Sparkles,
  CheckCircle2,
  CheckCircle,
  Clock,
  Medal,
} from 'lucide-react';

interface PrintResultsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitions: Competition[];
  registrations: Registration[];
  results: Result[];
  groups?: Group[];
  initialCompId?: string;
  initialCategory?: string;
  initialStatus?: 'All' | 'Published' | 'Pending';
}

export const PrintResultsReportModal: React.FC<PrintResultsReportModalProps> = ({
  isOpen,
  onClose,
  competitions = [],
  registrations = [],
  results = [],
  groups = [],
  initialCompId = '',
  initialCategory = 'All',
  initialStatus = 'All',
}) => {
  const safeRegistrations = useMemo(() => (Array.isArray(registrations) ? registrations : []), [registrations]);
  const safeCompetitions = useMemo(() => (Array.isArray(competitions) ? competitions : []), [competitions]);
  const safeResults = useMemo(() => (Array.isArray(results) ? results : []), [results]);
  const safeGroups = useMemo(() => (Array.isArray(groups) ? groups : []), [groups]);

  // Determine if competition has evaluated / saved judge marks or completed status
  const isScoredByJudge = (comp: Competition): boolean => {
    const compRegs = safeRegistrations.filter((r) => r.competitionId === comp.id);
    const hasRegMarks = compRegs.some(
      (r) =>
        (r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '') ||
        (r.judgeRank !== undefined && r.judgeRank !== null)
    );
    const hasReportedRegs = compRegs.some((r) => r.isReported === true);

    return (
      hasRegMarks ||
      comp.status === 'completed' ||
      comp.isPublishedResult === true ||
      safeResults.some((res) => res.competitionId === comp.id) ||
      (hasReportedRegs && compRegs.length > 0)
    );
  };

  // Filter state: show All, Published only, or Pending Publish only
  const [statusFilter, setStatusFilter] = useState<'All' | 'Published' | 'Pending'>(initialStatus || 'All');

  // Keep in sync with initialStatus prop if it changes
  useEffect(() => {
    if (initialStatus) {
      setStatusFilter(initialStatus);
    }
  }, [initialStatus]);

  // Available competitions for result sheet printing
  const availableCompetitions = useMemo(() => {
    return safeCompetitions.filter((comp) => {
      // If a specific competition was requested directly, always include it
      if (initialCompId && initialCompId !== 'All' && comp.id === initialCompId) {
        return true;
      }

      const hasResult = safeResults.some((res) => res.competitionId === comp.id);
      const isPublished = comp.isPublishedResult || hasResult;
      const isEvaluated = isScoredByJudge(comp);

      if (!isPublished && !isEvaluated) return false;

      if (statusFilter === 'Published') {
        return isPublished;
      }
      if (statusFilter === 'Pending') {
        return !isPublished && isEvaluated;
      }
      return true;
    });
  }, [safeCompetitions, safeResults, safeRegistrations, statusFilter, initialCompId]);

  const evaluatedCount = useMemo(() => {
    return safeCompetitions.filter((comp) => {
      const hasResult = safeResults.some((res) => res.competitionId === comp.id);
      const isPublished = comp.isPublishedResult || hasResult;
      const isEvaluated = isScoredByJudge(comp);
      return isPublished || isEvaluated;
    }).length;
  }, [safeCompetitions, safeResults, safeRegistrations]);

  const publishedCount = useMemo(() => {
    return safeCompetitions.filter((comp) => {
      const hasResult = safeResults.some((res) => res.competitionId === comp.id);
      return comp.isPublishedResult || hasResult;
    }).length;
  }, [safeCompetitions, safeResults]);

  const pendingCount = useMemo(() => {
    return safeCompetitions.filter((comp) => {
      const hasResult = safeResults.some((res) => res.competitionId === comp.id);
      const isPublished = comp.isPublishedResult || hasResult;
      const isEvaluated = isScoredByJudge(comp);
      return !isPublished && isEvaluated;
    }).length;
  }, [safeCompetitions, safeResults, safeRegistrations]);

  // Performance Points calculator
  const calculatePerformancePoints = (
    score: number,
    type: 'Individual' | 'Group',
    teamSize: number = 4
  ): { grade: string; points: number } => {
    const s = Math.round(score);
    const config = festStore.getPerformancePointConfig();
    const rules = config?.rules || [];

    let matchedRule = rules.find((r) => s >= r.minScore && s <= r.maxScore);
    if (!matchedRule) {
      matchedRule = { grade: 'No Grade', minScore: 0, maxScore: 0, individual: 0, group2: 0, group3: 0, group4Plus: 0 };
    }

    const grade = matchedRule.grade;
    if (grade === 'No Grade' || (matchedRule.minScore === 0 && matchedRule.maxScore === 0)) {
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

  // Helper to extract effective competition result (whether published or pending evaluation)
  const getEffectiveCompetitionResult = (comp: Competition) => {
    const publishedResult = safeResults.find((r) => r.competitionId === comp.id);
    const p1 = comp.points1st || 10;
    const p2 = comp.points2nd || 7;
    const p3 = comp.points3rd || 5;

    if (publishedResult) {
      const winners = festStore.getResultWinners(publishedResult);
      const groupPointSummary: Record<string, { groupName: string; points: number }> = {};

      if (publishedResult.useDetailedPoints && publishedResult.participantPointsMap) {
        Object.entries(publishedResult.participantPointsMap).forEach(([regId, rawVal]) => {
          const val = rawVal as { totalPoints: number; grade?: string };
          const reg = safeRegistrations.find((r) => r.id === regId);
          const grp = reg ? safeGroups.find((g) => g.id === reg.groupId) : undefined;
          const gName = grp?.name || reg?.groupName || 'Team';
          if (!groupPointSummary[gName]) {
            groupPointSummary[gName] = { groupName: gName, points: 0 };
          }
          groupPointSummary[gName].points += val.totalPoints;
        });
      } else {
        winners.first.forEach((w) => {
          const gName = w.groupName || 'Team';
          if (!groupPointSummary[gName]) groupPointSummary[gName] = { groupName: gName, points: 0 };
          groupPointSummary[gName].points += p1;
        });
        winners.second.forEach((w) => {
          const gName = w.groupName || 'Team';
          if (!groupPointSummary[gName]) groupPointSummary[gName] = { groupName: gName, points: 0 };
          groupPointSummary[gName].points += p2;
        });
        winners.third.forEach((w) => {
          const gName = w.groupName || 'Team';
          if (!groupPointSummary[gName]) groupPointSummary[gName] = { groupName: gName, points: 0 };
          groupPointSummary[gName].points += p3;
        });
      }

      return {
        isPublished: true,
        publishedResult,
        winners,
        participantPointsMap: publishedResult.participantPointsMap,
        useDetailedPoints: publishedResult.useDetailedPoints,
        groupPointSummary,
      };
    }

    // Pending Result: derive winners from evaluated registrations
    const compRegs = safeRegistrations.filter((r) => r.competitionId === comp.id);
    const evaluatedRegs = compRegs.filter(
      (r) =>
        r.isReported === true ||
        (r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '') ||
        (r.judgeRank !== undefined && r.judgeRank !== null)
    );

    const rank1Regs = evaluatedRegs.filter((r) => r.judgeRank === 1);
    const rank2Regs = evaluatedRegs.filter((r) => r.judgeRank === 2);
    const rank3Regs = evaluatedRegs.filter((r) => r.judgeRank === 3);

    let p1List: string[] = [];
    let p2List: string[] = [];
    let p3List: string[] = [];

    // Prioritize explicit judge ranks if set
    if (rank1Regs.length > 0) {
      p1List = rank1Regs.map((r) => r.id);
    }
    if (rank2Regs.length > 0) {
      p2List = rank2Regs.map((r) => r.id);
    }
    if (rank3Regs.length > 0) {
      p3List = rank3Regs.map((r) => r.id);
    }

    // Fill missing podium positions by highest marks
    const assignedIds = new Set([...p1List, ...p2List, ...p3List]);
    const scoredRegs = evaluatedRegs
      .filter((r) => !assignedIds.has(r.id) && r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '')
      .map((r) => ({ ...r, numMark: Number(r.mark) || 0 }))
      .sort((a, b) => b.numMark - a.numMark);

    if (scoredRegs.length > 0) {
      const uniqueScores = Array.from(new Set<number>(scoredRegs.map((s) => s.numMark))).sort(
        (a, b) => b - a
      );
      let sIdx = 0;
      if (p1List.length === 0 && sIdx < uniqueScores.length) {
        const topScore = uniqueScores[sIdx++];
        p1List = scoredRegs.filter((s) => s.numMark === topScore).map((s) => s.id);
      }
      if (p2List.length === 0 && sIdx < uniqueScores.length) {
        const topScore = uniqueScores[sIdx++];
        p2List = scoredRegs.filter((s) => s.numMark === topScore).map((s) => s.id);
      }
      if (p3List.length === 0 && sIdx < uniqueScores.length) {
        const topScore = uniqueScores[sIdx++];
        p3List = scoredRegs.filter((s) => s.numMark === topScore).map((s) => s.id);
      }
    }

    const buildWinner = (regId: string): WinnerDetail | null => {
      const reg = compRegs.find((r) => r.id === regId);
      if (!reg) return null;
      const finalName = festStore.getParticipantFullName(reg.participantName, reg.id);
      return {
        regId: reg.id,
        participantName: finalName,
        groupId: reg.groupId || '',
        groupName: reg.groupName || '',
        codeLetter: reg.codeLetter,
        photoUrl: festStore.getParticipantPhotoUrl(finalName, reg.id),
        mark: reg.mark,
        score: reg.mark ? Number(reg.mark) : undefined,
      };
    };

    const winners = {
      first: p1List.map(buildWinner).filter(Boolean) as WinnerDetail[],
      second: p2List.map(buildWinner).filter(Boolean) as WinnerDetail[],
      third: p3List.map(buildWinner).filter(Boolean) as WinnerDetail[],
    };

    const participantPointsMap: Record<
      string,
      {
        competitionPoints: number;
        performancePoints: number;
        totalPoints: number;
        grade: string;
        score: number;
      }
    > = {};

    evaluatedRegs.forEach((reg) => {
      const score = Number(reg.mark) || 0;
      const { grade, points: performancePoints } = calculatePerformancePoints(
        score,
        comp.type || 'Individual',
        comp.teamSize || 4
      );

      let competitionPoints = 0;
      if (p1List.includes(reg.id)) {
        competitionPoints = p1;
      } else if (p2List.includes(reg.id)) {
        competitionPoints = p2;
      } else if (p3List.includes(reg.id)) {
        competitionPoints = p3;
      }

      participantPointsMap[reg.id] = {
        competitionPoints,
        performancePoints,
        totalPoints: competitionPoints + performancePoints,
        grade: grade !== 'No Grade' ? grade : '',
        score,
      };
    });

    const groupPointSummary: Record<string, { groupName: string; points: number }> = {};
    if (Object.keys(participantPointsMap).length > 0) {
      Object.entries(participantPointsMap).forEach(([regId, val]) => {
        const reg = safeRegistrations.find((r) => r.id === regId);
        const grp = reg ? safeGroups.find((g) => g.id === reg.groupId) : undefined;
        const gName = grp?.name || reg?.groupName || 'Team';
        if (!groupPointSummary[gName]) {
          groupPointSummary[gName] = { groupName: gName, points: 0 };
        }
        groupPointSummary[gName].points += val.totalPoints;
      });
    } else {
      winners.first.forEach((w) => {
        const gName = w.groupName || 'Team';
        if (!groupPointSummary[gName]) groupPointSummary[gName] = { groupName: gName, points: 0 };
        groupPointSummary[gName].points += p1;
      });
      winners.second.forEach((w) => {
        const gName = w.groupName || 'Team';
        if (!groupPointSummary[gName]) groupPointSummary[gName] = { groupName: gName, points: 0 };
        groupPointSummary[gName].points += p2;
      });
      winners.third.forEach((w) => {
        const gName = w.groupName || 'Team';
        if (!groupPointSummary[gName]) groupPointSummary[gName] = { groupName: gName, points: 0 };
        groupPointSummary[gName].points += p3;
      });
    }

    return {
      isPublished: false,
      publishedResult: undefined,
      winners,
      participantPointsMap,
      useDetailedPoints: true,
      groupPointSummary,
    };
  };

  // Available categories among available competitions
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    availableCompetitions.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats);
  }, [availableCompetitions]);

  // Whether "All Competitions" mode is active
  const [isAllCompetitions, setIsAllCompetitions] = useState<boolean>(() => {
    return !initialCompId || initialCompId === 'All';
  });

  // Selected competition IDs
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>(() => {
    if (initialCompId && initialCompId !== 'All') {
      return [initialCompId];
    }
    return availableCompetitions.map((c) => c.id);
  });

  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [showPointsBreakdown, setShowPointsBreakdown] = useState<boolean>(true);
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  // Dropdown UI state
  const [compDropdownOpen, setCompDropdownOpen] = useState(false);
  const [compSearchTerm, setCompSearchTerm] = useState('');
  const [compFilterTab, setCompFilterTab] = useState('All');
  const compDropdownRef = useRef<HTMLDivElement>(null);

  // PDF Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Synchronize when initialCompId changes
  useEffect(() => {
    if (initialCompId && initialCompId !== 'All') {
      setIsAllCompetitions(false);
      setSelectedCompIds([initialCompId]);
    } else if (initialCompId === 'All' || !initialCompId) {
      setIsAllCompetitions(true);
      setSelectedCompIds(availableCompetitions.map((c) => c.id));
    }
  }, [initialCompId, availableCompetitions]);

  const toggleCompetitionSelection = (compId: string) => {
    if (isAllCompetitions) {
      setIsAllCompetitions(false);
      setSelectedCompIds(availableCompetitions.filter((c) => c.id !== compId).map((c) => c.id));
      return;
    }

    if (selectedCompIds.includes(compId)) {
      const next = selectedCompIds.filter((id) => id !== compId);
      setSelectedCompIds(next);
      if (next.length === availableCompetitions.length) {
        setIsAllCompetitions(true);
      }
    } else {
      const next = [...selectedCompIds, compId];
      setSelectedCompIds(next);
      if (next.length === availableCompetitions.length) {
        setIsAllCompetitions(true);
      }
    }
  };

  const selectOnlyCompetition = (compId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAllCompetitions(false);
    setSelectedCompIds([compId]);
  };

  const handleSelectAllCompetitions = () => {
    setIsAllCompetitions(true);
    setSelectedCompIds(availableCompetitions.map((c) => c.id));
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
    const catCompIds = availableCompetitions.filter((c) => c.category === cat).map((c) => c.id);
    setIsAllCompetitions(false);
    setSelectedCompIds(catCompIds);
  };

  // Click outside to close dropdown
  useEffect(() => {
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

  // Filtered competitions for the dropdown
  const filteredDropdownComps = useMemo(() => {
    let comps = availableCompetitions;
    if (compFilterTab !== 'All') {
      comps = comps.filter((c) => c.category === compFilterTab);
    }
    const q = compSearchTerm.trim().toLowerCase();
    if (q) {
      comps = comps.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.category && c.category.toLowerCase().includes(q)) ||
          (c.venue && c.venue.toLowerCase().includes(q)) ||
          (c.scheduleTime && c.scheduleTime.toLowerCase().includes(q))
      );
    }
    return comps;
  }, [availableCompetitions, compFilterTab, compSearchTerm]);

  // Target competitions to render in print sheet
  const targetCompetitions = useMemo(() => {
    let comps: Competition[] = [];

    if (isAllCompetitions) {
      comps = [...availableCompetitions];
    } else {
      const selectedSet = new Set(selectedCompIds);
      comps = availableCompetitions.filter((c) => selectedSet.has(c.id));
    }

    const term = reportSearchQuery.trim().toLowerCase();
    if (term) {
      comps = comps.filter((comp) => {
        const matchesComp =
          comp.name.toLowerCase().includes(term) ||
          (comp.category && comp.category.toLowerCase().includes(term)) ||
          (comp.venue && comp.venue.toLowerCase().includes(term)) ||
          (comp.scheduleTime && comp.scheduleTime.toLowerCase().includes(term));

        if (matchesComp) return true;

        const eff = getEffectiveCompetitionResult(comp);
        const allWinners = [...eff.winners.first, ...eff.winners.second, ...eff.winners.third];
        const matchesWinner = allWinners.some(
          (w) =>
            (w.participantName && w.participantName.toLowerCase().includes(term)) ||
            (w.groupName && w.groupName.toLowerCase().includes(term)) ||
            (w.codeLetter && w.codeLetter.toLowerCase().includes(term))
        );
        return matchesWinner;
      });
    }

    return comps;
  }, [availableCompetitions, isAllCompetitions, selectedCompIds, reportSearchQuery, safeResults, safeRegistrations]);

  // Stats calculation
  const reportStats = useMemo(() => {
    let pubCount = 0;
    let pendCount = 0;
    let winnersCount = 0;

    targetCompetitions.forEach((c) => {
      const eff = getEffectiveCompetitionResult(c);
      if (eff.isPublished) {
        pubCount++;
      } else {
        pendCount++;
      }
      winnersCount += eff.winners.first.length + eff.winners.second.length + eff.winners.third.length;
    });

    return {
      totalCompetitions: targetCompetitions.length,
      publishedCount: pubCount,
      pendingCount: pendCount,
      winnersCount,
    };
  }, [targetCompetitions, safeResults, safeRegistrations]);

  // Direct PDF Download with jsPDF and html-to-image
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
          pdf.addPage('a4', 'portrait');
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
          heightLeft -= pdfHeight;
        }
      } else {
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

          const pageHeightRatio = (img.naturalHeight * pdfWidth) / (img.naturalWidth * pdfHeight);

          if (pageHeightRatio > 1.08) {
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
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
          }
        }
      }

      const compSlug =
        isAllCompetitions || selectedCompIds.length === availableCompetitions.length
          ? 'All_Published_Results'
          : selectedCompIds.length === 1
          ? (availableCompetitions.find((c) => c.id === selectedCompIds[0])?.name || 'Competition').replace(
              /[^a-zA-Z0-9-]/g,
              '_'
            )
          : `${selectedCompIds.length}_Competitions_Results`;

      pdf.save(`Competition_Results_${compSlug}.pdf`);
    } catch (err) {
      console.error('Error generating results PDF:', err);
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
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          #print-results-sheet-area, #print-results-sheet-area * {
            visibility: visible;
          }
          #print-results-sheet-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .competition-a4-page {
            page-break-after: always;
            break-after: page;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 18mm !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* Main Modal Container */}
      <div className="w-full max-w-6xl max-h-[96vh] bg-[#121424] border border-[#292d4a] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
        {/* TOP BAR / ACTIONS */}
        <div className="p-4 sm:p-5 border-b border-[#292d4a] bg-[#151728] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Competition Results PDF Report
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Official Bulletin
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official festival winners sheet, podium rankings, grade points & certified judge endorsements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Quick Direct Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="p-2.5 rounded-2xl bg-[#181b30] hover:bg-amber-600/20 text-slate-300 hover:text-amber-300 border border-[#292d4a] hover:border-amber-500/40 transition-all cursor-pointer"
              title="Direct Print"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Primary Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || targetCompetitions.length === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/30 transition-all cursor-pointer"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Result PDF</span>
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

        {/* CONTROLS & FILTER BAR */}
        <div className="p-3.5 sm:p-4 bg-[#151728]/80 border-b border-[#292d4a] space-y-3 shrink-0">
          {/* TOP ROW: Search + Status Tabs + Category Pills */}
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
            {/* Search across result fields */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                placeholder="Search across competition names, winners, chest numbers, venues, houses..."
                className="w-full pl-10 pr-9 py-2 bg-[#1e223d] border border-[#292d4a] focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-400 font-medium focus:outline-none transition-all shadow-inner"
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

            {/* Status Filter Tabs (All / Published / Pending) */}
            <div className="flex items-center gap-1 bg-[#121422] p-1 rounded-xl border border-[#292d4a] shrink-0">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('All');
                  setIsAllCompetitions(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'All'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All ({evaluatedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('Published');
                  setIsAllCompetitions(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'Published'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Published ({publishedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('Pending');
                  setIsAllCompetitions(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'Pending'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>⏳ Pending Publish ({pendingCount})</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => handleSelectCategoryCompetitions('All')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  isAllCompetitions
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
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
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                        : 'bg-[#1e223d] text-slate-400 hover:text-white border border-[#292d4a]'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* BOTTOM ROW: Select Competitions Dropdown + Options */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Searchable Multi-Select Competition Dropdown */}
            <div className="relative flex-1 max-w-xl" ref={compDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Select Competitions to Include
                </label>
                <span className="text-[10px] text-amber-400 font-bold">
                  {isAllCompetitions
                    ? `All ${availableCompetitions.length} Competitions`
                    : `${selectedCompIds.length} of ${availableCompetitions.length} Selected`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setCompDropdownOpen(!compDropdownOpen)}
                className={`w-full flex items-center justify-between gap-2 bg-[#1e223d] border rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                  compDropdownOpen
                    ? 'border-amber-500 text-white ring-2 ring-amber-500/20'
                    : isAllCompetitions || selectedCompIds.length === availableCompetitions.length
                    ? 'border-amber-500/60 text-amber-200'
                    : selectedCompIds.length > 0
                    ? 'border-indigo-500/70 text-indigo-100'
                    : 'border-rose-500/50 text-rose-300 hover:border-rose-400'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {isAllCompetitions || selectedCompIds.length === availableCompetitions.length
                      ? `All Published / Evaluated Competitions (${availableCompetitions.length})`
                      : selectedCompIds.length === 1
                      ? availableCompetitions.find((c) => c.id === selectedCompIds[0])?.name || '1 Competition Selected'
                      : selectedCompIds.length > 1
                      ? `${selectedCompIds.length} Competitions Selected`
                      : 'None Selected (Click to Select)'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold">
                    {isAllCompetitions ? availableCompetitions.length : selectedCompIds.length}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      compDropdownOpen ? 'rotate-180 text-amber-400' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Dropdown Popover */}
              {compDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 max-w-[94vw] bg-[#121424] border border-[#292d4a] rounded-2xl shadow-2xl z-50 p-3 space-y-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={compSearchTerm}
                      onChange={(e) => setCompSearchTerm(e.target.value)}
                      placeholder="Filter competitions..."
                      className="w-full pl-8 pr-3 py-1.5 bg-[#181b30] border border-[#292d4a] focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  {/* Actions inside dropdown */}
                  <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[#292d4a]/70">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllCompetitions}
                        className="text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-600">•</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllCompetitions}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {filteredDropdownComps.length} found
                    </span>
                  </div>

                  {/* Competitions list */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {filteredDropdownComps.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-500">No competitions found</div>
                    ) : (
                      filteredDropdownComps.map((comp) => {
                        const isChecked = isAllCompetitions || selectedCompIds.includes(comp.id);
                        const hasPublishedRes = safeResults.some((r) => r.competitionId === comp.id);

                        return (
                          <div
                            key={comp.id}
                            onClick={() => toggleCompetitionSelection(comp.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-all cursor-pointer group select-none ${
                              isChecked
                                ? 'bg-amber-600/20 border border-amber-500/40 text-white font-medium'
                                : 'hover:bg-white/5 border border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                                  isChecked
                                    ? 'bg-amber-600 border-amber-500 text-white'
                                    : 'border-slate-600 group-hover:border-slate-400 bg-[#1e223d]'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 text-white stroke-[3]" />}
                              </div>

                              <div className="truncate">
                                <div
                                  className={`truncate font-bold text-xs ${
                                    isChecked ? 'text-white' : 'text-slate-300'
                                  }`}
                                >
                                  {comp.name}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                  <span className="font-semibold text-amber-400">{comp.category}</span>
                                  {hasPublishedRes ? (
                                    <span className="text-emerald-400 font-bold">• Published</span>
                                  ) : (
                                    <span className="text-amber-400 font-bold">• ⏳ Pending Publish</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => selectOnlyCompetition(comp.id, e)}
                              className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-white/10 hover:bg-amber-600 text-[10px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                              title="Select only this competition"
                            >
                              Only
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-[#292d4a]/70 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {isAllCompetitions
                        ? `All ${availableCompetitions.length} selected`
                        : `${selectedCompIds.length} of ${availableCompetitions.length} selected`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCompDropdownOpen(false)}
                      className="px-3.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Options Checkboxes */}
            <div className="flex items-center gap-4 py-2 shrink-0 self-end sm:self-center flex-wrap">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white font-bold text-xs">
                <input
                  type="checkbox"
                  checked={showPointsBreakdown}
                  onChange={(e) => setShowPointsBreakdown(e.target.checked)}
                  className="rounded border-slate-700 text-amber-600 focus:ring-amber-500"
                />
                <span>Points Breakdown</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white font-bold text-xs">
                <input
                  type="checkbox"
                  checked={showSignatures}
                  onChange={(e) => setShowSignatures(e.target.checked)}
                  className="rounded border-slate-700 text-amber-600 focus:ring-amber-500"
                />
                <span>Official Signature Box</span>
              </label>
            </div>
          </div>

          {/* Quick Selection Tag bar when subset is selected */}
          {!isAllCompetitions && selectedCompIds.length > 0 && selectedCompIds.length < availableCompetitions.length && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#292d4a]/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mr-1 flex items-center gap-1">
                <CheckSquare className="w-3 h-3" /> Selected ({selectedCompIds.length}):
              </span>
              {selectedCompIds.slice(0, 5).map((id) => {
                const comp = availableCompetitions.find((c) => c.id === id);
                if (!comp) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[10px] font-medium"
                  >
                    <span className="max-w-[120px] truncate">{comp.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleCompetitionSelection(id)}
                      className="hover:text-white text-amber-400 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              {selectedCompIds.length > 5 && (
                <span className="text-[10px] text-slate-400 italic">
                  +{selectedCompIds.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* PRINTABLE PREVIEW CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/60 flex flex-col items-center custom-scrollbar">
          <div ref={printAreaRef} id="print-results-sheet-area" className="flex flex-col items-center gap-8 w-full">
            {targetCompetitions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 max-w-md bg-[#151728] rounded-3xl border border-[#292d4a] my-8">
                <Trophy className="w-12 h-12 text-amber-500/40 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">No Results to Display</h3>
                <p className="text-xs text-slate-400 mb-4">
                  No competitions match the current filter or selection. Publish competition results or select from the
                  dropdown to generate official PDF sheets.
                </p>
                <button
                  type="button"
                  onClick={handleSelectAllCompetitions}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Layers className="w-4 h-4" />
                  <span>Show All Evaluated Competitions</span>
                </button>
              </div>
            ) : (
              targetCompetitions.map((comp, pageIndex) => {
                const eff = getEffectiveCompetitionResult(comp);
                const winners = eff.winners;
                const isPublished = eff.isPublished;
                const participantPointsMap = eff.participantPointsMap;
                const useDetailedPoints = eff.useDetailedPoints;
                const groupPointSummary = eff.groupPointSummary;

                const p1 = comp.points1st || 10;
                const p2 = comp.points2nd || 7;
                const p3 = comp.points3rd || 5;

                return (
                  <div
                    key={comp.id}
                    className="competition-a4-page bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300 print:border-none print:shadow-none print:rounded-none print:m-0 flex flex-col justify-between break-after-page page-break-after"
                    style={{
                      width: '210mm',
                      maxWidth: '100%',
                      minHeight: '297mm',
                      padding: '20mm',
                      boxSizing: 'border-box',
                      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                    }}
                  >
                    {/* TOP SECTION: Header, Title, Metadata & Winner Podium */}
                    <div className="flex flex-col w-full">
                      {/* 1. Standard Enigma Print Header */}
                      <EnigmaPrintHeader
                        title="ENIGMA ‘26"
                        compact={true}
                        className="!mb-2.5"
                        rightElement={
                          <div className="text-right">
                            <span className="text-[10px] font-mono font-bold text-slate-700 uppercase block">
                              {isPublished ? 'OFFICIAL RESULT BULLETIN' : 'PROVISIONAL RESULT BULLETIN (PENDING)'}
                            </span>
                            <span className="text-[9px] font-mono text-slate-500">
                              Date: {new Date().toLocaleDateString('en-GB')}
                            </span>
                          </div>
                        }
                      />

                      {/* 2. Competition Header Banner */}
                      <div className="border-b-2 border-slate-900 pb-2 mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-950">
                            {formatCompetitionName(comp.name)}
                          </span>
                          <span className="text-[15px] font-black px-2.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 uppercase">
                            {comp.category}
                          </span>
                          {isPublished ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                              ✓ Published
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                              ⏳ Pending Publish (Evaluated)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3. PODIUM WINNERS TABLE */}
                      <div className="mb-4">
                        {winners.first.length === 0 &&
                        winners.second.length === 0 &&
                        winners.third.length === 0 ? (
                          <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded text-center text-xs text-slate-500 italic">
                            No evaluated marks or winners recorded yet for this competition.
                          </div>
                        ) : (
                          <div className="border border-slate-900 rounded overflow-hidden">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wider">
                                  <th className="py-2 px-3 w-16 text-center">Rank</th>
                                  <th className="py-2 px-3">Participant / Candidate</th>
                                  <th className="py-2 px-3">Code / ID</th>
                                  <th className="py-2 px-3">Group / Department</th>
                                  {showPointsBreakdown && (
                                    <>
                                      <th className="py-2 px-2 text-center w-14">Grade</th>
                                      <th className="py-2 px-3 text-right w-20">Points</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {/* FIRST PLACE */}
                                {winners.first.map((w, idx) => {
                                  const reg = safeRegistrations.find((r) => r.id === w.regId);
                                  const ptMap = participantPointsMap?.[w.regId];
                                  const pts = ptMap ? ptMap.totalPoints : p1;
                                  const grade = ptMap?.grade || (reg?.mark && Number(reg.mark) >= 80 ? 'A' : '');

                                  return (
                                    <tr key={`1st-${idx}`} className="bg-amber-50/70 font-semibold">
                                      <td className="py-2.5 px-3 text-center">
                                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded font-black text-amber-950 bg-amber-300 border border-amber-400 text-[11px]">
                                          🥇 1st
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-950 font-bold text-xs">
                                        {festStore.getParticipantFullName(w.participantName, w.regId)}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-700 font-mono text-[11px]">
                                        {w.codeLetter || reg?.participantUserId || '-'}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-800 text-[11px]">
                                        <span className="font-bold">{w.groupName}</span>
                                        {reg?.department && (
                                          <span className="text-slate-500 block text-[9px]">
                                            {reg.department}
                                          </span>
                                        )}
                                      </td>
                                      {showPointsBreakdown && (
                                        <>
                                          <td className="py-2.5 px-2 text-center text-slate-900 font-bold text-[11px]">
                                            {grade ? (
                                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-black">
                                                {grade}
                                              </span>
                                            ) : (
                                              '-'
                                            )}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-black text-amber-900 text-xs">
                                            +{pts} pts
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}

                                {/* SECOND PLACE */}
                                {winners.second.map((w, idx) => {
                                  const reg = safeRegistrations.find((r) => r.id === w.regId);
                                  const ptMap = participantPointsMap?.[w.regId];
                                  const pts = ptMap ? ptMap.totalPoints : p2;
                                  const grade = ptMap?.grade || (reg?.mark && Number(reg.mark) >= 80 ? 'A' : '');

                                  return (
                                    <tr key={`2nd-${idx}`} className="bg-slate-50 font-medium">
                                      <td className="py-2 px-3 text-center">
                                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded font-black text-slate-800 bg-slate-200 border border-slate-300 text-[11px]">
                                          🥈 2nd
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-slate-900 font-bold text-xs">
                                        {festStore.getParticipantFullName(w.participantName, w.regId)}
                                      </td>
                                      <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                                        {w.codeLetter || reg?.participantUserId || '-'}
                                      </td>
                                      <td className="py-2 px-3 text-slate-800 text-[11px]">
                                        <span className="font-bold">{w.groupName}</span>
                                        {reg?.department && (
                                          <span className="text-slate-500 block text-[9px]">
                                            {reg.department}
                                          </span>
                                        )}
                                      </td>
                                      {showPointsBreakdown && (
                                        <>
                                          <td className="py-2 px-2 text-center text-slate-900 font-bold text-[11px]">
                                            {grade ? (
                                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-black">
                                                {grade}
                                              </span>
                                            ) : (
                                              '-'
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-right font-black text-slate-800 text-xs">
                                            +{pts} pts
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}

                                {/* THIRD PLACE */}
                                {winners.third.map((w, idx) => {
                                  const reg = safeRegistrations.find((r) => r.id === w.regId);
                                  const ptMap = participantPointsMap?.[w.regId];
                                  const pts = ptMap ? ptMap.totalPoints : p3;
                                  const grade = ptMap?.grade || (reg?.mark && Number(reg.mark) >= 80 ? 'A' : '');

                                  return (
                                    <tr key={`3rd-${idx}`} className="bg-amber-50/30 font-medium">
                                      <td className="py-2 px-3 text-center">
                                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded font-black text-amber-900 bg-amber-200/80 border border-amber-300 text-[11px]">
                                          🥉 3rd
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-slate-900 font-bold text-xs">
                                        {festStore.getParticipantFullName(w.participantName, w.regId)}
                                      </td>
                                      <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                                        {w.codeLetter || reg?.participantUserId || '-'}
                                      </td>
                                      <td className="py-2 px-3 text-slate-800 text-[11px]">
                                        <span className="font-bold">{w.groupName}</span>
                                        {reg?.department && (
                                          <span className="text-slate-500 block text-[9px]">
                                            {reg.department}
                                          </span>
                                        )}
                                      </td>
                                      {showPointsBreakdown && (
                                        <>
                                          <td className="py-2 px-2 text-center text-slate-900 font-bold text-[11px]">
                                            {grade ? (
                                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-black">
                                                {grade}
                                              </span>
                                            ) : (
                                              '-'
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-right font-black text-amber-800 text-xs">
                                            +{pts} pts
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* 4. OTHER GRADED PARTICIPANTS (if detailed points with performance grade exist) */}
                      {useDetailedPoints &&
                        participantPointsMap &&
                        (() => {
                          const topWinnerRegIds = new Set([
                            ...winners.first.map((w) => w.regId),
                            ...winners.second.map((w) => w.regId),
                            ...winners.third.map((w) => w.regId),
                          ]);

                          const otherGradedRegs = Object.entries(participantPointsMap)
                            .map(([regId, rawVal]) => {
                              const val = rawVal as { totalPoints: number; grade?: string; score?: number };
                              const reg = safeRegistrations.find((r) => r.id === regId);
                              return { regId, val, reg };
                            })
                            .filter(({ regId, val }) => !topWinnerRegIds.has(regId) && val.totalPoints > 0);

                          if (otherGradedRegs.length === 0) return null;

                          return (
                            <div className="mb-4">
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-purple-600" />
                                <span>Performance Grade & Team Points Earners</span>
                              </div>
                              <div className="border border-slate-300 rounded overflow-hidden">
                                <table className="w-full text-left border-collapse text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px]">
                                      <th className="py-1.5 px-3">Participant</th>
                                      <th className="py-1.5 px-3">Code</th>
                                      <th className="py-1.5 px-3">Group</th>
                                      <th className="py-1.5 px-2 text-center">Grade</th>
                                      <th className="py-1.5 px-3 text-right">Points</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {otherGradedRegs.map(({ regId, val, reg }) => {
                                      const pName = reg ? festStore.getParticipantFullName(reg.participantName, reg.id) : 'Participant';
                                      const gName = reg?.groupName || 'Team';
                                      const cLetter = reg?.codeLetter || reg?.participantUserId || '-';

                                      return (
                                        <tr key={regId} className="hover:bg-slate-50">
                                          <td className="py-1.5 px-3 font-semibold text-slate-900">
                                            {pName}
                                          </td>
                                          <td className="py-1.5 px-3 text-slate-600 font-mono text-[10px]">
                                            {cLetter}
                                          </td>
                                          <td className="py-1.5 px-3 text-slate-700">{gName}</td>
                                          <td className="py-1.5 px-2 text-center">
                                            {val.grade ? (
                                              <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 font-black text-[10px] border border-purple-200">
                                                {val.grade}
                                              </span>
                                            ) : (
                                              '-'
                                            )}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-bold text-amber-700">
                                            +{val.totalPoints} pts
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}

                      {/* 5. TEAM POINTS TALLY FOR THIS EVENT */}
                      {Object.keys(groupPointSummary).length > 0 && (
                        <div className="mb-4 p-2.5 bg-slate-50 border border-slate-300 rounded-lg">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              Competition Group Points Summary
                            </span>
                            <span className="text-slate-500 font-normal">Championship Standing Impact</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {Object.entries(groupPointSummary)
                              .sort((a, b) => b[1].points - a[1].points)
                              .map(([gName, data]) => (
                                <div
                                  key={gName}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-300 shadow-2xs text-[11px]"
                                >
                                  <span className="font-bold text-slate-900">{gName}:</span>
                                  <span className="font-black text-amber-900 font-mono">
                                    +{data.points} pts
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BOTTOM SECTION: Official Signatures Block + Enigma Footer */}
                    <div className="w-full mt-auto">
                      {showSignatures && (
                        <div className="border-t-2 border-slate-900 pt-3 pb-2 mb-2">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="flex flex-col items-center">
                              <div className="h-10 w-full border-b border-dashed border-slate-400 mb-1 flex items-end justify-center">
                                <span className="text-[9px] text-slate-400 italic">Signature</span>
                              </div>
                              <span className="text-[10px] font-black uppercase text-slate-900">
                                Evaluator / Judge 1
                              </span>
                              <span className="text-[9px] text-slate-500">Official Mark Signature</span>
                            </div>

                            <div className="flex flex-col items-center">
                              <div className="h-10 w-full border-b border-dashed border-slate-400 mb-1 flex items-end justify-center">
                                <span className="text-[9px] text-slate-400 italic">Signature</span>
                              </div>
                              <span className="text-[10px] font-black uppercase text-slate-900">
                                Chief Judge / Tabulator
                              </span>
                              <span className="text-[9px] text-slate-500">Score Audit Verified</span>
                            </div>

                            <div className="flex flex-col items-center">
                              <div className="h-10 w-full border-b border-dashed border-slate-400 mb-1 flex items-end justify-center">
                                <span className="text-[9px] text-slate-400 italic">Signature</span>
                              </div>
                              <span className="text-[10px] font-black uppercase text-slate-900">
                                Festival Convener / Director
                              </span>
                              <span className="text-[9px] text-slate-500">Final Endorsement</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Standard Enigma Print Footer */}
                      <EnigmaPrintFooter
                        leftMain="ENIGMA ‘26"
                        leftSub="Arts & Cultural Festival • Official Results Bulletin"
                        pageNumber={`Page ${pageIndex + 1} of ${targetCompetitions.length}`}
                        compact={true}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MODAL FOOTER BAR */}
        <div className="p-3 sm:p-4 bg-[#151728] border-t border-[#292d4a] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">
              {targetCompetitions.length} Competition Sheet{targetCompetitions.length === 1 ? '' : 's'} Ready
            </span>
            <span>•</span>
            <span className="text-amber-400 font-bold">{reportStats.winnersCount} Placed Winners</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-[#1e223d] hover:bg-[#252a4a] text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || targetCompetitions.length === 0}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white font-bold text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintResultsReportModal;
