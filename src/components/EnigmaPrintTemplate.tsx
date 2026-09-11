import React from 'react';

export const ENIGMA_GRADIENT_STYLE = {
  background: 'linear-gradient(90deg, #f43f5e 0%, #d946ef 20%, #8b5cf6 45%, #1e1b4b 75%, #78350f 100%)',
};

export const ENIGMA_GRADIENT_CSS = 'background: linear-gradient(90deg, #f43f5e 0%, #d946ef 20%, #8b5cf6 45%, #1e1b4b 75%, #78350f 100%);';

export interface EnigmaPrintHeaderProps {
  title?: string;
  rightElement?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const EnigmaPrintHeader: React.FC<EnigmaPrintHeaderProps> = ({
  title = 'ENIGMA \u201826',
  rightElement,
  className = '',
  compact = false,
}) => {
  return (
    <div className={`w-full flex items-center ${compact ? 'gap-2.5 mb-2.5' : 'gap-3.5 mb-6'} ${className}`}>
      {/* Logo mark: Slanted pink lines + vertical dark bars */}
      <div className="flex items-center gap-1 shrink-0">
        <svg
          className={`${compact ? 'w-5 h-5' : 'w-7 h-7'} shrink-0`}
          viewBox="0 0 42 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Slanted pink strokes */}
          <line x1="4" y1="24" x2="10" y2="4" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" />
          <line x1="10" y1="24" x2="16" y2="4" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" />
          
          {/* Vertical dark bars */}
          <line x1="20" y1="4" x2="20" y2="24" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="24" y1="4" x2="24" y2="24" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="4" x2="28" y2="24" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="32" y1="4" x2="32" y2="24" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="36" y1="4" x2="36" y2="24" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        <span className={`${compact ? 'text-base font-black' : 'text-xl sm:text-2xl font-black'} text-slate-950 tracking-tight font-sans select-none`}>
          {title}
        </span>
      </div>

      {/* Horizontal Gradient Line extending across to the right */}
      <div
        className={`flex-1 ${compact ? 'h-[2px]' : 'h-[3.5px]'} rounded-full`}
        style={ENIGMA_GRADIENT_STYLE}
      />

      {/* Optional right element (e.g. date or badge) */}
      {rightElement && (
        <div className="shrink-0 text-right">
          {rightElement}
        </div>
      )}
    </div>
  );
};

export interface EnigmaPrintFooterProps {
  leftMain?: string;
  leftSub?: string;
  pageNumber?: string | number;
  className?: string;
  compact?: boolean;
}

export const EnigmaPrintFooter: React.FC<EnigmaPrintFooterProps> = ({
  leftMain = 'MIASIN ZOR',
  leftSub = 'Festival collective',
  pageNumber = 1,
  className = '',
  compact = false,
}) => {
  return (
    <div className={`w-full mt-auto ${compact ? 'pt-2.5' : 'pt-6'} ${className}`}>
      {/* Full width gradient bar */}
      <div
        className={`w-full ${compact ? 'h-[2px] mb-1.5' : 'h-[3.5px] mb-3'} rounded-full`}
        style={ENIGMA_GRADIENT_STYLE}
      />

      {/* Footer Text Row */}
      <div className={`flex items-center justify-between ${compact ? 'text-[9px]' : 'text-xs sm:text-[13px]'} text-slate-900 px-1 font-sans`}>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-slate-950 uppercase tracking-tight">
            {leftMain}
          </span>
          <span className="text-[8px] text-slate-950 font-bold">●</span>
          <span className="font-medium text-slate-800">
            {leftSub}
          </span>
        </div>

        {pageNumber !== undefined && pageNumber !== null && (
          <div className="font-bold text-slate-950">
            {pageNumber}
          </div>
        )}
      </div>
    </div>
  );
};

// Pure HTML string generator for external popup print windows (e.g. QR codes / badge sheets)
export const getEnigmaPrintHeaderHtml = (title = 'ENIGMA ‘26', rightHtml = ''): string => {
  return `
    <div style="width: 100%; display: flex; align-items: center; gap: 14px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        <svg style="width: 28px; height: 28px; flex-shrink: 0;" viewBox="0 0 42 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="4" y1="24" x2="10" y2="4" stroke="#ec4899" stroke-width="3" stroke-linecap="round" />
          <line x1="10" y1="24" x2="16" y2="4" stroke="#ec4899" stroke-width="3" stroke-linecap="round" />
          <line x1="20" y1="4" x2="20" y2="24" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />
          <line x1="24" y1="4" x2="24" y2="24" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />
          <line x1="28" y1="4" x2="28" y2="24" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />
          <line x1="32" y1="4" x2="32" y2="24" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />
          <line x1="36" y1="4" x2="36" y2="24" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />
        </svg>
        <span style="font-size: 22px; font-weight: 900; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.5px;">
          ${title}
        </span>
      </div>
      <div style="flex: 1; height: 3.5px; border-radius: 9999px; ${ENIGMA_GRADIENT_CSS}"></div>
      ${rightHtml ? `<div style="flex-shrink: 0; text-align: right;">${rightHtml}</div>` : ''}
    </div>
  `;
};

export const getEnigmaPrintFooterHtml = (leftMain = 'MIASIN ZOR', leftSub = 'Festival collective', pageNumber: string | number = 1): string => {
  return `
    <div style="width: 100%; margin-top: auto; padding-top: 24px;">
      <div style="width: 100%; height: 3.5px; border-radius: 9999px; margin-bottom: 12px; ${ENIGMA_GRADIENT_CSS}"></div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 0 4px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 900; text-transform: uppercase; letter-spacing: -0.3px;">${leftMain}</span>
          <span style="font-size: 10px; font-weight: 800;">●</span>
          <span style="font-weight: 500; color: #334155;">${leftSub}</span>
        </div>
        <div style="font-weight: 800; color: #0f172a;">${pageNumber}</div>
      </div>
    </div>
  `;
};
