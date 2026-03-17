'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderTree, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/panel/projects', label: 'Proyectos', icon: FolderTree },
  { href: '/panel/tasks', label: 'Incidencias', icon: ClipboardList },
];

export default function PublicNav() {
  const pathname = usePathname();

  return (
    <header className="bg-[#111111] border-b border-[#2a2a2a] shrink-0">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-12">
        <span className="text-sm font-bold tracking-wide" style={{ fontFamily: 'Silkscreen, cursive' }}>
          GCC World
        </span>
        <nav className="flex gap-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-[#737373] hover:text-white hover:bg-white/5',
                )}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
