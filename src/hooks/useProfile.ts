import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStoredProfileId, setStoredProfileId } from "@/lib/profile-storage";

export type Profile = {
  id: string;
  name: string;
  icon: string;
};

export function useProfile() {
  const qc = useQueryClient();
  const [profileId, setProfileId] = useState<string | null>(() => getStoredProfileId());

  // Hydrate on mount in case of SSR
  useEffect(() => {
    const id = getStoredProfileId();
    if (id !== profileId) setProfileId(id);
  }, []);

  const query = useQuery({
    queryKey: ["profile", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<Profile | null> => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, icon")
        .eq("id", profileId)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const create = useMutation({
    mutationFn: async (input: { name: string; icon: string }) => {
      const { data, error } = await supabase
        .from("profiles")
        .insert({ name: input.name, icon: input.icon })
        .select("id, name, icon")
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (data) => {
      setStoredProfileId(data.id);
      setProfileId(data.id);
      qc.setQueryData(["profile", data.id], data);
    },
  });

  const update = useMutation({
    mutationFn: async (input: { name: string; icon: string }) => {
      if (!profileId) throw new Error("Sem perfil");
      const { data, error } = await supabase
        .from("profiles")
        .update({ name: input.name, icon: input.icon, updated_at: new Date().toISOString() })
        .eq("id", profileId)
        .select("id, name, icon")
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (data) => {
      qc.setQueryData(["profile", data.id], data);
    },
  });

  return {
    profileId,
    profile: query.data ?? null,
    isLoading: query.isLoading,
    isReady: !!profileId && !query.isLoading,
    needsSetup: !profileId || (!query.isLoading && !query.data),
    create,
    update,
  };
}
