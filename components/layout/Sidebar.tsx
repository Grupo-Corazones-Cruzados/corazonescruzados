'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Globe, FolderTree, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/world', label: 'DigiMundo', icon: Globe },
  { href: '/projects', label: 'Proyectos', icon: FolderTree },
];

export default function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={onClose} />}
      <aside className={cn(
        'bg-digi-dark border-r border-digi-border flex flex-col shrink-0 z-40',
        'hidden md:flex md:w-56',
        open && 'fixed inset-y-0 left-0 flex w-56'
      )}>
        <div className="p-4 border-b border-digi-border flex items-center justify-between">
          <div>
            <h1 className="font-pixel text-sm text-digi-green tracking-wider">DigiMundo</h1>
            <p className="text-[10px] text-digi-muted font-mono mt-1">v1.0</p>
          </div>
          {open && <button onClick={onClose} className="md:hidden text-digi-muted"><X size={18} /></button>}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link key={href} href={href} onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors',
                  isActive
                    ? 'bg-digi-green/15 text-digi-green border border-digi-green/30'
                    : 'text-digi-muted hover:text-digi-text hover:bg-white/5 border border-transparent'
                )}>
                <Icon size={18} />
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-digi-border">
          <p className="text-[10px] text-digi-muted font-mono">DigiMundo</p>
        </div>
      </aside>
    </>
  );
}
