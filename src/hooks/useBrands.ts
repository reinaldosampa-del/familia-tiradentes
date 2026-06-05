import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "./useRealtime";

export type Brand = { id: string; name: string; normalized: string };

export function useBrands() {
  useRealtime("brands-list", "brands" as any, [["brands"]]);
  return useQuery({
    queryKey: ["brands"],
    queryFn: async (): Promise<Brand[]> => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, normalized")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Brand[];
    },
  });
}
