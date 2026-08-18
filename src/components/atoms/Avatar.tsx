import { useState } from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

const fontSizeMap: Record<AvatarSize, string> = {
  sm: 'var(--text-xs)',
  md: 'var(--text-sm)',
  lg: 'var(--text-lg)',
};

const statusColors: Record<AvatarStatus, string> = {
  online: 'var(--color-success-500)',
  offline: 'var(--color-neutral-400)',
  busy: 'var(--color-danger-500)',
  away: 'var(--color-warning-500)',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ src, alt, name, size = 'md', status }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const dimension = sizeMap[size];
  const showImage = src && !imgError;
  const initials = name ? getInitials(name) : '?';

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: dimension,
    height: dimension,
    borderRadius: 'var(--radius-full)',
    backgroundColor: '#5A8F5A',
    color: '#FFFFFF',
    fontSize: fontSizeMap[size],
    fontWeight: 600,
    fontFamily: 'var(--font-family-sans)',
    overflow: 'hidden',
    flexShrink: 0,
  };

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  const statusDotSize = size === 'sm' ? 8 : size === 'md' ? 10 : 14;
  const statusDotStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: statusDotSize,
    height: statusDotSize,
    borderRadius: 'var(--radius-full)',
    backgroundColor: status ? statusColors[status] : undefined,
    border: '2px solid var(--color-neutral-0)',
  };

  return (
    <div style={containerStyle} role="img" aria-label={alt ?? name ?? 'Avatar'}>
      {showImage ? (
        <img src={src} alt={alt ?? name ?? ''} style={imgStyle} onError={() => setImgError(true)} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
      {status && <span style={statusDotStyle} aria-label={`Status: ${status}`} />}
    </div>
  );
}
