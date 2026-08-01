'use client';

import { useEffect, useRef, useState } from 'react';
import NovaAvatar from './NovaAvatar';
import { goalsToday, habits, fitness, waterProgress, stackToday, learning, library, growth, fmtShort, money } from '@/lib/sunpath';

const HISTORY_KEY = 'mentor_chat_history';
const MAX_HISTORY = 40;
const MENTOR_MODEL = 'claude-sonnet-5';

function loadHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch (e) {}
}

function buildSunpathDigest() {
  const parts = [];
  try {
    const G = goalsToday();
    parts.push('Goals: ' + (G.total ? G.done + '/' + G.total + ' done today' : 'none set today'));
  } catch (e) {}
  try {
    const H = habits();
    parts.push('Habits: best streak ' + H.bestStreak + ' days, ' + H.list.length + ' tracked');
  } catch (e) {}
  try {
    const F = fitness();
    const last = F.sessions[0];
    parts.push('Fitness: ' + (F.km % 1 === 0 ? F.km : F.km.toFixed(1)) + ' km all-time' + (last ? ', last session ' + last.type + ' on ' + last.date : ', no sessions yet'));
  } catch (e) {}
  try {
    const W = waterProgress();
    parts.push('Water today: ' + (W.total ? W.done + '/' + W.total : 'not tracked'));
  } catch (e) {}
  try {
    const st = stackToday();
    if (st.total) parts.push('Supplement stack: ' + st.taken + '/' + st.total + ' taken today');
  } catch (e) {}
  try {
    const L = learning();
    parts.push('Learning: ' + (L.hours % 1 === 0 ? L.hours : L.hours.toFixed(1)) + ' hours total');
  } catch (e) {}
  try {
    const Lib = library();
    const reading = Lib.books.filter((b) => b && b.status === 'reading');
    parts.push('Library: ' + reading.length + ' book(s) currently reading' + (reading[0] ? ' — "' + reading[0].title + '"' : ''));
  } catch (e) {}
  try {
    const Gr = growth();
    const lastNote = Gr.notes[0];
    parts.push('Growth: ' + (lastNote ? 'last reflection ' + fmtShort(lastNote.ts) : 'no reflections yet'));
  } catch (e) {}
  try {
    const M = money();
    if (M) parts.push('Money: net worth ' + Math.round(M.last.v).toLocaleString() + ' SGD, ' + (M.delta30 >= 0 ? '+' : '') + Math.round(M.delta30).toLocaleString() + ' past 30d');
  } catch (e) {}
  return parts.join('\n');
}

function novaSystemPrompt() {
  return (
    "You are Nova, a warm, direct personal mentor inside the user's Sunpath life-tracking dashboard. " +
    'You can see their goals, habits, fitness, water, supplements, learning, library, growth reflections and ' +
    'money — not just one area. Use the data below to ground your answers in what is actually happening in ' +
    'their life. Be concise — a few sentences, not an essay — and always point to ONE thing they can act on next.\n\n' +
    'Current data:\n' + buildSunpathDigest()
  );
}

function buildNudge() {
  const hour = new Date().getHours();
  try {
    const G = goalsToday();
    if (G.total > 0 && G.pending.length > 0 && hour >= 17) {
      return "You've got " + G.pending.length + ' goal' + (G.pending.length === 1 ? '' : 's') + ' still open today. Want to pick one to close out?';
    }
  } catch (e) {}
  try {
    const H = habits();
    if (H.list.length > 0 && H.doneToday < H.list.length && hour >= 20) {
      return "You're at " + H.doneToday + '/' + H.list.length + ' habits today — still time to close the gap before the day resets.';
    }
  } catch (e) {}
  try {
    const W = waterProgress();
    if (W.total > 0 && W.done < Math.ceil(W.total * 0.5) && hour >= 15) {
      return "You're behind on water today (" + W.done + '/' + W.total + '). Worth catching up.';
    }
  } catch (e) {}
  try {
    const st = stackToday();
    if (st.total > 0 && st.taken < st.total && hour >= 12) {
      return "You haven't logged your full stack today (" + st.taken + '/' + st.total + ').';
    }
  } catch (e) {}
  try {
    const F = fitness();
    const last = F.sessions[0];
    if (last && last.date) {
      const days = Math.floor((Date.now() - new Date(last.date + 'T00:00:00').getTime()) / 864e5);
      if (days >= 3) return "It's been " + days + ' days since your last ' + (last.type || 'workout') + ' — anything planned soon?';
    }
  } catch (e) {}
  try {
    const G = goalsToday(), H = habits();
    if (G.total > 0 && G.pending.length === 0 && H.list.length > 0 && H.doneToday === H.list.length) {
      return 'Goals and habits are both clean today — nice work. Anything on your mind?';
    }
  } catch (e) {}
  return null;
}

