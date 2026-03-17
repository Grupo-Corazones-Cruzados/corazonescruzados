import PublicNav from '@/components/layout/PublicNav';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden">
      <PublicNav />
      <main className="flex-1 overflow-auto p-4 md:p-6 min-h-0">
        {children}
      </main>
    </div>
  );
}
