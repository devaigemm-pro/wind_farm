import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const navStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    padding: 'var(--space-3) 0',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-sm)',
    overflow: 'hidden',
  };

  const linkStyle: React.CSSProperties = {
    color: 'var(--color-neutral-500)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '150px',
  };

  const currentStyle: React.CSSProperties = {
    color: 'var(--color-neutral-900)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '200px',
  };

  const separatorStyle: React.CSSProperties = {
    color: 'var(--color-neutral-400)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  };

  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" style={navStyle}>
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={item.path ?? item.label}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}
            >
              {index > 0 && (
                <span style={separatorStyle} aria-hidden="true">
                  <ChevronRight size={14} />
                </span>
              )}
              {isLast || !item.path ? (
                <span style={currentStyle} aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link to={item.path} style={linkStyle}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
