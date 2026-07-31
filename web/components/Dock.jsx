'use client';

import { useEffect, useRef, useState } from 'react';

const TABS = [
  { id: 'today', label: 'Today', href: '/' },
  { id: 'body', label: 'Body', href: '/body.html' },
  { id: 'mind', label: 'Mind', href: '/mind.html' },
  { id: 'money', label: 'Money', href: '/money.html' },
];

// Ported from sunpath.js's injectDock(): the 4-tab hub nav with a
// sliding "lens" highlight that animates to the tapped tab before the
// (still full-page, since most hubs are still static HTML) navigation.
export default function Dock({ activeId }) {
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.id === activeId));
  const [lensIndex, setLensIndex] = useState(activeIndex);
  const [animate, setAnimate] = useState(false);
  const navigateTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (navigateTimer.current) clearTimeout(navigateTimer.current);
    };
  }, []);

  function handleClick(e, tab, index) {
    if (tab.id === activeId) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    setAnimate(true);
    setLensIndex(index);
    navigateTimer.current = setTimeout(() => {
      window.location.href = tab.href;
    }, 230);
  }

  return (
    <nav className="dock glassy" aria-label="Sunpath areas">
      <span
        className="dock-lens"
        style={{
          transition: animate ? '' : 'none',
          transform: `translateX(${lensIndex * 100}%)`,
        }}
      />
      {TABS.map((tab, i) => (
        <a key={tab.id} href={tab.href} className={tab.id === activeId ? 'on' : ''} onClick={(e) => handleClick(e, tab, i)}>
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
