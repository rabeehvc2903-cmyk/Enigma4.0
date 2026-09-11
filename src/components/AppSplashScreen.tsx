import React, { useEffect, useState } from 'react';
import { Wifi, CheckCircle2 } from 'lucide-react';
import { BrandingConfig } from '../types';
import logoImg from '../assets/images/logo-01.png';

interface AppSplashScreenProps {
  branding: BrandingConfig;
  syncStatus: {
    status: string;
    error?: string | null;
  };
  onFinish: () => void;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({
  branding,
  syncStatus,
  onFinish,
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progressWidth, setProgressWidth] = useState('25%');

  const isConnecting = syncStatus.status === 'initializing';
  const isResolved = syncStatus.status === 'connected' || syncStatus.status === 'disconnected' || syncStatus.status === 'error';

  useEffect(() => {
    if (isConnecting) {
      // While connecting, simulate steady progress up to 80%
      setProgressWidth('65%');
    } else if (isResolved) {
      // When Supabase connection resolves, complete to 100% then dismiss
      setProgressWidth('100%');
      const timer = setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(onFinish, 400); // fade out animation
      }, 450); // short delay to show 100% completion state
      return () => clearTimeout(timer);
    }

    // Safety fallback: maximum 10 seconds if connection is blocked/stalled
    const fallbackTimer = setTimeout(() => {
      setProgressWidth('100%');
      setIsFadingOut(true);
      setTimeout(onFinish, 400);
    }, 10000);

    return () => clearTimeout(fallbackTimer);
  }, [isConnecting, isResolved, onFinish]);

  const festTitle = branding.title || branding.college || 'Arts & Cultural Fest';
  const editionTag = branding.tag || branding.college;

  const getStatusText = () => {
    if (syncStatus.status === 'initializing') {
      return 'Connecting to Supabase realtime database...';
    }
    if (syncStatus.status === 'connected') {
      return 'Connected to Supabase realtime!';
    }
    if (syncStatus.status === 'error') {
      return 'Offline mode (Local storage ready)';
    }
    return 'Loaded festival data';
  };

  const splashLogoSrc = branding.splashLogoUrl;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0c16] text-white select-none transition-opacity duration-400 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full blur-[140px] opacity-25"
          style={{ backgroundColor: branding.primaryColor || '#8b5cf6' }}
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] w-[500px] h-[500px] rounded-full blur-[140px] opacity-20"
          style={{ backgroundColor: branding.secondaryColor || '#6366f1' }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm">
        {/* Official Festival Splash Logo (PNG) - Only shown if uploaded, otherwise left blank */}
        {splashLogoSrc ? (
          <div className="relative mb-6 flex items-center justify-center">
            <img
              src={splashLogoSrc}
              alt={festTitle}
              className="w-32 h-32 sm:w-36 sm:h-36 max-w-[220px] max-h-[160px] object-contain drop-shadow-[0_10px_35px_rgba(139,92,246,0.45)] transition-all duration-300"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : null}

        {/* Fest Name & Edition / Tag */}
        <h1 className="text-2xl font-black tracking-tight text-white mb-1.5">
          {festTitle}
        </h1>
        
        {editionTag && (
          <div className="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest bg-white/5 border border-white/10 text-slate-300 mb-6 shadow-sm">
            {editionTag}
          </div>
        )}

        {/* Progress Bar & Status */}
        <div className="w-56 space-y-2 mt-2">
          <div className="w-full h-1.5 bg-[#181b30] rounded-full overflow-hidden border border-[#292d4a]">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: progressWidth,
                background: `linear-gradient(90deg, ${branding.primaryColor || '#8b5cf6'}, ${branding.secondaryColor || '#6366f1'})`,
              }}
            />
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
            {syncStatus.status === 'initializing' && (
              <Wifi className="w-3 h-3 text-purple-400 animate-pulse" />
            )}
            {syncStatus.status === 'connected' && (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            )}
            <span>{getStatusText()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};


