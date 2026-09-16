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
  Info,
  Layers,
  Sparkles,
  ArrowDownToLine,
  RefreshCw
} from 'lucide-react';
import { Competition } from '../types';
import { festStore } from '../lib/store';

interface CompetitionJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitions: Competition[];
  onSuccess: (message: string) => void;
  defaultTab?: 'download' | 'upload';
}

export const CompetitionJsonModal: React.FC<CompetitionJsonModalProps> = ({
  isOpen,
  onClose,
  competitions,
  onSuccess,
  defaultTab = 'download'
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'upload'>(defaultTab);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedComps, setParsedComps] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setSelectedFile(null);
      setJsonText('');
      setParseError(null);
      setParsedComps([]);
      setIsCopied(false);
    }
  }, [isOpen, defaultTab]);

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
      setParsedComps([]);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      let list: any[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (Array.isArray(parsed.competitions)) {
        list = parsed.competitions;
      } else if (Array.isArray(parsed.data)) {
        list = parsed.data;
      } else {
        setParseError('JSON format must be an array of competitions or an object with a "competitions" array.');
        setParsedComps([]);
        return;
      }

      if (list.length === 0) {
        setParseError('The JSON contains an empty list of competitions.');
        setParsedComps([]);
        return;
      }

      const validItems = list.filter(item => item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim());
      if (validItems.length === 0) {
        setParseError('None of the items in the JSON have a valid "name" field.');
        setParsedComps([]);
        return;
      }

      setParsedComps(validItems);
      if (validItems.length < list.length) {
        setParseError(`Warning: ${list.length - validItems.length} items were ignored because they lacked a valid "name".`);
      }
    } catch (err: any) {
      setParseError(`Invalid JSON Syntax: ${err.message || 'Check commas, brackets, and quotes'}`);
      setParsedComps([]);
    }
  };

  // Generate downloadable sample template
  const handleDownloadSample = () => {
    const sample = {
      type: "competitions_template",
      version: "1.0",
      competitions: [
        {
          name: "Elocution English",
          category: "Senior",
          type: "single",
          isStage: true,
          venue: "Stage 1",
          scheduleTime: "Day 1, 10:00 AM",
          timeSpan: 30,
          maxEntriesPerGroup: 2,
          points1st: 10,
          points2nd: 7,
          points3rd: 5,
          description: "English speech competition on festival themes."
        },
        {
          name: "Group Song (Duff)",
          category: "General",
          type: "group",
          isStage: true,
          venue: "Main Auditorium",
          scheduleTime: "Day 2, 02:30 PM",
          timeSpan: 45,
          teamSize: 6,
          maxEntriesPerGroup: 1,
          points1st: 15,
          points2nd: 10,
          points3rd: 7,
          description: "Traditional group duff performance."
        },
        {
          name: "Pencil Drawing",
          category: "Junior",
          type: "single",
          isStage: false,
          venue: "Art Hall B",
          scheduleTime: "Day 1, 11:30 AM",
          timeSpan: 60,
          maxEntriesPerGroup: 2,
          points1st: 10,
          points2nd: 7,
          points3rd: 5,
          description: "Freehand drawing with graphite pencils."
        }
      ]
    };

    const str = JSON.stringify(sample, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'competitions_sample_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Trigger Download
  const handleDownloadLiveJson = () => {
    const jsonStr = festStore.exportCompetitionsJSON(competitions);
    const dateStr = new Date().toISOString().split('T')[0];
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fest_competitions_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onSuccess(`Successfully downloaded ${competitions.length} competitions as JSON!`);
    onClose();
  };

  // Copy to clipboard
  const handleCopyJson = async () => {
    try {
      const jsonStr = festStore.exportCompetitionsJSON(competitions);
      await navigator.clipboard.writeText(jsonStr);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch {
      // Fallback
      setIsCopied(false);
    }
  };

  // Execute Import
  const handleExecuteImport = () => {
    if (!jsonText.trim() || parsedComps.length === 0) return;
    setIsProcessing(true);

    try {
      const result = festStore.importCompetitionsJSON(jsonText, importMode);
      setIsProcessing(false);

      if (result.success) {
        onSuccess(result.message);
        onClose();
      } else {
        setParseError(result.message);
      }
    } catch (err: any) {
      setIsProcessing(false);
      setParseError(`Import failed: ${err.message}`);
    }
  };

  // Category counts breakdown for export view
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    competitions.forEach(c => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });
    return counts;
  }, [competitions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#151728] border border-[#292d4a] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#292d4a] bg-[#121424]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-2xl border border-purple-500/30">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Competitions JSON Manager</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {competitions.length} Items
                </span>
              </h2>
              <p className="text-xs text-slate-400">Download, backup, or upload festival competitions via structured JSON</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-[#1a1d33] hover:bg-[#232742] rounded-xl border border-[#292d4a] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS SWITCHER */}
        <div className="flex items-center border-b border-[#292d4a] bg-[#16192e] px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('download')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'download'
                ? 'border-purple-500 text-purple-300 bg-[#1b1e38]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#181b32]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download (Export) JSON</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-emerald-300 bg-[#1b1e38]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#181b32]'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload (Import) JSON</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: DOWNLOAD / EXPORT */}
          {activeTab === 'download' && (
            <div className="space-y-5">
              <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Dataset Summary</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-500/30">
                    {competitions.length} Competitions Total
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-[#121424] p-2.5 rounded-xl border border-[#292d4a]/70">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">On-Stage</span>
                    <span className="text-sm font-extrabold text-white font-mono">
                      {competitions.filter(c => c.isStage).length}
                    </span>
                  </div>
                  <div className="bg-[#121424] p-2.5 rounded-xl border border-[#292d4a]/70">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Off-Stage</span>
                    <span className="text-sm font-extrabold text-white font-mono">
                      {competitions.filter(c => !c.isStage).length}
                    </span>
                  </div>
                  <div className="bg-[#121424] p-2.5 rounded-xl border border-[#292d4a]/70">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Single</span>
                    <span className="text-sm font-extrabold text-white font-mono">
                      {competitions.filter(c => c.type === 'single').length}
                    </span>
                  </div>
                  <div className="bg-[#121424] p-2.5 rounded-xl border border-[#292d4a]/70">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Group</span>
                    <span className="text-sm font-extrabold text-white font-mono">
                      {competitions.filter(c => c.type === 'group').length}
                    </span>
                  </div>
                </div>

                {/* Categories breakdown pills */}
                <div className="pt-2 border-t border-[#292d4a]/70 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] font-bold text-slate-400 mr-1">Categories:</span>
                  {Object.entries(categoryStats).map(([cat, count]) => (
                    <span key={cat} className="text-[11px] px-2 py-0.5 rounded-md bg-[#121424] border border-[#292d4a] text-slate-300 font-medium">
                      {cat}: <strong className="text-purple-300">{count}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadLiveJson}
                  className="py-3.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>Download Competitions JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="py-3.5 px-4 bg-[#181b30] hover:bg-[#202442] text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#292d4a] transition-all cursor-pointer active:scale-95"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Copy JSON Payload</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sample Template Section */}
              <div className="p-3.5 bg-[#121424] border border-[#292d4a] rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <FileCode className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Looking for sample schema before creating your own?</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="px-3 py-1.5 text-xs font-bold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg shrink-0 transition-all cursor-pointer"
                >
                  Get Sample JSON
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD / IMPORT */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* File upload drag/drop dropzone */}
              <div>
                <label className="border-2 border-dashed border-[#292d4a] hover:border-emerald-500/50 bg-[#121424] hover:bg-[#14172c] rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center gap-2 group block">
                  <Upload className="w-7 h-7 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                    {selectedFile ? selectedFile.name : 'Click to Browse or Drag Competitions .json File'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Accepts JSON array or {`{ "competitions": [...] }`}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Or paste JSON text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Or Paste JSON Data Directly:</label>
                  {jsonText && (
                    <button
                      type="button"
                      onClick={() => {
                        setJsonText('');
                        setSelectedFile(null);
                        setParsedComps([]);
                        setParseError(null);
                      }}
                      className="text-[11px] text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      Clear text
                    </button>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    validateJson(e.target.value);
                  }}
                  placeholder='[\n  { "name": "Elocution English", "category": "Senior", "venue": "Stage 1" }\n]'
                  className="w-full bg-[#121424] border border-[#292d4a] focus:border-emerald-500 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none placeholder-slate-600"
                />
              </div>

              {/* Live Status and Validation Feedback */}
              {parseError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span className="leading-relaxed">{parseError}</span>
                </div>
              )}

              {parsedComps.length > 0 && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Detected {parsedComps.length} valid competitions
                    </span>
                    <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      Ready to import
                    </span>
                  </div>

                  {/* Preview first 3 competitions */}
                  <div className="max-h-28 overflow-y-auto space-y-1 pt-1 text-[11px] font-mono">
                    {parsedComps.slice(0, 4).map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-[#121424]/80 px-2.5 py-1 rounded border border-[#292d4a]">
                        <span className="text-white font-medium truncate max-w-[200px] sm:max-w-xs">{c.name}</span>
                        <div className="flex items-center gap-2 text-slate-400 shrink-0">
                          <span className="text-purple-300">{c.category || 'Senior'}</span>
                          <span>•</span>
                          <span>{c.venue || 'Stage 1'}</span>
                        </div>
                      </div>
                    ))}
                    {parsedComps.length > 4 && (
                      <div className="text-[10px] text-slate-400 text-center pt-0.5 italic">
                        + {parsedComps.length - 4} more competitions...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Import Mode Radio Selectors */}
              <div className="p-3.5 bg-[#181b30] border border-[#292d4a] rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-300 block">Import Mode:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    onClick={() => setImportMode('merge')}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                      importMode === 'merge'
                        ? 'bg-purple-600/15 border-purple-500 text-white'
                        : 'bg-[#121424] border-[#292d4a] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="compImportMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 text-purple-600"
                    />
                    <div>
                      <span className="font-bold block text-purple-300">Merge & Update (Recommended)</span>
                      <span className="text-[11px] text-slate-400 leading-tight block mt-0.5">
                        Updates existing events with matching ID/name and adds new events without deleting others.
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setImportMode('replace')}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                      importMode === 'replace'
                        ? 'bg-rose-600/15 border-rose-500 text-white'
                        : 'bg-[#121424] border-[#292d4a] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="compImportMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-rose-600"
                    />
                    <div>
                      <span className="font-bold block text-rose-300">Replace All</span>
                      <span className="text-[11px] text-slate-400 leading-tight block mt-0.5">
                        Erases all existing competitions and loads only the competitions from this JSON file.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={parsedComps.length === 0 || isProcessing}
                  onClick={handleExecuteImport}
                  className={`flex-1 py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                    parsedComps.length > 0 && !isProcessing
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-600/30 active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing Competitions...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Import {parsedComps.length} Competitions ({importMode === 'merge' ? 'Merge' : 'Replace'})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-[#121424] border-t border-[#292d4a] flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-purple-400" />
            <span>Instant sync across all devices and local storage</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-[#1a1d33] hover:bg-[#242845] rounded-lg border border-[#292d4a] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
