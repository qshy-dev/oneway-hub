import { useState } from 'react';

interface AvatarProps {
  src: string;
  username: string;
  displayName: string;
  color: string;
  className?: string;
}

export function Avatar({ src, username, displayName, color, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`flex items-center justify-center font-bold text-white ${className ?? ''}`}
        style={{ background: color }}
      >
        {(displayName || username).charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
