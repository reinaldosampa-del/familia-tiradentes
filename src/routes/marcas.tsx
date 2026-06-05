import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrands } from "@/hooks/useBrands";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { normalizeName } from "@/lib/format";

export const Route = createFileRoute("/marcas")({
  head: () => ({
    meta: [
      { title: "Marcas — Lista de Compras" },
      { name: "description", content: "Cadastro de marcas conhecidas para autoidentificação nos produtos." },
    ],
  }),
  component: BrandsPage,
});

function BrandsPage() {
  const qc = useQueryClient();
  const { data: brands = [], isLoading } = useBrands();
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const norm = normalizeName(trimmed);
      if (brands.some((b) => b.normalized === norm)) return;
      const { error } = await supabase
        .from("brands")
        .insert({ name: trimmed.slice(0, 60), normalized: norm });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["brands"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-3">
          <Link
            to="/"
            aria-label="Voltar"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Marcas</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Marcas cadastradas são reconhecidas automaticamente nos nomes dos produtos.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
          className="mb-4 flex gap-2"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Ype, Camil, Omo"
            className="h-11 rounded-xl"
            maxLength={60}
          />
          <Button type="submit" disabled={!name.trim()} className="h-11 rounded-xl">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </form>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : brands.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma marca cadastrada ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {brands.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3"
              >
                <span className="font-medium">{b.name}</span>
                <button
                  onClick={() => remove.mutate(b.id)}
                  aria-label={`Remover ${b.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
