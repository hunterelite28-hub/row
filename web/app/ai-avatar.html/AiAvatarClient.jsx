'use client';

import { useEffect } from 'react';
import NovaAvatar from '@/components/NovaAvatar';

// This whole page is a self-contained demo/showcase kit (no localStorage,
// no cloud sync, no persisted user data anywhere) — animation gallery,
// expression picker, auto-tour, a restyleable fake chat lab, and a cozy
// loader lab, all driving the same Nova instance(s) via window.Nova /
// window.NovaChat. Ported near-verbatim into one mount effect, same
// rationale as NovaAvatar's own Three.js scene: it's inherently
// imperative DOM/animation-class-swapping code with tightly interlocked
// timing (the auto-tour alone touches animations + expressions +
// palette on a shared clock) — nothing is gained by reactifying it.
function bootAiAvatar() {
  const ANIMATIONS = [
    ['Float', 'a-float', 'nova-float', '0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)}', '3s ease-in-out infinite'],
    ['Pulse', 'a-pulse', 'nova-pulse', '0%,100%{transform:scale(1)} 50%{transform:scale(1.14)}', '2s ease-in-out infinite'],
    ['Spin', 'a-spin', 'nova-spin', 'to{transform:rotate(360deg)}', '6s linear infinite'],
    ['Wobble', 'a-wobble', 'nova-wobble', '0%,100%{transform:rotate(-7deg)} 50%{transform:rotate(7deg)}', '2.4s ease-in-out infinite'],
    ['Glow', 'a-glow', 'nova-glow', '0%,100%{box-shadow:0 0 14px rgba(167,139,250,.45)} 50%{box-shadow:0 0 40px rgba(103,232,249,.9)}', '2.2s ease-in-out infinite'],
    ['Bounce', 'a-bounce', 'nova-bounce', '0%,100%{transform:translateY(0)} 30%{transform:translateY(-22px)} 50%{transform:translateY(0)} 65%{transform:translateY(-8px)} 80%{transform:translateY(0)}', '1.8s ease-in-out infinite'],
    ['Shimmer', 'a-shimmer', 'nova-shimmer', '0%{background-position:0% 50%} 100%{background-position:200% 50%}', '3s linear infinite'],
    ['Flip', 'a-flip', 'nova-flip', '0%,100%{transform:rotateY(0)} 50%{transform:rotateY(180deg)}', '3.2s ease-in-out infinite'],
    ['Tilt 3D', 'a-tilt3d', 'nova-tilt3d', '0%,100%{transform:perspective(400px) rotateX(0) rotateY(0)} 25%{transform:perspective(400px) rotateX(18deg) rotateY(18deg)} 75%{transform:perspective(400px) rotateX(-18deg) rotateY(-18deg)}', '4s ease-in-out infinite'],
    ['Heartbeat', 'a-heartbeat', 'nova-heartbeat', '0%,100%{transform:scale(1)} 14%{transform:scale(1.16)} 28%{transform:scale(1)} 42%{transform:scale(1.12)} 56%{transform:scale(1)}', '1.6s ease-in-out infinite'],
    ['Jelly', 'a-jelly', 'nova-jelly', '0%,100%{transform:scale(1,1)} 30%{transform:scale(1.25,.78)} 50%{transform:scale(.82,1.22)} 70%{transform:scale(1.08,.94)}', '2.4s ease-in-out infinite'],
    ['Drift', 'a-drift', 'nova-drift', '0%{transform:translate(0,0) rotate(0)} 50%{transform:translate(10px,-10px) rotate(8deg)} 100%{transform:translate(0,0) rotate(0)}', '5s ease-in-out infinite'],
    ['Swing', 'a-swing', 'nova-swing', '0%,100%{transform:rotate(-12deg)} 50%{transform:rotate(12deg)}', '2.6s ease-in-out infinite', 'transform-origin:50% 0;'],
    ['Pop in', 'a-pop', 'nova-pop', '0%{transform:scale(.6);opacity:.3} 60%{transform:scale(1.12);opacity:1} 100%{transform:scale(1);opacity:1}', '1.8s ease-out infinite'],
    ['Ripple', 'a-ripple', 'nova-ripple', '0%{box-shadow:0 0 0 0 rgba(103,232,249,.6),0 0 0 0 rgba(167,139,250,.4)} 100%{box-shadow:0 0 0 22px rgba(103,232,249,0),0 0 0 40px rgba(167,139,250,0)}', '1.8s ease-out infinite'],
  ];

  function snippet(a) {
    const [name, , key, frames, timing, extra] = a;
    return `/* ${name} — Nova animation kit */
@keyframes ${key} { ${frames} }
.${key} {${extra ? ' ' + extra : ''} animation: ${key} ${timing}; }

/* usage: <div class="${key}">…</div> */`;
  }

  const grid = document.getElementById('grid');
  const avatarWrap = document.getElementById('avatarWrap');
  const roleEl = document.getElementById('role');
  const ALL_CLASSES = ANIMATIONS.map((a) => a[1]);
  let playTimer;

  function playOnNova(a) {
    const [name, cls] = a;
    avatarWrap.classList.remove(...ALL_CLASSES);
    void avatarWrap.offsetWidth;
    avatarWrap.classList.add(cls);
    roleEl.textContent = name;
    document.querySelectorAll('.tile').forEach((t) => t.classList.toggle('active', t.dataset.cls === cls));
    clearTimeout(playTimer);
    playTimer = setTimeout(() => {
      avatarWrap.classList.remove(...ALL_CLASSES);
      roleEl.textContent = 'your companion';
      document.querySelectorAll('.tile').forEach((t) => t.classList.remove('active'));
    }, 6000);
  }

  ANIMATIONS.forEach((a) => {
    const [name, cls, key] = a;
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.cls = cls;
    tile.innerHTML = `
      <span class="copy" role="button" title="Copy CSS">copy ⧉</span>
      <div class="preview"><div class="orb ${cls}"></div></div>
      <div class="nm">${name}</div>
      <div class="meta">.${key}</div>`;
    tile.addEventListener('click', () => playOnNova(a));
    tile.querySelector('.copy').addEventListener('click', (e) => {
      e.stopPropagation();
      copy(snippet(a), name);
    });
    grid.appendChild(tile);
  });

  let toastTimer;
  function copy(text, name) {
    const done = () => showToast(`Copied "${name}" CSS`);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback(text, done));
    } else {
      fallback(text, done);
    }
  }
  function fallback(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    ta.remove();
    done();
  }
  function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toastText').textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---------- palette swatches ----------
  const PALETTES = [
    ['Nebula', '#67E8F9', '#A78BFA', '#F0ABFC'],
    ['Mint', '#6EE7B7', '#34D399', '#A7F3D0'],
    ['Ember', '#FBBF24', '#F472B6', '#FB7185'],
    ['Ocean', '#38BDF8', '#22D3EE', '#818CF8'],
    ['Aurora', '#34D399', '#67E8F9', '#A78BFA'],
    ['Rose', '#F472B6', '#FB7185', '#FDA4AF'],
    ['Gold', '#FCD34D', '#FBBF24', '#FDE68A'],
    ['Mono', '#E5E7EB', '#CBD5E1', '#94A3B8'],
  ];
  const palHost = document.getElementById('palettes');
  PALETTES.forEach(([name, a, b, c], i) => {
    const el = document.createElement('div');
    el.className = 'pal' + (i === 0 ? ' active' : '');
    el.style.background = `linear-gradient(135deg, ${a}, ${b} 55%, ${c})`;
    el.innerHTML = `<span class="pal-name">${name}</span>`;
    el.addEventListener('click', () => {
      if (window.Nova && window.Nova.setPalette) window.Nova.setPalette(a, b, c);
      palHost.querySelectorAll('.pal').forEach((x) => x.classList.toggle('active', x === el));
    });
    palHost.appendChild(el);
  });

  // ---------- expression picker ----------
  const EXPRESSIONS = [
    ['neutral', '⊙ ⊙', 'Neutral', 0],
    ['happy', '◡ ◡', 'Happy', 4],
    ['sad', '◠ ◠', 'Sad', 4],
    ['surprised', '◎ ◎', 'Surprised', 4],
    ['thinking', '⊙ ⊙ …', 'Thinking', 4],
    ['sleepy', '— — z', 'Sleepy', 4],
    ['wink', '◡ —', 'Wink', 3],
    ['love', '♥', 'Love', 4],
    ['star', '★', 'Star-eyed', 4],
  ];
  function nova(name, hold) {
    if (window.Nova) window.Nova.setExpression(name, hold);
  }
  const exprGrid = document.getElementById('exprGrid');
  EXPRESSIONS.forEach(([name, glyph, label, hold]) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `
      <span class="copy" role="button" title="Copy code">copy ⧉</span>
      <div class="preview"><div style="font-size:30px;letter-spacing:2px;color:#eafcff;text-shadow:0 0 14px #a78bfa">${glyph}</div></div>
      <div class="nm">${label}</div>
      <div class="meta">Nova.setExpression('${name}')</div>`;
    tile.addEventListener('click', () => nova(name, hold));
    tile.querySelector('.copy').addEventListener('click', (e) => {
      e.stopPropagation();
      copy(exprSnippet(name, hold), label + ' expression');
    });
    exprGrid.appendChild(tile);
  });
  function exprSnippet(name, hold) {
    return `// Nova expression — drive the avatar's face from your app.
// Nova exposes a tiny global once the 3D avatar mounts:
//   window.Nova.setExpression(name, holdSeconds)
// Available: ${'neutral, happy, sad, surprised, thinking, sleepy, wink, love, star'}

Nova.setExpression('${name}'${hold ? ', ' + hold : ''});

// React to a user prompt — thinking while you call your model,
// then a happy/sad face based on the answer:
async function onUserPrompt(text) {
  Nova.setExpression('thinking');              // hold until the reply lands
  const reply = await getAIReply(text);        // your API call
  Nova.setExpression(reply.positive ? 'happy' : 'sad', 4);
}`;
  }

  // ---------- play every expression ----------
  const playAllExprBtn = document.getElementById('playAllExpr');
  let exprShowTimer = null;
  const EXPR_HOLD = 1700;
  function playAllExpressions() {
    if (exprShowTimer) return;
    const tiles = exprGrid.querySelectorAll('.tile');
    playAllExprBtn.classList.add('playing');
    let i = 0;
    const step = () => {
      tiles.forEach((t, k) => t.classList.toggle('active', k === i));
      const [name, , label] = EXPRESSIONS[i];
      nova(name, 0);
      playAllExprBtn.innerHTML = `<span class="pa-bars"><i></i><i></i><i></i></span> ${label} · ${i + 1}/${EXPRESSIONS.length}`;
      i++;
      exprShowTimer = setTimeout(i < EXPRESSIONS.length ? step : finish, EXPR_HOLD);
    };
    const finish = () => {
      tiles.forEach((t) => t.classList.remove('active'));
      nova('neutral', 0);
      playAllExprBtn.classList.remove('playing');
      playAllExprBtn.innerHTML = `<span class="pa-ico">▶</span> Play every expression`;
      exprShowTimer = null;
    };
    step();
  }
  playAllExprBtn.addEventListener('click', playAllExpressions);

  // ---------- play every animation ----------
  const playAllAnimBtn = document.getElementById('playAllAnim');
  let animShowTimer = null;
  const ANIM_HOLD = 2200;
  function playAllAnimations() {
    if (animShowTimer) return;
    playAllAnimBtn.classList.add('playing');
    let i = 0;
    const step = () => {
      playOnNova(ANIMATIONS[i]);
      playAllAnimBtn.innerHTML = `<span class="pa-bars"><i></i><i></i><i></i></span> ${ANIMATIONS[i][0]} · ${i + 1}/${ANIMATIONS.length}`;
      i++;
      animShowTimer = setTimeout(i < ANIMATIONS.length ? step : finish, ANIM_HOLD);
    };
    const finish = () => {
      playAllAnimBtn.classList.remove('playing');
      playAllAnimBtn.innerHTML = `<span class="pa-ico">▶</span> Play all 15 animations`;
      animShowTimer = null;
    };
    step();
  }
  playAllAnimBtn.addEventListener('click', playAllAnimations);

  // ---------- copy everything ----------
  document.getElementById('copyAll').addEventListener('click', async () => {
    let html;
    try {
      const res = await fetch(location.href, { cache: 'no-store' });
      html = await res.text();
    } catch (e) {
      html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    }
    copy(html, 'the whole kit — paste into one .html file');
  });

  // ---------- auto-tour ----------
  const STEP_MS = 10000;
  let tourOn = false,
    tourTimer = null,
    tourStepIdx = 0;

  function buildTour() {
    const steps = [];
    const moodFor = { Float: 'happy', Pulse: 'happy', Spin: 'surprised', Wobble: 'wink', Glow: 'love', Bounce: 'happy', Shimmer: 'star', Flip: 'surprised', 'Tilt 3D': 'thinking', Heartbeat: 'love', Jelly: 'happy', Drift: 'sleepy', Swing: 'wink', 'Pop in': 'surprised', Ripple: 'star' };
    ANIMATIONS.forEach((a, i) => {
      steps.push({ type: 'anim', anim: a, mood: moodFor[a[0]] || 'happy', label: a[0], kind: 'Animation' });
      if (i % 4 === 3) {
        const p = PALETTES[((i / 4) | 0) % PALETTES.length];
        steps.push({ type: 'palette', pal: p, label: p[0], kind: 'Palette' });
      }
    });
    EXPRESSIONS.forEach((e) => steps.push({ type: 'expr', expr: e, label: e[2], kind: 'Expression' }));
    return steps;
  }
  const TOUR = buildTour();

  const tourCap = document.getElementById('tourCap');
  const tourLabel = document.getElementById('tourLabel');
  const tourStepEl = document.getElementById('tourStep');

  function runTourStep() {
    if (!tourOn) return;
    const step = TOUR[tourStepIdx % TOUR.length];

    if (step.type === 'anim') {
      avatarWrap.classList.remove(...ALL_CLASSES);
      void avatarWrap.offsetWidth;
      avatarWrap.classList.add(step.anim[1]);
      if (window.Nova) window.Nova.setExpression(step.mood, STEP_MS / 1000);
      document.querySelectorAll('.tile').forEach((t) => t.classList.toggle('active', t.dataset.cls === step.anim[1]));
    } else if (step.type === 'expr') {
      avatarWrap.classList.remove(...ALL_CLASSES);
      if (window.Nova) window.Nova.setExpression(step.expr[0], STEP_MS / 1000);
    } else if (step.type === 'palette') {
      if (window.Nova && window.Nova.setPalette) window.Nova.setPalette(step.pal[1], step.pal[2], step.pal[3]);
      const swatches = document.querySelectorAll('#palettes .pal');
      swatches.forEach((s) => s.classList.remove('active'));
    }

    tourLabel.textContent = step.label;
    tourStepEl.textContent = `${step.kind} · ${(tourStepIdx % TOUR.length) + 1} / ${TOUR.length}`;
    tourCap.classList.add('show');

    tourStepIdx++;
    tourTimer = setTimeout(runTourStep, STEP_MS);
  }

  function startTour() {
    tourOn = true;
    tourStepIdx = 0;
    document.getElementById('autoTour').classList.add('on');
    document.getElementById('autoTour').textContent = '■ Stop tour';
    document.querySelector('.tabs button[data-tab="avatar"]').click();
    runTourStep();
  }
  function stopTour() {
    tourOn = false;
    clearTimeout(tourTimer);
    avatarWrap.classList.remove(...ALL_CLASSES);
    document.querySelectorAll('.tile').forEach((t) => t.classList.remove('active'));
    roleEl.textContent = 'your companion';
    tourCap.classList.remove('show');
    document.getElementById('autoTour').classList.remove('on');
    document.getElementById('autoTour').textContent = '▶ Auto-tour';
    if (window.Nova) window.Nova.setExpression('neutral');
  }
  document.getElementById('autoTour').addEventListener('click', () => (tourOn ? stopTour() : startTour()));
  document.getElementById('grid').addEventListener(
    'click',
    () => {
      if (tourOn) stopTour();
    },
    true
  );
  document.getElementById('exprGrid').addEventListener(
    'click',
    () => {
      if (tourOn) stopTour();
    },
    true
  );

  // ---------- tab switching ----------
  document.querySelectorAll('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === btn));
      const tab = btn.dataset.tab;
      document.getElementById('view-avatar').classList.toggle('active', tab === 'avatar');
      document.getElementById('view-chat').classList.toggle('active', tab === 'chat');
      document.getElementById('view-loader').classList.toggle('active', tab === 'loader');
    });
  });

  // ---------- cozy loader lab ----------
  const TONES = {
    mint: { tone: '#6EE7B7', soft: 'rgba(110,231,183,0.28)', ink: '#06281d' },
    blue: { tone: '#8fb8c9', soft: 'rgba(143,184,201,0.34)', ink: '#08222b' },
    amber: { tone: '#F59E0B', soft: 'rgba(245,158,11,0.30)', ink: '#2a1903' },
    violet: { tone: '#a78bfa', soft: 'rgba(167,139,250,0.32)', ink: '#1b1233' },
    rose: { tone: '#f472b6', soft: 'rgba(244,114,182,0.30)', ink: '#320c20' },
  };
  const czCfg = { tone: 'mint', speed: 3000, bar: true, dots: true, thumb: false };
  let czIdx = 0,
    czTagIdx = 0,
    czTimer = null;

  function czLines() {
    return document
      .getElementById('czItems')
      .value.split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [text, hl] = l.split('|').map((s) => s.trim());
        return { text, hl };
      });
  }
  function czTags() {
    return document
      .getElementById('czTags')
      .value.split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
  function czTitle() {
    return document.getElementById('czTitle').value.trim();
  }

  function czTextHtml(item) {
    if (!item.hl) return item.text;
    const i = item.text.indexOf(item.hl);
    if (i < 0) return item.text;
    return item.text.slice(0, i) + `<span class="cz-hl">${item.hl}</span>` + item.text.slice(i + item.hl.length);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function renderCozy() {
    const host = document.getElementById('czHost');
    const t = TONES[czCfg.tone];
    const lines = czLines();
    const tags = czTags();
    if (!lines.length) {
      host.innerHTML = '<div style="color:rgba(233,236,245,.4);font-size:13px">add a line →</div>';
      return;
    }
    const item = lines[czIdx % lines.length];
    const tag = tags.length ? tags[czTagIdx % tags.length] : null;
    const title = czTitle();
    host.innerHTML = `
      <article class="cz" style="--tone:${t.tone};--tone-soft:${t.soft};--tone-ink:${t.ink}">
        ${czCfg.thumb ? '<div class="cz-shimmer"></div>' : ''}
        <div class="cz-body">
          ${title ? `<div class="cz-title">${escapeHtml(title)}</div>` : ''}
          ${czCfg.bar ? '<div class="cz-bar"><span></span></div>' : ''}
          <div class="cz-fact">
            ${tag ? `<span class="cz-tag" key="${czIdx}-${czTagIdx}">${escapeHtml(tag)}</span>` : ''}
            <p class="cz-text">${czTextHtml(item)}</p>
            ${czCfg.dots ? '<div class="cz-dots"><i></i><i></i><i></i></div>' : ''}
          </div>
        </div>
      </article>`;
  }
  function czStartRotation() {
    clearInterval(czTimer);
    czTimer = setInterval(() => {
      const lines = czLines(),
        tags = czTags();
      if (lines.length > 1) czIdx = (czIdx + 1) % lines.length;
      if (tags.length > 1) czTagIdx = (czTagIdx + 1) % tags.length;
      renderCozy();
    }, czCfg.speed);
  }

  const czToneHost = document.getElementById('czTone');
  Object.keys(TONES).forEach((name, i) => {
    const c = document.createElement('div');
    c.className = 'chip2' + (i === 0 ? ' active' : '');
    c.textContent = name;
    c.addEventListener('click', () => {
      czCfg.tone = name;
      renderCozy();
      czToneHost.querySelectorAll('.chip2').forEach((x) => x.classList.toggle('active', x === c));
    });
    czToneHost.appendChild(c);
  });
  ['czTitle', 'czTags', 'czItems'].forEach((id) =>
    document.getElementById(id).addEventListener('input', () => {
      czIdx = 0;
      czTagIdx = 0;
      renderCozy();
    })
  );
  document.getElementById('czSpeed').addEventListener('input', (e) => {
    czCfg.speed = +e.target.value;
    czStartRotation();
  });
  document.getElementById('czBar').addEventListener('change', (e) => {
    czCfg.bar = e.target.checked;
    renderCozy();
  });
  document.getElementById('czDots').addEventListener('change', (e) => {
    czCfg.dots = e.target.checked;
    renderCozy();
  });
  document.getElementById('czThumb').addEventListener('change', (e) => {
    czCfg.thumb = e.target.checked;
    renderCozy();
  });

  document.getElementById('czCopy').addEventListener('click', () => copy(czSnippet(), 'cozy loader'));
  function czSnippet() {
    const t = TONES[czCfg.tone];
    const lines = czLines(),
      tags = czTags(),
      title = czTitle();
    const itemsJs = JSON.stringify(lines);
    const tagsJs = JSON.stringify(tags);
    return `<!-- Cozy Loader — Nova export · tone: ${czCfg.tone} -->
<div id="cozy"></div>
<style>
.cz { --tone:${t.tone}; --tone-soft:${t.soft}; --tone-ink:${t.ink};
  display:flex; gap:14px; border:1px solid var(--tone-soft); background:rgba(255,255,255,.02);
  border-radius:14px; padding:14px; max-width:460px; }
.cz-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:10px; }
.cz-title { font-family:Georgia,serif; font-style:italic; font-size:16px; color:var(--tone); }
.cz-bar { height:4px; border-radius:999px; background:rgba(255,255,255,.16); overflow:hidden; }
.cz-bar span { display:block; height:100%; width:40%; border-radius:999px; background:linear-gradient(90deg,transparent,var(--tone),transparent); animation:czSlide 1.4s cubic-bezier(.16,1,.3,1) infinite; }
.cz-fact { display:flex; flex-direction:column; align-items:flex-start; gap:10px; min-height:3.6em; }
.cz-tag { font:700 9.5px/1 ui-monospace,monospace; letter-spacing:.14em; text-transform:uppercase; color:var(--tone-ink); background:var(--tone); border-radius:999px; padding:3px 10px; animation:czTagPop .5s cubic-bezier(.34,1.56,.64,1); }
.cz-text { margin:0; font-weight:500; font-size:14px; line-height:1.35; color:#eafff7; animation:czPop .55s cubic-bezier(.34,1.56,.64,1); }
.cz-hl { color:var(--tone); font-weight:700; }
.cz-dots { display:flex; gap:6px; } .cz-dots i { width:6px; height:6px; border-radius:50%; background:var(--tone); opacity:.4; animation:czDot 1.2s ease-in-out infinite; }
.cz-dots i:nth-child(2){animation-delay:.2s} .cz-dots i:nth-child(3){animation-delay:.4s}
@keyframes czTagPop{0%{opacity:0;transform:scale(.6) rotate(-6deg)}100%{opacity:1;transform:scale(1)}}
@keyframes czPop{0%{opacity:0;transform:scale(.8) translateY(8px)}60%{opacity:1;transform:scale(1.04)}100%{transform:scale(1)}}
@keyframes czDot{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
@keyframes czSlide{from{transform:translateX(-120%)}to{transform:translateX(320%)}}
</style>
<scr`+`ipt>
(function(){
  var items=${itemsJs}, tags=${tagsJs}, title=${JSON.stringify(title)};
  var i=0,ti=0,host=document.getElementById('cozy');
  function hl(it){ if(!it.hl) return it.text; var k=it.text.indexOf(it.hl); return k<0?it.text:it.text.slice(0,k)+'<span class="cz-hl">'+it.hl+'</span>'+it.text.slice(k+it.hl.length); }
  function draw(){ var it=items[i%items.length], tg=tags.length?tags[ti%tags.length]:null;
    host.innerHTML='<article class="cz">'+(title?'<div class="cz-body"><div class="cz-title">'+title+'</div>':'<div class="cz-body">')+
      ${czCfg.bar ? "'<div class=\\'cz-bar\\'><span></span></div>'+" : ''}
      '<div class="cz-fact">'+(tg?'<span class="cz-tag">'+tg+'</span>':'')+'<p class="cz-text">'+hl(it)+'</p>'+
      ${czCfg.dots ? "'<div class=\\'cz-dots\\'><i></i><i></i><i></i></div>'+" : ''}'</div></div></article>'; }
  draw();
  setInterval(function(){ if(items.length>1)i++; if(tags.length>1)ti++; draw(); }, ${czCfg.speed});
})();
</scr`+`ipt>`;
  }

  renderCozy();
  czStartRotation();

  // ---------- chat box lab ----------
  const chatRoot = document.getElementById('chatRoot');
  const feed = document.getElementById('feed');
  const chatInput = document.getElementById('chatInput');

  const cfg = { accent: '#6EE7B7', accent2: '#67E8F9', skin: 'glass', radius: 16, think: 'dots', reveal: 'fade', avatar: 'on' };

  const ACCENTS = [
    ['#6EE7B7', '#67E8F9'],
    ['#A78BFA', '#67E8F9'],
    ['#F472B6', '#A78BFA'],
    ['#FBBF24', '#F472B6'],
    ['#38BDF8', '#818CF8'],
    ['#34D399', '#A3E635'],
  ];
  const SKINS = ['glass', 'solid', 'outline', 'glow'];
  const THINKS = ['dots', 'bars', 'pulse', 'shimmer'];
  const REVEALS = ['fade', 'rise', 'typewriter'];

  const REPLIES = [
    { html: 'Not even close yet. You are at <span class="pill">27g</span> out of 195g, so you have got a big gap to close. Still early though — plenty of time to <b>stack it up</b>.', mood: 'sad' },
    { html: 'Solid question. A plate with <b>some color</b> usually has some balance too.', mood: 'happy' },
    { html: 'Good instinct. Lock in protein first, then fill the rest with whatever keeps you <b>full and moving</b>.', mood: 'wink' },
    { html: 'You are <b>on track</b> — keep the momentum and do not overthink the next meal.', mood: 'star' },
  ];
  let replyIdx = 0;

  const labAvatar = document.getElementById('labAvatar');
  const aState = document.getElementById('aState');

  function applyCfg() {
    chatRoot.style.setProperty('--accent', cfg.accent);
    chatRoot.style.setProperty('--accent-2', cfg.accent2);
    chatRoot.style.setProperty('--bubble-radius', cfg.radius + 'px');
    chatRoot.dataset.skin = cfg.skin;
    if (labAvatar) labAvatar.style.opacity = cfg.avatar === 'off' ? 0.4 : 1;
    if (cfg.avatar === 'off' && window.NovaChat) window.NovaChat.setExpression('neutral');
  }

  function thinkingMarkup() {
    if (cfg.think === 'dots') return '<span class="thinking think-dots"><span></span><span></span><span></span></span><span class="think-label">thinking</span>';
    if (cfg.think === 'bars') return '<span class="thinking think-bars"><span></span><span></span><span></span><span></span></span><span class="think-label">thinking</span>';
    if (cfg.think === 'pulse') return '<span class="thinking"><span class="think-pulse"></span></span><span class="think-label">thinking</span>';
    return '<span class="thinking"><span class="think-shimmer"></span></span>';
  }

  function addUser(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    feed.appendChild(el);
    scrollFeed();
  }

  function addCoach(html, mood) {
    if (window.Nova) window.Nova.setExpression('thinking');

    const el = document.createElement('div');
    el.className = 'msg coach';
    el.innerHTML = `<div class="bubble"><span class="tagchip">Echo</span><div class="think">${thinkingMarkup()}</div></div>`;
    feed.appendChild(el);
    scrollFeed();

    setTimeout(() => {
      const body = el.querySelector('.bubble');
      body.innerHTML = `<span class="tagchip">Echo</span>` + revealMarkup(html);
      if (cfg.reveal === 'typewriter') typewriter(body.querySelector('.bubble-text'), html);
      if (window.Nova) window.Nova.setExpression(mood || 'happy', 4);
      avatarReply(html, mood);
      scrollFeed();
    }, 1400);
  }

  function revealMarkup(html) {
    if (cfg.reveal === 'rise') {
      const words = html
        .split(/(\s+)/)
        .map((w, i) => (/^\s+$/.test(w) ? w : `<span class="word" style="animation-delay:${i * 30}ms">${w}</span>`))
        .join('');
      return `<div class="bubble-text reveal-rise-host">${words}</div>`;
    }
    if (cfg.reveal === 'typewriter') return `<div class="bubble-text caret"></div>`;
    return `<div class="bubble-text reveal-fade-host">${html}</div>`;
  }

  function typewriter(node, html) {
    let i = 0;
    node.classList.add('caret');
    (function step() {
      if (i > html.length) {
        node.classList.remove('caret');
        return;
      }
      if (html[i] === '<') {
        i = html.indexOf('>', i) + 1;
      } else {
        i++;
      }
      node.innerHTML = html.slice(0, i);
      scrollFeed();
      setTimeout(step, 16);
    })();
  }

  function send(text) {
    if (!text.trim()) return;
    addUser(text.trim());
    avatarReactSend();
    const r = REPLIES[replyIdx % REPLIES.length];
    addCoach(r.html, r.mood);
    replyIdx++;
    chatInput.value = '';
  }
  function scrollFeed() {
    feed.scrollTop = feed.scrollHeight;
  }

  let avatarTimer = null;
  function aLabel(s) {
    if (aState) aState.textContent = s;
  }
  function chatNova(name, hold) {
    if (cfg.avatar !== 'off' && window.NovaChat) window.NovaChat.setExpression(name, hold || 0);
  }
  function avatarReactSend() {
    if (cfg.avatar === 'off') return;
    clearTimeout(avatarTimer);
    chatNova('surprised');
    aLabel('looking…');
    avatarTimer = setTimeout(() => {
      chatNova('thinking');
      aLabel('thinking…');
    }, 600);
  }
  function avatarReply(html, mood) {
    if (cfg.avatar === 'off') return;
    clearTimeout(avatarTimer);
    aLabel('talking…');
    avatarTimer = setTimeout(() => {
      chatNova(mood || 'happy', 4);
      aLabel(mood || 'happy');
      setTimeout(() => aLabel('resting'), 4000);
    }, 250);
  }

  document.getElementById('chatSend').addEventListener('click', () => send(chatInput.value));
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send(chatInput.value);
  });

  const STARTERS = ['enough protein today?', 'what should I eat tonight?', 'how am I tracking?'];
  const startersEl = document.getElementById('starters');
  STARTERS.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'starter';
    b.textContent = s;
    b.addEventListener('click', () => send(s));
    startersEl.appendChild(b);
  });

  const swAccent = document.getElementById('swAccent');
  ACCENTS.forEach(([a, a2], i) => {
    const s = document.createElement('div');
    s.className = 'swatch' + (i === 0 ? ' active' : '');
    s.style.background = `linear-gradient(135deg, ${a}, ${a2})`;
    s.addEventListener('click', () => {
      cfg.accent = a;
      cfg.accent2 = a2;
      applyCfg();
      swAccent.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === s));
    });
    swAccent.appendChild(s);
  });
  function chipGroup(hostId, items, key) {
    const host = document.getElementById(hostId);
    items.forEach((it, i) => {
      const c = document.createElement('div');
      c.className = 'chip2' + (i === 0 ? ' active' : '');
      c.textContent = it;
      c.addEventListener('click', () => {
        cfg[key] = it;
        applyCfg();
        host.querySelectorAll('.chip2').forEach((x) => x.classList.toggle('active', x === c));
      });
      host.appendChild(c);
    });
  }
  chipGroup('optSkin', SKINS, 'skin');
  chipGroup('optThink', THINKS, 'think');
  chipGroup('optReveal', REVEALS, 'reveal');
  chipGroup('optAvatar', ['on', 'off'], 'avatar');

  const avatarPreview = document.getElementById('avatarPreview');
  if (avatarPreview)
    avatarPreview.addEventListener('click', () => {
      clearTimeout(avatarTimer);
      if (labAvatar) labAvatar.style.opacity = 1;
      if (window.NovaChat) window.NovaChat.setExpression('surprised');
      aLabel('looking…');
      setTimeout(() => {
        if (window.NovaChat) window.NovaChat.setExpression('thinking');
        aLabel('thinking…');
      }, 700);
      setTimeout(() => {
        if (window.NovaChat) window.NovaChat.setExpression('happy', 4);
        aLabel('happy');
      }, 2200);
      setTimeout(() => {
        aLabel('resting');
        if (labAvatar) labAvatar.style.opacity = cfg.avatar === 'off' ? 0.4 : 1;
      }, 6000);
    });
  document.getElementById('optRadius').addEventListener('input', (e) => {
    cfg.radius = +e.target.value;
    applyCfg();
  });

  document.getElementById('copyChat').addEventListener('click', () => {
    copy(chatSnippet(), 'chat box');
  });
  function chatSnippet() {
    return `/* AI chat box — Nova Chat Lab export
   skin: ${cfg.skin} · thinking: ${cfg.think} · reveal: ${cfg.reveal} */
.chat-box {
  --accent: ${cfg.accent};
  --accent-2: ${cfg.accent2};
  --radius: ${cfg.radius}px;
}
.chat-msg.user .bubble {
  align-self: flex-end;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius);
  padding: 14px 16px;
}
.chat-msg.coach .bubble {
  background: ${cfg.skin === 'solid' ? '#0f1512' : cfg.skin === 'outline' ? 'transparent' : 'rgba(255,255,255,0.04)'};
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius);
  padding: 14px 16px;${cfg.skin === 'glow' ? '\n  box-shadow: 0 0 26px color-mix(in srgb, var(--accent) 22%, transparent);' : ''}${cfg.skin === 'glass' ? '\n  backdrop-filter: blur(8px);' : ''}
}
.chat-msg .pill { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); padding: 1px 7px; border-radius: 6px; }

/* thinking — ${cfg.think} */
${thinkCss()}

/* text reveal — ${cfg.reveal} */
${revealCss()}`;
  }
  function thinkCss() {
    if (cfg.think === 'dots')
      return `.think span { width:7px;height:7px;border-radius:50%;background:var(--accent);display:inline-block;animation:tdBounce 1.2s infinite ease-in-out }
.think span:nth-child(2){animation-delay:.15s} .think span:nth-child(3){animation-delay:.3s}
@keyframes tdBounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-6px);opacity:1}}`;
    if (cfg.think === 'bars')
      return `.think span{width:4px;height:16px;border-radius:2px;background:var(--accent);display:inline-block;animation:tdBars 1s infinite ease-in-out}
@keyframes tdBars{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}`;
    if (cfg.think === 'pulse')
      return `.think{width:16px;height:16px;border-radius:50%;background:var(--accent);animation:tdPulse 1.3s infinite ease-out}
@keyframes tdPulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 60%,transparent)}100%{box-shadow:0 0 0 14px transparent}}`;
    return `.think{width:120px;height:10px;border-radius:6px;background:linear-gradient(90deg,transparent,var(--accent),transparent);background-size:200% 100%;animation:tdShimmer 1.4s infinite linear}
@keyframes tdShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
  }
  function revealCss() {
    if (cfg.reveal === 'rise')
      return `.bubble-text .word{display:inline-block;opacity:0;transform:translateY(8px);animation:rvRise .4s ease forwards}
@keyframes rvRise{to{opacity:1;transform:none}}`;
    if (cfg.reveal === 'typewriter')
      return `/* type chars in with JS; blinking caret: */
.caret::after{content:'▍';color:var(--accent);animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}`;
    return `.bubble-text{animation:rvFade .5s ease both}
@keyframes rvFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`;
  }

  applyCfg();
  addUser('enough protein today?');
  addCoach(REPLIES[0].html, REPLIES[0].mood);
  replyIdx = 1;
}

export default function AiAvatarClient() {
  useEffect(() => {
    bootAiAvatar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ai-avatar-page">
      <nav className="tabs">
        <button data-tab="avatar" className="active">
          Avatar + Animations
        </button>
        <button data-tab="chat">Chat Box Lab</button>
        <button data-tab="loader">Cozy Loader</button>
        <button id="autoTour" className="autoTour">
          ▶ Auto-tour
        </button>
        <button id="copyAll" className="copyAll">
          ⬇ Copy everything
        </button>
      </nav>

      {/* ============ VIEW 1: AVATAR ============ */}
      <div className="view active" id="view-avatar">
        <div className="stage">
          <div className="tag">
            AVATAR · <b>NOVA</b>
          </div>
          <div className="palettes" id="palettes"></div>
          <div id="avatarWrap">
            <NovaAvatar canvasId="scene" wrapClassName={null} onReady={(api) => (window.Nova = api)} />
          </div>
          <div className="label">
            <div className="name">Nova</div>
            <div className="role" id="role">
              your companion
            </div>
          </div>
          <div className="tour-cap" id="tourCap">
            <span id="tourLabel"></span>
            <div className="tour-step" id="tourStep"></div>
          </div>
        </div>

        <div className="prompt-note">
          <div className="pn-eyebrow">↑ Prompt that built the 3D avatar</div>
          <div className="pn-prompt">
            "Build me a 3D AI companion called <b>Nova</b> using Three.js — an iridescent glass octahedron floating in dark cosmic space. It should slowly rotate and 'breathe', follow the cursor, blink, and show emotions on a
            glowing face. No rings or wireframe borders — just the crystal, a soft inner glow, and a halo of drifting particles. Light it cyan → violet → pink, and put a serif italic 'Nova' name label with a 'your companion'
            role underneath. Expose a small JS API so the rest of the page can change its expression."
          </div>
          <div className="pn-label">Core ideas in the prompt</div>
          <ul>
            <li>
              <b>Crystal core</b> — Three.js <b>OctahedronGeometry</b> in a physical glass material (transmission + iridescence) over a PMREM cyan→violet→pink environment.
            </li>
            <li>
              <b>Alive idle</b> — continuous slow rotation, a sine-wave "breathe" scale, and cursor-follow tilt (no user input required to feel living).
            </li>
            <li>
              <b>Expressive face</b> — eyes/mouth drawn to a canvas texture, random blinking, and a "pop" bounce whenever the expression changes.
            </li>
            <li>
              <b>No borders</b> — rings & wireframe removed on purpose; only an additive inner glow sphere + a 70-point particle halo for atmosphere.
            </li>
            <li>
              <b>Public hook</b> — <b>window.Nova.setExpression(name, holdSeconds)</b> so the animation kit, expression picker, and chat lab can all drive the same face.
            </li>
          </ul>
        </div>

        <section className="gallery">
          <h2>Animation kit</h2>
          <div className="sub">
            Click a tile to <b>play it on Nova</b> ↑ · hit <b>copy ⧉</b> to grab the CSS for your dashboard.
          </div>
          <button className="play-all" id="playAllAnim">
            <span className="pa-ico">▶</span> Play all 15 animations
          </button>
          <div className="grid" id="grid"></div>

          <div className="prompt-note">
            <div className="pn-eyebrow">↑ Prompt that built the animation kit</div>
            <div className="pn-prompt">
              "Make a gallery of <b>15 ready-to-use, pure-CSS animations</b> for an avatar — float, pulse, spin, wobble, glow, bounce, shimmer, flip, 3D tilt, heartbeat, jelly, drift, swing, pop-in and ripple. Show each one in
              a clickable card with a small live preview. Clicking the card should <b>play that animation on the real Nova above</b>, and a 'copy' chip should copy the exact, self-contained CSS to the clipboard with a
              little toast confirmation."
            </div>
            <div className="pn-label">Core ideas in the prompt</div>
            <ul>
              <li>
                <b>15 named @keyframes</b> — each one self-contained and paste-anywhere; the snippet you copy <b>is</b> what runs the preview (same class names → no drift).
              </li>
              <li>
                <b>Two click targets per tile</b> — body = "play on Nova", copy chip = "copy CSS" (<b>stopPropagation</b> so they don't fire together).
              </li>
              <li>
                <b>Play on the live avatar</b> — swap the CSS class onto the avatar wrapper over the running 3D idle, then auto-reset to calm after ~6s.
              </li>
              <li>
                <b>Clipboard + toast</b> — <b>navigator.clipboard</b> with a textarea fallback, and a transient "Copied" toast for feedback.
              </li>
            </ul>
          </div>
        </section>

        <section className="gallery" style={{ paddingTop: 0 }}>
          <h2>Eye expressions</h2>
          <div className="sub">Click an expression to play it on Nova ↑ — happy, sad, symbols. In the Chat Lab, Nova reacts with these when you send a prompt.</div>
          <button className="play-all" id="playAllExpr">
            <span className="pa-ico">▶</span> Play every expression
          </button>
          <div className="grid" id="exprGrid"></div>

          <div className="prompt-note">
            <div className="pn-eyebrow">↑ Prompt that built the expression picker</div>
            <div className="pn-prompt">
              "Give Nova a face with <b>9 expressions</b> — neutral, happy, sad, surprised, thinking, sleepy, wink, love (heart eyes) and star-eyed. Each is just a few canvas strokes (arcs for eyes, a mouth, or a drawn
              heart/star symbol). Clicking an expression plays it on Nova for a few seconds then settles back to neutral. The 'copy' chip should hand over the <b>JS</b> to drive it from any app —{' '}
              <b>Nova.setExpression(name, holdSeconds)</b> — with a worked example that shows 'thinking' while calling the model, then happy/sad based on the reply."
            </div>
            <div className="pn-label">Core ideas in the prompt</div>
            <ul>
              <li>
                <b>Expression table</b> — one <b>EXPR</b> map says how each face draws (eye shape + optional mouth + optional heart/star symbol).
              </li>
              <li>
                <b>Hold-then-return</b> — expressions auto-revert to neutral after their hold time; blinking is suppressed while a symbol face shows.
              </li>
              <li>
                <b>Copy = real integration</b> — the snippet isn't decorative; it's the actual API call pattern (<b>thinking → await reply → happy/sad</b>).
              </li>
              <li>
                <b>Shared face</b> — same <b>setExpression</b> the Chat Lab calls, so a reply's mood lights up Nova live.
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* ============ VIEW 2: CHAT BOX LAB ============ */}
      <div className="view" id="view-chat">
        <div id="chatRoot" data-skin="glass">
          <div className="lab">
            <div>
              <h2>Chat box lab</h2>
              <div className="sub">Type below — your companion looks when you ask and talks when it answers. Restyle it on the right →</div>
              <div className="chat-row">
                <div className="avatar-box" id="labAvatar">
                  <div className="a-name">Nova</div>
                  <NovaAvatar canvasId="novaChat" canvasClassName="nova-chat-canvas" wrapClassName={null} onReady={(api) => (window.NovaChat = api)} />
                  <div className="a-state" id="aState">
                    resting
                  </div>
                </div>
                <div className="chat">
                  <div className="eyebrow">Ask your coach</div>
                  <div className="feed" id="feed"></div>
                  <div className="starters" id="starters"></div>
                  <div className="composer">
                    <input id="chatInput" placeholder="ask your coach…" autoComplete="off" />
                    <button id="chatSend" aria-label="Send">
                      →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="opt">
                <label>Accent color</label>
                <div className="swatches" id="swAccent"></div>
              </div>
              <div className="opt">
                <label>Bubble design</label>
                <div className="chips" id="optSkin"></div>
              </div>
              <div className="opt">
                <label>Corner radius</label>
                <input type="range" min="0" max="28" defaultValue="16" className="range" id="optRadius" />
              </div>
              <div className="opt">
                <label>Thinking animation</label>
                <div className="chips" id="optThink"></div>
              </div>
              <div className="opt">
                <label>Text reveal</label>
                <div className="chips" id="optReveal"></div>
              </div>
              <div className="opt">
                <label>Companion</label>
                <div className="chips" id="optAvatar"></div>
                <button className="copyBtn" id="avatarPreview" style={{ marginTop: 10, background: 'rgba(255,255,255,0.06)', color: '#e9ecf5' }}>
                  Preview reaction ▷
                </button>
              </div>
              <button className="copyBtn" id="copyChat">
                Copy this chat box CSS ⧉
              </button>
            </div>
          </div>

          <div className="prompt-note">
            <div className="pn-eyebrow">↑ Prompt that built the chat box lab</div>
            <div className="pn-prompt">
              "Build a live, <b>restyleable AI coach chat box</b>. The user types, a <b>thinking indicator</b> shows, then the reply <b>reveals with animation</b>. A side panel changes it live: accent color, bubble design (
              <b>glass / solid / outline / glow</b>), corner radius, thinking style (<b>dots / bars / pulse / shimmer</b>) and text reveal (<b>fade / rise / typewriter</b>). A 'copy' button exports the chat-box CSS baked
              with whatever's currently selected — and Nova reacts with a face that matches each reply's mood."
            </div>
            <div className="pn-label">Core ideas in the prompt</div>
            <ul>
              <li>
                <b>CSS variables = single source of truth</b> — every option writes a custom prop on <b>#chatRoot</b>, so the live box and the exported snippet are the same thing.
              </li>
              <li>
                <b>Two-step message</b> — thinking bubble first, then swap to the answer with the chosen reveal (fade/rise/typewriter, the last typed char-by-char in JS).
              </li>
              <li>
                <b>Mix-and-match</b> — 4 skins × 4 thinking × 3 reveals × accent swatches + radius slider, all toggling instantly.
              </li>
              <li>
                <b>Mood-linked avatar</b> — canned replies carry a mood tag that calls <b>Nova.setExpression</b> so the crystal's face answers too.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ============ VIEW 3: COZY LOADER LAB ============ */}
      <div className="view" id="view-loader">
        <div className="loaderLab">
          <div>
            <h2>Cozy loader lab</h2>
            <div className="sub">The playful "pop" loading card from the app. Edit the tone, tag, title &amp; lines → it rotates live. Copy it when it feels right.</div>
            <div className="stageBox">
              <div id="czHost"></div>
            </div>

            <div style={{ marginTop: 24 }}>
              <div className="field">
                <label>Title (optional)</label>
                <input type="text" id="czTitle" defaultValue="Analyzing your meal…" />
              </div>
              <div className="field">
                <label>Rotating tags — one per line</label>
                <textarea id="czTags" defaultValue={'Fuel fact\nHot take\nDid you know'}></textarea>
              </div>
              <div className="field">
                <label>Lines — "text | highlighted phrase" per line</label>
                <textarea
                  id="czItems"
                  defaultValue={'Chicken and black coffee is a clean, no-nonsense start. | clean\nA plate with some color usually has some balance too. | some color\n27g of protein out of the gate is a solid foundation. | 27g'}
                ></textarea>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="opt">
              <label>Tone</label>
              <div className="chips" id="czTone"></div>
            </div>
            <div className="opt">
              <label>Speed (ms between swaps)</label>
              <input type="range" min="1200" max="5000" step="200" defaultValue="3000" className="range" id="czSpeed" />
            </div>
            <div className="opt">
              <label>Parts</label>
              <div className="toggleRow">
                <label>
                  <input type="checkbox" id="czBar" defaultChecked /> shimmer bar
                </label>
                <label>
                  <input type="checkbox" id="czDots" defaultChecked /> dots
                </label>
                <label>
                  <input type="checkbox" id="czThumb" /> thumbnail
                </label>
              </div>
            </div>
            <button className="copyBtn" id="czCopy">
              Copy this loader (HTML + CSS) ⧉
            </button>
          </div>
        </div>

        <div className="prompt-note">
          <div className="pn-eyebrow">↑ Prompt that built the cozy loader lab</div>
          <div className="pn-prompt">
            "Port the app's playful '<b>pop / cozy</b>' loading card into an editable lab. A little tag <b>bounces in</b>, a line <b>springs up</b> with one phrase highlighted, dots pulse, a shimmer bar slides, and the whole
            card <b>tints to a tone</b>. Let me edit the title, the rotating tags, and the lines (written as <b>'text | highlighted phrase'</b>), pick a tone (<b>mint / blue / amber / violet / rose</b>), set the rotation
            speed, and toggle the shimmer bar, dots and thumbnail. Copy should export a fully self-contained <b>HTML + CSS + JS</b> loader."
          </div>
          <div className="pn-label">Core ideas in the prompt</div>
          <ul>
            <li>
              <b>Spring personality</b> — overshoot <b>cubic-bezier</b> easing on the tag pop and line rise is what makes it read "cozy" instead of clinical.
            </li>
            <li>
              <b>Tone via CSS vars</b> — one <b>--tone</b> trio recolors border, tag, highlight, dots and shimmer at once; swapping tone is one variable change.
            </li>
            <li>
              <b>Content you type rotates live</b> — lines parse on the <b>|</b> to wrap the highlight; tags + lines cycle on an interval at the chosen speed.
            </li>
            <li>
              <b>Self-contained export</b> — the copy emits standalone HTML/CSS/JS (only the toggled-on parts), plus a <b>prefers-reduced-motion</b> fallback.
            </li>
          </ul>
        </div>
      </div>

      <div className="toast" id="toast">
        <span className="dot"></span>
        <span id="toastText">Copied</span>
      </div>
    </div>
  );
}
