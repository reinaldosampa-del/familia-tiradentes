import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

let _channelCounter = 0;

/**
 * Subscribe to Postgres realtime changes on a table and invalidate matching queries.
 *
 * Each hook instance gets its own uniquely-named channel so we never try to add
 * `postgres_changes` callbacks to an already-subscribed channel (which Supabase
 * forbids and throws "cannot add … after subscribe()").
 */
export function useRealtime(
  channelName: string,
  table: "profiles" | "purchases" | "purchase_items" | "pre_list_items" | "brands",
  invalidateKeys: unknown[][],
  filter?: string,
) {
  const qc = useQueryClient();
  // Stable unique suffix per hook instance — never changes across re-renders.
  const suffixRef = useRef<number | null>(null);
  if (suffixRef.current === null) {
    suffixRef.current = ++_channelCounter;
  }

  useEffect(() => {
    const uniqueName = `${channelName}:${suffixRef.current}`;
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
