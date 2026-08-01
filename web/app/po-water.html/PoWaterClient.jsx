'use client';

import { useEffect, useState } from 'react';
import Topbar from '@/components/Topbar';
import WaterTracker from '@/components/WaterTracker';
import { useCloudSync } from '@/hooks/useCloudSync';

function dayPillLabel() {
  const d = new Date();
  const dows = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const mons = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return dows[d.getDay()] + ', ' + mons[d.getMonth()] + ' ' + d.getDate();
}

// The classic po-water.html is BOTH a standalone page (own topbar/dock
// chrome) AND embedded via <iframe> inside health.html's Water Tracker
// section — the iframe gets a fully isolated document, so this page's
// scoped CSS never collides with health.html's. When embedded, the
// legacy page skipped its own chrome and cloud sync (health.html's own
// sync already covers po_water_v1) — replicated below via the
// same-origin top-window check.
export default function PoWaterClient() {
  const [mounted, setMounted] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [dayPill, setDayPill] = useState('—');

  useEffect(() => {
    setMounted(true);
    let isEmbedded = false;
    try {
      isEmbedded = window.self !== window.top;
    } catch (e) {
      isEmbedded = true;
    }
    setEmbedded(isEmbedded);
    setDayPill(dayPillLabel());
  }, []);

  useCloudSync({
    appKey: embedded ? null : 'health',
    syncedKeys: ['po_water_v1'],
    onApplied: () => {},
  });

  return (
    <div className="po-water-page">
      {mounted && !embedded && <Topbar hub="body" pageLabel="WATER" />}
      <div className="shell">
        <button className="day-pill" type="button">
          <span>{dayPill}</span>
        </button>
        <div className="header">
          <h1 className="title">Water Coach</h1>
        </div>
        <div className="divider">
          <span>WATER</span>
        </div>
        <div className="card">{mounted && <WaterTracker />}</div>
      </div>
    </div>
  );
}
