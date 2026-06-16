import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 relative">
      <div className="bg-brand-glow absolute inset-0 -z-10" />
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo width={180} priority />
        </div>
        <div className="bg-white border border-ink-200 rounded-xl shadow-md p-8">{children}</div>
      </div>
    </main>
  );
}
