import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Postgres realtime changes on a table and invalidate matching queries.
 */
export function useRealtime(
  channelName: string,
  table: "profiles" | "purchases" | "purchase_items" | "pre_list_items",
  invalidateKeys: unknown[][],
  filter?: string,
) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(channelName)
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
