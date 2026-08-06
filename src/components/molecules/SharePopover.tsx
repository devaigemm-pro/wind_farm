import { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

export interface SharePopoverProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  shareKey: string;
  windFarmId?: string;
  turbineId?: string;
}

export function SharePopover({ anchorEl, open, onClose, shareKey, windFarmId, turbineId }: SharePopoverProps) {
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const storageKey = `shared-${shareKey}`;

  // Load emails from localStorage
  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          setEmails(JSON.parse(stored));
        } catch {
          setEmails([]);
        }
      } else {
        setEmails([]);
      }
    }
  }, [open, storageKey]);

  // Persist emails to localStorage
  const persistEmails = (updated: string[]) => {
    setEmails(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleAddUser = () => {
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    if (emails.includes(trimmed)) return;
    persistEmails([...emails, trimmed]);
    setNewEmail('');
  };

  const handleRemoveUser = (index: number) => {
    const updated = emails.filter((_, i) => i !== index);
    persistEmails(updated);
  };

  const handleCopyLink = (index: number) => {
    const shareUrl = windFarmId && turbineId
      ? `${window.location.origin}/shared/${windFarmId}/${turbineId}${window.location.search}`
      : window.location.href;
    navigator.clipboard.writeText(shareUrl);
    setCopiedIdx(index);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddUser();
    }
  };

  if (!open || !anchorEl) return null;

  return (
    <>
      {/* Overlay to close on outside click */}
      <div style={overlayStyle} onClick={onClose} />

      {/* Popover */}
      <div ref={popoverRef} style={popoverStyle}>
        <h3 style={titleStyle}>Share results page</h3>
        <p style={subtitleStyle}>This page is shared in readonly with:</p>

        {/* Email list */}
        <div style={listStyle}>
          {emails.length === 0 && (
            <p style={emptyStyle}>No users added yet.</p>
          )}
          {emails.map((email, idx) => (
            <div key={idx} style={emailRowStyle}>
              <button
                style={deleteBtn}
                onClick={() => handleRemoveUser(idx)}
                aria-label={`Remove ${email}`}
              >
                <Trash2 size={14} />
              </button>
              <span style={emailTextStyle} title={email}>{email}</span>
              <button
                style={copyLinkBtn}
                onClick={() => handleCopyLink(idx)}
              >
                {copiedIdx === idx ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          ))}
        </div>

        {/* Add user input */}
        <div style={addRowStyle}>
          <input
            type="email"
            placeholder="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            style={inputStyle}
          />
          <button style={addBtn} onClick={handleAddUser}>
            Add user
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 999,
};

const popoverStyle: React.CSSProperties = {
  position: 'fixed',
  top: '56px',
  right: '16px',
  zIndex: 1000,
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '16px',
  width: '380px',
  boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  margin: '0 0 4px',
  color: '#1e293b',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
  margin: '0 0 12px',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginBottom: '12px',
  maxHeight: '180px',
  overflowY: 'auto',
};

const emptyStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: 0,
  fontStyle: 'italic',
};

const emailRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const deleteBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#EF4444',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
};

const emailTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#334155',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const copyLinkBtn: React.CSSProperties = {
  backgroundColor: '#FFC107',
  color: '#ffffff',
  fontSize: '12px',
  borderRadius: '4px',
  padding: '4px 8px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const addRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  borderRadius: '4px',
  padding: '6px 10px',
  fontSize: '12px',
  flex: 2,
  outline: 'none',
  fontFamily: 'inherit',
};

const addBtn: React.CSSProperties = {
  backgroundColor: '#4CAF50',
  color: '#ffffff',
  fontSize: '12px',
  borderRadius: '4px',
  padding: '6px 12px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};
