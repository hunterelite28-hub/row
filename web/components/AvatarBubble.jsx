'use client';

import { useEffect, useState } from 'react';
import { profile } from '@/lib/sunpath';

// Ported from sunpath.js's injectAvatarBubble(). `inline` renders it
// docked beside a page's own greeting (today's hero); otherwise it
// floats fixed in the bottom-right corner, as on every other hub page.
export default function AvatarBubble({ inline = false }) {
  const [p, setP] = useState(null);

  useEffect(() => {
    setP(profile());
  }, []);

  if (!p) return null;

  const className = inline ? 'avatar-bubble avatar-bubble-inline glassy' : 'avatar-bubble glassy';

  return (
    <a href="/areas.html" className={className} aria-label="Profile & life areas">
      {p.avatarDataUrl ? (
        <img src={p.avatarDataUrl} alt="" />
      ) : (
        <span className="avatar-bubble-fallback">{p.avatarEmoji}</span>
      )}
    </a>
  );
}