const CHIP_POOL = [
  'What should I focus on today?',
  'How am I doing this week overall?',
  "Any habit I'm slipping on?",
  'Summarize my goals',
  "What's one thing I should fix?",
  "How's my fitness trending?",
  'Am I on track with money?',
  'What should I read or learn next?',
];
function pickChips() {
  const pool = CHIP_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, 4);
}

const CZ_TAGS = ['Thinking', 'One sec', 'On it'];
const CZ_LINES = [
  { text: 'Reading your whole day across the dashboard.', hl: 'whole day' },
  { text: 'Finding the one move that matters most right now.', hl: 'one move' },
  { text: 'Keeping it honest and something you can do today.', hl: 'do today' },
];

function ThinkingBubble() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setI((v) => (v + 1) % CZ_LINES.length), 2200);
    return () => clearInterval(timer);
  }, []);
  const line = CZ_LINES[i];
  const idx = line.hl ? line.text.indexOf(line.hl) : -1;
  return (
    <div className="msg nova">
      <div className="bubble">
        <span className="tagchip">Nova</span>
        <div className="cz">
          <div className="cz-body">
            <div className="cz-bar">
              <span />
            </div>
            <div className="cz-fact">
              <span className="cz-tag">{CZ_TAGS[i % CZ_TAGS.length]}</span>
              <p className="cz-text">
                {idx < 0 ? (
                  line.text
                ) : (
                  <>
                    {line.text.slice(0, idx)}
                    <span className="cz-hl">{line.hl}</span>
                    {line.text.slice(idx + line.hl.length)}
                  </>
                )}
              </p>
              <div className="cz-dots">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseSSEBlock(block) {
  let event = null, dataLine = null;
  block.split('\n').forEach((line) => {
    if (line.indexOf('event:') === 0) event = line.slice(6).trim();
    else if (line.indexOf('data:') === 0) dataLine = line.slice(5).trim();
  });
  if (!dataLine) return null;
  try {
    return { event, data: JSON.parse(dataLine) };
  } catch (e) {
    return null;
  }
}

export default function MentorClient() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', content}
  const [thinking, setThinking] = useState(false);
  const [streamingText, setStreamingText] = useState(null); // string while streaming, null when not
  const [chips, setChips] = useState([]);
  const [input, setInput] = useState('');
  const historyRef = useRef([]);
  const novaRef = useRef(null);
  const feedRef = useRef(null);

  function scrollChat() {
    requestAnimationFrame(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    });
  }

  function startFreshConversation() {
    const nudge = buildNudge();
    setMessages([{ role: 'assistant', content: nudge || "Hey, I'm Nova. Ask me anything about your day." }]);
    setChips(pickChips());
  }

  useEffect(() => {
    setMounted(true);
    const history = loadHistory();
    historyRef.current = history;
    if (history.length) {
      setMessages(history);
      setChips([]);
    } else {
      startFreshConversation();
    }
    scrollChat();

    let pendingPrompt = null;
    try {
      pendingPrompt = sessionStorage.getItem('mentor_pending_prompt');
      sessionStorage.removeItem('mentor_pending_prompt');
    } catch (e) {}
    if (pendingPrompt) {
      // defer so Nova's avatar + UI has mounted
      setTimeout(() => send(pendingPrompt), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runReply(text) {
    setThinking(true);
    if (novaRef.current) novaRef.current.setExpression('thinking');
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];
    saveHistory(historyRef.current);

    let fullText = '';
    let streamErr = null;
    let started = false;
    try {
      const res = await fetch('/api/mentor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MENTOR_MODEL,
          max_tokens: 512,
          thinking: { type: 'disabled' },
          stream: true,
          system: novaSystemPrompt(),
          messages: historyRef.current,
        }),
      });

      if (!res.ok || !res.body) {
        setThinking(false);
        const errBody = await res.json().catch(() => ({}));
        const msg = (errBody && errBody.error && errBody.error.message) || 'Request failed (' + res.status + ')';
        setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong: ' + msg + '. Check that the API key is set in .env and try again.' }]);
        if (novaRef.current) novaRef.current.setExpression('sad', 4);
        historyRef.current = historyRef.current.slice(0, -1);
        saveHistory(historyRef.current);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const parsed = parseSSEBlock(buf.slice(0, idx));
          buf = buf.slice(idx + 2);
          if (!parsed) continue;
          if (parsed.event === 'content_block_delta' && parsed.data.delta && parsed.data.delta.type === 'text_delta') {
            if (!started) {
              started = true;
              setThinking(false);
              if (novaRef.current) novaRef.current.setExpression('happy', 4);
            }
            fullText += parsed.data.delta.text;
            setStreamingText(fullText);
            scrollChat();
          } else if (parsed.event === 'error') {
            streamErr = (parsed.data.error && parsed.data.error.message) || 'stream error';
          }
        }
      }

      if (!fullText) {
        setThinking(false);
        setMessages((m) => [...m, { role: 'assistant', content: streamErr ? 'Something went wrong: ' + streamErr + '.' : '(empty reply)' }]);
        if (novaRef.current) novaRef.current.setExpression('sad', 4);
        historyRef.current = historyRef.current.slice(0, -1);
        saveHistory(historyRef.current);
        return;
      }
      setMessages((m) => [...m, { role: 'assistant', content: fullText }]);
      setStreamingText(null);
      historyRef.current = [...historyRef.current, { role: 'assistant', content: fullText }];
      saveHistory(historyRef.current);
    } catch (e) {
      if (started && fullText) {
        setMessages((m) => [...m, { role: 'assistant', content: fullText }]);
        setStreamingText(null);
        historyRef.current = [...historyRef.current, { role: 'assistant', content: fullText }];
        saveHistory(historyRef.current);
      } else {
        setThinking(false);
        setMessages((m) => [...m, { role: 'assistant', content: "Couldn't reach Nova — check your connection and try again." }]);
        if (novaRef.current) novaRef.current.setExpression('sad', 4);
        historyRef.current = historyRef.current.slice(0, -1);
        saveHistory(historyRef.current);
      }
    }
  }

  function send(text) {
    text = String(text || '').trim();
    if (!text) return;
    setChips([]);
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    if (novaRef.current) novaRef.current.setExpression('surprised');
    scrollChat();
    runReply(text);
  }

  function clearConversation() {
    historyRef.current = [];
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {}
    startFreshConversation();
  }

  return (
    <div className="mentor-page">
      <div className="page">
        <div className="dash-header">
          <div>
            <div className="dash-title-text">
              Mentor<span className="dash-title-dot">.</span>
            </div>
            <div className="dash-title-sub">Nova · your AI companion</div>
          </div>
          <button type="button" className="mentor-clear-btn" aria-label="Clear conversation" onClick={clearConversation}>
            Clear
          </button>
        </div>

        <div className="nova-card glassy">
          <NovaAvatar onReady={(api) => (novaRef.current = api)} />
          <div className="nova-label">
            <div className="nova-name">Nova</div>
            <div className="nova-role">your mentor</div>
          </div>
        </div>

        <div className="chat-card glassy">
          <div className="chat-feed" ref={feedRef}>
            {mounted &&
              messages.map((m, i) => (
                <div className={'msg ' + (m.role === 'user' ? 'user' : 'nova')} key={i}>
                  {m.role === 'user' ? (
                    <div className="bubble">{m.content}</div>
                  ) : (
                    <div className="bubble">
                      <span className="tagchip">Nova</span>
                      <div className="bubble-text" style={{ whiteSpace: 'pre-wrap' }}>
                        {m.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            {streamingText != null && (
              <div className="msg nova">
                <div className="bubble">
                  <span className="tagchip">Nova</span>
                  <div className="bubble-text" style={{ whiteSpace: 'pre-wrap' }}>
                    {streamingText}
                  </div>
                </div>
              </div>
            )}
            {thinking && <ThinkingBubble />}
          </div>
          <div className="chip-row">
            {chips.map((c) => (
              <button key={c} type="button" className="chip" onClick={() => send(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="chat-composer">
            <input
              placeholder="ask Nova…"
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
            />
            <button aria-label="Send" onClick={() => send(input)}>
              &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
