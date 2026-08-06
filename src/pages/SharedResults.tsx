import { Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { TurbineDetail } from './TurbineDetail';
import { LoadingSplash } from '@/components/atoms/LoadingSplash';

/**
 * Public shared results page.
 * Renders TurbineDetail in a full-screen layout without sidebar or AuthGuard.
 * A minimal toolbar shows the CORE Insight logo.
 */
export function SharedResults() {
  const { windFarmId, turbineId } = useParams<{ windFarmId: string; turbineId: string }>();

  if (!windFarmId || !turbineId) {
    return (
      <div style={errorContainer}>
        <p style={errorText}>Invalid shared link. Missing wind farm or turbine ID.</p>
      </div>
    );
  }

  return (
    <div style={shell}>
      {/* Minimal toolbar */}
      <div style={toolbar}>
        <div style={logoGroup}>
          <img src="/coretec-logo.svg" width="32" height="32" alt="CORE Insight" />
          <img src="/coretec-wordmark.svg" height="18" alt="CORE Insight" />
        </div>
        <span style={titleStyle}>Shared Inspection Results</span>
        <div style={{ width: 120 }} />
      </div>

      {/* Main content: TurbineDetail in shared (readonly) mode */}
      <div style={content}>
        <Suspense fallback={<LoadingSplash />}>
          <TurbineDetail shared />
        </Suspense>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'var(--font-family-sans)',
  background: '#fff',
};

const toolbar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 20px',
  borderBottom: '1px solid #E5E7EB',
  background: '#fff',
  flexShrink: 0,
};

const logoGroup: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#333',
};

const content: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

const errorContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  background: '#fff',
};

const errorText: React.CSSProperties = {
  fontSize: 16,
  color: '#555',
};
