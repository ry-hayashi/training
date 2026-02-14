'use client';

import { useState, useRef, useEffect } from 'react';
import { exportAll, importMerge, getMeta } from '@/lib/db';
import type { BackupData, ImportResult } from '@/types';

export default function SettingsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Check last backup on mount
  useEffect(() => {
    getMeta('lastBackupAt').then((val) => {
      if (val) setLastBackup(val as string);
    });
  }, []);

  const handleExport = async () => {
    try {
      setStatus('エクスポート中...');
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `training-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLastBackup(data.exportedAt);
      setStatus('✅ バックアップ完了');
    } catch (e) {
      setStatus('❌ エクスポート失敗');
      console.error(e);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatus('インポート中...');
      setImportResult(null);
      const text = await file.text();
      const backup: BackupData = JSON.parse(text);

      if (!backup.schemaVersion || !backup.data) {
        setStatus('❌ 無効なバックアップファイル');
        return;
      }

      const result = await importMerge(backup);
      setImportResult(result);
      setStatus('✅ インポート完了（マージ）');
    } catch (err) {
      setStatus('❌ インポート失敗');
      console.error(err);
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">設定</h1>

      {/* Backup section */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold">バックアップ</h2>

        {lastBackup && (
          <div className="text-xs text-textMuted">
            最終バックアップ: {new Date(lastBackup).toLocaleString('ja-JP')}
          </div>
        )}

        <button
          onClick={handleExport}
          className="w-full bg-accent hover:bg-accentHover text-white py-3.5 rounded-xl font-bold transition-colors"
        >
          💾 Save & Backup (JSON)
        </button>
      </div>

      {/* Import section */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold">インポート</h2>
        <p className="text-xs text-textMuted leading-relaxed">
          マージモード: 既存IDはスキップ、新規IDのみ追加。上書き・削除なし。
        </p>

        <label className="block w-full bg-surfaceHover hover:bg-border/50 border border-border rounded-xl py-3.5 text-center font-medium cursor-pointer transition-colors">
          📂 JSONファイルを選択
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>

      {/* Status */}
      {status && (
        <div className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-center">
          {status}
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-sm">
          <h3 className="font-semibold text-xs text-textSecondary">インポート結果</h3>
          {Object.entries(importResult.added).map(([key, count]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-textSecondary">{key}</span>
              <span>
                <span className="text-success">+{count}</span>
                {' / '}
                <span className="text-textMuted">skip {importResult.skipped[key]}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* App info */}
      <div className="text-center text-xs text-textMuted py-4">
        Training Log v1.0 — データはこの端末にのみ保存
      </div>
    </div>
  );
}
