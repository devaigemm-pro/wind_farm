import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Wind } from 'lucide-react';
import { Button } from '@/components/atoms';
import { Skeleton } from '@/components/atoms/Skeleton';
import { EmptyState } from '@/components/molecules';
import {
  ConfirmDialog,
  WindFarmForm,
  TurbineForm,
  BladeForm,
} from '@/components/organisms';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import {
  useAssetTree,
  useCreateWindFarm,
  useUpdateWindFarm,
  useDeleteWindFarm,
  useCreateTurbine,
  useUpdateTurbine,
  useDeleteTurbine,
  useUpdateBlade,
} from '@/hooks/useAssetsAdmin';
import type { WindFarm, Turbine, Blade } from '@/types';
import type {
  WindFarmFormData,
  TurbineFormData,
  BladeFormData,
} from '@/utils/validation';

// ─── Modal state types ────────────────────────────────────────────────────────

type FarmModal =
  | { kind: 'create-farm' }
  | { kind: 'edit-farm'; farm: WindFarm }
  | { kind: 'create-turbine'; windFarmId: string }
  | { kind: 'edit-turbine'; turbine: Turbine }
  | { kind: 'edit-blade'; blade: Blade }
  | null;

type DeleteTarget =
  | { kind: 'farm'; item: WindFarm }
  | { kind: 'turbine'; item: Turbine }
  | null;

