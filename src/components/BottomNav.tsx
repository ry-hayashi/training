'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const tabs = [
  { href: '/', label: '種目', icon: '🏋️' },
  { href: '/templates', label: 'テンプレ', icon: '📋' },
  { href: '/graph', label: 'グラフ', icon: '📊' },
  { href: '/settings', label: '設定', icon: '⚙️' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-border z-50">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const active =
            tab.href === '/'
              ? pathname === '/' || pathname.startsWith('/exercises')
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
                active ? 'text-accent' : 'text-textMuted hover:text-textSecondary'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
