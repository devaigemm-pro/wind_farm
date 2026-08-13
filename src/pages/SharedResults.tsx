import { Suspense, useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { TurbineDetail } from './TurbineDetail';
import { LoadingSplash } from '@/components/atoms/LoadingSplash';
import { supabase } from '@/lib/supabase';

/**
 * Public shared results page — accessible without login.
 * Auto-authenticates, validates token against DB, shows results readonly.
 */
export function SharedResults() {
  const { windFarmId, turbineId } = useParams<{ windFarmId: string; turbineId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<'loading' | 'valid' | 'expired'>('loading');

  useEffect(() => {
    if (!token) { setState('expired'); return; }

    (async () => {
      // Auto-login silently
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
      }

      // Step 1: Find the token in report where storage_path = token, type = consolidated, filename starts with "share:"
      const { data: tokenData } = await (supabase as any)
        .from('report')
        .select('id, filename, generated_at')
        .eq('storage_path', token)
        .eq('type', 'consolidated')
        .like('filename', 'share:%')
        .limit(1);

      if (!tokenData || tokenData.length === 0) {
        setState('expired');
        return;
      }

      const tokenRecord = tokenData[0];
      const shareKey = (tokenRecord.filename as string).replace('share:', '');
      const tokenCreatedAt = tokenRecord.generated_at;

      // Step 2: Check if there's a "revoked-all:{shareKey}" record with generated_at AFTER the token's generated_at
      const { data: revokeData } = await (supabase as any)
        .from('report')
        .select('id, generated_at')
        .eq('filename', `revoked-all:${shareKey}`)
        .eq('type', 'consolidated')
        .gt('generated_at', tokenCreatedAt)
        .order('generated_at', { ascending: false })
        .limit(1);

      // Step 3: If revocation exists with later timestamp → EXPIRED, otherwise → VALID
      if (revokeData && revokeData.length > 0) {
        setState('expired');
      } else {
        setState('valid');
      }
    })();
  }, [token]);

  if (!windFarmId || !turbineId) {
    return <div style={center}><p style={txt}>Invalid shared link.</p></div>;
  }

  if (state === 'loading') return <LoadingSplash />;

  if (state === 'expired') {
    return (
      <div style={center}>
        <div style={{ textAlign: 'center' }}>
          <img src="/coretec-logo.svg" width="64" height="64" alt="CORE Insight" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, color: '#1e293b', margin: '0 0 8px' }}>Link Expired</h2>
          <p style={txt}>This shared link is no longer active.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/coretec-logo.svg" width="32" height="32" alt="CORE Insight" />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>Shared Inspection Results</span>
        <div style={{ width: 120 }} />
      </div>
      <div style={content}>
        <Suspense fallback={<LoadingSplash />}>
          <TurbineDetail shared />
        </Suspense>
      </div>
    </div>
  );
}

const shell: React.CSSProperties = { height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' };
const toolbar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #E5E7EB', background: '#fff', flexShrink: 0 };
const content: React.CSSProperties = { flex: 1, overflow: 'auto' };
const center: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff' };
const txt: React.CSSProperties = { fontSize: 16, color: '#555' };
