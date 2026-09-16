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
  Users,
  Trophy,
  ArrowDownToLine,
  RefreshCw,
  Filter
} from 'lucide-react';
import { Registration, Group, Competition } from '../types';
import { festStore } from '../lib/store';

interface RegistrationJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  registrations: Registration[];
  groups: Group[];
  competitions: Competition[];
  onSuccess: (message: string) => void;
  defaultTab?: 'download' | 'upload';
  selectedGroupFilter?: string;
  selectedCompFilter?: string;
}

export const RegistrationJsonModal: React.FC<RegistrationJsonModalProps> = ({
  isOpen,
  onClose,
  registrations,
  groups,
  competitions,
  onSuccess,
  defaultTab = 'download',
  selectedGroupFilter = 'All',
  selectedCompFilter = 'All'
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'upload'>(defaultTab);
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>('all');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRegs, setParsedRegs] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Compute filtered registrations for export if filter is active
  const filteredList = useMemo(() => {
    return registrations.filter(r => {
      const matchGroup = selectedGroupFilter === 'All' || r.groupId === selectedGroupFilter;
      const matchComp = selectedCompFilter === 'All' || r.competitionId === selectedCompFilter;
      return matchGroup && matchComp;
    });
  }, [registrations, selectedGroupFilter, selectedCompFilter]);

  const exportList = exportScope === 'filtered' ? filteredList : registrations;

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setSelectedFile(null);
      setJsonText('');
      setParseError(null);
      setParsedRegs([]);
      setIsCopied(false);
      if (selectedGroupFilter !== 'All' || selectedCompFilter !== 'All') {
        setExportScope('filtered');
      } else {
        setExportScope('all');
      }
    }
  }, [isOpen, defaultTab, selectedGroupFilter, selectedCompFilter]);

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
      setParsedRegs([]);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      let list: any[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (Array.isArray(parsed.registrations)) {
        list = parsed.registrations;
      } else if (Array.isArray(parsed.data)) {
        list = parsed.data;
      } else {
        setParseError('JSON format must be an array of registrations or an object with a "registrations" array.');
        setParsedRegs([]);
        return;
      }

      if (list.length === 0) {
        setParseError('The JSON contains an empty list of registrations.');
        setParsedRegs([]);
        return;
      }

      const validItems = list.filter(item => item && typeof item === 'object' && (item.competitionId || item.competitionName) && (item.participantName || item.participantId || item.participantUserId));
      if (validItems.length === 0) {
        setParseError('None of the items contain valid competition and participant indicators (need competitionId/competitionName and participantName/participantId).');
        setParsedRegs([]);
        return;
      }

      setParsedRegs(validItems);
      if (validItems.length < list.length) {
        setParseError(`Warning: ${list.length - validItems.length} items were ignored because they lacked competition or participant details.`);
      }
    } catch (err: any) {
      setParseError(`Invalid JSON Syntax: ${err.message || 'Check commas, brackets, and quotes'}`);
      setParsedRegs([]);
    }
  };

  // Generate downloadable sample template
  const handleDownloadSample = () => {
    const sampleComp = competitions[0] || { id: "comp-sample-1", name: "Elocution English" };
    const sampleGroup = groups[0] || { id: "group-sample-1", name: "Team Ruby" };

    const sample = {
      type: "registrations_template",
      version: "1.0",
      registrations: [
        {
          competitionId: sampleComp.id,
          competitionName: sampleComp.name,
          participantName: "Ahmad Zain",
          participantUserId: "ART-2026-101",
          groupId: sampleGroup.id,
          groupName: sampleGroup.name,
          codeLetter: "A",
          isReported: true,
          mark: "88"
        },
        {
          competitionId: sampleComp.id,
          competitionName: sampleComp.name,
          participantName: "Bilal Faris",
          participantUserId: "ART-2026-102",
          groupId: sampleGroup.id,
          groupName: sampleGroup.name,
          codeLetter: "B",
          isReported: false
        },
        {
          competitionId: competitions[1]?.id || sampleComp.id,
          competitionName: competitions[1]?.name || "Pencil Drawing",
          participantName: "Tariq Mansoor",
          participantUserId: "ART-2026-103",
          groupId: groups[1]?.id || sampleGroup.id,
          groupName: groups[1]?.name || "Team Emerald",
          codeLetter: "C",
          isReported: true,
          mark: "92",
          judgeRank: 1
        }
      ]
    };

    const str = JSON.stringify(sample, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'registrations_sample_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Trigger Download
  const handleDownloadLiveJson = () => {
    const jsonStr = festStore.exportRegistrationsJSON(exportList);
    const dateStr = new Date().toISOString().split('T')[0];
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fest_registrations_${exportScope === 'filtered' ? 'filtered_' : ''}${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onSuccess(`Successfully downloaded ${exportList.length} registrations as JSON!`);
    onClose();
  };

  // Copy to clipboard
  const handleCopyJson = async () => {
    try {
      const jsonStr = festStore.exportRegistrationsJSON(exportList);
      await navigator.clipboard.writeText(jsonStr);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch {
      setIsCopied(false);
    }
  };

  // Execute Import
  const handleExecuteImport = () => {
    if (!jsonText.trim() || parsedRegs.length === 0) return;
    setIsProcessing(true);

    try {
      const result = festStore.importRegistrationsJSON(jsonText, importMode);
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

  const compNameMap = useMemo(() => {
    const map = new Map<string, string>();
    competitions.forEach(c => map.set(c.id, c.name));
    return map;
  }, [competitions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#151728] border border-[#292d4a] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#292d4a] bg-[#121424]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-600/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Registrations JSON Manager</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {registrations.length} Registrations
                </span>
              </h2>
              <p className="text-xs text-slate-400">Download, backup, or bulk upload festival registrations via structured JSON</p>
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
                ? 'border-amber-500 text-amber-300 bg-[#1b1e38]'
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
              {/* Scope Selector if active filters exist */}
              {(selectedGroupFilter !== 'All' || selectedCompFilter !== 'All') && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Filter className="w-4 h-4 shrink-0" />
                    <span>Active Filters: {selectedGroupFilter !== 'All' ? `Group: ${groups.find(g => g.id === selectedGroupFilter)?.name || selectedGroupFilter}` : ''} {selectedCompFilter !== 'All' ? `Comp: ${competitions.find(c => c.id === selectedCompFilter)?.name || selectedCompFilter}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExportScope('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        exportScope === 'all'
                          ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                          : 'bg-[#181b30] text-slate-300 hover:text-white border border-[#292d4a]'
                      }`}
                    >
                      All ({registrations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportScope('filtered')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        exportScope === 'filtered'
                          ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                          : 'bg-[#181b30] text-slate-300 hover:text-white border border-[#292d4a]'
                      }`}
                    >
                      Filtered ({filteredList.length})
                    </button>
                  </div>
                </div>
              )}

              {/* Summary Card */}
              <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Registrations Export Summary</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/30">
                    {exportList.length} Entries Selected
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-[#121424] p-2.5 rounded-xl border border-[#292d4a]/70">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Total Entries</span>
                    <span className="text-sm font-extrabold text-white font-mono">{exportList.length}</span>
                  </div>
                  <div className="bg-[#121424] p-2.5 rounded-xl border border-[#292d4a]/70">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Reported (Present)</span>
                    <span className="text-sm font-extrabold text-emerald-400 font-mono">
                      {exportList.filter(r => r.isReported).length}
                    </span>
                  </div>
                  <div className="bg-[#121424] p-2.5 rounded-xl border border-[#292d4a]/70">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">With Marks</span>
                    <span className="text-sm font-extrabold text-purple-400 font-mono">
                      {exportList.filter(r => r.mark !== undefined && r.mark !== '').length}
                    </span>
                  </div>
                  <div className="bg-[#121424] p-2.5 rounded-xl border border-[#292d4a]/70">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Unique Students</span>
                    <span className="text-sm font-extrabold text-amber-400 font-mono">
                      {new Set(exportList.map(r => r.participantId || r.participantName)).size}
                    </span>
                  </div>
                </div>

                {/* Groups count breakdown */}
                <div className="pt-2 border-t border-[#292d4a]/70 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] font-bold text-slate-400 mr-1">Groups:</span>
                  {groups.map(g => {
                    const count = exportList.filter(r => r.groupId === g.id).length;
                    if (count === 0) return null;
                    return (
                      <span key={g.id} className="text-[11px] px-2 py-0.5 rounded-md bg-[#121424] border border-[#292d4a] text-slate-300 font-medium">
                        {g.name}: <strong className="text-amber-300">{count}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadLiveJson}
                  className="py-3.5 px-4 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>Download Registrations JSON</span>
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

              {/* Sample Template */}
              <div className="p-3.5 bg-[#121424] border border-[#292d4a] rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Need a formatted registration schema template?</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="px-3 py-1.5 text-xs font-bold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg shrink-0 transition-all cursor-pointer"
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
                    {selectedFile ? selectedFile.name : 'Click to Browse or Drag Registrations .json File'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Accepts JSON array or {`{ "registrations": [...] }`}</span>
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
                        setParsedRegs([]);
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
                  placeholder='[\n  { "competitionId": "comp-1", "participantName": "Ahmad", "participantUserId": "ART-2026-101", "groupName": "Team Ruby" }\n]'
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

              {parsedRegs.length > 0 && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Detected {parsedRegs.length} valid registrations
                    </span>
                    <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      Ready to import
                    </span>
                  </div>

                  {/* Preview first 4 registrations */}
                  <div className="max-h-28 overflow-y-auto space-y-1 pt-1 text-[11px] font-mono">
                    {parsedRegs.slice(0, 4).map((r, i) => (
                      <div key={i} className="flex items-center justify-between bg-[#121424]/80 px-2.5 py-1 rounded border border-[#292d4a]">
                        <div className="flex items-center gap-2 truncate max-w-[200px] sm:max-w-xs">
                          <span className="text-white font-bold">{r.participantName || r.participantUserId || 'Participant'}</span>
                          <span className="text-slate-500 text-[10px]">({r.participantUserId || 'ID'})</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 shrink-0">
                          <span className="text-amber-300 truncate max-w-[100px]">{compNameMap.get(r.competitionId) || r.competitionName || r.competitionId}</span>
                          <span>•</span>
                          <span className="text-purple-300">{r.groupName || r.groupId}</span>
                        </div>
                      </div>
                    ))}
                    {parsedRegs.length > 4 && (
                      <div className="text-[10px] text-slate-400 text-center pt-0.5 italic">
                        + {parsedRegs.length - 4} more registrations...
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
                      name="regImportMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 text-purple-600"
                    />
                    <div>
                      <span className="font-bold block text-purple-300">Merge & Update (Recommended)</span>
                      <span className="text-[11px] text-slate-400 leading-tight block mt-0.5">
                        Updates existing registrations and adds new ones without removing other participant registrations.
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
                      name="regImportMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-rose-600"
                    />
                    <div>
                      <span className="font-bold block text-rose-300">Replace All</span>
                      <span className="text-[11px] text-slate-400 leading-tight block mt-0.5">
                        Erases all existing registrations and installs only the entries from this JSON file.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={parsedRegs.length === 0 || isProcessing}
                  onClick={handleExecuteImport}
                  className={`flex-1 py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                    parsedRegs.length > 0 && !isProcessing
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-600/30 active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing Registrations...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Import {parsedRegs.length} Registrations ({importMode === 'merge' ? 'Merge' : 'Replace'})</span>
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
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>Updates are synced to local storage and active cloud connections</span>
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
