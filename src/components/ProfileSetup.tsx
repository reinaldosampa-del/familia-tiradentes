import { ProfileForm } from "./ProfileForm";
import { ShoppingBasket } from "lucide-react";

interface Props {
  onCreate: (data: { name: string; icon: string; color: string }) => void;
  isSubmitting?: boolean;
}

export function ProfileSetup({ onCreate, isSubmitting }: Props) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
            <ShoppingBasket className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Lista de Compras
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compartilhada em tempo real com a família
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <ProfileForm onSubmit={onCreate} isSubmitting={isSubmitting} submitLabel="Começar" />
        </div>
      </div>
    </div>
  );
}
