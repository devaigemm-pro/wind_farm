import { useState, useEffect } from 'react';
import { Button } from '@/components/atoms';
import { useSerialNumbers, useUpdateSerialNumbers } from '@/hooks/useWindFarmDetail';
import { useToast } from '@/store/toastStore';
import type { TurbineSerialNumbers } from '@/types';

export interface TurbineSerialNumbersModalProps {
  windFarmId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TurbineSerialNumbersModal({
  windFarmId,
  isOpen,
  onClose,
}: TurbineSerialNumbersModalProps) {
  const toast = useToast();
  const { data: serials, isLoading } = useSerialNumbers(windFarmId);
  const updateMutation = useUpdateSerialNumbers();
  const [localData, setLocalData] = useState<TurbineSerialNumbers[]>([]);

  useEffect(() => {
    if (serials) setLocalData(serials);
  }, [serials]);

  // Reset local data to server state when modal opens
  useEffect(() => {
    if (isOpen && serials) setLocalData(serials);
  }, [isOpen, serials]);

  if (!isOpen) return null;

  const handleChange = (
    index: number,
    field: keyof TurbineSerialNumbers,
    value: string | boolean,
  ) => {
    setLocalData((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as TurbineSerialNumbers;
      return next;
    });
  };

  const handleUpdate = async () => {
    try {
      await updateMutation.mutateAsync(localData);
      toast.success('Serial numbers updated');
      onClose();
    } catch {
      toast.error('Failed to update serial numbers');
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitleStyle}>Turbines serial numbers</h2>

        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Turbine</th>
                  <th style={thStyle}>Blade A</th>
                  <th style={thStyle}>Blade B</th>
                  <th style={thStyle}>Blade C</th>
                  <th style={thStyle}>Tower</th>
                  <th style={thStyle}>Anticlockwise</th>
                </tr>
              </thead>
              <tbody>
                {localData.map((row, idx) => (
                  <tr key={row.turbineId}>
                    <td style={tdStyle}>
                      <strong>{row.turbineName}</strong>
                    </td>
                    <td style={tdStyle}>
                      <input
                        style={inputStyle}
                        value={row.turbineSerial}
                        onChange={(e) => handleChange(idx, 'turbineSerial', e.target.value)}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        style={inputStyle}
                        value={row.bladeASerial}
                        onChange={(e) => handleChange(idx, 'bladeASerial', e.target.value)}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        style={inputStyle}
                        value={row.bladeBSerial}
                        onChange={(e) => handleChange(idx, 'bladeBSerial', e.target.value)}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        style={inputStyle}
                        value={row.bladeCSerial}
                        onChange={(e) => handleChange(idx, 'bladeCSerial', e.target.value)}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        style={inputStyle}
                        value={row.towerSerial}
                        onChange={(e) => handleChange(idx, 'towerSerial', e.target.value)}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={row.anticlockwise}
                        onChange={(e) => handleChange(idx, 'anticlockwise', e.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={footerStyle}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdate}
            loading={updateMutation.isPending}
          >
            Update
          </Button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-neutral-0)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)',
  width: '90%',
  maxWidth: '900px',
  maxHeight: '80vh',
  overflow: 'auto',
  boxShadow: 'var(--shadow-xl)',
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontWeight: 700,
  color: 'var(--color-primary-600)',
  marginBottom: 'var(--space-4)',
  margin: '0 0 var(--space-4) 0',
};

const tableWrapperStyle: React.CSSProperties = {
  overflowX: 'auto',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-sm)',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-2) var(--space-3)',
  fontWeight: 600,
  fontSize: 'var(--text-xs)',
  color: 'var(--color-neutral-600)',
  borderBottom: '1px solid var(--color-neutral-200)',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--color-neutral-100)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-sm)',
  backgroundColor: 'var(--color-neutral-50)',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-4)',
  paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--color-neutral-200)',
};
