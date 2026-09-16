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
  Trophy,
  Sparkles,
  ArrowDownToLine,
  RefreshCw,
  Award
} from 'lucide-react';
import { Result, Competition } from '../types';
import { festStore } from '../lib/store';

interface ResultJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: Result[];
  competitions: Competition[];
  onSuccess: (message: string) => void;
  defaultTab?: 'download' | 'upload';
  selectedCompFilter?: string;
}

export const ResultJsonModal: React.FC<ResultJsonModalProps> = ({
  isOpen,
  onClose,
  results,
  competitions,
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
  const [parsedResults, setParsedResults] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setCompFilter(selectedCompFilter || 'All');
      setSelectedFile(null);
      setJsonText('');
      setParseError(null);
      setParsedResults([]);
      setIsCopied(false);
    }
  }, [isOpen, defaultTab, selectedCompFilter]);

  // Filter results for download
  const filteredResults = useMemo(() => {
    if (compFilter === 'All') return results;
    return results.filter(r => r.competitionId === compFilter);
  }, [results, compFilter]);

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
      setParsedResults([]);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      let list: any[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (Array.isArray(parsed.results)) {
        list = parsed.results;
      } else if (Array.isArray(parsed.festivalResults)) {
        list = parsed.festivalResults;
      } else if (Array.isArray(parsed.data)) {
        list = parsed.data;
      } else {
        setParseError('JSON must be an array of results or an object containing a "results" array.');
        setParsedResults([]);
        return;
      }

      if (list.length === 0) {
        setParseError('The JSON contains an empty list of results.');
        setParsedResults([]);
        return;
      }

      const validItems = list.filter(item => 
        item && typeof item === 'object' && 
        (item.competitionId || item.competitionName) &&
        (item.firstPlaceParticipantName || item.firstPlaceRegId || (item.firstPlaceWinners && item.firstPlaceWinners.length > 0))
      );

      if (validItems.length === 0) {
        setParseError('None of the items in the JSON contain valid competition and winner details.');
        setParsedResults([]);
        return;
      }

      setParsedResults(validItems);
      if (validItems.length < list.length) {
        setParseError(`Warning: ${list.length - validItems.length} items were ignored due to missing competition name or winner.`);
      }
    } catch (err: any) {
      setParseError(`Invalid JSON Syntax: ${err.message || 'Check commas, brackets, and quotes'}`);
      setParsedResults([]);
    }
  };

  // Generate downloadable sample template
  const handleDownloadSample = () => {
    const sampleComp = competitions[0];
    const sample = {
      type: "festival_results_template",
      version: "1.0",
      description: "Sample template for importing competition winners & results",
      results: [
        {
          competitionId: sampleComp?.id || "comp-sample-1",
          competitionName: sampleComp?.name || "English Elocution",
          firstPlaceParticipantName: "Ahmad Bin Ziyad",
          firstPlaceGroupId: "grp-1",
          firstPlaceGroupName: "Team Ruby",
          firstPlaceCodeLetter: "A",
          secondPlaceParticipantName: "Bilal Hassan",
          secondPlaceGroupId: "grp-2",
          secondPlaceGroupName: "Team Sapphire",
          secondPlaceCodeLetter: "B",
          thirdPlaceParticipantName: "Zaid Omar",
          thirdPlaceGroupId: "grp-3",
          thirdPlaceGroupName: "Team Emerald",
          thirdPlaceCodeLetter: "C",
          publishedAt: new Date().toISOString()
        }
      ]
    };

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `festival_results_sample_template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download exported results JSON
  const handleDownloadJson = () => {
    const jsonStr = festStore.exportResultsJSON(filteredResults);
    const dateStr = new Date().toISOString().split('T')[0];
    const filterSuffix = compFilter !== 'All' ? `_${compFilter}` : '_all';
    const filename = `festival_results${filterSuffix}_${dateStr}.json`;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onSuccess(`Downloaded ${filteredResults.length} result(s) as JSON!`);
  };

  // Copy results JSON to clipboard
  const handleCopyJson = () => {
    const jsonStr = festStore.exportResultsJSON(filteredResults);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  // Execute Import
  const handleExecuteImport = () => {
    if (!jsonText.trim() || parsedResults.length === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      const res = festStore.importResultsJSON(jsonText, importMode);
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
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Festival Results JSON</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  {results.length} Published
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Download published results or import winners data in bulk via JSON
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
                ? 'border-amber-500 text-amber-300 bg-amber-500/5'
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
                ? 'border-emerald-500 text-emerald-300 bg-emerald-500/5'
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
                  className="w-full bg-[#181b30] border border-[#292d4a] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="All">All Competitions ({results.length} results)</option>
                  {competitions
                    .filter(c => results.some(r => r.competitionId === c.id))
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.category || 'General'})
                      </option>
                    ))}
                </select>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Selected Results</span>
                  <span className="text-xl font-black text-amber-400 mt-1 block">
                    {filteredResults.length}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">1st Place Winners</span>
                  <span className="text-xl font-black text-yellow-400 mt-1 block">
                    {filteredResults.filter(r => r.firstPlaceParticipantName).length}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#181b30] border border-[#292d4a] text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Multiple / Tied</span>
                  <span className="text-xl font-black text-emerald-400 mt-1 block">
                    {filteredResults.filter(r => (r.firstPlaceWinners?.length || 0) > 1 || (r.secondPlaceWinners?.length || 0) > 1).length}
                  </span>
                </div>
              </div>

              {/* Preview Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>JSON Payload Preview</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="text-[11px] font-bold text-amber-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied!' : 'Copy to Clipboard'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-[#0f111a] rounded-2xl border border-[#292d4a] text-[11px] text-slate-300 font-mono overflow-x-auto max-h-48 leading-relaxed custom-scrollbar">
                  {festStore.exportResultsJSON(filteredResults.slice(0, 3))}
                  {filteredResults.length > 3 && `\n\n// ... and ${filteredResults.length - 3} more results`}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  disabled={filteredResults.length === 0}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Results JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="py-3 px-4 bg-[#181b30] hover:bg-[#1f233d] text-slate-300 hover:text-white border border-[#292d4a] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ArrowDownToLine className="w-4 h-4 text-amber-400" />
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
                      Merge & Update
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Updates winners for matched competitions; keeps other existing results intact.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importMode === 'replace'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-300 ring-1 ring-rose-500/50'
                        : 'bg-[#121422] border-[#292d4a] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-bold block flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Replace All Results
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Clears current results and sets only the imported results. Recalculates all scores.
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
                    {selectedFile ? selectedFile.name : 'Click to select or drop .json file'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Supports JSON files exported from Festival Manager or conforming schema
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
                  {parsedResults.length > 0 && (
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{parsedResults.length} valid result(s) parsed</span>
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
                  placeholder='Paste JSON here, e.g. [{"competitionName": "English Elocution", "firstPlaceParticipantName": "Ahmad", "firstPlaceGroupName": "Team Ruby"}, ...]'
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
                  disabled={parsedResults.length === 0 || isProcessing}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Import {parsedResults.length > 0 ? `${parsedResults.length} Results` : 'JSON'}</span>
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
