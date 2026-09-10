import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/atoms';
import { Skeleton } from '@/components/atoms/Skeleton';
import { EmptyState } from '@/components/molecules';
import { ConfirmDialog } from '@/components/organisms';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import {
  useUsersList,
  useAdminWindFarms,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useUserFarms,
} from '@/hooks/useUsers';
import { validateRut } from '@/utils/validation';
import { USER_ROLES, type Profile, type UserRole } from '@/types';

// Roles offered by the maintainer. 'client' is excluded because the DB check
// constraint on profiles.role only allows inspector/supervisor/admin.
const MANAGED_ROLES: UserRole[] = USER_ROLES.filter(
  (r): r is UserRole => r !== 'client',
);

export const UsersAdmin = () => {
  const { t } = useLanguage();
  const toast = useToast();

  const { data: users, isLoading } = useUsersList();
  const { data: farms } = useAdminWindFarms();
  const deleteUser = useDeleteUser();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [toDelete, setToDelete] = useState<Profile | null>(null);

  const farmNameById = useMemo(() => {
    const map = new Map<string, string>();
    (farms ?? []).forEach((f) => map.set(f.id, f.name));
    return map;
  }, [farms]);

  const handleNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (user: Profile) => {
    setEditing(user);
    setModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteUser.mutateAsync(toDelete.id);
      toast.success(t('users.deleted'));
    } catch {
      toast.error(t('users.deleteFailed'));
    } finally {
      setToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.toolbar}>
          <h1 style={styles.title}>{t('users.title')}</h1>
        </div>
        <div style={styles.content}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="52px" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <h1 style={styles.title}>{t('users.title')}</h1>
        <Button variant="primary" icon={Plus} onClick={handleNew} style={{ backgroundColor: '#5A8F5A' }}>
          {t('users.new')}
        </Button>
      </div>

      {/* Table */}
      <div style={styles.content}>
        {(users ?? []).length === 0 ? (
          <EmptyState title={t('users.empty')} description={t('users.emptyDesc')} />
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{t('users.name')}</th>
                  <th style={styles.th}>{t('users.lastName')}</th>
                  <th style={styles.th}>{t('users.rut')}</th>
                  <th style={styles.th}>{t('users.email')}</th>
                  <th style={styles.th}>{t('users.role')}</th>
                  <th style={styles.th}>{t('users.assignedFarms')}</th>
                  <th style={{ ...styles.th, width: '110px' }}>{t('users.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    farmNameById={farmNameById}
                    onEdit={() => handleEdit(user)}
                    onDelete={() => setToDelete(user)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <UserFormModal
          user={editing}
          onClose={() => setModalOpen(false)}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t('users.delete')}
        message={t('users.confirmDelete')}
        variant="danger"
        confirmLabel={t('users.delete')}
        cancelLabel={t('users.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

// ─── Row (loads its assigned farms) ───────────────────────────────────────────

interface UserRowProps {
  user: Profile;
  farmNameById: Map<string, string>;
  onEdit: () => void;
  onDelete: () => void;
}

function UserRow({ user, farmNameById, onEdit, onDelete }: UserRowProps) {
  const { data: farmIds } = useUserFarms(user.id);

  const farmsLabel =
    farmIds && farmIds.length > 0
      ? farmIds.map((id) => farmNameById.get(id) ?? '—').join(', ')
      : '—';

  return (
    <tr style={styles.row}>
      <td style={styles.td}>{user.name}</td>
      <td style={styles.td}>{user.last_name ?? '—'}</td>
      <td style={styles.td}>{user.rut ?? '—'}</td>
      <td style={styles.td}>{user.email}</td>
      <td style={styles.td}>{user.role}</td>
      <td style={{ ...styles.td, whiteSpace: 'normal', maxWidth: '260px' }}>{farmsLabel}</td>
      <td style={styles.td}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button style={styles.iconBtn} onClick={onEdit} aria-label="edit">
            <Pencil size={16} color="#5A8F5A" />
          </button>
          <button style={styles.iconBtn} onClick={onDelete} aria-label="delete">
            <Trash2 size={16} color="#999" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

interface UserFormModalProps {
  user: Profile | null;
  onClose: () => void;
}

function UserFormModal({ user, onClose }: UserFormModalProps) {
  const { t } = useLanguage();
  const toast = useToast();
  const isEdit = !!user;

  const { data: farms } = useAdminWindFarms();
  const { data: existingFarmIds } = useUserFarms(user?.id);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [name, setName] = useState(user?.name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [rut, setRut] = useState(user?.rut ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>((user?.role as UserRole) ?? 'inspector');
  const [selectedFarms, setSelectedFarms] = useState<Set<string>>(new Set());
  const [rutError, setRutError] = useState<string | undefined>(undefined);

  // Seed selected farms once the existing assignments load (edit mode).
  useEffect(() => {
    if (existingFarmIds) {
      setSelectedFarms(new Set(existingFarmIds));
    }
  }, [existingFarmIds]);

  const toggleFarm = (id: string) => {
    setSelectedFarms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isSaving = createUser.isPending || updateUser.isPending;

  const handleSave = async () => {
    // RUT validation (only when a value is provided).
    if (rut.trim() && !validateRut(rut.trim())) {
      setRutError(t('users.rutInvalid'));
      return;
    }
    setRutError(undefined);

    if (!name.trim()) {
      toast.error(t('users.nameRequired'));
      return;
    }

    try {
      if (isEdit && user) {
        await updateUser.mutateAsync({
          userId: user.id,
          name: name.trim(),
          last_name: lastName.trim(),
          rut: rut.trim(),
          role,
          password: password.trim() || undefined,
          windFarmIds: Array.from(selectedFarms),
        });
        toast.success(t('users.saved'));
      } else {
        if (!email.trim() || !password.trim()) {
          toast.error(t('users.credentialsRequired'));
          return;
        }
        await createUser.mutateAsync({
          email: email.trim(),
          password: password.trim(),
          name: name.trim(),
          last_name: lastName.trim(),
          rut: rut.trim(),
          role,
          windFarmIds: Array.from(selectedFarms),
        });
        toast.success(t('users.created'));
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('users.saveFailed'));
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitleStyle}>{isEdit ? t('users.edit') : t('users.new')}</h2>

        <div style={fieldGridStyle}>
          <div>
            <label style={labelStyle}>{t('users.name')} *</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>{t('users.lastName')}</label>
            <input style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>{t('users.rut')}</label>
            <input
              style={{ ...inputStyle, borderColor: rutError ? 'var(--color-danger-500)' : 'var(--color-neutral-300)' }}
              value={rut}
              onChange={(e) => {
                setRut(e.target.value);
                if (rutError) setRutError(undefined);
              }}
              placeholder="12.345.678-5"
            />
            {rutError && <span style={errorTextStyle}>{rutError}</span>}
          </div>
          <div>
            <label style={labelStyle}>{t('users.role')}</label>
            <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {MANAGED_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t('users.email')} {isEdit ? '' : '*'}</label>
            <input
              style={{ ...inputStyle, ...(isEdit ? disabledInputStyle : {}) }}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
            />
          </div>
          <div>
            <label style={labelStyle}>
              {t('users.password')} {isEdit ? `(${t('users.passwordOptional')})` : '*'}
            </label>
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        {/* Farms checklist */}
        <div style={{ marginTop: 'var(--space-4)' }}>
          <label style={labelStyle}>{t('users.farms')}</label>
          <div style={farmsBoxStyle}>
            {(farms ?? []).length === 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-400)' }}>
                {t('users.noFarms')}
              </p>
            ) : (
              (farms ?? []).map((f) => (
                <label key={f.id} style={farmItemStyle}>
                  <input
                    type="checkbox"
                    checked={selectedFarms.has(f.id)}
                    onChange={() => toggleFarm(f.id)}
                  />
                  <span>{f.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <button style={cancelBtnStyle} onClick={onClose} disabled={isSaving}>
            {t('users.cancel')}
          </button>
          <button style={saveBtnStyle} onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('users.saving') : isEdit ? t('users.save') : t('users.create')}
          </button>
        </div>
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
    padding: '0',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'var(--color-neutral-0)',
  },
  th: {
    textAlign: 'left',
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--color-neutral-600)',
    borderBottom: '2px solid var(--color-neutral-200)',
    whiteSpace: 'nowrap',
  },
  row: {
    borderBottom: '1px solid var(--color-neutral-100)',
  },
  td: {
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-800)',
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
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
  maxWidth: '640px',
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

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-3)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--color-neutral-700)',
  display: 'block',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  boxSizing: 'border-box',
  backgroundColor: 'var(--color-neutral-0)',
  color: 'var(--color-neutral-900)',
  fontFamily: 'var(--font-family-sans)',
};

const disabledInputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-neutral-100)',
  color: 'var(--color-neutral-500)',
  cursor: 'not-allowed',
};

const errorTextStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--color-danger-500)',
  marginTop: '2px',
  display: 'block',
};

const farmsBoxStyle: React.CSSProperties = {
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3)',
  maxHeight: '160px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const farmItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-neutral-800)',
  cursor: 'pointer',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-5)',
  paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--color-neutral-200)',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  backgroundColor: '#e0e0e0',
  color: '#333B46',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  backgroundColor: '#5A8F5A',
  color: '#ffffff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
};
