import { useState } from 'react';
import { Send } from 'lucide-react';
import { useDefectComments, useAddDefectComment } from '@/hooks/useDefectComments';
import { Skeleton } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';

export interface DefectCommentsProps {
  defectId: string;
  showAll?: boolean;
}

export function DefectComments({ defectId, showAll = false }: DefectCommentsProps) {
  const { data: comments, isLoading } = useDefectComments(defectId);
  const addComment = useAddDefectComment();
  const [newComment, setNewComment] = useState('');
  const { t } = useLanguage();

  function handleSubmit() {
    const text = newComment.trim();
    if (!text || !defectId) return;
    addComment.mutate({ defectId, text });
    setNewComment('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  };

  const headerStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-800)',
  };

  const commentItemStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-700)',
    lineHeight: 1.4,
  };

  const authorStyle: React.CSSProperties = {
    fontWeight: 600,
    color: 'var(--color-neutral-800)',
  };

  const dateStyle: React.CSSProperties = {
    color: 'var(--color-neutral-400)',
    marginLeft: 'var(--space-2)',
  };

  const inputContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2) var(--space-3)',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-700)',
    backgroundColor: 'transparent',
  };

  const sendBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'none',
    cursor: newComment.trim() ? 'pointer' : 'default',
    color: newComment.trim() ? 'var(--color-primary-600)' : 'var(--color-neutral-300)',
    padding: 0,
  };

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <span style={headerStyle}>{t('comments.title')}</span>
        <Skeleton variant="rect" height="40px" />
        <Skeleton variant="rect" height="40px" />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <span style={headerStyle}>{t('comments.title')} ({comments?.length ?? 0})</span>

      {comments && comments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: showAll ? '200px' : 'none', overflowY: showAll ? 'auto' : 'hidden' }}>
          {(showAll ? comments : comments.slice(0, 1)).map((comment) => (
            <div key={comment.id} style={commentItemStyle}>
              <span style={authorStyle}>{comment.authorName}:</span>
              {' '}
              <span>{comment.text}</span>
              <div style={dateStyle}>{formatDate(comment.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={inputContainerStyle}>
        <input
          type="text"
          style={inputStyle}
          placeholder={t('comments.new')}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={t('comments.new')}
        />
        <button
          type="button"
          style={sendBtnStyle}
          onClick={handleSubmit}
          disabled={!newComment.trim()}
          aria-label={t('misc.sendComment')}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
