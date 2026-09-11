import React, { useRef, useState, useEffect } from 'react';
import { Result, Competition } from '../types';
import { festStore, formatCompetitionName } from '../lib/store';
import { ParticipantAvatar } from './ParticipantAvatar';
import { 
  X, 
  Download, 
  Share2, 
  Sparkles, 
  Trophy, 
  Crown, 
  Award, 
  Check, 
  Palette, 
  Image as ImageIcon 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import logoImg from '../assets/images/logo-01.png';

interface ResultPosterModalProps {
  result: Result | null;
  competition?: Competition;
  isOpen: boolean;
  onClose: () => void;
}

export const ResultPosterModal: React.FC<ResultPosterModalProps> = ({
  result,
  competition,
  isOpen,
  onClose,
}) => {
  const [templateConfig, setTemplateConfig] = useState(() => festStore.getPosterTemplateConfig());
  const [branding, setBranding] = useState(() => festStore.getBrandingConfig());
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTemplateConfig(festStore.getPosterTemplateConfig());
      setBranding(festStore.getBrandingConfig());
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {}
    }
  }, [isOpen]);

  if (!isOpen || !result) return null;

  const comp = competition || festStore.getCompetitions().find((c) => c.id === result.competitionId);
  const cleanCompName = formatCompetitionName(result.competitionName, comp?.category);

  const cleanName = (str?: string) => (str ? str.replace(/\s*\([^)]*\)/g, '').trim() : '');

  const p1 = {
    name: festStore.getParticipantFullName(result.firstPlaceParticipantName, result.firstPlaceRegId),
    group: result.firstPlaceGroupName,
    code: result.firstPlaceCodeLetter,
    points: comp?.points1st ?? 10,
    photoUrl: festStore.getParticipantPhotoUrl(result.firstPlaceParticipantName, result.firstPlaceRegId),
  };
  const p2 = result.secondPlaceParticipantName
    ? {
        name: festStore.getParticipantFullName(result.secondPlaceParticipantName, result.secondPlaceRegId),
        group: result.secondPlaceGroupName || '',
        code: result.secondPlaceCodeLetter,
        points: comp?.points2nd ?? 5,
        photoUrl: festStore.getParticipantPhotoUrl(result.secondPlaceParticipantName, result.secondPlaceRegId),
      }
    : null;
  const p3 = result.thirdPlaceParticipantName
    ? {
        name: festStore.getParticipantFullName(result.thirdPlaceParticipantName, result.thirdPlaceRegId),
        group: result.thirdPlaceGroupName || '',
        code: result.thirdPlaceCodeLetter,
        points: comp?.points3rd ?? 3,
        photoUrl: festStore.getParticipantPhotoUrl(result.thirdPlaceParticipantName, result.thirdPlaceRegId),
      }
    : null;

  // Background Theme Styles
  const getThemeBackground = () => {
    if (templateConfig.backgroundImageUrl) {
      return {
        backgroundImage: `url(${templateConfig.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }

    switch (templateConfig.themePreset) {
      case 'royal_gold':
        return {
          background: 'linear-gradient(145deg, #181308 0%, #2b1f0c 35%, #151226 70%, #090a14 100%)',
        };
      case 'neon_fest':
        return {
          background: 'linear-gradient(135deg, #0f0728 0%, #1e0b36 40%, #06182c 80%, #050814 100%)',
        };
      case 'midnight_purple':
        return {
          background: 'linear-gradient(160deg, #130a2a 0%, #1e1245 40%, #0e0d21 80%, #070712 100%)',
        };
      case 'emerald_glory':
        return {
          background: 'linear-gradient(145deg, #061c14 0%, #0d3829 40%, #091a18 80%, #050e0c 100%)',
        };
      case 'sunset_fire':
        return {
          background: 'linear-gradient(145deg, #2b0b14 0%, #3d141e 40%, #1b0a1f 80%, #090712 100%)',
        };
      default:
        return {
          background: 'linear-gradient(145deg, #151728 0%, #1f223d 50%, #0e101f 100%)',
        };
    }
  };

  // High-Resolution Native Canvas Image Generator & Downloader
  const handleDownloadPoster = async () => {
    setIsGenerating(true);
    try {
      const width = 1080;
      const height = 1350;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas context unavailable');
      }

      // 1. Draw Background
      if (templateConfig.backgroundImageUrl) {
        try {
          const bgImg = new Image();
          bgImg.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            bgImg.onload = resolve;
            bgImg.onerror = reject;
            bgImg.src = templateConfig.backgroundImageUrl!;
          });
          ctx.drawImage(bgImg, 0, 0, width, height);

          // Overlay shade
          ctx.fillStyle = `rgba(11, 12, 22, ${templateConfig.overlayOpacity ?? 0.8})`;
          ctx.fillRect(0, 0, width, height);
        } catch {
          // Fallback gradient if image failed
          drawGradientBg(ctx, width, height);
        }
      } else {
        drawGradientBg(ctx, width, height);
      }

      // Draw Decorative Borders & Lights
      ctx.strokeStyle = templateConfig.accentColor || '#f59e0b';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, width - 60, height - 60);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(40, 40, width - 80, height - 80);

      // 2. Header & Branding
      let topY = 110;

      // College Title
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '2px';
      ctx.fillText((branding.college || 'MADANI COLLEGE').toUpperCase(), width / 2, topY);

      // Fest Title
      topY += 45;
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 42px sans-serif';
      ctx.fillText((branding.title || 'MADANI ART FEST 2026').toUpperCase(), width / 2, topY);

      // Header Tag ("OFFICIAL RESULT")
      topY += 60;
      const tagText = (templateConfig.headerText || 'OFFICIAL RESULT').toUpperCase();
      ctx.fillStyle = templateConfig.accentColor || '#f59e0b';
      ctx.font = '900 22px sans-serif';
      ctx.fillText(`★  ${tagText}  ★`, width / 2, topY);

      // Competition Title Box
      topY += 70;
      ctx.fillStyle = 'rgba(24, 27, 48, 0.9)';
      ctx.strokeStyle = templateConfig.secondaryAccent || '#8b5cf6';
      ctx.lineWidth = 2;
      roundRect(ctx, 100, topY - 45, width - 200, 90, 20, true, true);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(cleanCompName, width / 2, topY + 10);

      // 3. Winners Podium (1st Center, 2nd Left, 3rd Right)
      const podiumCenterY = 680;

      // Load participant profile photos for canvas
      const loadAvatarImg = (photoUrl?: string): Promise<HTMLImageElement | null> => {
        if (!photoUrl) return Promise.resolve(null);
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = photoUrl;
        });
      };

      const [p1Img, p2Img, p3Img] = await Promise.all([
        loadAvatarImg(p1.photoUrl),
        p2 ? loadAvatarImg(p2.photoUrl) : Promise.resolve(null),
        p3 ? loadAvatarImg(p3.photoUrl) : Promise.resolve(null),
      ]);

      // Draw 1st Place (Center - Prominent)
      drawWinnerCard(
        ctx,
        width / 2,
        podiumCenterY - 40,
        280,
        340,
        '1',
        '🥇 1st PLACE',
        p1.name,
        p1.group,
        p1.points,
        p1.code,
        '#f59e0b',
        '#fbbf24',
        p1Img
      );

      // Draw 2nd Place (Left)
      if (p2) {
        drawWinnerCard(
          ctx,
          width / 2 - 290,
          podiumCenterY + 40,
          240,
          290,
          '2',
          '🥈 2nd PLACE',
          p2.name,
          p2.group,
          p2.points,
          p2.code,
          '#94a3b8',
          '#cbd5e1',
          p2Img
        );
      }

      // Draw 3rd Place (Right)
      if (p3) {
        drawWinnerCard(
          ctx,
          width / 2 + 290,
          podiumCenterY + 40,
          240,
          290,
          '3',
          '🥉 3rd PLACE',
          p3.name,
          p3.group,
          p3.points,
          p3.code,
          '#d97706',
          '#f59e0b',
          p3Img
        );
      }

      // 4. Footer & Watermark
      const footerY = height - 90;
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 20px sans-serif';
      ctx.fillText(
        templateConfig.footerText || 'Congratulations to all winning participants & groups!',
        width / 2,
        footerY
      );

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(
        `Generated from Fest Official Media Portal • ${new Date().toLocaleDateString()}`,
        width / 2,
        footerY + 35
      );

      // 5. Trigger download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeComp = cleanCompName.replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Result_Poster_${safeComp}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating canvas poster:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const drawGradientBg = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    if (templateConfig.themePreset === 'emerald_glory') {
      grad.addColorStop(0, '#061c14');
      grad.addColorStop(0.5, '#0d3829');
      grad.addColorStop(1, '#050e0c');
    } else if (templateConfig.themePreset === 'neon_fest') {
      grad.addColorStop(0, '#0f0728');
      grad.addColorStop(0.5, '#1e0b36');
      grad.addColorStop(1, '#050814');
    } else {
      grad.addColorStop(0, '#181308');
      grad.addColorStop(0.4, '#2b1f0c');
      grad.addColorStop(0.8, '#151226');
      grad.addColorStop(1, '#090a14');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  };

  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: boolean,
    stroke: boolean
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  };

  const drawWinnerCard = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    cardW: number,
    cardH: number,
    rankNum: string,
    rankLabel: string,
    name: string,
    group: string,
    points: number,
    codeLetter: string | undefined,
    accentColor: string,
    badgeColor: string,
    avatarImg?: HTMLImageElement | null
  ) => {
    const leftX = centerX - cardW / 2;
    const topY = centerY - cardH / 2;

    // Card BG
    ctx.fillStyle = 'rgba(21, 23, 40, 0.95)';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    roundRect(ctx, leftX, topY, cardW, cardH, 24, true, true);

    // Rank Pill
    ctx.fillStyle = badgeColor;
    roundRect(ctx, centerX - 70, topY - 18, 140, 36, 18, true, false);

    ctx.fillStyle = '#0b0c16';
    ctx.font = '900 16px sans-serif';
    ctx.fillText(rankLabel, centerX, topY + 6);

    // Avatar Circle
    const avatarY = topY + 85;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, avatarY, 40, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (avatarImg) {
      ctx.drawImage(avatarImg, centerX - 40, avatarY - 40, 80, 80);
    } else {
      ctx.fillStyle = '#1e223d';
      ctx.fillRect(centerX - 40, avatarY - 40, 80, 80);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(name.charAt(0).toUpperCase() || 'P', centerX, avatarY + 10);
    }
    ctx.restore();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, avatarY, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    const truncatedName = name.length > 18 ? name.substring(0, 16) + '...' : name;
    ctx.fillText(truncatedName, centerX, topY + 165);

    // Group Badge
    ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, centerX - 90, topY + 185, 180, 34, 12, true, true);

    ctx.fillStyle = '#c4b5fd';
    ctx.font = 'bold 16px sans-serif';
    const truncatedGroup = group.length > 16 ? group.substring(0, 14) + '..' : group;
    ctx.fillText(truncatedGroup.toUpperCase(), centerX, topY + 208);

    // Points
    ctx.fillStyle = accentColor;
    ctx.font = '900 20px sans-serif';
    ctx.fillText(`🪙 ${points} POINTS`, centerX, topY + 255);
  };

  const handleShare = () => {
    const text = `🏆 ${cleanCompName} Results 🏆\n1st: ${p1.name} (${p1.group})\n${p2 ? `2nd: ${p2.name} (${p2.group})\n` : ''}${p3 ? `3rd: ${p3.name} (${p3.group})\n` : ''}\nOfficial ${branding.title || 'Arts Festival'} ${branding.tag || ''}`;
    if (navigator.share) {
      navigator.share({
        title: cleanCompName,
        text,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#121424] border border-[#292d4a] rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-[#292d4a] flex items-center justify-between bg-[#151728]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">
                Official Result Poster
              </h3>
              <p className="text-[11px] text-slate-400">
                Media Template Ready • 1-Click High Res PNG Download
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-[#181b30] hover:bg-[#202542] border border-[#292d4a] text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Share or Copy Result"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-purple-400" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={handleDownloadPoster}
              disabled={isGenerating}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Rendering...' : 'Download Poster'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-[#181b30] hover:bg-rose-500/20 transition-all ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Poster Visual Preview Area */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[70vh] flex justify-center bg-[#090a12]">
          <div
            ref={posterRef}
            style={getThemeBackground()}
            className="w-full max-w-md rounded-3xl border-2 border-amber-500/60 p-5 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden transition-all"
          >
            {/* Ambient Lighting / Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Poster Header */}
            <div className="text-center space-y-1 relative z-10 border-b border-white/10 pb-4">
              <div className="flex items-center justify-center gap-2">
                <img
                  src={branding.logoUrl || logoImg}
                  alt="Fest Logo"
                  className="max-h-8 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="text-[11px] font-extrabold tracking-widest text-slate-300 uppercase">
                  {branding.college || 'MADANI COLLEGE'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
                {branding.title || 'MADANI COLLEGE FEST'}
              </h2>
              <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-500/40 shadow-sm mt-1">
                <Sparkles className="w-3 h-3" />
                <span>{templateConfig.headerText || 'OFFICIAL RESULT'}</span>
              </div>
            </div>

            {/* Competition Banner */}
            <div className="bg-[#121424]/90 border border-purple-500/40 rounded-2xl p-3.5 text-center shadow-lg relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                {comp?.category || 'Category'}${comp?.venue ? ` • ${comp.venue}` : ''}
              </span>
              <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                {cleanCompName}
              </h3>
            </div>

            {/* Podium Visual Layout */}
            <div className="space-y-3 relative z-10">
              {/* 1st Place Champion Spotlight */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-purple-600/20 to-amber-500/20 border-2 border-amber-400/70 text-center space-y-2 shadow-xl relative overflow-hidden">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-black text-[10px] px-3 py-0.5 rounded-full flex items-center gap-1 shadow-md uppercase tracking-wider">
                  <Crown className="w-3 h-3 fill-slate-950" />
                  <span>1st Place Champion</span>
                </div>

                <div className="pt-2 flex flex-col items-center">
                  <ParticipantAvatar
                    name={p1.name}
                    photoUrl={p1.photoUrl}
                    className="w-16 h-16 border-2 border-amber-400 shadow-xl shadow-amber-500/40 mb-1.5"
                  />
                  <h4 className="text-base font-black text-white tracking-wide">
                    {p1.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px] uppercase border border-amber-500/30">
                      {p1.group}
                    </span>
                    <span className="text-amber-400 font-black text-xs">
                      🪙 {p1.points} pts
                    </span>
                  </div>
                </div>
              </div>

              {/* 2nd & 3rd Place Grid */}
              {(p2 || p3) && (
                <div className="grid grid-cols-2 gap-3">
                  {/* 2nd Place */}
                  {p2 ? (
                    <div className="p-3 rounded-2xl bg-[#151728]/90 border border-slate-400/50 text-center space-y-1.5 shadow-md relative">
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-950 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                        2nd Place
                      </div>
                      <div className="pt-1 flex flex-col items-center">
                        <ParticipantAvatar
                          name={p2.name}
                          photoUrl={p2.photoUrl}
                          className="w-11 h-11 border border-slate-300 shadow-md mb-1"
                        />
                        <div className="text-xs font-bold text-white truncate w-full" title={p2.name}>
                          {p2.name}
                        </div>
                        <div className="text-[10px] text-slate-300 font-semibold truncate w-full uppercase">
                          {p2.group}
                        </div>
                        <div className="text-[10px] font-bold text-amber-400">
                          🪙 {p2.points} pts
                        </div>
                      </div>
                    </div>
                  ) : <div />}

                  {/* 3rd Place */}
                  {p3 ? (
                    <div className="p-3 rounded-2xl bg-[#151728]/90 border border-amber-600/50 text-center space-y-1.5 shadow-md relative">
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                        3rd Place
                      </div>
                      <div className="pt-1 flex flex-col items-center">
                        <ParticipantAvatar
                          name={p3.name}
                          photoUrl={p3.photoUrl}
                          className="w-11 h-11 border border-amber-600 shadow-md mb-1"
                        />
                        <div className="text-xs font-bold text-white truncate w-full" title={p3.name}>
                          {p3.name}
                        </div>
                        <div className="text-[10px] text-amber-300/80 font-semibold truncate w-full uppercase">
                          {p3.group}
                        </div>
                        <div className="text-[10px] font-bold text-amber-400">
                          🪙 {p3.points} pts
                        </div>
                      </div>
                    </div>
                  ) : <div />}
                </div>
              )}
            </div>

            {/* Poster Footer Tagline */}
            <div className="text-center pt-2 border-t border-white/10 relative z-10 space-y-1">
              <p className="text-[10px] text-slate-400 font-medium italic">
                {templateConfig.footerText || 'Congratulations to all winning participants & groups!'}
              </p>
              <p className="text-[9px] font-mono text-slate-500">
                Official Festival Media Release • {new Date(result.publishedAt).toLocaleDateString()}
              </p>
            </div>

          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3.5 sm:p-4 border-t border-[#292d4a] bg-[#151728] flex items-center justify-between text-xs text-slate-400">
          <span>Formatted with Media Poster Template</span>
          <button
            onClick={handleDownloadPoster}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Download High-Res PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
