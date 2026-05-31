import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useRealtime } from "@/hooks/useRealtime";
import { ProfileSetup } from "@/components/ProfileSetup";
import { ProfileBadge } from "@/components/ProfileBadge";
import { CreatePurchaseDialog } from "@/components/CreatePurchaseDialog";
import { getIcon } from "@/lib/icons";
import { formatShortDate, todayISO } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lista de Compras — Compartilhada em tempo real" },
      {
        name: "description",
        content:
          "Crie e organize compras de mercado em tempo real com sua família, direto pelo celular.",
      },
      { property: "og:title", content: "Lista de Compras" },
      { property: "og:description", content: "Lista de compras compartilhada em tempo real." },
    ],
  }),
  component: HomePage,
});

type PurchaseRow = {
  id: string;
  name: string;
  icon: string;
  budget: number;
  date: string;
};

function HomePage() {
  const { profile, profileId, isLoading, needsSetup, create, update } = useProfile();

  if (needsSetup && !isLoading) {
    return (
      <ProfileSetup
        isSubmitting={create.isPending}
        onCreate={(data) => create.mutate(data)}
      />
    );
  }

  if (!profile || !profileId) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return <PurchasesScreen profileName={profile.name} profileIcon={profile.icon}>
    <ProfileBadge profile={profile} onUpdate={(d) => update.mutateAsync(d)} />
  </PurchasesScreen>;
}

function PurchasesScreen({ children }: { profileName: string; profileIcon: string; children: React.ReactNode }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  useRealtime("purchases-list", "purchases", [["purchases"]]);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, name, icon, budget, date")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PurchaseRow[];
    },
  });

  const createPurchase = useMutation({
    mutationFn: async (input: { name: string; icon: string }) => {
      const { data, error } = await supabase
        .from("purchases")
        .insert({ name: input.name, icon: input.icon, date: todayISO(), budget: 0 })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchases"] }),
  });

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Minhas compras
            </h1>
            <p className="text-xs text-muted-foreground">Toque para abrir</p>
          </div>
          {children}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        ) : purchases.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {purchases.map((p) => (
              <li key={p.id}>
                <PurchaseCard purchase={p} />
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Floating big add button */}
      <button
        onClick={() => setCreating(true)}
        aria-label="Nova compra"
        className="fixed bottom-6 left-1/2 z-20 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition-all active:scale-95"
      >
        <Plus className="h-8 w-8" strokeWidth={2.5} />
      </button>

      <CreatePurchaseDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={async (d) => { await createPurchase.mutateAsync(d); }}
      />
    </div>
  );
}

function PurchaseCard({ purchase }: { purchase: PurchaseRow }) {
  const Icon = getIcon(purchase.icon);
  return (
    <Link
      to="/compra/$id"
      params={{ id: purchase.id }}
      className="group flex h-full flex-col items-center justify-center gap-2 rounded-3xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-[0.98]"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="h-7 w-7" />
      </span>
      <span className="text-xs font-medium text-muted-foreground">
        {formatShortDate(purchase.date)}
      </span>
      <span className="line-clamp-1 text-center text-base font-semibold text-foreground">
        {purchase.name || "Sem nome"}
      </span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Plus className="h-10 w-10" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Nenhuma compra ainda</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Toque no botão grande abaixo para criar sua primeira compra.
      </p>
    </div>
  );
}