export const AssetsAdmin = () => {
  const { t } = useLanguage();
  const toast = useToast();

  const { data: farms, isLoading } = useAssetTree();

  const createFarm = useCreateWindFarm();
  const updateFarm = useUpdateWindFarm();
  const deleteFarm = useDeleteWindFarm();
  const createTurbine = useCreateTurbine();
  const updateTurbine = useUpdateTurbine();
  const deleteTurbine = useDeleteTurbine();
  const updateBlade = useUpdateBlade();

  const [expandedFarms, setExpandedFarms] = useState<Set<string>>(new Set());
  const [expandedTurbines, setExpandedTurbines] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<FarmModal>(null);
  const [toDelete, setToDelete] = useState<DeleteTarget>(null);

  const toggleFarm = (id: string) => {
    setExpandedFarms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTurbine = (id: string) => {
    setExpandedTurbines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const closeModal = () => setModal(null);

  // ─── Save handlers ──────────────────────────────────────────────────────────

  const handleSaveFarm = async (data: WindFarmFormData) => {
    try {
      if (modal?.kind === 'edit-farm') {
        await updateFarm.mutateAsync({
          id: modal.farm.id,
          input: {
            name: data.name,
            location: data.location,
            country: data.country ?? null,
            client: data.client ?? null,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
          },
        });
        toast.success(t('assetsAdmin.farmSaved'));
      } else {
        await createFarm.mutateAsync(data);
        toast.success(t('assetsAdmin.farmCreated'));
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('assetsAdmin.saveFailed'));
    }
  };

  const handleSaveTurbine = async (data: TurbineFormData) => {
    try {
      if (modal?.kind === 'edit-turbine') {
        await updateTurbine.mutateAsync({
          id: modal.turbine.id,
          input: {
            name: data.name,
            model: data.model ?? null,
            manufacturer: data.manufacturer ?? null,
            power_kw: data.power_kw ?? null,
            serial_number: data.serial_number ?? null,
          },
        });
        toast.success(t('assetsAdmin.turbineSaved'));
      } else {
        await createTurbine.mutateAsync(data);
        toast.success(t('assetsAdmin.turbineCreated'));
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('assetsAdmin.saveFailed'));
    }
  };

  const handleSaveBlade = async (data: BladeFormData) => {
    if (modal?.kind !== 'edit-blade') return;
    try {
      await updateBlade.mutateAsync({
        id: modal.blade.id,
        input: {
          serial_number: data.serial_number ?? null,
          length_meters: data.length_meters ?? null,
        },
      });
      toast.success(t('assetsAdmin.bladeSaved'));
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('assetsAdmin.saveFailed'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    try {
      if (toDelete.kind === 'farm') {
        await deleteFarm.mutateAsync(toDelete.item.id);
        toast.success(t('assetsAdmin.farmDeleted'));
      } else {
        await deleteTurbine.mutateAsync(toDelete.item.id);
        toast.success(t('assetsAdmin.turbineDeleted'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('assetsAdmin.deleteFailed'));
    } finally {
      setToDelete(null);
    }
  };

  const isSaving =
    createFarm.isPending ||
    updateFarm.isPending ||
    createTurbine.isPending ||
    updateTurbine.isPending ||
    updateBlade.isPending;

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.toolbar}>
          <h1 style={styles.title}>{t('assetsAdmin.title')}</h1>
        </div>
        <div style={styles.content}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="56px" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <h1 style={styles.title}>{t('assetsAdmin.title')}</h1>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setModal({ kind: 'create-farm' })}
          style={{ backgroundColor: '#5A8F5A' }}
        >
          {t('assetsAdmin.newFarm')}
        </Button>
      </div>

      {/* Tree */}
      <div style={styles.content}>
        {(farms ?? []).length === 0 ? (
          <EmptyState
            icon={Wind}
            title={t('assetsAdmin.empty')}
            description={t('assetsAdmin.emptyDesc')}
          />
        ) : (
          <div style={styles.treeWrapper}>
            {(farms ?? []).map((farm) => (
              <FarmNode
                key={farm.id}
                farm={farm}
                expanded={expandedFarms.has(farm.id)}
                expandedTurbines={expandedTurbines}
                onToggle={() => toggleFarm(farm.id)}
                onToggleTurbine={toggleTurbine}
                onEditFarm={() => setModal({ kind: 'edit-farm', farm })}
                onDeleteFarm={() => setToDelete({ kind: 'farm', item: farm })}
                onNewTurbine={() => setModal({ kind: 'create-turbine', windFarmId: farm.id })}
                onEditTurbine={(turbine) => setModal({ kind: 'edit-turbine', turbine })}
                onDeleteTurbine={(turbine) => setToDelete({ kind: 'turbine', item: turbine })}
                onEditBlade={(blade) => setModal({ kind: 'edit-blade', blade })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {(modal?.kind === 'create-farm' || modal?.kind === 'edit-farm') && (
        <Modal title={modal.kind === 'edit-farm' ? t('assetsAdmin.editFarm') : t('assetsAdmin.newFarm')} onClose={closeModal}>
          <WindFarmForm
            initialData={modal.kind === 'edit-farm' ? modal.farm : undefined}
            onSubmit={handleSaveFarm}
            onCancel={closeModal}
            loading={isSaving}
          />
        </Modal>
      )}

      {(modal?.kind === 'create-turbine' || modal?.kind === 'edit-turbine') && (
        <Modal
          title={modal.kind === 'edit-turbine' ? t('assetsAdmin.editTurbine') : t('assetsAdmin.newTurbine')}
          onClose={closeModal}
        >
          <TurbineForm
            windFarmId={modal.kind === 'edit-turbine' ? modal.turbine.wind_farm_id : modal.windFarmId}
            initialData={modal.kind === 'edit-turbine' ? modal.turbine : undefined}
            onSubmit={handleSaveTurbine}
            onCancel={closeModal}
            loading={isSaving}
          />
        </Modal>
      )}

      {modal?.kind === 'edit-blade' && (
        <Modal title={t('assetsAdmin.editBlade')} onClose={closeModal}>
          <BladeForm
            initialData={modal.blade}
            onSubmit={handleSaveBlade}
            onCancel={closeModal}
            loading={isSaving}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={toDelete?.kind === 'turbine' ? t('assetsAdmin.deleteTurbine') : t('assetsAdmin.deleteFarm')}
        message={
          toDelete?.kind === 'turbine'
            ? t('assetsAdmin.confirmDeleteTurbine')
            : t('assetsAdmin.confirmDeleteFarm')
        }
        variant="danger"
        confirmLabel={t('assetsAdmin.delete')}
        cancelLabel={t('assetsAdmin.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

// ─── Farm node ────────────────────────────────────────────────────────────────

interface FarmNodeProps {
  farm: WindFarm;
  expanded: boolean;
  expandedTurbines: Set<string>;
  onToggle: () => void;
  onToggleTurbine: (id: string) => void;
  onEditFarm: () => void;
  onDeleteFarm: () => void;
  onNewTurbine: () => void;
  onEditTurbine: (turbine: Turbine) => void;
  onDeleteTurbine: (turbine: Turbine) => void;
  onEditBlade: (blade: Blade) => void;
}

function FarmNode({
  farm,
  expanded,
  expandedTurbines,
  onToggle,
  onToggleTurbine,
  onEditFarm,
  onDeleteFarm,
  onNewTurbine,
  onEditTurbine,
  onDeleteTurbine,
  onEditBlade,
}: FarmNodeProps) {
  const { t } = useLanguage();
  const turbines = farm.turbines ?? [];

  return (
    <div style={styles.farmCard}>
      {/* Farm header */}
      <div style={styles.farmHeader}>
        <button style={styles.expandBtn} onClick={onToggle} aria-label="toggle">
          {expanded ? <ChevronDown size={18} color="#5A8F5A" /> : <ChevronRight size={18} color="#5A8F5A" />}
        </button>
        <div style={styles.farmInfo}>
          <span style={styles.farmName}>{farm.name}</span>
          <span style={styles.farmMeta}>
            {[farm.location, farm.country, farm.client].filter(Boolean).join(' · ') || '—'}
          </span>
        </div>
        <div style={styles.actions}>
          <button style={styles.iconBtn} onClick={onEditFarm} aria-label="edit-farm">
            <Pencil size={16} color="#5A8F5A" />
          </button>
          <button style={styles.iconBtn} onClick={onDeleteFarm} aria-label="delete-farm">
            <Trash2 size={16} color="#999" />
          </button>
        </div>
      </div>

      {/* Turbines */}
      {expanded && (
        <div style={styles.turbineList}>
          <div style={styles.subToolbar}>
            <Button
              variant="secondary"
              icon={Plus}
              onClick={onNewTurbine}
              style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}
            >
              {t('assetsAdmin.newTurbine')}
            </Button>
          </div>
          {turbines.length === 0 ? (
            <p style={styles.emptyLine}>{t('assetsAdmin.noTurbines')}</p>
          ) : (
            turbines.map((turbine) => (
              <TurbineNode
                key={turbine.id}
                turbine={turbine}
                expanded={expandedTurbines.has(turbine.id)}
                onToggle={() => onToggleTurbine(turbine.id)}
                onEdit={() => onEditTurbine(turbine)}
                onDelete={() => onDeleteTurbine(turbine)}
                onEditBlade={onEditBlade}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Turbine node ─────────────────────────────────────────────────────────────

interface TurbineNodeProps {
  turbine: Turbine;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditBlade: (blade: Blade) => void;
}

function TurbineNode({ turbine, expanded, onToggle, onEdit, onDelete, onEditBlade }: TurbineNodeProps) {
  const { t } = useLanguage();
  const blades = [...(turbine.blades ?? [])].sort((a, b) => a.position - b.position);

  const meta = [
    turbine.manufacturer,
    turbine.model,
    turbine.power_kw != null ? `${turbine.power_kw} kW` : null,
    turbine.serial_number ? `S/N ${turbine.serial_number}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div style={styles.turbineCard}>
      <div style={styles.turbineHeader}>
        <button style={styles.expandBtn} onClick={onToggle} aria-label="toggle-turbine">
          {expanded ? <ChevronDown size={16} color="#777" /> : <ChevronRight size={16} color="#777" />}
        </button>
        <div style={styles.farmInfo}>
          <span style={styles.turbineName}>{turbine.name}</span>
          <span style={styles.farmMeta}>{meta || '—'}</span>
        </div>
        <div style={styles.actions}>
          <button style={styles.iconBtn} onClick={onEdit} aria-label="edit-turbine">
            <Pencil size={15} color="#5A8F5A" />
          </button>
          <button style={styles.iconBtn} onClick={onDelete} aria-label="delete-turbine">
            <Trash2 size={15} color="#999" />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={styles.bladeList}>
          {blades.length === 0 ? (
            <p style={styles.emptyLine}>{t('assetsAdmin.noBlades')}</p>
          ) : (
            blades.map((blade) => (
              <div key={blade.id} style={styles.bladeRow}>
                <span style={styles.bladePosition}>
                  {t('assetsAdmin.blade')} {blade.position}
                </span>
                <span style={styles.bladeMeta}>
                  {blade.serial_number ? `S/N ${blade.serial_number}` : '—'}
                  {blade.length_meters != null ? ` · ${blade.length_meters} m` : ''}
                </span>
                <button style={styles.iconBtn} onClick={() => onEditBlade(blade)} aria-label="edit-blade">
                  <Pencil size={14} color="#5A8F5A" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitleStyle}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-family-sans)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--color-neutral-100)',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 'var(--text-xl)',
    fontWeight: 700,
    color: '#111827',
    borderLeft: '4px solid #5A8F5A',
    paddingLeft: '12px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--space-4) var(--space-5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  },
  treeWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  },
  farmCard: {
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-neutral-0)',
    overflow: 'hidden',
  },
  farmHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-4)',
  },
  farmInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  farmName: {
    fontSize: 'var(--text-sm)',
    fontWeight: 700,
    color: 'var(--color-neutral-900)',
  },
  turbineName: {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--color-neutral-800)',
  },
  farmMeta: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-neutral-500)',
  },
  actions: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
  },
  expandBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
  },
  iconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  turbineList: {
    borderTop: '1px solid var(--color-neutral-100)',
    padding: 'var(--space-3) var(--space-4) var(--space-3) var(--space-6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    backgroundColor: 'var(--color-neutral-50)',
  },
  subToolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  turbineCard: {
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-neutral-0)',
    overflow: 'hidden',
  },
  turbineHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
  },
  bladeList: {
    borderTop: '1px solid var(--color-neutral-100)',
    padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-6)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    backgroundColor: 'var(--color-neutral-50)',
  },
  bladeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: '4px 0',
  },
  bladePosition: {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--color-neutral-700)',
    width: '70px',
    flexShrink: 0,
  },
  bladeMeta: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-neutral-500)',
    flex: 1,
  },
  emptyLine: {
    margin: 0,
    fontSize: 'var(--text-xs)',
    color: 'var(--color-neutral-400)',
    padding: 'var(--space-1) 0',
  },
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
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
  maxWidth: '560px',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  boxShadow: 'var(--shadow-xl)',
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontWeight: 700,
  color: '#111827',
  borderLeft: '4px solid #5A8F5A',
  paddingLeft: '12px',
  margin: '0 0 var(--space-4) 0',
};
