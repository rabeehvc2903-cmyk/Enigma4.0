import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Sparkles, Heart, Instagram, Youtube, Facebook, Twitter, Globe, MessageCircle } from 'lucide-react';
import { festStore } from '../lib/store';
import { SocialLinksConfig } from '../types';
import logoImg from '../assets/images/logo-01.png';

interface FooterProps {
  onNavigate: (tab: string) => void;
  onOpenGuide?: () => void;
}

const formatSocialUrl = (type: 'instagram' | 'youtube' | 'whatsapp' | 'facebook' | 'twitter' | 'website', url?: string): string => {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (type === 'instagram') {
    return `https://instagram.com/${trimmed.replace(/^@/, '')}`;
  }
  if (type === 'youtube') {
    return trimmed.startsWith('@') ? `https://youtube.com/${trimmed}` : `https://youtube.com/@${trimmed}`;
  }
  if (type === 'whatsapp') {
    if (trimmed.includes('chat.whatsapp.com')) return `https://${trimmed.replace(/^https?:\/\//, '')}`;
    return `https://wa.me/${trimmed.replace(/[^0-9+]/g, '')}`;
  }
  if (type === 'facebook') {
    return `https://facebook.com/${trimmed}`;
  }
  if (type === 'twitter') {
    return `https://x.com/${trimmed.replace(/^@/, '')}`;
  }
  return `https://${trimmed}`;
};

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [branding, setBranding] = useState(() => festStore.getBrandingConfig());
  const [socialLinks, setSocialLinks] = useState<SocialLinksConfig>(() => festStore.getSocialLinks());

  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      setBranding(festStore.getBrandingConfig());
      setSocialLinks(festStore.getSocialLinks());
    });
    return unsubscribe;
  }, []);

  const socialItems = [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: Instagram,
      url: formatSocialUrl('instagram', socialLinks.instagram),
      raw: socialLinks.instagram,
      hoverClass: 'hover:text-pink-400 hover:border-pink-500/50 hover:bg-pink-500/10 active:scale-95'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: Youtube,
      url: formatSocialUrl('youtube', socialLinks.youtube),
      raw: socialLinks.youtube,
      hoverClass: 'hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 active:scale-95'
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: MessageCircle,
      url: formatSocialUrl('whatsapp', socialLinks.whatsapp),
      raw: socialLinks.whatsapp,
      hoverClass: 'hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 active:scale-95'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      url: formatSocialUrl('facebook', socialLinks.facebook),
      raw: socialLinks.facebook,
      hoverClass: 'hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10 active:scale-95'
    },
    {
      id: 'twitter',
      name: 'Twitter / X',
      icon: Twitter,
      url: formatSocialUrl('twitter', socialLinks.twitter),
      raw: socialLinks.twitter,
      hoverClass: 'hover:text-sky-400 hover:border-sky-500/50 hover:bg-sky-500/10 active:scale-95'
    },
    {
      id: 'website',
      name: 'Website',
      icon: Globe,
      url: formatSocialUrl('website', socialLinks.website),
      raw: socialLinks.website,
      hoverClass: 'hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/10 active:scale-95'
    }
  ];

  return (
    <footer className="bg-[#0b0c16] border-t border-[#292d4a] mt-16 pt-10 pb-28 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-[#292d4a]">
          
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4 flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3.5">
              <img 
                src={branding.logoUrl || logoImg} 
                alt="Campus Logo" 
                className="max-h-14 w-auto object-contain transition-all"
                referrerPolicy="no-referrer"
              />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto md:mx-0">
              Live score calculation, real-time stage event announcements, group championship standings, and automated participant ID generation platform for {branding.college}.
            </p>

            {/* Social Media Icons */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Connect & Follow Us
              </span>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                {socialItems.map((item) => {
                  const Icon = item.icon;
                  if (item.url) {
                    return (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={item.name}
                        aria-label={item.name}
                        className={`p-2.5 rounded-xl bg-[#151728] border border-[#292d4a] text-slate-300 transition-all shadow-sm ${item.hoverClass}`}
                      >
                        <Icon className="w-4 h-4" />
                      </a>
                    );
                  }
                  return (
                    <span
                      key={item.id}
                      title={`${item.name} (Link not configured)`}
                      className="p-2.5 rounded-xl bg-[#151728]/50 border border-[#292d4a]/50 text-slate-600 cursor-not-allowed opacity-60"
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase text-white tracking-wider border-b border-[#292d4a] pb-1">
              Festival Navigation
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-purple-400 transition-colors">
                  Festival Home
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('competitions')} className="hover:text-purple-400 transition-colors">
                  Competitions & Rules
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('results')} className="hover:text-amber-400 transition-colors">
                  Live Group Standings
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('auth')} className="hover:text-indigo-400 transition-colors">
                  Sign In Portals
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-4">
          <div>
            © {new Date().getFullYear()} {branding.title} • All Rights Reserved
          </div>
          <div className="flex items-center gap-1 text-slate-400 font-sans">
            Crafted with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for {branding.college} Fest
          </div>
        </div>

      </div>
    </footer>
  );
};
