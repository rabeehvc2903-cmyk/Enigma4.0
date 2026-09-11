import React, { useState, useEffect } from 'react';
import { festStore } from '../lib/store';

export const Countdown: React.FC = () => {
  const [config, setConfig] = useState(festStore.getCountdownConfig());

  // Sync state on store updates
  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      setConfig(festStore.getCountdownConfig());
    });
    return unsubscribe;
  }, []);

  const targetTimeStr = config.targetDate || '2026-11-15T09:00:00';
  const festDate = new Date(targetTimeStr).getTime();

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const difference = festDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);

    return () => clearInterval(timer);
  }, [festDate]);

  if (!config.show) {
    return null;
  }

  const showDays = config.showDays ?? true;
  const showHours = config.showHours ?? true;
  const showMinutes = config.showMinutes ?? true;
  const showSeconds = config.showSeconds ?? true;

  const dayLabel = config.dayLabel || 'Days';
  const hourLabel = config.hourLabel || 'Hours';
  const minLabel = config.minLabel || 'Mins';
  const secLabel = config.secLabel || 'Secs';

  const units = [
    { show: showDays, value: timeLeft.days, label: dayLabel, color: '#ff2a5f', borderColor: 'border-rose-500/50', textColor: 'text-rose-400' },
    { show: showHours, value: timeLeft.hours, label: hourLabel, color: '#ffbe0b', borderColor: 'border-amber-400/50', textColor: 'text-amber-400' },
    { show: showMinutes, value: timeLeft.minutes, label: minLabel, color: '#00f0ff', borderColor: 'border-cyan-400/50', textColor: 'text-cyan-400' },
    { show: showSeconds, value: timeLeft.seconds, label: secLabel, color: '#c084fc', borderColor: 'border-purple-400/50', textColor: 'text-purple-400' },
  ].filter(u => u.show);

  if (units.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-[#111322]/95 backdrop-blur-md border border-[#292d4a] px-3.5 py-2 sm:px-4 sm:py-2.5 relative overflow-hidden rounded-xl sm:rounded-2xl shadow-lg transition-all">
      {/* Subtle ambient lighting */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-purple-500/5 via-rose-500/5 to-amber-500/5" />

      <div className="relative z-10 flex flex-row items-center justify-between gap-2 sm:gap-4">
        {/* Title & Status Beacon */}
        <div className="flex items-center gap-2 min-w-0 shrink">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff2a5f] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff2a5f]"></span>
          </span>
          <div className="flex items-center gap-2 min-w-0 truncate">
            <h3 className="text-[11px] sm:text-xs md:text-sm font-black uppercase tracking-wider text-white truncate">
              {config.title || 'Stay Tuned'}
            </h3>
            {config.subtitle && (
              <span className="hidden md:inline-block text-[10px] text-slate-400 truncate max-w-xs border-l border-[#292d4a] pl-2">
                {config.subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Counter Display Units */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {units.map((unit, idx) => (
            <div
              key={idx}
              className={`bg-[#0a0b12] border ${unit.borderColor} px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg min-w-[42px] sm:min-w-[48px] text-center shadow-sm flex flex-col items-center justify-center transition-all`}
            >
              <span className="block text-xs sm:text-sm font-black font-mono text-white leading-none">
                {String(unit.value).padStart(2, '0')}
              </span>
              <span className={`text-[7px] sm:text-[8px] font-extrabold uppercase ${unit.textColor} block leading-none tracking-wider whitespace-nowrap mt-0.5`}>
                {unit.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

