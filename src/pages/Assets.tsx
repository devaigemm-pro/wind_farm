import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/atoms';
import {
  AssetTree,
  AssetDetailPanel,
  WindFarmForm,
  TurbineForm,
  ConfirmDialog,
} from '@/components/organisms';
import { useAssetTree } from '@/hooks/useAssetTree';
import { useCreateWindFarm, useUpdateWindFarm, useDeleteWindFarm } from '@/hooks/useWindFarms';
import { useCreateTurbine, useUpdateTurbine, useDeleteTurbine } from '@/hooks/useTurbines';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/store/toastStore';
import { useLanguage } from '@/components/design-system';
import { AssetServiceError } from '@/services/assets.service';
import type { WindFarm, Turbine, Blade } from '@/types';
import type { WindFarmFormData } from '@/utils/validation';
import type { TurbineFormData } from '@/utils/validation';

type AssetType = 'wind_farm' | 'turbine' | 'blade';
type FormMode = 'create_wind_farm' | 'edit_wind_farm' | 'create_turbine' | 'edit_turbine' | null;

export function Assets() {
  const { role } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();

  // Tree data
  const { data: treeData, isLoading: treeLoading } = useAssetTree();

  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<AssetType | null>(null);

  // Form state
  const [formMode, setFormMode] = useState<FormMode>(null);

  // Delete confirmation
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Mobile: show detail instead of tree
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Mutations
  const createWindFarm = useCreateWindFarm();
  const updateWindFarm = useUpdateWindFarm();
  const deleteWindFarm = useDeleteWindFarm();
  const createTurbine = useCreateTurbine();
  const updateTurbine = useUpdateTurbine();
  const deleteTurbine = useDeleteTurbine();

  // Derive selected asset data from the tree
  const selectedData = useMemo((): WindFarm | Turbine | Blade | null => {
    if (!selectedId || !treeData) return null;

    for (const farm of treeData) {
      if (farm.id === selectedId) return farm;
      if (farm.turbines) {
        for (const turbine of farm.turbines) {
          if (turbine.id === selectedId) return turbine;
          if (turbine.blades) {
            for (const blade of turbine.blades) {
              if (blade.id === selectedId) return blade;
            }
          }
        }
      }
    }
    return null;
  }, [selectedId, treeData]);

  // Find the parent wind farm ID for a selected turbine
  const selectedTurbineWindFarmId = useMemo((): string | null => {
    if (!selectedId || !treeData || selectedType !== 'turbine') return null;
    for (const farm of treeData) {
      if (farm.turbines?.some((t) => t.id === selectedId)) {
        return farm.id;
      }
    }
    return null;
  }, [selectedId, selectedType, treeData]);

  const canManageAssets = role === 'supervisor' || role === 'admin';

  // Handlers
  const handleSelect = useCallback((id: string, type: AssetType) => {
    setSelectedId(id);
    setSelectedType(type);
    setFormMode(null);
    setMobileShowDetail(true);
  }, []);

  const handleMobileBack = useCallback(() => {
    setMobileShowDetail(false);
  }, []);

  const handleCreateWindFarm = useCallback(() => {
    setFormMode('create_wind_farm');
  }, []);

  const handleCreateTurbine = useCallback(() => {
    setFormMode('create_turbine');
  }, []);

  const handleEdit = useCallback(() => {
    if (selectedType === 'wind_farm') {
      setFormMode('edit_wind_farm');
    } else if (selectedType === 'turbine') {
      setFormMode('edit_turbine');
    }
  }, [selectedType]);

  const handleDelete = useCallback(() => {
    setShowConfirmDelete(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedId || !selectedType) return;

    try {
      if (selectedType === 'wind_farm') {
        await deleteWindFarm.mutateAsync(selectedId);
      } else if (selectedType === 'turbine') {
        await deleteTurbine.mutateAsync(selectedId);
      }
      toast.success(`${selectedType === 'wind_farm' ? t('toast.windFarmDeleted') : t('toast.turbineDeleted')}`);
      setSelectedId(null);
      setSelectedType(null);
      setMobileShowDetail(false);
    } catch (err) {
      if (err instanceof AssetServiceError && err.code === '23503') {
        toast.error(err.message);
      } else {
        toast.error(t('toast.deleteAssetFailed'));
      }
    } finally {
      setShowConfirmDelete(false);
    }
  }, [selectedId, selectedType, deleteWindFarm, deleteTurbine, toast]);

  const handleCancelDelete = useCallback(() => {
    setShowConfirmDelete(false);
  }, []);

  const handleWindFarmSubmit = useCallback(
    async (data: WindFarmFormData) => {
      try {
        if (formMode === 'create_wind_farm') {
          await createWindFarm.mutateAsync(data);
          toast.success(t('toast.windFarmCreated'));
        } else if (formMode === 'edit_wind_farm' && selectedId) {
          await updateWindFarm.mutateAsync({ id: selectedId, input: data });
          toast.success(t('toast.windFarmUpdated'));
        }
        setFormMode(null);
      } catch (err) {
        if (err instanceof AssetServiceError) {
          toast.error(err.message);
        } else {
          toast.error(t('toast.saveWindFarmFailed'));
        }
      }
    },
    [formMode, selectedId, createWindFarm, updateWindFarm, toast],
  );

  const handleTurbineSubmit = useCallback(
    async (data: TurbineFormData) => {
      try {
        if (formMode === 'create_turbine') {
          await createTurbine.mutateAsync(data);
          toast.success(t('toast.turbineCreated'));
        } else if (formMode === 'edit_turbine' && selectedId) {
          await updateTurbine.mutateAsync({ id: selectedId, input: data });
          toast.success(t('toast.turbineUpdated'));
        }
        setFormMode(null);
      } catch (err) {
        if (err instanceof AssetServiceError) {
          toast.error(err.message);
        } else {
          toast.error(t('toast.saveTurbineFailed'));
        }
      }
    },
    [formMode, selectedId, createTurbine, updateTurbine, toast],
  );

  const handleFormCancel = useCallback(() => {
    setFormMode(null);
  }, []);

  // Determine turbine form's wind farm ID for creating a turbine
  const turbineFormWindFarmId = useMemo((): string => {
    if (formMode === 'edit_turbine' && selectedTurbineWindFarmId) {
      return selectedTurbineWindFarmId;
    }
    // When creating, use the selected wind farm or the parent of the selected turbine
    if (selectedType === 'wind_farm' && selectedId) {
      return selectedId;
    }
    if (selectedTurbineWindFarmId) {
      return selectedTurbineWindFarmId;
    }
    // Fallback to first wind farm if available
    return treeData?.[0]?.id ?? '';
  }, [formMode, selectedType, selectedId, selectedTurbineWindFarmId, treeData]);

  // Styles
  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-family-sans)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-4)',
    borderBottom: '1px solid var(--color-neutral-100)',
    flexShrink: 0,
  };

  const headerTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--text-xl)',
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
  };

  const headerActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--space-2)',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  };

  const treePanelStyle: React.CSSProperties = {
    width: '300px',
    flexShrink: 0,
    borderRight: '1px solid var(--color-neutral-100)',
    overflow: 'auto',
  };

  const detailPanelStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  };

  const detailActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-4)',
    borderBottom: '1px solid var(--color-neutral-100)',
  };

  // Mobile styles (below 768px handled via media queries workaround with inline logic)
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;

  // Render form overlay in the detail panel
  const renderForm = () => {
    if (formMode === 'create_wind_farm' || formMode === 'edit_wind_farm') {
      return (
        <div style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-neutral-900)' }}>
            {formMode === 'create_wind_farm' ? t('assets.createWindFarm') : t('assets.editWindFarm')}
          </h3>
          <WindFarmForm
            initialData={formMode === 'edit_wind_farm' ? (selectedData as WindFarm) : undefined}
            onSubmit={handleWindFarmSubmit}
            onCancel={handleFormCancel}
            loading={createWindFarm.isPending || updateWindFarm.isPending}
          />
        </div>
      );
    }

    if (formMode === 'create_turbine' || formMode === 'edit_turbine') {
      return (
        <div style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-neutral-900)' }}>
            {formMode === 'create_turbine' ? t('assets.createTurbine') : t('assets.editTurbine')}
          </h3>
          <TurbineForm
            windFarmId={turbineFormWindFarmId}
            initialData={formMode === 'edit_turbine' ? (selectedData as Turbine) : undefined}
            onSubmit={handleTurbineSubmit}
            onCancel={handleFormCancel}
            loading={createTurbine.isPending || updateTurbine.isPending}
          />
        </div>
      );
    }

    return null;
  };

  // Mobile layout
  if (isMobileView) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          {mobileShowDetail && (
            <Button variant="ghost" size="sm" onClick={handleMobileBack} aria-label={t('assets.backToTree')}>
              <ArrowLeft size={16} />
            </Button>
          )}
          <h1 style={headerTitleStyle}>{t('page.assets')}</h1>
          {canManageAssets && (
            <div style={headerActionsStyle}>
              <Button variant="primary" size="sm" onClick={handleCreateWindFarm}>
                <Plus size={14} /> Farm
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCreateTurbine}>
                <Plus size={14} /> Turbine
              </Button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {mobileShowDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {canManageAssets && selectedId && (selectedType === 'wind_farm' || selectedType === 'turbine') && !formMode && (
                <div style={detailActionsStyle}>
                  <Button variant="ghost" size="sm" onClick={handleEdit}>
                    <Pencil size={14} /> {t('button.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDelete}>
                    <Trash2 size={14} /> {t('button.delete')}
                  </Button>
                </div>
              )}
              {formMode ? renderForm() : (
                <AssetDetailPanel
                  type={selectedType}
                  data={selectedData}
                  loading={treeLoading}
                />
              )}
            </div>
          ) : (
            <AssetTree data={treeData} selectedId={selectedId} onSelect={handleSelect} />
          )}
        </div>

        <ConfirmDialog
          open={showConfirmDelete}
          title={selectedType === 'wind_farm' ? t('assets.deleteWindFarm') : t('assets.deleteTurbine')}
          message={selectedType === 'wind_farm' ? t('assets.confirmDeleteWindFarm') : t('assets.confirmDeleteTurbine')}
          confirmLabel={t('button.delete')}
          cancelLabel={t('button.cancel')}
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={headerTitleStyle}>{t('page.assets')}</h1>
        {canManageAssets && (
          <div style={headerActionsStyle}>
            <Button variant="primary" size="sm" onClick={handleCreateWindFarm}>
              <Plus size={14} /> {t('button.addWindFarm')}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCreateTurbine}>
              <Plus size={14} /> {t('button.addTurbine')}
            </Button>
          </div>
        )}
      </div>

      <div style={contentStyle}>
        {/* Tree panel */}
        <div style={treePanelStyle}>
          <AssetTree data={treeData} selectedId={selectedId} onSelect={handleSelect} />
        </div>

        {/* Detail panel */}
        <div style={detailPanelStyle}>
          {canManageAssets && selectedId && (selectedType === 'wind_farm' || selectedType === 'turbine') && !formMode && (
            <div style={detailActionsStyle}>
              <Button variant="ghost" size="sm" onClick={handleEdit}>
                <Pencil size={14} /> {t('button.edit')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 size={14} /> {t('button.delete')}
              </Button>
            </div>
          )}
          {formMode ? renderForm() : (
            <AssetDetailPanel
              type={selectedType}
              data={selectedData}
              loading={treeLoading}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showConfirmDelete}
        title={selectedType === 'wind_farm' ? t('assets.deleteWindFarm') : t('assets.deleteTurbine')}
        message={selectedType === 'wind_farm' ? t('assets.confirmDeleteWindFarm') : t('assets.confirmDeleteTurbine')}
        confirmLabel={t('button.delete')}
        cancelLabel={t('button.cancel')}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
