import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import type { DefectDashboardRow } from '@/types';
import { DEFECT_TYPE_DISPLAY_LABELS } from '@/types';

export interface DefectEditFormProps {
  defect: DefectDashboardRow;
  onClose: () => void;
  onUpdate: (data: DefectEditData) => void;
  onRemove: () => void;
}

export interface DefectEditData {
  type: string;
  category: number;
  rootDistance: number;
  side: string;
  notes: string;
  rootCause: string;
  nextStep: string;
}

const DEFECT_TYPES = Object.values(DEFECT_TYPE_DISPLAY_LABELS);
const BLADE_FACES = ['LE', 'TE', 'SS', 'PS'];

export function DefectEditForm({ defect, onClose, onUpdate, onRemove }: DefectEditFormProps) {
  const { t } = useLanguage();
  // Initialize directly from defect props
  const initialType = defect.type || '';
  const initialCategory = defect.category || 3;
  const initialRootDistance = defect.rootDistance ?? 0;
  const initialSide = defect.side || 'LE';
  const initialNotes = defect.notes || '';
  const initialRootCause = defect.rootCause || '';
  const initialNextStep = defect.nextStep || '';

  const [type, setType] = useState(initialType);
  const [category, setCategory] = useState(initialCategory);
  const [rootDistance, setRootDistance] = useState(initialRootDistance);
  const [side, setSide] = useState(initialSide);
  const [notes, setNotes] = useState(initialNotes);
  const [rootCause, setRootCause] = useState(initialRootCause);
  const [nextStep, setNextStep] = useState(initialNextStep);

  // Re-sync when defect changes (e.g. selecting a different defect while in edit mode)
  useEffect(() => {
    setType(defect.type || '');
    setCategory(defect.category || 3);
    setRootDistance(defect.rootDistance ?? 0);
    setSide(defect.side || 'LE');
    setNotes(defect.notes || '');
    setRootCause(defect.rootCause || '');
    setNextStep(defect.nextStep || '');
  }, [defect.id, defect.type, defect.category, defect.rootDistance, defect.side, defect.notes, defect.rootCause, defect.nextStep]);

  // Ensure defect.type is in the options list
  const currentType = defect.type || '';
  const typeOptions = DEFECT_TYPES.includes(currentType)
    ? DEFECT_TYPES
    : currentType ? [currentType, ...DEFECT_TYPES] : DEFECT_TYPES;

  // Ensure defect.side is in the options list
  const currentSide = defect.side || 'LE';
  const faceOptions = BLADE_FACES.includes(currentSide)
    ? BLADE_FACES
    : [currentSide, ...BLADE_FACES];

  const handleUpdate = () => {
    onUpdate({ type, category, rootDistance, side, notes, rootCause, nextStep });
  };

  return (
    <div style={formContainerStyle}>
      {/* Type select */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{t('defectEdit.type')}</label>
        <select
          style={selectStyle}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value={type}>{type || t('defectEdit.selectPlaceholder')}</option>
          {typeOptions.filter(t => t !== type).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Category + Root distance + Blade face row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {/* Category */}
        <div>
          <span style={inlineLabelStyle}>{t('defectEdit.category')}</span>
          <div style={buttonGroupStyle}>
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                type="button"
                style={category === val ? categoryBtnActiveStyle : categoryBtnStyle}
                onClick={() => setCategory(val)}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Root distance */}
        <div>
          <span style={inlineLabelStyle}>{t('defectEdit.rootDistance')}</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={rootDistance}
            onChange={(e) => setRootDistance(Number(e.target.value))}
            style={numberInputStyle}
          />
        </div>

        {/* Blade face */}
        <div>
          <span style={inlineLabelStyle}>{t('defectEdit.bladeFace')}</span>
          <select
            style={smallSelectStyle}
            value={side}
            onChange={(e) => setSide(e.target.value)}
          >
            <option value={side}>{side || '--'}</option>
            {faceOptions.filter(f => f !== side).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Note */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{t('defectEdit.note')}</label>
        <div style={textareaWrapperStyle}>
          <textarea
            style={textareaStyle}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('defects.descriptionPlaceholder')}
            rows={2}
          />
          {notes && (
            <button type="button" style={clearBtnStyle} onClick={() => setNotes('')} aria-label="Clear note">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Root cause */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{t('defectEdit.rootCause')}</label>
        <div style={textareaWrapperStyle}>
          <textarea
            style={textareaStyle}
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            placeholder={t('defects.causePlaceholder')}
            rows={2}
          />
          {rootCause && (
            <button type="button" style={clearBtnStyle} onClick={() => setRootCause('')} aria-label="Clear root cause">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Next step */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{t('defectEdit.nextStep')}</label>
        <div style={textareaWrapperStyle}>
          <textarea
            style={textareaStyle}
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder={t('defects.actionPlaceholder')}
            rows={2}
          />
          {nextStep && (
            <button type="button" style={clearBtnStyle} onClick={() => setNextStep('')} aria-label="Clear next step">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={buttonRowStyle}>
        <button type="button" style={removeBtnStyle} onClick={onRemove}>
          {t('defectEdit.removeDefect')}
        </button>
        <button type="button" style={closeBtnStyle} onClick={onClose}>
          {t('defectEdit.close')}
        </button>
        <button type="button" style={updateBtnStyle} onClick={handleUpdate}>
          {t('defectEdit.update')}
        </button>
      </div>
    </div>
  );
}

const formContainerStyle: React.CSSProperties = {
  padding: '16px',
  fontFamily: 'var(--font-family-sans)',
};

const fieldStyle: React.CSSProperties = {
  marginBottom: '16px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: '#666',
  marginBottom: '4px',
  fontFamily: 'var(--font-family-sans)',
};

const inlineLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: '#333',
  marginBottom: '6px',
  fontFamily: 'var(--font-family-sans)',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  fontFamily: 'var(--font-family-sans)',
  border: '1px solid #BDBDBD',
  borderRadius: '4px',
  backgroundColor: 'var(--color-neutral-0)',
  color: '#212121',
  appearance: 'auto',
  cursor: 'pointer',
};

const smallSelectStyle: React.CSSProperties = {
  width: '70px',
  padding: '6px 8px',
  fontSize: '13px',
  fontFamily: 'var(--font-family-sans)',
  border: '1px solid #BDBDBD',
  borderRadius: '4px',
  backgroundColor: 'var(--color-neutral-0)',
  color: '#212121',
  appearance: 'auto',
  cursor: 'pointer',
};

const numberInputStyle: React.CSSProperties = {
  width: '70px',
  padding: '6px 8px',
  fontSize: '13px',
  fontFamily: 'var(--font-family-sans)',
  border: '1px solid #BDBDBD',
  borderRadius: '4px',
  backgroundColor: 'var(--color-neutral-0)',
  color: '#212121',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'inline-flex',
  border: '1px solid #1976D2',
  borderRadius: '4px',
  overflow: 'hidden',
};

const categoryBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-family-sans)',
  backgroundColor: 'var(--color-neutral-0)',
  color: '#1976D2',
  border: 'none',
  borderRight: '1px solid #1976D2',
  cursor: 'pointer',
};

const categoryBtnActiveStyle: React.CSSProperties = {
  ...categoryBtnStyle,
  backgroundColor: '#1976D2',
  color: '#FFF',
};

const textareaWrapperStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-start',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 32px 10px 12px',
  fontSize: '13px',
  fontFamily: 'var(--font-family-sans)',
  border: '1px solid #BDBDBD',
  borderRadius: '4px',
  backgroundColor: 'var(--color-neutral-0)',
  color: '#212121',
  resize: 'vertical',
  minHeight: '50px',
};

const clearBtnStyle: React.CSSProperties = {
  position: 'absolute',
  right: '8px',
  top: '10px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#666',
  padding: '2px',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  marginTop: '20px',
  flexWrap: 'wrap',
};

const removeBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-family-sans)',
  backgroundColor: '#F15959',
  color: '#FFF',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  textTransform: 'uppercase',
};

const closeBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-family-sans)',
  backgroundColor: '#E0E0E0',
  color: '#333B46',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  textTransform: 'uppercase',
};

const updateBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-family-sans)',
  backgroundColor: '#4CAF50',
  color: '#FFF',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  textTransform: 'uppercase',
};
