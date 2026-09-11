import React, { useState, useMemo, useRef } from 'react';
import { Competition, Registration } from '../types';
import { festStore, formatCompetitionName, formatStageName } from '../lib/store';
import { normalizeScheduleString } from '../lib/scheduler';
import { EnigmaPrintHeader, EnigmaPrintFooter } from './EnigmaPrintTemplate';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import {
  Download,
  Printer,
  X,
  FileText,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface PrintDayScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitions: Competition[];
  registrations?: Registration[];
  stagesList?: string[];
  initialDay?: string;
}

// Helper to format date cleanly as DD/MM/YYYY if possible
function formatDisplayDate(dateStr: string): string {
  if (!dateStr || dateStr === 'Unscheduled / TBA' || dateStr === 'All') return dateStr || '07/09/2026';
  // Check if date has DD-MM-YYYY or YYYY-MM-DD or DD/MM/YYYY
  const clean = dateStr.replace(/^[a-zA-Z]+,\s*/, '').trim(); // Remove leading weekday if any
  const dmyMatch = clean.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${day}/${month}/${year}`;
  }
  return clean;
}

// Helper to sort stages naturally (STAGE 1, STAGE 2, STAGE 3... then named stages)
function parseStageSortKey(stageName: string): number {
  const match = stageName.match(/stage\s*(\d+)/i) || stageName.match(/^(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  if (/main\s*stage/i.test(stageName)) return 0;
  return 1000;
}

function compareStages(a: string, b: string): number {
  const numA = parseStageSortKey(a);
  const numB = parseStageSortKey(b);
  if (numA !== numB) return numA - numB;
  return a.localeCompare(b);
}

// Helper to convert time string to comparable minutes for sorting
function parseTimeMinutes(timeStr: string): number {
  if (!timeStr) return 9999;
  // Match "3.00 to 3.30" or "3:00 to 3:30" or "3.00 - 3.30" or "09:00 AM - 10:00 AM"
  const dotMatch = timeStr.match(/(\d{1,2})[.:](\d{2})\s*(AM|PM)?/i);
  if (dotMatch) {
    let hours = parseInt(dotMatch[1], 10);
    const minutes = parseInt(dotMatch[2], 10);
    const meridiem = dotMatch[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    // Heuristic: If hours are between 1 and 7 and no AM/PM, it is likely afternoon (e.g., 3.00 = 15:00)
    if (!meridiem && hours >= 1 && hours <= 7) hours += 12;
    return hours * 60 + minutes;
  }
  return 9999;
}

export const PrintDayScheduleModal: React.FC<PrintDayScheduleModalProps> = ({
  isOpen,
  onClose,
  competitions = [],
  stagesList = [],
  initialDay = 'All',
}) => {
  const safeCompetitions = useMemo(
    () => (Array.isArray(competitions) ? competitions : []),
    [competitions]
  );

  const [selectedDay, setSelectedDay] = useState<string>(initialDay);
  const [selectedStage, setSelectedStage] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Extract all unique days from the competitions
  const availableDays = useMemo(() => {
    const dayMap = new Map<string, number>();
    for (const c of safeCompetitions) {
      if (!c.scheduleTime) continue;
      const { dayDate } = normalizeScheduleString(c.scheduleTime);
      if (dayDate) {
        dayMap.set(dayDate, (dayMap.get(dayDate) || 0) + 1);
      }
    }
    return Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [safeCompetitions]);

  // Extract all categories
  const categoriesList = festStore.getCategories();

  // Filter competitions based on selections
  const filteredComps = useMemo(() => {
    return safeCompetitions.filter((comp) => {
      if (!comp.scheduleTime) return false;
      const { dayDate } = normalizeScheduleString(comp.scheduleTime);
      const stageName = formatStageName(comp.venue);

      // Filter by Day
      if (selectedDay !== 'All' && dayDate !== selectedDay) {
        return false;
      }

      // Filter by Stage
      if (selectedStage !== 'All' && stageName !== selectedStage && comp.venue !== selectedStage) {
        return false;
      }

      // Filter by Category
      if (selectedCategory !== 'All' && comp.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [safeCompetitions, selectedDay, selectedStage, selectedCategory]);

  // Group competitions by Day and then by Stage
  const scheduleByDay = useMemo(() => {
    const dayMap = new Map<string, Competition[]>();

    if (selectedDay !== 'All') {
      dayMap.set(selectedDay, []);
    } else {
      if (availableDays.length === 0) {
        dayMap.set('07/09/2026', []);
      } else {
        for (const [dayDate] of availableDays) {
          dayMap.set(dayDate, []);
        }
      }
    }

    for (const comp of filteredComps) {
      const { dayDate } = normalizeScheduleString(comp.scheduleTime);
      const groupKey = dayDate || '07/09/2026';
      if (!dayMap.has(groupKey)) {
        dayMap.set(groupKey, []);
      }
      dayMap.get(groupKey)!.push(comp);
    }

    const result: {
      dayDate: string;
      formattedDate: string;
      totalCompetitions: number;
      stages: { stageName: string; competitions: Competition[] }[];
    }[] = [];

    for (const [dayDate, dayComps] of dayMap.entries()) {
      if (dayComps.length > 0 || selectedDay === dayDate) {
        // Group by stage
        const stageMap = new Map<string, Competition[]>();
        for (const comp of dayComps) {
          const sName = formatStageName(comp.venue) || 'STAGE 4';
          const normalizedStageName = sName.toUpperCase();
          if (!stageMap.has(normalizedStageName)) {
            stageMap.set(normalizedStageName, []);
          }
          stageMap.get(normalizedStageName)!.push(comp);
        }

        // Inside each stage, sort chronologically by time
        const stageGroups: { stageName: string; competitions: Competition[] }[] = [];
        for (const [sName, comps] of stageMap.entries()) {
          comps.sort((a, b) => {
            const { timeSlot: timeA } = normalizeScheduleString(a.scheduleTime);
            const { timeSlot: timeB } = normalizeScheduleString(b.scheduleTime);
            const minutesDiff = parseTimeMinutes(timeA) - parseTimeMinutes(timeB);
            if (minutesDiff !== 0) return minutesDiff;
            return a.name.localeCompare(b.name);
          });
          stageGroups.push({ stageName: sName, competitions: comps });
        }

        // Sort stages: STAGE 1, STAGE 2, STAGE 3, STAGE 4, STAGE 5, STAGE 6...
        stageGroups.sort((a, b) => compareStages(a.stageName, b.stageName));

        result.push({
          dayDate,
          formattedDate: formatDisplayDate(dayDate),
          totalCompetitions: dayComps.length,
          stages: stageGroups,
        });
      }
    }

    return result.sort((a, b) => a.dayDate.localeCompare(b.dayDate));
  }, [filteredComps, availableDays, selectedDay]);

  // Trigger direct PDF Download with jsPDF and html-to-image
  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const element = printAreaRef.current;

      const imgData = await toPng(element, {
        quality: 0.99,
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

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (img.naturalHeight * imgWidth) / img.naturalWidth;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const daySlug = selectedDay === 'All' ? 'Festival_Schedule' : selectedDay.replace(/[^a-zA-Z0-9-]/g, '_');
      const filename = `Schedule_${daySlug}.pdf`;
      pdf.save(filename);
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Modal Container */}
      <div className="bg-[#121422] border border-[#292d4a] rounded-3xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none print:bg-white print:overflow-visible">
        
        {/* Top Control Bar (Hidden during printing) */}
        <div className="p-4 sm:p-5 bg-[#151728] border-b border-[#292d4a] flex flex-wrap items-center justify-between gap-4 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Print Festival Schedule
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Official ENIGMA stage timetable format matching official specification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Direct Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-2xl bg-[#181b30] hover:bg-purple-600/20 text-slate-200 hover:text-purple-300 border border-[#292d4a] hover:border-purple-500/40 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Direct Print (Ctrl + P)"
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>Print</span>
            </button>

            {/* Download PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-extrabold transition-all inline-flex items-center gap-2 shadow-lg shadow-purple-600/25 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-[#292d4a] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls (Hidden in Print) */}
        <div className="px-4 py-3 bg-[#0e101d] border-b border-[#292d4a] flex flex-wrap items-center gap-3 print:hidden text-xs">
          {/* Day Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold">Day:</span>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-2.5 py-1.5 text-xs text-white"
            >
              <option value="All">All Days</option>
              {availableDays.map(([dayDate, count]) => (
                <option key={dayDate} value={dayDate}>
                  {formatDisplayDate(dayDate)} ({count} events)
                </option>
              ))}
            </select>
          </div>

          {/* Stage Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold">Stage:</span>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-2.5 py-1.5 text-xs text-white"
            >
              <option value="All">All Stages</option>
              {stagesList.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl px-2.5 py-1.5 text-xs text-white"
            >
              <option value="All">All Categories</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-slate-400 font-medium text-[11px]">
            Showing <strong className="text-white">{filteredComps.length}</strong> scheduled competitions
          </div>
        </div>

        {/* Printable Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200 print:bg-white print:p-0 print:overflow-visible">
          
          {/* Printable Page Wrapper - Exact Layout matching image.png */}
          <div
            ref={printAreaRef}
            className="printable-document-container max-w-[760px] mx-auto w-full bg-white text-slate-900 shadow-2xl rounded-sm p-8 sm:p-12 border border-slate-300 print:shadow-none print:border-none print:p-8 print:max-w-none print:w-full min-h-[950px] flex flex-col justify-between"
            style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
          >
            {scheduleByDay.length === 0 ? (
              <div className="py-20 text-center text-slate-500">
                <Calendar className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="font-bold text-slate-800 text-base">No scheduled competitions found.</p>
                <p className="text-xs text-slate-500 mt-1">Please schedule competitions or adjust filters above.</p>
              </div>
            ) : (
              scheduleByDay.map((dayGroup, dayIdx) => (
                <div key={dayGroup.dayDate} className={`flex-1 flex flex-col justify-between ${dayIdx > 0 ? 'print:break-before-page pt-10 print:pt-0' : ''}`}>
                  
                  {/* Top Header & Schedule Content */}
                  <div>
                    {/* 1. Header: Logo/Title + Horizontal Gradient Line + Date */}
                    <EnigmaPrintHeader
                      title="ENIGMA ‘26"
                      rightElement={
                        <span className="text-sm font-bold text-slate-900 tracking-wide">
                          {dayGroup.formattedDate}
                        </span>
                      }
                    />

                    {/* 2. Main Title: SCHEDULE */}
                    <div className="text-center mb-7">
                      <h1 className="text-2xl sm:text-3xl font-black text-[#9e2a7b] uppercase tracking-wider inline-block underline underline-offset-4 decoration-[#9e2a7b] decoration-[3px]">
                        SCHEDULE
                      </h1>
                    </div>

                    {/* 3. Stage Sections */}
                    <div className="space-y-6">
                      {dayGroup.stages.map((stageGroup) => (
                        <div key={stageGroup.stageName} className="space-y-2.5">
                          {/* Stage Banner */}
                          <div className="bg-[#9e2a7b] text-white py-1 px-4 text-center rounded-[2px] shadow-sm">
                            <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-white">
                              {stageGroup.stageName}
                            </h2>
                          </div>

                          {/* 3 Columns: Time | Competition Name | Category */}
                          <div className="px-6 sm:px-14 py-1.5 space-y-2">
                            {stageGroup.competitions.map((comp) => {
                              const { timeSlot } = normalizeScheduleString(comp.scheduleTime);
                              const cleanTime = timeSlot || '3.00 to 3.30';

                              return (
                                <div
                                  key={comp.id}
                                  className="grid grid-cols-[140px_1fr_100px] sm:grid-cols-[170px_1fr_130px] items-center text-xs sm:text-[13.5px] py-0.5 font-bold text-slate-900"
                                >
                                  {/* Column 1: Time (e.g. 3.00 to 3.30) */}
                                  <div className="font-bold text-slate-900 whitespace-nowrap">
                                    {cleanTime}
                                  </div>

                                  {/* Column 2: Competition Name (e.g. Story English) */}
                                  <div className="font-bold text-slate-950 pr-3">
                                    <span>{comp.name}</span>
                                  </div>

                                  {/* Column 3: Category (e.g. Senior / Junior) */}
                                  <div className="font-bold text-slate-900">
                                    {comp.category || 'Senior'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. Bottom Footer: Gradient Line + MIASIN ZOR ● Festival collective + Page Number */}
                  <EnigmaPrintFooter pageNumber={dayIdx + 1} />

                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
