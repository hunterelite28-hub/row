'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Same project used everywhere else in the app.
const SUPABASE_URL = 'https://pdropxqcdyppbjkaxgpo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7y8hvL8HV-X2YLHora2EKw_jhdTI7UH';

// Two-way sync, ported from the legacy sync.js's `initCloudSync()`.
// Monkey-patches localStorage.setItem/removeItem so that any write to a
// matched key schedules a debounced push to Supabase; remote changes are
// applied back into localStorage and `onApplied` is called so the page
// can re-render. Pages that still run the legacy sync.js (goals.html
// etc., until migrated) write to the SAME app_state row/key, so this
// hook stays interoperable with them during the migration.
export function useCloudSync({ appKey, syncedKeys = [], syncedPrefixes = [], onApplied }) {
  const onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;

  useEffect(() => {
    if (!appKey || !SUPABASE_URL || !SUPABASE_KEY) return;

    let supa = null;
    let pushTimer = null;
    let suppressSync = false;
    let lastSyncedJson = null;
    let destroyed = false;

    function matches(k) {
      if (!k) return false;
      if (syncedKeys.indexOf(k) !== -1) return true;
      for (let i = 0; i < syncedPrefixes.length; i++) {
        if (k.indexOf(syncedPrefixes[i]) === 0) return true;
      }
      return false;
    }
    function listAllKeys() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (matches(k)) out.push(k);
      }
      return out;
    }
    function collect() {
      const out = {};
      for (const k of listAllKeys()) {
        const v = localStorage.getItem(k);
        if (v == null) continue;
        try {
          out[k] = JSON.parse(v);
        } catch (e) {
          out[k] = v;
        }
      }
      return out;
    }

    const origSet = localStorage.setItem.bind(localStorage);
    const origRemove = localStorage.removeItem.bind(localStorage);
    function beat() {
      try {
        origSet('os_last_sync', String(Date.now()));
      } catch (e) {}
    }
    localStorage.setItem = function (k, v) {
      origSet(k, v);
      try {
        if (!suppressSync && matches(k)) schedulePush();
      } catch (e) {}
    };
    localStorage.removeItem = function (k) {
      origRemove(k);
      try {
        if (!suppressSync && matches(k)) schedulePush();
      } catch (e) {}
    };

    function applyRemote(remote) {
      if (!remote || typeof remote !== 'object') return false;
      suppressSync = true;
      let changed = false;
      try {
        for (const k of Object.keys(remote)) {
          if (!matches(k)) continue;
          const incoming = JSON.stringify(remote[k]);
          const local = localStorage.getItem(k);
          if (local !== incoming) {
            try {
              origSet(k, incoming);
              changed = true;
            } catch (e) {}
          }
        }
        for (const k of listAllKeys()) {
          if (!(k in remote)) {
            try {
              origRemove(k);
              changed = true;
            } catch (e) {}
          }
        }
      } finally {
        suppressSync = false;
      }
      if (changed) {
        try {
          onAppliedRef.current && onAppliedRef.current();
        } catch (e) {}
      }
      return changed;
    }
    async function pushNow() {
      if (!supa) return;
      const state = collect();
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) return;
      try {
        const { error } = await supa.from('app_state').upsert({ key: appKey, data: state, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (!error) {
          lastSyncedJson = json;
          beat();
        }
      } catch (e) {}
    }
    function schedulePush() {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(pushNow, 250);
    }
    function flushOnUnload() {
      const state = collect();
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) return;
      try {
        fetch(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ key: appKey, data: state, updated_at: new Date().toISOString() }),
          keepalive: true,
        }).catch(() => {});
        lastSyncedJson = json;
      } catch (e) {}
    }

    let channel = null;
    (async function init() {
      supa = createClient(SUPABASE_URL, SUPABASE_KEY);
      try {
        const { data, error } = await supa.from('app_state').select('data').eq('key', appKey).maybeSingle();
        if (destroyed) return;
        if (!error && data && data.data && Object.keys(data.data).length > 0) {
          lastSyncedJson = JSON.stringify(data.data);
          applyRemote(data.data);
          beat();
        } else if (Object.keys(collect()).length > 0) {
          schedulePush();
        }
      } catch (e) {}
      if (destroyed) return;
      channel = supa
        .channel('app_state_' + appKey)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.' + appKey }, (payload) => {
          if (!payload.new || !payload.new.data) return;
          const incoming = JSON.stringify(payload.new.data);
          if (incoming === lastSyncedJson) return;
          lastSyncedJson = incoming;
          applyRemote(payload.new.data);
          beat();
        })
        .subscribe();
    })();

    function onStorage(e) {
      if (e.key && matches(e.key)) schedulePush();
    }
    window.addEventListener('beforeunload', flushOnUnload);
    window.addEventListener('pagehide', flushOnUnload);
    window.addEventListener('storage', onStorage);

    return () => {
      destroyed = true;
      localStorage.setItem = origSet;
      localStorage.removeItem = origRemove;
      clearTimeout(pushTimer);
      window.removeEventListener('beforeunload', flushOnUnload);
      window.removeEventListener('pagehide', flushOnUnload);
      window.removeEventListener('storage', onStorage);
      if (supa && channel) supa.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);
}
