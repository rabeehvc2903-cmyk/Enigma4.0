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
  Scale, 
  Sparkles, 
  ArrowDownToLine, 
  RefreshCw,
  Award
} from 'lucide-react';
import { Competition, Registration } from '../types';
import { festStore } from '../lib/store';

interface JudgeMarksJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitions: Competition[];
  registrations: Registration[];
  onSuccess: (message: string) => void;
  defaultTab?: 'download' | 'upload';
  selectedCompFilter?: string;
}

export const JudgeMarksJsonModal: React.FC<JudgeMarksJsonModalProps> = ({
  isOpen,
  onClose,
  competitions,
  registrations,
  onSuccess,
  defaultTab = 'download',
  selectedCompFilter = 'All'
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'upload'>(defaultTab);
  const [compFilter, setCompFilter] = useState<string>(selectedCompFilter);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedMarks, setParsedMarks] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setCompFilter(selectedCompFilter || 'All');
      setSelectedFile(null);
      setJsonText('');
      setParseError(null);
      setParsedMarks([]);
      setIsCopied(false);
    }
  }, [isOpen, defaultTab, selectedCompFilter]);

  // Candidates for selected competition filter
  const targetCandidates = useMemo(() => {
    if (compFilter === 'All') return registrations;
    return registrations.filter(r => r.competitionId === compFilter);
  }, [registrations, compFilter]);

  const scoredCandidates = useMemo(() => {
    return targetCandidates.filter(r => r.mark !== undefined && r.mark !== null && String(r.mark).trim() !== '');
  }, [targetCandidates]);

  // Handle file selection
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
      setParsedMarks([]);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      let list: any[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (Array.isArray(parsed.judgeMarks)) {
        list = parsed.judgeMarks;
      } else if (Array.isArray(parsed.marks)) {
        list = parsed.marks;
      } else if (Array.isArray(parsed.data)) {
        list = parsed.data;
      } else {
        setParseError('JSON must be an array of judge marks or an object containing a "judgeMarks" array.');
        setParsedMarks([]);
        return;
      }

      if (list.length === 0) {
        setParseError('The JSON contains an empty list of judge marks.');
        setParsedMarks([]);
        return;
      }

      const validItems = list.filter(item => 
        item && typeof item === 'object' && 
        (item.registrationId || item.participantUserId || item.chestNo || item.participantName || item.codeLetter)
      );

      if (validItems.length === 0) {
        setParseError('None of the items in the JSON contain participant identification or chest numbers.');
        setParsedMarks([]);
        return;
      }

      setParsedMarks(validItems);
      if (validItems.length < list.length) {
        setParseError(`Warning: ${list.length - validItems.length} items were ignored due to missing participant details.`);
      }
    } catch (err: any) {
      setParseError(`Invalid JSON Syntax: ${err.message || 'Check commas, brackets, and quotes'}`);
      setParsedMarks([]);
    }
  };

  // Generate downloadable sample template
  const handleDownloadSample = () => {
    const sampleComp = competitions[0];
    const sample = {
      type: "judge_marks_template",
      version: "1.0",
      description: "Sample template for importing judge scores & evaluation marks",
      judgeMarks: [
        {
          competitionId: sampleComp?.id || "comp-1",
          competitionName: sampleComp?.name || "English Elocution",
          participantName: "Ahmad Bin Ziyad",
          participantUserId: "CH-101",
          groupName: "Team Ruby",
          codeLetter: "A",
          mark: "88.5",
          judgeRank: 1,
          isReported: true
        },
        {
          competitionId: sampleComp?.id || "comp-1",
          competitionName: sampleComp?.name || "English Elocution",
          participantName: "Bilal Hassan",
          participantUserId: "CH-102",
          groupName: "Team Sapphire",
          codeLetter: "B",
          mark: "84.0",
          judgeRank: 2,
          isReported: true
        },
        {
          competitionId: sampleComp?.id || "comp-1",
          competitionName: sampleComp?.name || "English Elocution",
          participantName: "Zaid Omar",
          participantUserId: "CH-103",
          groupName: "Team Emerald",
          codeLetter: "C",
          mark: "79.0",
          judgeRank: 3,
          isReported: true
        }
      ]
    };

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `judge_marks_sample_template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download exported judge marks JSON
  const handleDownloadJson = () => {
    const jsonStr = festStore.exportJudgeMarksJSON(compFilter);
    const dateStr = new Date().toISOString().split('T')[0];
    const filterSuffix = compFilter !== 'All' ? `_${compFilter}` : '_all';
    const filename = `judge_marks${filterSuffix}_${dateStr}.json`;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onSuccess(`Downloaded judge marks for ${targetCandidates.length} candidate(s) as JSON!`);
  };

  // Copy judge marks JSON to clipboard
  const handleCopyJson = () => {
    const jsonStr = festStore.exportJudgeMarksJSON(compFilter);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  // Execute Import
  const handleExecuteImport = () => {
    if (!jsonText.trim() || parsedMarks.length === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      const res = festStore.importJudgeMarksJSON(jsonText, importMode);
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
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Judge Marks & Valuation JSON</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  {scoredCandidates.length} / {targetCandidates.length} Scored
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Export scored evaluation sheets or upload judge scores and rankings via JSON
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
                ? 'border-emerald-500 text-emerald-300 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download / Export JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'border-teal-500 text-teal-300 bg-teal-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload / Import JSON</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">

          {/* TAB 1: DOWNLOAD */}
          {activeTab === 'download' && (
            <div className="space-y-5">
              
              {/* Competition Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Filter by Competition</label>
                <select
                  value={compFilter}
                  onChange={(e) => setCompFilter(e.target.value)}
                  className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Competitions ({registrations.length} candidates)</option>
                  {competitions.map(c => {
                    const count = registrations.filter(r => r.competitionId === c.id).length;
                    const scored = registrations.filter(r => r.competitionId === c.id && r.mark).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({scored}/{count} scored)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Candidates</span>
                  <span className="text-xl font-black text-white mt-1 block">
                    {targetCandidates.length}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Scored by Judge</span>
                  <span className="text-xl font-black text-emerald-400 mt-1 block">
                    {scoredCandidates.length}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Unscored / Pending</span>
                  <span className="text-xl font-black text-amber-400 mt-1 block">
                    {targetCandidates.length - scoredCandidates.length}
                  </span>
                </div>
              </div>

              {/* Preview Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>JSON Payload Preview</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="text-[11px] font-bold text-emerald-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied!' : 'Copy to Clipboard'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-[#0f111a] rounded-2xl border border-[#292d4a] text-[11px] text-slate-300 font-mono overflow-x-auto max-h-48 leading-relaxed custom-scrollbar">
                  {festStore.exportJudgeMarksJSON(compFilter)}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  disabled={targetCandidates.length === 0}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Judge Marks JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="py-3 px-4 bg-[#181b30] hover:bg-[#1f233d] text-slate-300 hover:text-white border border-[#292d4a] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
                  <span>Sample Template</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD */}
          {activeTab === 'upload' && (
            <div className="space-y-5">
              
              {/* Mode Selection */}
              <div className="p-4 rounded-2xl bg-[#181b30] border border-[#292d4a] space-y-2.5">
                <span className="text-xs font-bold text-white block">Import Mode:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importMode === 'merge'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50'
                        : 'bg-[#121422] border-[#292d4a] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-bold block flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Merge & Update Marks
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Updates marks for matched candidates; retains all existing marks for others.
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
                      Replace Competition Marks
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Clears existing marks for included competitions before applying imported marks.
                    </span>
                  </button>
                </div>
              </div>

              {/* File Dropzone */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Choose JSON File</label>
                <label className="border-2 border-dashed border-[#292d4a] hover:border-emerald-500/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 bg-[#181b30]/50 hover:bg-[#181b30] transition-colors cursor-pointer">
                  <FileJson className="w-8 h-8 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">
                    {selectedFile ? selectedFile.name : 'Click to select or drop judge marks .json file'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Supports matching by Registration ID, Chest No, Code Letter, or Participant Name
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
                  {parsedMarks.length > 0 && (
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{parsedMarks.length} candidate mark(s) parsed</span>
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
                  placeholder='Paste JSON here, e.g. [{"chestNo": "CH-101", "mark": "88", "judgeRank": 1}, ...]'
                  className="w-full bg-[#0f111a] border border-[#292d4a] rounded-2xl p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 custom-scrollbar"
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
                  disabled={parsedMarks.length === 0 || isProcessing}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing Marks...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Import {parsedMarks.length > 0 ? `${parsedMarks.length} Marks` : 'JSON'}</span>
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
