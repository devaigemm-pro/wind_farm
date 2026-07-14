import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/atoms';

export interface EmptyStateProps {
  icon?: LucideIcon;
  emoji?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: IconComponent,
  emoji,
  title,
  description,
  action,
}: EmptyStateProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-12) var(--space-6)',
    textAlign: 'center',
    fontFamily: 'var(--font-family-sans)',
  };

  const iconWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-neutral-100)',
    color: 'var(--color-neutral-400)',
    marginBottom: 'var(--space-4)',
  };

  const emojiStyle: React.CSSProperties = {
    fontSize: 'var(--text-3xl)',
    marginBottom: 'var(--space-4)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--text-lg)',
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
    margin: 0,
    marginBottom: 'var(--space-2)',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-500)',
    margin: 0,
    maxWidth: '320px',
    lineHeight: 1.5,
  };

  const actionStyle: React.CSSProperties = {
    marginTop: 'var(--space-6)',
  };

  return (
    <div style={containerStyle} role="status">
      {IconComponent && (
        <div style={iconWrapperStyle}>
          <IconComponent size={28} aria-hidden="true" />
        </div>
      )}
      {emoji && !IconComponent && (
        <div style={emojiStyle} aria-hidden="true">
          {emoji}
        </div>
      )}
      <h3 style={titleStyle}>{title}</h3>
      {description && <p style={descriptionStyle}>{description}</p>}
      {action && (
        <div style={actionStyle}>
          <Button variant="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
