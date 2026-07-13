# Mentor (Nova) — Design Spec

Date: 2026-07-13
Status: Approved via conversation — implementing.

## Purpose

Add a real, working "Mentor" page to the Sunpath dashboard: an AI companion named
**Nova** (reusing the name/branding already prototyped in `ai-avatar.html`) that chats
using the Claude API and grounds its answers in the user's own Sunpath data (goals,
habits, fitness, water, growth, learning, library, money). Reached from a new tile on
`today.html`.

## Source material

`ai-avatar.html` (repo root) is a standalone "lab" — a Three.js avatar demo, a chat-box
style lab with canned replies, and a cozy-loader config lab, each with copy-to-clipboard
export buttons. It has no backend and isn't linked from the real site. This spec ports
its working code into a real, integrated page. The lab is left in place as a reference/
playground and is not deleted.

## Styling approach

Hybrid: keep Nova's 3D crystal avatar exactly as built (iridescent octahedron, cyan →
violet → pink "Nebula" palette, expression system) since it's the distinctive part worth
preserving. Re-skin the chat box and cozy loader to Sunpath's existing glass design
language (`glass.css` tokens, Bricolage Grotesque font) and wrap the page in the shared
topbar/bottombar (`topbar.js`) so it reads as native to the dashboard, not a demo page.

## New page — `mentor.html`

- Uses `topbar.js` + `sunpath.css`/`glass.css` like `goals.html`/`habits.html`.
- Registered in `topbar.js`'s `currentPageKey`/`currentHub`/`pageDisplayName` maps,
  mapped to the `today` hub.
- Layout: Nova avatar up top (trimmed to idle/thinking/talking states — the lab's 15-
  animation showcase and auto-tour are not ported, they're demo-only), chat box below.

## Data grounding

On load, build a short plain-text digest from the existing `window.Sunpath` API
(`S.goalsToday`, `S.habits`, `S.fitness`, `S.growth`, `S.money`, `S.learning`,
`S.library`, `S.waterProgress`, `S.stackToday`) — summarized numbers, not raw dumps —
and send it as part of the system prompt on every request so Nova's replies reference
real, current data.

## Claude API integration

- Settings (gear icon in page header) + first-run inline chat prompt, both opening the
  same input, for pasting an Anthropic API key.
- Key stored in `localStorage` (`mentor_api_key`), never committed, never sent anywhere
  but `api.anthropic.com`.
- Direct browser `fetch` to `https://api.anthropic.com/v1/messages` with header
  `anthropic-dangerous-direct-browser-access: true` (Anthropic's supported opt-in for
  client-only apps). Model: `claude-sonnet-5`. Conversation history kept in memory for
  the session.
- Cozy loader (ported from the lab, re-skinned) shows as the "thinking" state while
  awaiting a response; avatar shifts to its `thinking` expression and back to a mood-
  matched expression on reply, reusing `Nova.setExpression`.

## Error handling

- No key saved → chat shows an inline prompt/input, no call attempted.
- Call fails (bad key, network, rate limit) → friendly inline error bubble from Nova,
  chat remains usable.

## Today.html tile

New `.mod.glassy` tile in `today.html`'s `renderGrid()`, styled like the existing Goals/
Habits tiles, linking to `mentor.html`.

## Local dev + sync workflow

A local static server (`python3 -m http.server`) serves the repo root during this
session so `ai-avatar.html` and `mentor.html` are both live on localhost. When the lab
file changes, changes are folded into `mentor.html` by hand (told to Claude, or via the
lab's copy buttons) — never auto-committed. `git commit`/`push` only happens after
explicit confirmation.

## Testing / verification

- Click through from `today.html`, confirm nav/topbar/bottombar highlight correctly.
- Load `mentor.html` standalone: avatar renders, cozy loader shows while waiting,
  chat bubbles render with reveal animation.
- Send a real message with a valid key; confirm the reply references live Sunpath data.
- Test no-key state and a deliberately invalid key.
- Check mobile viewport (this is a phone-first dashboard).

## Out of scope

- No serverless proxy / hidden API key — key is user-supplied and client-side only.
- No model picker UI — single default model.
- The 15-animation showcase, auto-tour, and palette picker from the lab are not ported;
  Nova only needs idle/thinking/talking states on the real page.
