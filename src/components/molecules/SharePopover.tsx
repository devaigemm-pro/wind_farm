import { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { restSelect, restInsert, getUserId } from '@/utils/supabaseRest';

export interface SharePopoverProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  shareKey: string;
  windFarmId?: string;
  turbineId?: string;
  campaignId?: string;
}

export function SharePopover({ anchorEl, open, onClose, shareKey, windFarmId, turbineId, campaignId }: SharePopoverProps) {
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load share data from DB on open (using REST)
  useEffect(() => {
    if (!open) return;
    (async () => {
      // Find latest share token for this shareKey
      const tokens = await restSelect('report',
        `select=storage_path,generated_at&filename=eq.share:${encodeURIComponent(shareKey)}&type=eq.consolidated&order=generated_at.desc&limit=1`
      );

      if (tokens.length > 0) {
        const latestToken = tokens[0].storage_path;
        const tokenTime = tokens[0].generated_at;

        // Check if revoked (revocation created AFTER this token)
        const revokes = await restSelect('report',
          `select=generated_at&filename=eq.revoked-all:${encodeURIComponent(shareKey)}&type=eq.consolidated&generated_at=gt.${tokenTime}&order=generated_at.desc&limit=1`
        );

        if (revokes.length > 0) {
          setCurrentToken(null);
          setEmails([]);
        } else {
          setCurrentToken(latestToken);
          const stored = localStorage.getItem(`share-emails-${shareKey}`);
          if (stored) try { setEmails(JSON.parse(stored)); } catch { setEmails([]); }
        }
      } else {
        setCurrentToken(null);
        setEmails([]);
      }
    })();
  }, [open, shareKey]);

  const handleAddUser = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    if (emails.includes(trimmed)) return;

    const updated = [...emails, trimmed];
    setEmails(updated);
    localStorage.setItem(`share-emails-${shareKey}`, JSON.stringify(updated));
    setNewEmail('');

    // Create token if needed
    if (!currentToken) {
      const token = crypto.randomUUID();
      const inspections = await restSelect('inspection', 'select=id&limit=1');
      const refId = inspections[0]?.id || '00000000-0000-4000-8000-000000000001';

      const result = await restInsert('report', {
        reference_id: refId,
        type: 'consolidated',
        generated_by: getUserId(),
        generated_at: new Date().toISOString(),
        filename: `share:${shareKey}`,
        storage_path: token,
      });

      if (result.ok) {
        setCurrentToken(token);
      } else {
        console.error('[SharePopover] Failed to create token:', result.error);
      }
    }
  };

  const handleRemoveUser = async (index: number) => {
    const updated = emails.filter((_, i) => i !== index);
    setEmails(updated);
    localStorage.setItem(`share-emails-${shareKey}`, JSON.stringify(updated));

    // If no emails left, revoke
    if (updated.length === 0) {
      const inspections = await restSelect('inspection', 'select=id&limit=1');
      const refId = inspections[0]?.id || '00000000-0000-4000-8000-000000000001';

      const result = await restInsert('report', {
        reference_id: refId,
        type: 'consolidated',
        generated_by: getUserId(),
        generated_at: new Date().toISOString(),
        filename: `revoked-all:${shareKey}`,
        storage_path: `revoked-all-${shareKey}-${Date.now()}`,
      });

      if (result.ok) {
        console.log('[SharePopover] Revocation inserted successfully');
      } else {
        console.error('[SharePopover] Revocation failed:', result.error);
      }
      setCurrentToken(null);
    }
  };

  const handleCopyLink = (index: number) => {
    let shareUrl: string;
    if (currentToken && windFarmId && turbineId) {
      const params = new URLSearchParams({ token: currentToken });
      if (campaignId) params.set('campaignId', campaignId);
      shareUrl = `${window.location.origin}/shared/${windFarmId}/${turbineId}?${params.toString()}`;
    } else {
      shareUrl = window.location.href;
    }
    navigator.clipboard.writeText(shareUrl);
    setCopiedIdx(index);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddUser(); }
  };

  if (!open || !anchorEl) return null;

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div ref={popoverRef} style={popoverStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={titleStyle}>Share results page</h3>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">×</button>
        </div>
        <p style={subtitleStyle}>This page is shared in readonly with:</p>
        <div style={listStyle}>
          {emails.length === 0 && <p style={emptyStyle}>No users added yet.</p>}
          {emails.map((email, idx) => (
            <div key={idx} style={emailRowStyle}>
              <button style={deleteBtn} onClick={() => handleRemoveUser(idx)} aria-label={`Remove ${email}`}>
                <Trash2 size={14} />
              </button>
              <span style={emailTextStyle} title={email}>{email}</span>
              <button style={copyLinkBtn} onClick={() => handleCopyLink(idx)}>
                {copiedIdx === idx ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          ))}
        </div>
        <div style={addRowStyle}>
          <input type="email" placeholder="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={handleKeyDown} style={inputStyle} />
          <button style={addBtn} onClick={handleAddUser}>Add user</button>
        </div>
      </div>
    </>
  );
}

const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 };
const popoverStyle: React.CSSProperties = { position: 'fixed', top: '56px', right: '16px', zIndex: 1000, backgroundColor: 'var(--color-neutral-0)', borderRadius: '8px', padding: '16px', width: '380px', boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)' };
const titleStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 600, margin: '0 0 4px', color: '#1e293b' };
const subtitleStyle: React.CSSProperties = { fontSize: '12px', color: '#64748b', margin: '0 0 12px' };
const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', maxHeight: '180px', overflowY: 'auto' };
const emptyStyle: React.CSSProperties = { fontSize: '12px', color: '#94a3b8', margin: 0, fontStyle: 'italic' };
const emailRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
const deleteBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '2px', display: 'flex', alignItems: 'center' };
const emailTextStyle: React.CSSProperties = { fontSize: '12px', color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const copyLinkBtn: React.CSSProperties = { backgroundColor: '#FFC107', color: '#ffffff', fontSize: '12px', borderRadius: '4px', padding: '4px 8px', border: 'none', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' };
const addRowStyle: React.CSSProperties = { display: 'flex', gap: '8px', alignItems: 'center' };
const inputStyle: React.CSSProperties = { border: '1px solid #ccc', borderRadius: '4px', padding: '6px 10px', fontSize: '12px', flex: 2, outline: 'none', fontFamily: 'inherit' };
const addBtn: React.CSSProperties = { backgroundColor: '#5A8F5A', color: '#ffffff', fontSize: '12px', borderRadius: '4px', padding: '6px 12px', border: 'none', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' };
const closeBtnStyle: React.CSSProperties = { background: 'none', border: 'none', fontSize: '20px', lineHeight: 1, cursor: 'pointer', color: '#64748b', padding: '2px 6px', borderRadius: '4px' };
