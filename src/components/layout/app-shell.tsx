import Link from "next/link";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/modules/auth/actions";
import { BrandLogo } from "@/components/brand/brand-logo";

const navigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Clientes", href: "/clientes" },
  { label: "Pagos", href: "/pagos" },
  { label: "Calendario", href: "/calendario" },
  { label: "Recibos", href: "/recibos" },
  { label: "Correos", href: "/correos" },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-once-whitesmoke text-once-midnight">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-white/10 bg-once-midnight px-5 py-6 text-white">
          <div className="mb-8 px-1">
            <BrandLogo variant="negative" width={170} />
          </div>
          <nav className="space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="border-b border-once-midnight/10 bg-white">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <BrandLogo variant="icon" width={30} />
                <div>
                  <p className="font-brand text-sm text-once-midnight">Once Once</p>
                  <p className="text-xs text-once-midnight/60">Internal Billing Platform</p>
                </div>
              </div>

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-md border border-once-midnight/15 px-3 py-2 text-sm font-medium text-once-midnight hover:bg-once-whitesmoke"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
