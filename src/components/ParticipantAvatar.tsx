import React, { useState } from 'react';
import { getParticipantPhoto } from '../lib/avatarUtils';

interface ParticipantAvatarProps {
  name: string;
  photoUrl?: string;
  className?: string;
  alt?: string;
}

export const ParticipantAvatar: React.FC<ParticipantAvatarProps> = ({
  name,
  photoUrl,
  className = "w-10 h-10",
  alt
}) => {
  const [error, setError] = useState(false);
  const src = error ? getParticipantPhoto(name) : getParticipantPhoto(name, photoUrl);

  const initials = name
    ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className={`relative inline-block overflow-hidden rounded-full shrink-0 bg-[#181b30] border border-[#292d4a] ${className}`}>
      <img
        src={src}
        alt={alt || name}
        onError={() => setError(true)}
        className="w-full h-full object-cover object-center transition-opacity duration-300"
      />
    </div>
  );
};
