import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Postgres realtime changes on a table and invalidate matching queries.
 */
export function useRealtime(
  channelName: string,
  table: "profiles" | "purchases" | "purchase_items" | "pre_list_items" | "brands",
  invalidateKeys: unknown[][],
  filter?: string,
) {
  const qc = useQueryClient();
  useEffect(() => {
    const uniqueName = `${channelName}-${Math.random().toString(36).slice(2, 10)}`;
    const ch = supabase
      .channel(uniqueName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => {
          invalidateKeys.forEach((key) => {
            qc.invalidateQueries({ queryKey: key });
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, filter]);
}
