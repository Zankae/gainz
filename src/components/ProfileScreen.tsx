import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../theme';
import type { Preference } from '../theme';
import {
  db,
  normalizeQuarterKg,
  exportBackup,
  restoreBackup,
  type BodyweightEntry,
} from '../gainz-db';
import StepperInput from './StepperInput';
import ConfirmDialog from './ConfirmDialog';

export default function ProfileScreen() {
  const { preference, setPreference } = useTheme();
  const [bodyweightEntries, setBodyweightEntries] = useState<BodyweightEntry[]>([]);
  const [bwValue, setBwValue] = useState(70);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void; destructive?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const entries = await db.bodyweight.orderBy('at').reverse().toArray();
    setBodyweightEntries(entries);
    const setting = await db.settings.get('lastBackupAt');
    setLastBackup(setting ? (setting.value as number) : null);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // --- Bodyweight ---
  const logBodyweight = async () => {
    const kg = normalizeQuarterKg(bwValue);
    await db.bodyweight.add({ at: Date.now(), kg });
    showToast(`Bodyweight logged: ${kg.toFixed(2)} kg`);
    loadData();
  };

  const deleteBodyweight = (entry: BodyweightEntry) => {
    setConfirm({
      title: 'Delete Entry',
      message: `Delete bodyweight entry from ${new Date(entry.at).toLocaleDateString()}?`,
      destructive: true,
      onConfirm: async () => {
        if (entry.id) await db.bodyweight.delete(entry.id);
        setConfirm(null);
        loadData();
      },
    });
  };

  // --- Export ---
  const handleExport = async () => {
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gainz-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded');
      loadData();
    } catch {
      showToast('Export failed');
    }
  };

  // --- Restore ---
  const handleRestoreClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setConfirm({
        title: 'Restore Backup',
        message: `This will replace ALL your data with the backup. Make sure you've exported a safety copy first.\n\nBackup date: ${new Date(data.exportedAt).toLocaleString()}`,
        destructive: true,
        onConfirm: async () => {
          try {
            await restoreBackup(data);
            setConfirm(null);
            showToast('Backup restored successfully');
            loadData();
          } catch (err) {
            setConfirm(null);
            showToast(err instanceof Error ? err.message : 'Restore failed');
          }
        },
      });
    } catch {
      showToast('Invalid backup file');
    }
    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  };

  // --- Theme options ---
  const options: { value: Preference; label: string }[] = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div style={{ padding: '16px', paddingBottom: 80 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 20 }}>Profile</h2>

      {/* Theme */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
          Theme
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPreference(opt.value)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 'var(--radius-sm)',
                background: preference === opt.value ? 'var(--accent-dim)' : 'var(--surface-2)',
                color: preference === opt.value ? 'var(--accent)' : 'var(--muted)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bodyweight log */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
          Log Bodyweight
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <StepperInput mode="weight" value={bwValue} onChange={setBwValue} />
          </div>
          <button
            onClick={logBodyweight}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontSize: 14,
              fontWeight: 600,
              height: 36,
            }}
          >
            LOG
          </button>
        </div>

        {/* Recent entries */}
        {bodyweightEntries.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Recent entries
            </div>
            {bodyweightEntries.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>
                  <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>
                    {entry.kg.toFixed(2)} kg
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
                    {new Date(entry.at).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => deleteBodyweight(entry)}
                  style={{ fontSize: 14, color: 'var(--loss)', padding: '2px 4px' }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup & Restore */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
          Backup & Restore
        </div>

        {lastBackup && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Last backup: {new Date(lastBackup).toLocaleString()}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleExport}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--gain-dim)',
              color: 'var(--gain)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Export Backup
          </button>
          <button
            onClick={handleRestoreClick}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--loss-dim)',
              color: 'var(--loss)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Restore Backup
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
          Export saves all your data as a JSON file. Restore replaces everything — make sure to export a safety copy first.
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          borderRadius: 'var(--radius)',
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          fontSize: 13,
          fontWeight: 600,
          zIndex: 500,
          boxShadow: '0 4px 16px var(--shadow)',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={confirm?.destructive ? 'Delete' : 'OK'}
        destructive={confirm?.destructive}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
