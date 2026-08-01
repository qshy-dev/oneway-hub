import { useState } from 'react';

interface AvatarProps {
  src: string;
  username: string;
  displayName: string;
  color: string;
  className?: string;
}

export function Avatar({ src, username, displayName, color, className }: AvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const initial = (displayName || username).charAt(0).toUpperCase();

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`} style={{ background: color }}>
      <div
        className={`absolute inset-0 flex items-center justify-center font-bold text-white transition-opacity duration-300 ${
          loaded && !failed ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {initial}
      </div>
      {!failed && (
        <img
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
