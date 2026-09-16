import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  FileCode, 
  FileSpreadsheet, 
  BarChart3, 
  Sparkles, 
  ArrowDownToLine, 
  RefreshCw,
  UserCheck,
  Building2,
  Calendar,
  Info
} from 'lucide-react';
import { Competition, Registration, UserProfile } from '../types';
import { festStore } from '../lib/store';

interface ReportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitions: Competition[];
  registrations: Registration[];
  profiles?: UserProfile[];
  onSuccess: (message: string) => void;
  defaultTab?: 'download' | 'upload';
  selectedCompFilter?: string;
}

export const ReportJsonModal: React.FC<ReportJsonModalProps> = ({
  isOpen,
  onClose,
  competitions,
  registrations,
  profiles,
  onSuccess,
  defaultTab = 'download',
  selectedCompFilter = 'All'
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'upload'>(defaultTab);
  const [reportType, setReportType] = useState<'attendance' | 'master'>('attendance');
  const [compFilter, setCompFilter] = useState<string>(selectedCompFilter);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setCompFilter(selectedCompFilter || 'All');
      setSelectedFile(null);
      setJsonText('');
      setParseError(null);
      setParsedItems([]);
      setIsCopied(false);
    }
  }, [isOpen, defaultTab, selectedCompFilter]);

  // Calculations for attendance report
  const targetRegs = useMemo(() => {
    if (compFilter === 'All') return registrations;
    return registrations.filter(r => r.competitionId === compFilter);
  }, [registrations, compFilter]);

  const reportedCount = useMemo(() => {
    return targetRegs.filter(r => r.isReported).length;
  }, [targetRegs]);

  const absentCount = targetRegs.length - reportedCount;
  const attendanceRate = targetRegs.length > 0 ? `${((reportedCount / targetRegs.length) * 100).toFixed(1)}%` : '0%';

  // Handle file selection for upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      validateJson(content);
    };
    reader.readAsText(file);
  };

  // Validate JSON string
  const validateJson = (text: string) => {
    setParseError(null);
    if (!text.trim()) {
      setParsedItems([]);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      let list: any[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (Array.isArray(parsed.attendance)) {
        list = parsed.attendance;
      } else if (Array.isArray(parsed.report)) {
        list = parsed.report;
      } else if (Array.isArray(parsed.data)) {
        list = parsed.data;
      } else {
        setParseError('JSON must be an array or an object containing an "attendance" array.');
        setParsedItems([]);
        return;
      }

      if (list.length === 0) {
        setParseError('The JSON contains an empty list.');
        setParsedItems([]);
        return;
      }

      const validItems = list.filter(item => 
        item && typeof item === 'object' && 
        (item.registrationId || item.participantUserId || item.chestNo || item.participantName)
      );

      if (validItems.length === 0) {
        setParseError('None of the items in the JSON contain participant identification or chest numbers.');
        setParsedItems([]);
        return;
      }

      setParsedItems(validItems);
      if (validItems.length < list.length) {
        setParseError(`Warning: ${list.length - validItems.length} items were ignored due to missing participant details.`);
      }
    } catch (err: any) {
      setParseError(`Invalid JSON Syntax: ${err.message || 'Check commas, brackets, and quotes'}`);
      setParsedItems([]);
    }
  };

  // Generate downloadable sample template for attendance report
  const handleDownloadSample = () => {
    const sampleComp = competitions[0];
    const sample = {
      type: "attendance_report_template",
      version: "1.0",
      description: "Sample template for updating candidate reporting status and code letters",
      attendance: [
        {
          competitionId: sampleComp?.id || "comp-1",
          competitionName: sampleComp?.name || "English Elocution",
          participantName: "Ahmad Bin Ziyad",
          participantUserId: "CH-101",
          isReported: true,
          codeLetter: "A"
        },
        {
          competitionId: sampleComp?.id || "comp-1",
          competitionName: sampleComp?.name || "English Elocution",
          participantName: "Bilal Hassan",
          participantUserId: "CH-102",
          isReported: true,
          codeLetter: "B"
        },
        {
          competitionId: sampleComp?.id || "comp-1",
          competitionName: sampleComp?.name || "English Elocution",
          participantName: "Zaid Omar",
          participantUserId: "CH-103",
          isReported: false,
          codeLetter: ""
        }
      ]
    };

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_sample_template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download exported JSON
  const handleDownloadJson = () => {
    const jsonStr = reportType === 'attendance'
      ? festStore.exportAttendanceReportJSON(compFilter)
      : festStore.exportFestivalReportJSON();

    const dateStr = new Date().toISOString().split('T')[0];
    const prefix = reportType === 'attendance' 
      ? `attendance_report${compFilter !== 'All' ? `_${compFilter}` : '_all'}` 
      : `festival_master_report`;
    const filename = `${prefix}_${dateStr}.json`;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onSuccess(`Downloaded ${reportType === 'attendance' ? 'Attendance' : 'Festival Master'} Report as JSON!`);
  };

  // Copy JSON to clipboard
  const handleCopyJson = () => {
    const jsonStr = reportType === 'attendance'
      ? festStore.exportAttendanceReportJSON(compFilter)
      : festStore.exportFestivalReportJSON();

    navigator.clipboard.writeText(jsonStr).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  // Execute Attendance Report Import
  const handleExecuteImport = () => {
    if (!jsonText.trim() || parsedItems.length === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      const res = festStore.importAttendanceReportJSON(jsonText, importMode);
      setIsProcessing(false);

      if (res.success) {
        onSuccess(res.message);
        onClose();
      } else {
        setParseError(res.message);
      }
    }, 150);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#151728] border border-[#292d4a] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#292d4a] flex items-center justify-between bg-[#121422]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Festival & Attendance Reports JSON</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Download analytics & attendance reports or upload attendance check-in data via JSON
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1f233d] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#292d4a] bg-[#10121d] px-6">
          <button
            type="button"
            onClick={() => setActiveTab('download')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'download'
                ? 'border-blue-500 text-blue-300 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download Report JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Import Attendance JSON</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">

          {/* TAB 1: DOWNLOAD */}
          {activeTab === 'download' && (
            <div className="space-y-5">
              
              {/* Choose Report Scope */}
              <div className="p-4 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-2.5">
                <span className="text-xs font-bold text-white block">Select Report Format:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReportType('attendance')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      reportType === 'attendance'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                        : 'bg-[#121422] border-[#292d4a] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-bold block flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      Attendance & Reporting JSON
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Candidate check-ins, reporting flags, chest numbers, and code letters.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportType('master')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      reportType === 'master'
                        ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/50'
                        : 'bg-[#121422] border-[#292d4a] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-bold block flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                      Festival Master Report JSON
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Comprehensive festival stats, group leaderboards, and published results.
                    </span>
                  </button>
                </div>
              </div>

              {/* Competition Filter (only for Attendance) */}
              {reportType === 'attendance' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Filter by Competition</label>
                  <select
                    value={compFilter}
                    onChange={(e) => setCompFilter(e.target.value)}
                    className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="All">All Competitions ({registrations.length} candidates)</option>
                    {competitions.map(c => {
                      const count = registrations.filter(r => r.competitionId === c.id).length;
                      const reported = registrations.filter(r => r.competitionId === c.id && r.isReported).length;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({reported}/{count} reported)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Statistics Grid */}
              {reportType === 'attendance' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Candidates</span>
                    <span className="text-lg font-black text-white mt-1 block">{targetRegs.length}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Reported</span>
                    <span className="text-lg font-black text-emerald-400 mt-1 block">{reportedCount}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Absent</span>
                    <span className="text-lg font-black text-rose-400 mt-1 block">{absentCount}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Attendance Rate</span>
                    <span className="text-lg font-black text-blue-400 mt-1 block">{attendanceRate}</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Competitions</span>
                    <span className="text-lg font-black text-white mt-1 block">{competitions.length}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Participants</span>
                    <span className="text-lg font-black text-indigo-400 mt-1 block">{profiles.length}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Entries</span>
                    <span className="text-lg font-black text-emerald-400 mt-1 block">{registrations.length}</span>
                  </div>
                </div>
              )}

              {/* Preview Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                    <span>JSON Payload Preview</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="text-[11px] font-bold text-blue-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied!' : 'Copy to Clipboard'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-[#0f111a] rounded-2xl border border-[#292d4a] text-[11px] text-slate-300 font-mono overflow-x-auto max-h-44 leading-relaxed custom-scrollbar">
                  {reportType === 'attendance'
                    ? festStore.exportAttendanceReportJSON(compFilter)
                    : festStore.exportFestivalReportJSON().slice(0, 800) + '\n  ...\n}'}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {reportType === 'attendance' ? 'Attendance' : 'Festival'} Report JSON</span>
                </button>

                {reportType === 'attendance' && (
                  <button
                    type="button"
                    onClick={handleDownloadSample}
                    className="py-3 px-4 bg-[#181b30] hover:bg-[#1f233d] text-slate-300 hover:text-white border border-[#292d4a] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <ArrowDownToLine className="w-4 h-4 text-blue-400" />
                    <span>Sample Template</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD ATTENDANCE */}
          {activeTab === 'upload' && (
            <div className="space-y-5">
              
              {/* Explanation Note */}
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Upload attendance or check-in reporting data to update participant attendance flags (<code className="bg-blue-900/40 px-1 py-0.5 rounded text-white">isReported</code>) and assigned <code className="bg-blue-900/40 px-1 py-0.5 rounded text-white">codeLetter</code> in bulk.
                </span>
              </div>

              {/* Mode Selection */}
              <div className="p-4 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-2.5">
                <span className="text-xs font-bold text-white block">Import Mode:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importMode === 'merge'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                        : 'bg-[#121422] border-[#292d4a] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-bold block flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      Merge & Update
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Updates attendance for matched candidates without altering other participants.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importMode === 'replace'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-1 ring-amber-500/50'
                        : 'bg-[#121422] border-[#292d4a] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-bold block flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Strict Replace
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Applies all attendance updates from the file.
                    </span>
                  </button>
                </div>
              </div>

              {/* File Dropzone */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Choose Attendance JSON File</label>
                <label className="border-2 border-dashed border-[#292d4a] hover:border-blue-500/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 bg-[#181b30]/50 hover:bg-[#181b30] transition-colors cursor-pointer">
                  <FileJson className="w-8 h-8 text-blue-400" />
                  <span className="text-xs font-bold text-slate-200">
                    {selectedFile ? selectedFile.name : 'Click to select or drop attendance .json file'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Matches candidates by Registration ID, Chest No, or Participant Name
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Or Paste Raw JSON */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Or Paste JSON Data Directly</label>
                  {parsedItems.length > 0 && (
                    <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{parsedItems.length} attendance record(s) parsed</span>
                    </span>
                  )}
                </div>
                <textarea
                  rows={6}
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    validateJson(e.target.value);
                  }}
                  placeholder='Paste JSON here, e.g. [{"chestNo": "CH-101", "isReported": true, "codeLetter": "A"}, ...]'
                  className="w-full bg-[#0f111a] border border-[#292d4a] rounded-2xl p-3 text-xs text-white font-mono focus:outline-none focus:border-blue-500 custom-scrollbar"
                />
              </div>

              {/* Validation Feedback */}
              {parseError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{parseError}</span>
                </div>
              )}

              {/* Execute Import Button */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-[#292d4a] text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={parsedItems.length === 0 || isProcessing}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Updating Attendance...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Update {parsedItems.length > 0 ? `${parsedItems.length} Candidates` : 'Attendance'}</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
