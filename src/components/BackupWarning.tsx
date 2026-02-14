'use client';

import { useEffect, useState } from 'react';
import { getMeta } from '@/lib/db';
import { daysSinceBackup } from '@/lib/aggregations';
import Link from 'next/link';

export default function BackupWarning() {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const last = (await getMeta('lastBackupAt')) as string | undefined;
        const d = daysSinceBackup(last ?? null);
        setDays(d);
      } catch {
        // DB not ready yet
      }
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  // Show warning if never backed up (null) or 30+ days
  if (days !== null && days < 30) return null;

  return (
    <Link href="/settings" className="block">
      <div className="bg-warning/10 border-b border-warning/30 px-4 py-2.5 text-center">
        <span className="text-warning text-sm font-medium">
          ⚠️ {days === null ? 'バックアップ未実施' : `${days}日間バックアップなし`}
          — 設定からバックアップ →
        </span>
      </div>
    </Link>
  );
}
