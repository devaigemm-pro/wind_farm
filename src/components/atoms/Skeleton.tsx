export type SkeletonVariant = 'text' | 'circle' | 'rect';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
}

const pulseKeyframes = `
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

let styleInjected = false;

function injectStyles() {
  if (styleInjected || typeof document === 'undefined') return;
  const styleEl = document.createElement('style');
  styleEl.textContent = pulseKeyframes;
  document.head.appendChild(styleEl);
  styleInjected = true;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  borderRadius,
}: SkeletonProps) {
  injectStyles();

  const variantDefaults: Record<SkeletonVariant, React.CSSProperties> = {
    text: {
      width: width ?? '100%',
      height: height ?? '1em',
      borderRadius: borderRadius ?? 'var(--radius-sm)',
    },
    circle: {
      width: width ?? '40px',
      height: height ?? '40px',
      borderRadius: 'var(--radius-full)',
    },
    rect: {
      width: width ?? '100%',
      height: height ?? '100px',
      borderRadius: borderRadius ?? 'var(--radius-md)',
    },
  };

  const style: React.CSSProperties = {
    display: 'block',
    backgroundColor: 'var(--color-neutral-200)',
    animation: `skeleton-pulse var(--duration-slower) var(--easing-default) infinite`,
    ...variantDefaults[variant],
  };

  return <div style={style} aria-hidden="true" role="presentation" />;
}
