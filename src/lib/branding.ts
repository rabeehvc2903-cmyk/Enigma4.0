import { BrandingConfig } from '../types';

export const FONT_OPTIONS = [
  { label: 'Plus Jakarta Sans (Modern Clean - Default)', value: "'Plus Jakarta Sans', sans-serif" },
  { label: 'Inter (Crisp Tech UI)', value: "'Inter', sans-serif" },
  { label: 'Outfit (Sleek Geometric)', value: "'Outfit', sans-serif" },
  { label: 'Poppins (Friendly Rounded)', value: "'Poppins', sans-serif" },
  { label: 'Montserrat (Bold Luxury)', value: "'Montserrat', sans-serif" },
  { label: 'Playfair Display (Elegant Serif)', value: "'Playfair Display', serif" },
  { label: 'Cinzel (Classic Royal Serif)', value: "'Cinzel', serif" },
  { label: 'Space Grotesk (Futuristic Tech)', value: "'Space Grotesk', sans-serif" },
  { label: 'Fira Code (Technical Monospace)', value: "'Fira Code', monospace" },
  { label: 'System Default Sans', value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
];

export function applyBrandingToDocument(branding: BrandingConfig) {
  if (typeof document === 'undefined') return;

  const font = branding.fontFamily || "'Plus Jakarta Sans', sans-serif";
  const headingFont = branding.headingFontFamily || font;

  document.documentElement.style.setProperty('--font-family', font);
  document.documentElement.style.setProperty('--heading-font-family', headingFont);

  if (branding.primaryColor) {
    document.documentElement.style.setProperty('--accent-purple', branding.primaryColor);
    document.documentElement.style.setProperty('--border-glow', branding.primaryColor);
  }
  if (branding.secondaryColor) {
    document.documentElement.style.setProperty('--accent-indigo', branding.secondaryColor);
  }
  if (branding.bgDarkColor) {
    document.documentElement.style.setProperty('--bg-dark', branding.bgDarkColor);
  }
  if (branding.bgCardColor) {
    document.documentElement.style.setProperty('--bg-card', branding.bgCardColor);
  }

  // Dynamically update browser tab favicon
  const faviconHref = branding.logoUrl || '/favicon.png';
  let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = faviconHref;

  // Dynamically update browser tab title
  if (branding.title) {
    document.title = branding.tag ? `${branding.title} ${branding.tag}` : branding.title;
  }
}
