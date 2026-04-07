import { auth0 } from "@/lib/auth0";
import { AppShell } from "@/components/app-shell";
import { Shield, ArrowRight } from "lucide-react";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: "#06060a" }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[150px]"
          style={{ background: "rgba(139,92,246,0.06)" }}
        />

        <div className="relative z-10 text-center max-w-md px-6">
          <div className="relative inline-flex mb-8">
            <div className="absolute inset-0 rounded-2xl blur-2xl" style={{ background: "rgba(139,92,246,0.25)" }} />
            <div
              className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              <Shield className="w-8 h-8 text-violet-400" />
            </div>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-white mb-2" style={{ fontFamily: "var(--font-outfit)" }}>
            Agent<span className="text-violet-400">Gate</span>
          </h1>
          <p className="text-base text-white/40 mb-10 leading-relaxed">Permission Contracts for AI Agents</p>

          <a
            href="/auth/login"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all duration-200"
            style={{ boxShadow: "0 0 24px rgba(139,92,246,0.2)" }}
          >
            Sign in with Auth0
            <ArrowRight className="w-4 h-4" />
          </a>

          <p className="mt-16 text-[11px] text-white/15 tracking-wide uppercase">
            Auth0 for AI Agents &middot; Token Vault &middot; Vercel AI SDK
          </p>
        </div>
      </div>
    );
  }

  return <AppShell user={session.user} />;
}
