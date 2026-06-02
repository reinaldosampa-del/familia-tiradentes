import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileForm } from "./ProfileForm";
import { getIcon } from "@/lib/icons";
import type { Profile } from "@/hooks/useProfile";

interface Props {
  profile: Profile;
  onUpdate: (data: { name: string; icon: string; color: string }) => Promise<unknown> | unknown;
}

export function ProfileBadge({ profile, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const Icon = getIcon(profile.icon);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-all hover:border-primary active:scale-95"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: profile.color || "#3b82f6" }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="max-w-[120px] truncate">{profile.name}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
          </DialogHeader>
          <ProfileForm
            initialName={profile.name}
            initialIcon={profile.icon}
            initialColor={profile.color}
            submitLabel="Salvar"
            isSubmitting={saving}
            onSubmit={async (data) => {
              setSaving(true);
              try {
                await onUpdate(data);
                setOpen(false);
              } finally {
                setSaving(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
