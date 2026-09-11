import React, { useState, useEffect } from 'react';
import { UserProfile, Group, BrandingConfig } from '../types';
import { festStore } from '../lib/store';
import { downloadBulkQrZip, openPrintableQrSheet, generateParticipantQrPngDataUrl } from '../lib/qrExport';
import { QrCode, Download, Printer, X, Filter, Users, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface BulkQrExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding?: BrandingConfig;
}

export const BulkQrExportModal: React.FC<BulkQrExportModalProps> = ({
  isOpen,
  onClose,
  branding,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [includeLabel, setIncludeLabel] = useState<boolean>(true);
  const [qrResolution, setQrResolution] = useState<number>(512);
  const [namingFormat, setNamingFormat] = useState<'chestNoOnly' | 'full'>('chestNoOnly');
  const [imageFormat, setImageFormat] = useState<'jpg' | 'png'>('jpg');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string }>({
    current: 0,
    total: 0,
    name: '',
  });
  const [toastMessage, setToastMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');

  const allProfiles: UserProfile[] = festStore.getProfiles().filter((p) => p.role === 'participant');
  const groups: Group[] = festStore.getGroups();
  const categoriesList: string[] = festStore.getCategories();
  const levelsList: string[] = festStore.getLevels();

  // Filter profiles based on selected filters
  const filteredProfiles = allProfiles.filter((p) => {
    const matchGroup = selectedGroup === 'All' || p.groupId === selectedGroup;
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchLvl = selectedLevel === 'All' || p.department === selectedLevel;
    return matchGroup && matchCat && matchLvl;
  }).sort((a, b) => {
    const numA = parseInt(a.userId?.replace(/\D/g, '') || '', 10);
    const numB = parseInt(b.userId?.replace(/\D/g, '') || '', 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return (a.userId || '').localeCompare(b.userId || '', undefined, { numeric: true, sensitivity: 'base' });
  });

  // Generate preview image for the first matching participant
  useEffect(() => {
    const sample = filteredProfiles[0] || allProfiles[0];
    if (sample) {
      generateParticipantQrPngDataUrl(sample, {
        includeLabel,
        size: 380,
        imageFormat,
      }).then((url) => setPreviewDataUrl(url));
    } else {
      setPreviewDataUrl('');
    }
  }, [selectedGroup, selectedCategory, selectedLevel, includeLabel, imageFormat]);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    if (filteredProfiles.length === 0) {
      setErrorMessage('No participants found matching the selected filter.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage('');
    setToastMessage('');
    setProgress({ current: 0, total: filteredProfiles.length, name: 'Starting...' });

    const groupName = selectedGroup === 'All' ? 'all_groups' : (groups.find(g => g.id === selectedGroup)?.name || 'group').toLowerCase().replace(/\s+/g, '_');
    const prefix = `festival_qr_codes_${groupName}`;

    const res = await downloadBulkQrZip(filteredProfiles, prefix, {
      includeLabel,
      size: qrResolution,
      imageFormat,
      namingFormat,
      onProgress: (current, total, name) => {
        setProgress({ current, total, name });
      },
    });

    setIsGenerating(false);

    if (res.success) {
      setToastMessage(`Successfully generated and downloaded ZIP of ${res.count} QR codes!`);
      setTimeout(() => setToastMessage(''), 5000);
    } else {
      setErrorMessage(res.error || 'Failed to download QR ZIP.');
    }
  };

  const handlePrintSheet = async () => {
    if (filteredProfiles.length === 0) {
      setErrorMessage('No participants found matching the selected filter.');
      return;
    }
    await openPrintableQrSheet(filteredProfiles, branding);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#151728] border border-purple-500/40 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-auto animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#292d4a] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600/20 text-purple-400 rounded-2xl border border-purple-500/30">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Bulk Participant QR Code Export</h2>
              <p className="text-xs text-slate-400">
                Download high-resolution QR codes in a ZIP archive or print multi-badge sheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-[#181b30] hover:bg-rose-500/20 hover:text-rose-300 rounded-xl border border-[#292d4a] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback banners */}
        {toastMessage && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2.5 text-emerald-400 text-xs font-bold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-rose-400 text-xs font-bold animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Controls Column (7 cols) */}
          <div className="md:col-span-7 space-y-4">
            
            {/* Filter Group */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Filter by Assigned Group
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl text-xs text-white focus:outline-none font-semibold cursor-pointer"
              >
                <option value="All">All Groups ({allProfiles.length} participants)</option>
                {groups.map((g) => {
                  const count = allProfiles.filter((p) => p.groupId === g.id).length;
                  return (
                    <option key={g.id} value={g.id}>
                      {g.name} ({count} participants)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Category & Level filter */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl text-xs text-white focus:outline-none font-semibold cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Level / Dept
                </label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181b30] border border-[#292d4a] focus:border-purple-500 rounded-xl text-xs text-white focus:outline-none font-semibold cursor-pointer"
                >
                  <option value="All">All Levels</option>
                  {levelsList.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl.replace(/^Level\s+/i, '')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Formatting Options */}
            <div className="p-3.5 bg-[#181b30] rounded-2xl border border-[#292d4a] space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                QR Image Options
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeLabel}
                  onChange={(e) => setIncludeLabel(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-700 bg-slate-900"
                />
                <span>Stamp Chest No & Name label under QR code</span>
              </label>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#292d4a]/60">
                <span className="text-xs text-slate-400">Image File Naming:</span>
                <select
                  value={namingFormat}
                  onChange={(e) => setNamingFormat(e.target.value as 'chestNoOnly' | 'full')}
                  className="px-2.5 py-1 bg-[#111322] border border-[#292d4a] rounded-lg text-xs text-slate-200 focus:outline-none font-semibold"
                >
                  <option value="chestNoOnly">Chest No. Only (e.g. 101.jpg)</option>
                  <option value="full">Full Info (ChestNo_Name_Group.jpg)</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#292d4a]/60">
                <span className="text-xs text-slate-400">File Format:</span>
                <select
                  value={imageFormat}
                  onChange={(e) => setImageFormat(e.target.value as 'jpg' | 'png')}
                  className="px-2.5 py-1 bg-[#111322] border border-[#292d4a] rounded-lg text-xs text-slate-200 focus:outline-none font-semibold"
                >
                  <option value="jpg">JPG (.jpg - Default)</option>
                  <option value="png">PNG (.png)</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#292d4a]/60">
                <span className="text-xs text-slate-400">Output Resolution:</span>
                <select
                  value={qrResolution}
                  onChange={(e) => setQrResolution(Number(e.target.value))}
                  className="px-2.5 py-1 bg-[#111322] border border-[#292d4a] rounded-lg text-xs text-slate-200 focus:outline-none"
                >
                  <option value={380}>Medium (380px)</option>
                  <option value={512}>High (512px - Recommended)</option>
                  <option value={1024}>Ultra HD (1024px)</option>
                </select>
              </div>
            </div>

            {/* Selection Summary Pill */}
            <div className="flex items-center justify-between p-3 bg-[#111322] border border-[#292d4a] rounded-xl text-xs">
              <span className="text-slate-400">Total Participants Selected:</span>
              <span className="font-mono font-bold text-purple-400 text-sm">
                {filteredProfiles.length} of {allProfiles.length}
              </span>
            </div>

          </div>

          {/* Preview Column (5 cols) */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-[#111322] border border-[#292d4a] rounded-2xl space-y-3 text-center">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Sample QR Preview
            </div>

            {previewDataUrl ? (
              <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-md max-w-[240px] max-h-[310px] flex items-center justify-center overflow-hidden">
                <img
                  src={previewDataUrl}
                  alt="Sample QR Preview"
                  className="w-full h-auto object-contain"
                />
              </div>
            ) : (
              <div className="w-40 h-40 bg-slate-800/50 rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-xs">
                No participant found
              </div>
            )}

            {previewDataUrl && (
              <div className="text-[10px] text-slate-300 font-mono bg-[#181b30] px-2.5 py-1 rounded-lg border border-[#292d4a]">
                File name: <span className="text-purple-400 font-bold">{namingFormat === 'chestNoOnly' ? `${(filteredProfiles[0] || allProfiles[0])?.userId || (filteredProfiles[0] || allProfiles[0])?.chestNo || '101'}.${imageFormat}` : `${(filteredProfiles[0] || allProfiles[0])?.userId || '101'}_${((filteredProfiles[0] || allProfiles[0])?.name || 'Participant').replace(/\s+/g, '_')}.${imageFormat}`}</span>
              </div>
            )}

            <p className="text-[10px] text-slate-400 leading-tight">
              Scannable by camera on Login screen using Participant Chest Number.
            </p>
          </div>
        </div>

        {/* Progress Bar when Generating */}
        {isGenerating && (
          <div className="p-4 bg-[#181b30] border border-purple-500/40 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-2 font-bold text-purple-300">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Generating QR Codes Archive...
              </span>
              <span className="font-mono font-bold text-white">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-150"
                style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate">
              {progress.name}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-[#292d4a]">
          <button
            type="button"
            onClick={handlePrintSheet}
            disabled={isGenerating || filteredProfiles.length === 0}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            <span>Print Multi-Badge Sheet (PDF)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={isGenerating || filteredProfiles.length === 0}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span>Download All as ZIP ({filteredProfiles.length})</span>
          </button>
        </div>

      </div>
    </div>
  );
};
