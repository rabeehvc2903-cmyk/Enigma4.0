// Clean "No Profile" Shadow Head SVG generator & presets

function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

function makeShadowHead(bg1: string, bg2: string, head1: string, head2: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <linearGradient id="head" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${head1}"/>
      <stop offset="100%" stop-color="${head2}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="80" fill="url(#bg)"/>
  <!-- Head Silhouette -->
  <circle cx="80" cy="60" r="28" fill="url(#head)"/>
  <!-- Shoulders Silhouette -->
  <path d="M30 144 C30 112 52 96 80 96 C108 96 130 112 130 144 Z" fill="url(#head)"/>
</svg>`;
  return svgToDataUrl(svg);
}

export const NO_PROFILE_AVATARS: string[] = [
  makeShadowHead('#1e2238', '#111322', '#6b7294', '#474d6d'), // Slate Shadow
  makeShadowHead('#2b1a4a', '#140c26', '#a87ff5', '#7952c4'), // Purple Dusk Silhouette
  makeShadowHead('#0f2b3c', '#081620', '#38bdf8', '#0284c7'), // Cyan Shadow
  makeShadowHead('#123326', '#091b14', '#34d399', '#059669'), // Emerald Silhouette
  makeShadowHead('#3b1d28', '#1f0d14', '#fb7185', '#e11d48'), // Rose Shadow
  makeShadowHead('#382813', '#1c1308', '#fbbf24', '#d97706'), // Amber Silhouette
  makeShadowHead('#201c38', '#0f0d1c', '#818cf8', '#4f46e5'), // Indigo Dusk
  makeShadowHead('#242938', '#131620', '#94a3b8', '#64748b'), // Steel Shadow
  makeShadowHead('#331b3b', '#1c0d21', '#e879f9', '#c026d3'), // Fuchsia Silhouette
  makeShadowHead('#0e2f33', '#06191c', '#2dd4bf', '#0d9488'), // Teal Shadow
  makeShadowHead('#1f2430', '#10131a', '#788296', '#525b6c'), // Charcoal Silhouette
  makeShadowHead('#361e1b', '#1c0e0c', '#f87171', '#dc2626')  // Crimson Shadow
];

// Alias for backwards compatibility with any existing imports
export const REAL_PEOPLE_PHOTOS = NO_PROFILE_AVATARS;

export const DEFAULT_SHADOW_AVATAR = NO_PROFILE_AVATARS[0];

export function getParticipantPhoto(name?: string, photoUrl?: string): string {
  // If user uploaded a custom base64 or valid non-unsplash image, preserve it
  if (photoUrl && photoUrl.trim().length > 0) {
    const trimmed = photoUrl.trim();
    // If it's an old Unsplash photo from previous seed data, replace with shadow head
    if (!trimmed.includes('unsplash.com/photo-')) {
      return trimmed;
    }
  }

  if (!name) {
    return DEFAULT_SHADOW_AVATAR;
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % NO_PROFILE_AVATARS.length;
  return NO_PROFILE_AVATARS[index];
}
