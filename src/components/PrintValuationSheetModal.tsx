import React, { useState, useMemo, useRef } from 'react';
import { Competition, Registration, Group } from '../types';
import { festStore, formatCompetitionName, formatStageName } from '../lib/store';
import { EnigmaPrintHeader, EnigmaPrintFooter } from './EnigmaPrintTemplate';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import {
  Download,
  Printer,
  X,
  Scale,
  Loader2,
  Search,
  ChevronDown,
  Layers,
  Filter,
  CheckSquare,
  Square,
  ListChecks,
  LayoutGrid,
} from 'lucide-react';

interface PrintValuationSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitions: Competition[];
  registrations: Registration[];
  groups?: Group[];
  initialCompId?: string;
}

export const PrintValuationSheetModal: React.FC<PrintValuationSheetModalProps> = ({
  isOpen,
  onClose,
  competitions = [],
  registrations = [],
  groups = [],
  initialCompId = '',
}) => {
  const safeRegistrations = useMemo(() => Array.isArray(registrations) ? registrations : [], [registrations]);
  const safeCompetitions = useMemo(() => Array.isArray(competitions) ? competitions : [], [competitions]);

  // Available competitions: Scheduled and Closed reporting or initial
  const availableCompetitions = useMemo(() => {
    const readyComps = safeCompetitions.filter(c => Boolean(c.scheduleTime && c.scheduleTime.trim()));
    if (initialCompId && initialCompId !== 'All') {
      const specific = safeCompetitions.find(c => c.id === initialCompId);
      if (specific && !readyComps.some(c => c.id === initialCompId)) {
        return [specific, ...readyComps];
      }
    }
    return readyComps;
  }, [safeCompetitions, initialCompId]);

  // Available categories
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    availableCompetitions.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats);
  }, [availableCompetitions]);

  const [isAllCompetitions, setIsAllCompetitions] = useState<boolean>(() => {
    return !initialCompId || initialCompId === 'All';
  });

  const [selectedCompIds, setSelectedCompIds] = useState<string[]>(() => {
    if (initialCompId && initialCompId !== 'All') {
      return [initialCompId];
    }
    return availableCompetitions.map(c => c.id);
  });

  const [itemsPerPage, setItemsPerPage] = useState<number>(2); // 2 competitions per A4 portrait page default
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [compDropdownOpen, setCompDropdownOpen] = useState(false);
  const [compSearchTerm, setCompSearchTerm] = useState('');
  const [compFilterTab, setCompFilterTab] = useState('All');
  const compDropdownRef = useRef<HTMLDivElement>(null);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Sync initialCompId changes
  React.useEffect(() => {
    if (initialCompId && initialCompId !== 'All') {
      setIsAllCompetitions(false);
      setSelectedCompIds([initialCompId]);
    } else if (initialCompId === 'All' || !initialCompId) {
      setIsAllCompetitions(true);
      setSelectedCompIds(availableCompetitions.map(c => c.id));
    }
  }, [initialCompId, availableCompetitions]);

  // Close dropdown on click outside
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

  const toggleCompetitionSelection = (compId: string) => {
    if (isAllCompetitions) {
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
    setSearchQuery('');
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

  // Filtered competitions for printing
  const targetCompetitions = useMemo(() => {
    let comps: Competition[] = [];
    if (isAllCompetitions) {
      comps = availableCompetitions;
    } else {
      comps = availableCompetitions.filter(c => selectedCompIds.includes(c.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      comps = comps.filter(comp => {
        const matchesComp =
          comp.name.toLowerCase().includes(q) ||
          (comp.category || '').toLowerCase().includes(q) ||
          (comp.venue || '').toLowerCase().includes(q) ||
          (comp.type || '').toLowerCase().includes(q);
        if (matchesComp) return true;

        const compRegs = safeRegistrations.filter(r => r.competitionId === comp.id);
        const matchesReg = compRegs.some(r =>
          (r.codeLetter || '').toLowerCase().includes(q) ||
          (r.participantName || '').toLowerCase().includes(q) ||
          (r.chestNo || '').toLowerCase().includes(q)
        );
        return matchesReg;
      });
    }

    return comps;
  }, [availableCompetitions, isAllCompetitions, selectedCompIds, searchQuery, safeRegistrations]);

  // Group target competitions into pages (chunked by 2 competitions per page or 1 per page)
  const pageChunks = useMemo(() => {
    const chunks: Competition[][] = [];
    for (let i = 0; i < targetCompetitions.length; i += itemsPerPage) {
      chunks.push(targetCompetitions.slice(i, i + itemsPerPage));
    }
    return chunks;
  }, [targetCompetitions, itemsPerPage]);

  // Dropdown list filtering
  const dropdownFilteredComps = useMemo(() => {
    return availableCompetitions.filter(c => {
      if (compFilterTab !== 'All' && c.category !== compFilterTab) return false;
      if (compSearchTerm.trim()) {
        const q = compSearchTerm.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.category || '').toLowerCase().includes(q) ||
          (c.venue || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [availableCompetitions, compFilterTab, compSearchTerm]);

  // Direct PDF Download with jsPDF & html-to-image (A4 Portrait)
  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const container = printAreaRef.current;
      const pageElements = Array.from(container.querySelectorAll<HTMLElement>('.valuation-a4-page'));

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
          pixelRatio: 2.5,
          backgroundColor: '#ffffff',
          skipFonts: true,
          cacheBust: false,
        });

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
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

          if (i > 0) {
            pdf.addPage('a4', 'portrait');
          }

          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        }
      }

      pdf.save(`Enigma26_Valuation_Sheets_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Failed to generate valuation PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleNativePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #valuation-print-container {
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .valuation-a4-page {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: 284mm !important;
            max-height: 284mm !important;
            page-break-after: always !important;
            break-after: page !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
        }
      `}</style>

      {/* Container */}
      <div className="bg-[#121424] border border-[#292d4a] rounded-3xl w-full max-w-5xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden text-white">
        
        {/* MODAL TOP HEADER BAR */}
        <div className="p-4 sm:p-5 border-b border-[#292d4a] flex items-center justify-between gap-3 bg-[#181b30]/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>Print Judge Valuation Sheet</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  {targetCompetitions.length} Event{targetCompetitions.length !== 1 ? 's' : ''} ({pageChunks.length} Page{pageChunks.length !== 1 ? 's' : ''})
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official judge mark sheet rendered in A4 Portrait format with page header and footer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Native Browser Print */}
            <button
              type="button"
              onClick={handleNativePrint}
              className="px-4 py-2.5 bg-[#1e223d] hover:bg-[#282d50] text-slate-200 hover:text-white border border-[#292d4a] rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              title="Print via system dialog"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Direct PDF Download */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Global Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across competitions, categories, code letters..."
                className="w-full pl-10 pr-9 py-2 bg-[#1e223d] border border-[#292d4a] focus:border-emerald-500 rounded-xl text-xs text-white placeholder-slate-400 font-medium focus:outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Page Density Selector: 2 Events / Page vs 1 Event / Page */}
            <div className="flex items-center bg-[#1e223d] p-1 rounded-xl border border-[#292d4a] shrink-0">
              <button
                type="button"
                onClick={() => setItemsPerPage(2)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  itemsPerPage === 2
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Print 2 competitions per A4 portrait sheet"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>2 Events / Page</span>
              </button>
              <button
                type="button"
                onClick={() => setItemsPerPage(1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  itemsPerPage === 1
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Print 1 competition per A4 portrait sheet"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>1 Event / Page</span>
              </button>
            </div>

            {/* Quick Show All Button */}
            <button
              type="button"
              onClick={handleSelectAllCompetitions}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isAllCompetitions
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-[#1e223d] hover:bg-[#282d50] text-slate-300 border border-[#292d4a]'
              }`}
            >
              <ListChecks className="w-4 h-4 text-emerald-400" />
              <span>All Competitions ({availableCompetitions.length})</span>
            </button>
          </div>

          {/* SECOND ROW: Multi-Select Dropdown & Category Quick Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-[#292d4a]/60">
            {/* Competition Multi-Select Dropdown */}
            <div className="relative w-full sm:w-80" ref={compDropdownRef}>
              <button
                type="button"
                onClick={() => setCompDropdownOpen(prev => !prev)}
                className="w-full px-3.5 py-2 bg-[#1e223d] hover:bg-[#252a4a] border border-[#292d4a] hover:border-emerald-500/50 rounded-xl text-xs text-white font-medium flex items-center justify-between gap-2 transition-all cursor-pointer text-left shadow-sm"
              >
                <div className="flex items-center gap-2 truncate">
                  <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {isAllCompetitions
                      ? `All Competitions (${availableCompetitions.length})`
                      : selectedCompIds.length === 1
                      ? availableCompetitions.find(c => c.id === selectedCompIds[0])?.name || '1 Competition'
                      : `${selectedCompIds.length} of ${availableCompetitions.length} Competitions`}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${compDropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
              </button>

              {/* DROPDOWN POPOVER */}
              {compDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-80 sm:w-96 bg-[#181b30] border border-[#292d4a] rounded-2xl shadow-2xl z-50 p-3 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-[#292d4a] text-[11px]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-300">
                      <Filter className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Select Competitions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllCompetitions}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllCompetitions}
                        className="text-[10px] text-slate-400 hover:text-slate-200 font-bold transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {['All', ...availableCategories].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCompFilterTab(cat)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                          compFilterTab === cat
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#121424] text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Search inside dropdown */}
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={compSearchTerm}
                      onChange={(e) => setCompSearchTerm(e.target.value)}
                      placeholder="Filter list..."
                      className="w-full pl-8 pr-3 py-1 bg-[#121424] border border-[#292d4a] focus:border-emerald-500 rounded-lg text-[11px] text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  {/* Competitions checkbox list */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {dropdownFilteredComps.length === 0 ? (
                      <div className="py-4 text-center text-slate-500 text-[11px]">
                        No matching competitions.
                      </div>
                    ) : (
                      dropdownFilteredComps.map(comp => {
                        const isChecked = isAllCompetitions || selectedCompIds.includes(comp.id);
                        return (
                          <div
                            key={comp.id}
                            className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer group ${
                              isChecked ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : 'hover:bg-[#1f233f]'
                            }`}
                            onClick={() => toggleCompetitionSelection(comp.id)}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />
                              )}
                              <div className="truncate">
                                <span className={`text-xs block truncate ${isChecked ? 'text-white font-bold' : 'text-slate-300'}`}>
                                  {comp.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {comp.category} {comp.venue ? `• ${comp.venue}` : ''}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => selectOnlyCompetition(comp.id, e)}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[#121424] hover:bg-emerald-600 text-slate-400 hover:text-white font-bold shrink-0 transition-colors"
                              title="Select only this event"
                            >
                              Only
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Category Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
              <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0">Category:</span>
              <button
                type="button"
                onClick={() => handleSelectCategoryCompetitions('All')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isAllCompetitions
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                }`}
              >
                All
              </button>
              {availableCategories.map(cat => {
                const catCompIds = availableCompetitions.filter(c => c.category === cat).map(c => c.id);
                const isCatActive = !isAllCompetitions && catCompIds.length > 0 && catCompIds.every(id => selectedCompIds.includes(id)) && selectedCompIds.length === catCompIds.length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectCategoryCompetitions(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isCatActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-[#181b30] text-slate-400 hover:text-white border border-[#292d4a]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* PRINTABLE PREVIEW AREA (PORTRAIT) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0b0c16] flex justify-center custom-scrollbar">
          {targetCompetitions.length === 0 ? (
            <div className="my-auto text-center p-12 bg-[#151728] rounded-3xl border border-[#292d4a] max-w-md">
              <Scale className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h4 className="text-base font-bold text-white mb-1">No Competitions Selected</h4>
              <p className="text-xs text-slate-400 mb-4">
                Please select at least one competition from the controls above to preview and print valuation sheets.
              </p>
              <button
                type="button"
                onClick={handleSelectAllCompetitions}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                Select All Competitions
              </button>
            </div>
          ) : (
            /* PRINT PAGES CONTAINER (A4 PORTRAIT) */
            <div
              ref={printAreaRef}
              id="valuation-print-container"
              className="w-full flex flex-col items-center gap-8 print:gap-0 print:m-0 print:p-0"
            >
              {pageChunks.map((chunk, pageIndex) => {
                return (
                  <div
                    key={`page-${pageIndex}`}
                    className="valuation-a4-page bg-white text-slate-900 w-full max-w-[760px] p-6 sm:p-8 shadow-2xl rounded-2xl border border-slate-300 print:border-none print:shadow-none print:rounded-none print:m-0 print:p-6 flex flex-col justify-between break-after-page page-break-after"
                    style={{ minHeight: '980px' }}
                  >
                    {/* Top Enigma Print Header */}
                    <EnigmaPrintHeader
                      title="ENIGMA ‘26"
                      rightElement={
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {new Date().toLocaleDateString('en-GB')}
                        </span>
                      }
                    />

                    {/* Competitions Block (1 or 2 competitions stacked vertically) */}
                    <div className="flex-1 flex flex-col justify-between gap-6 my-3">
                      {chunk.map((comp) => {
                        // Get reported or coded registrations
                        const compRegs = safeRegistrations
                          .filter(r => r.competitionId === comp.id && (r.isReported === true || Boolean(r.codeLetter)))
                          .sort((a, b) => (a.codeLetter || '').localeCompare(b.codeLetter || ''));

                        // Default 9 rows per event when 2 per page, or 18 when 1 per page
                        const defaultRows = itemsPerPage === 2 ? 9 : 18;
                        const numTableRows = Math.max(compRegs.length, defaultRows);
                        const tableRows = Array.from({ length: numTableRows }, (_, i) => compRegs[i] || null);

                        return (
                          <div key={comp.id} className="w-full flex flex-col gap-1.5">
                            {/* Top Header Box: Competition Name | Category | Type */}
                            <div className="border-2 border-black rounded-t-lg overflow-hidden bg-white text-xs sm:text-sm font-sans">
                              <div className="grid grid-cols-12 border-b-2 border-black text-center font-bold text-slate-950 divide-x-2 divide-black">
                                <div className="col-span-4 py-1.5 px-2.5 uppercase tracking-tight flex items-center justify-center font-extrabold text-xs sm:text-sm">
                                  {formatCompetitionName(comp.name)}
                                </div>
                                <div className="col-span-5 py-1.5 px-2.5 uppercase tracking-tight flex items-center justify-center font-bold">
                                  {comp.category || 'General'}
                                </div>
                                <div className="col-span-3 py-1.5 px-2.5 uppercase tracking-tight flex items-center justify-center font-bold">
                                  {comp.type || 'Individual'}
                                </div>
                              </div>

                              {/* Sub-Header Row: Code | Mark Columns | Mark Out of 100 */}
                              <div className="grid grid-cols-12 text-center font-extrabold text-slate-950 divide-x-2 divide-black text-xs bg-slate-50">
                                <div className="col-span-2 py-1 px-2 uppercase tracking-wider flex items-center justify-center">
                                  Code
                                </div>
                                <div className="col-span-8 py-1 px-2 uppercase tracking-wider flex items-center justify-center">
                                  Mark
                                </div>
                                <div className="col-span-2 py-0.5 px-2 uppercase tracking-tight flex flex-col items-center justify-center text-[10px] sm:text-xs font-bold">
                                  <span>Mark Out of</span>
                                  <span className="font-extrabold text-xs">100</span>
                                </div>
                              </div>
                            </div>

                            {/* Valuation Scoring Table Grid */}
                            <div className="border-2 border-t-0 border-black rounded-b-lg overflow-hidden">
                              <table className="w-full text-left border-collapse text-xs sm:text-sm border-t-0">
                                <tbody className="divide-y-2 divide-black">
                                  {tableRows.map((reg, rowIdx) => {
                                    const code = reg ? (reg.codeLetter || reg.chestNo || '').toUpperCase() : '';
                                    return (
                                      <tr key={reg ? reg.id : `empty-row-${rowIdx}`} className={itemsPerPage === 2 ? 'h-6 sm:h-7' : 'h-8 sm:h-9'}>
                                        {/* Code Column */}
                                        <td className="w-[16.666%] border-r-2 border-black text-center font-mono font-black text-xs sm:text-sm px-2 text-slate-950">
                                          {code}
                                        </td>
                                        
                                        {/* Mark Scoring Sub-Grid (4 breakdown columns) */}
                                        <td className="w-[66.666%] p-0 border-r-2 border-black">
                                          <div className="grid grid-cols-4 h-full divide-x-2 divide-black">
                                            <div className={itemsPerPage === 2 ? 'h-6 sm:h-7' : 'h-8 sm:h-9'}></div>
                                            <div className={itemsPerPage === 2 ? 'h-6 sm:h-7' : 'h-8 sm:h-9'}></div>
                                            <div className={itemsPerPage === 2 ? 'h-6 sm:h-7' : 'h-8 sm:h-9'}></div>
                                            <div className={itemsPerPage === 2 ? 'h-6 sm:h-7' : 'h-8 sm:h-9'}></div>
                                          </div>
                                        </td>

                                        {/* Total Mark Column */}
                                        <td className="w-[16.666%] text-center px-2">
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Judge Signature Line (Balanced spacing for 9-row tables) */}
                            <div className="mt-3 sm:mt-4 flex items-center justify-end">
                              <div className="text-right text-xs sm:text-sm font-bold text-slate-950 font-sans">
                                <span>Judge’s Name and Sign : </span>
                                <span className="inline-block border-b-2 border-black w-48 sm:w-60 ml-2"></span>
                              </div>
                            </div>

                            {/* Official Enigma Footer for each competition */}
                            <div className="mt-3 pt-1">
                              <EnigmaPrintFooter
                                leftMain="MIASIN ZOR"
                                leftSub="Festival collective"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Overall Page Number Indicator */}
                    <div className="text-right text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-200 print:hidden">
                      Page {pageIndex + 1} of {pageChunks.length}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
