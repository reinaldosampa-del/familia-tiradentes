import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Postgres realtime changes on a table and invalidate matching queries.
 *
 * Uses a random suffix per effect execution so each subscription always gets a
 * brand-new channel name — safe under React Strict Mode double-invoke and when
 * the same hook is used in multiple components simultaneously.
 */
export function useRealtime(
  channelName: string,
  table: "profiles" | "purchases" | "purchase_items" | "pre_list_items" | "brands",
  invalidateKeys: unknown[][],
  filter?: string,
) {
  const qc = useQueryClient();
  const invalidateKeysRef = useRef(invalidateKeys);
  invalidateKeysRef.current = invalidateKeys;

  useEffect(() => {
    // Random suffix guarantees a fresh channel name every time this effect runs,
    // even under Strict Mode or when the same channelName is used elsewhere.
    const uniqueName = `${channelName}-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase
      .channel(uniqueName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => {
          invalidateKeysRef.current.forEach((key) => {
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
