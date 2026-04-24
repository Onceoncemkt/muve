import { loginAction } from "@/modules/auth/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { isAuthDisabled } from "@/lib/supabase/runtime";

interface LoginPageProps {
  searchParams?: {
    error?: string;
    notice?: string;
  };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-once-whitesmoke px-6">
      <section className="w-full max-w-md rounded-xl border border-once-midnight/10 bg-white p-8 shadow-card">
        <div className="mb-5 flex items-center justify-between">
          <BrandLogo variant="positive" width={160} />
          <span className="rounded-full bg-once-midnight px-2.5 py-1 text-xs font-semibold text-white">
            Interno
          </span>
        </div>
        <h1 className="font-brand text-2xl text-once-midnight">Acceso interno</h1>
        <p className="mt-2 text-sm text-once-midnight/70">
          {isAuthDisabled
            ? "Modo local activo: acceso sin autenticación."
            : "Ingresa con un usuario interno de Supabase Auth."}
        </p>

        {searchParams?.error && (
          <p className="mt-3 rounded-md border border-once-violet/40 bg-once-violet/10 px-3 py-2 text-sm text-once-midnight">
            {searchParams.error}
          </p>
        )}
        {searchParams?.notice && (
          <p className="mt-3 rounded-md border border-once-dodger/30 bg-once-dodger/10 px-3 py-2 text-sm text-once-midnight">
            {searchParams.notice}
          </p>
        )}

        <form action={loginAction} className="mt-5 space-y-4">
          <label className="block space-y-1">
            <span className="text-sm text-once-midnight/70">Correo</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-once-midnight/20 px-3 py-2 text-sm outline-none ring-once-dodger/30 focus:ring"
            />
          </label>


          <button
            type="submit"
            className="w-full rounded-md bg-once-midnight px-4 py-2 text-sm font-medium text-white hover:bg-once-dodger"
          >
            Enviar enlace de acceso
          </button>
        </form>
      </section>
    </main>
  );
}
