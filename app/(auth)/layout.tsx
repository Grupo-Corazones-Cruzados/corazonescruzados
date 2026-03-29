import PixelStars from "@/components/landing/PixelStars";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="landing-page min-h-screen flex items-center justify-center px-4 py-12 relative">
      <PixelStars count={30} />
      {/* Pixel corners */}
      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-accent/20" />
      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-accent/20" />
      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-accent/20" />
      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-accent/20" />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
