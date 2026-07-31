'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Same project used by the legacy sync.js / topbar.js / sunpath.js —
// keeping the same URL/key means this app reads the exact rows the
// classic pages already write, no migration needed.
const SUPABASE_URL = 'https://pdropxqcdyppbjkaxgpo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7y8hvL8HV-X2YLHora2EKw_jhdTI7UH';

// Read-only pull from Supabase into localStorage (mirrors sunpath.js's
// `S.pull()`). Logging still happens on the classic pages, which own
// their own two-way sync — this hook only ever reads.
export function usePull(rows, onApplied) {
  const onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    let supa;
    try {
      supa = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
      return;
    }

    function apply(rowKey, data) {
      if (!data || typeof data !== 'object') return;
      const spec = rows[rowKey] || {};
      const want = (k) =>
        (spec.keys || []).indexOf(k) !== -1 || (spec.prefixes || []).some((p) => k.indexOf(p) === 0);
      let changed = false;
      for (const k of Object.keys(data)) {
        if (!want(k)) continue;
        const v = JSON.stringify(data[k]);
        if (localStorage.getItem(k) !== v) {
          try {
            localStorage.setItem(k, v);
            changed = true;
          } catch (e) {}
        }
      }
      if (changed) {
        try {
          onAppliedRef.current && onAppliedRef.current();
        } catch (e) {}
      }
    }

    const channels = Object.keys(rows).map((rk) => {
      supa
        .from('app_state')
        .select('data')
        .eq('key', rk)
        .maybeSingle()
        .then((r) => {
          if (!r.error && r.data) apply(rk, r.data.data);
        })
        .catch(() => {});
      return supa
        .channel('sunpath_' + rk)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.' + rk }, (p) => {
          if (p.new && p.new.data) apply(rk, p.new.data);
        })
        .subscribe();
    });

    return () => {
      channels.forEach((ch) => supa.removeChannel(ch));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
