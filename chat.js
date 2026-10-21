/* =====================================================================
   Общий чат для посетителей сайта — chat.js
   Сообщения хранятся в бесплатной базе Google Firebase (Realtime Database).

   ЧТО НУЖНО СДЕЛАТЬ ВЛАДЕЛЬЦУ САЙТА — ОДИН РАЗ:
   замените блок «const firebaseConfig = { ... };» ниже на такой же блок
   из консоли Firebase (Настройки проекта → Ваши приложения).
   Всё остальное в этом файле менять не нужно.
   ===================================================================== */
(function () {
'use strict';

// ▼▼▼ ВСТАВЬТЕ СЮДА СВОЙ БЛОК firebaseConfig ИЗ КОНСОЛИ FIREBASE (заменить целиком) ▼▼▼
const firebaseConfig = {
  apiKey: "ВСТАВЬТЕ_СЮДА",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
// ▲▲▲ ДАЛЬШЕ НИЧЕГО МЕНЯТЬ НЕ НУЖНО ▲▲▲

if (window.__chatLoaded) return;
window.__chatLoaded = true;

var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
var LIMIT = 100, PAGE = 50, MAX_LEN = 500, NAME_MAX = 30, RATE_MS = 3000, GROUP_MS = 5 * 60 * 1000;
var K = { name: 'chat.name', uid: 'chat.uid', seen: 'chat.seen', admin: 'chat.admin' };
var D = document, R = D.documentElement;
var mqM = window.matchMedia ? matchMedia('(max-width:760px)') : { matches: false };
var isTouch = !!(window.matchMedia && matchMedia('(hover:none)').matches);
var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches);

function ls(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  } catch (e) { return null; }
}

var cfg = firebaseConfig || {};
var dbURL = String(cfg.databaseURL || '').trim().replace(/\/+$/, '');
var hasKey = !!(cfg.apiKey && !/ВСТАВЬТЕ/.test(cfg.apiKey) && cfg.projectId);
var configured = hasKey && /^https:\/\//.test(dbURL);

/* ---------- правила базы (их же можно скопировать из чата со своим ID модератора) ---------- */
function rules(admin) {
  var A = "auth.uid === '" + admin + "'";
  return { rules: {
    messages: {
      '.read': true,
      $id: {
        '.write': "auth != null && !root.child('banned').child(auth.uid).exists() && ((!data.exists() && newData.exists()) || (data.exists() && !newData.exists() && (data.child('uid').val() === auth.uid || " + A + ')))',
        '.validate': "newData.hasChildren(['uid', 'name', 'text', 'ts']) && newData.child('uid').val() === auth.uid && newData.child('ts').val() === now && newData.parent().parent().child('last').child(auth.uid).val() === now",
        uid: { '.validate': 'newData.isString()' },
        name: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= ' + NAME_MAX },
        text: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= ' + MAX_LEN },
        ts: { '.validate': 'newData.isNumber()' },
        $other: { '.validate': false }
      }
    },
    /* не чаще одного сообщения в 3 секунды с одного устройства */
    last: { $uid: { '.write': 'auth != null && auth.uid === $uid', '.validate': 'newData.val() === now && (!data.exists() || newData.val() >= data.val() + ' + RATE_MS + ')' } },
    online: { '.read': true, $uid: { '.write': 'auth != null && auth.uid === $uid', '.validate': 'newData.val() === true' } },
    banned: { $uid: {
      '.read': 'auth != null && (auth.uid === $uid || ' + A + ')',
      '.write': 'auth != null && ' + A,
      '.validate': 'newData.val() === true'
    } }
  } };
}
window.__chatRules = rules; // для проверки и для файла firebase-rules.json

/* ---------- значки ---------- */
var IC = {
  chat: '<svg class="ci-chat" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 4.5h13a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.6 3.4c-.4.3-.9 0-.9-.4v-3H5.5A2.5 2.5 0 0 1 3 15V7a2.5 2.5 0 0 1 2.5-2.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="8.2" cy="11" r="1.25" fill="currentColor"/><circle cx="12" cy="11" r="1.25" fill="currentColor"/><circle cx="15.8" cy="11" r="1.25" fill="currentColor"/></svg>',
  chatPx: '<svg class="ico-px" viewBox="0 0 12 10" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><rect x="1" y="0" width="10" height="1" fill="currentColor"/><rect x="0" y="1" width="1" height="6" fill="currentColor"/><rect x="11" y="1" width="1" height="6" fill="currentColor"/><rect x="2" y="3" width="2" height="2" fill="currentColor"/><rect x="5" y="3" width="2" height="2" fill="currentColor"/><rect x="8" y="3" width="2" height="2" fill="currentColor"/><rect x="1" y="7" width="10" height="1" fill="currentColor"/><rect x="2" y="8" width="2" height="1" fill="currentColor"/><rect x="2" y="9" width="1" height="1" fill="currentColor"/></svg>',
  down: '<svg class="ci-down" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" focusable="false"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 3.6V6l1.6 1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path d="M12 5v13M6.5 12.5 12 18l5.5-5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/* ---------- оформление (берёт цвета и шрифты сайта, поэтому само подстраивается под темы) ---------- */
var CSS = [
'.chat-fab{position:fixed;right:26px;bottom:calc(26px + env(safe-area-inset-bottom,0px));z-index:395;width:56px;height:56px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;cursor:pointer;color:var(--surface);background:var(--accent);box-shadow:0 10px 26px -8px color-mix(in srgb,var(--accent) 75%,transparent),0 2px 6px rgba(0,0,0,.14);transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s ease;-webkit-tap-highlight-color:transparent}',
'.chat-fab:hover{transform:translateY(-2px)}',
'.chat-fab:active{transform:scale(.93)}',
'.chat-fab:focus-visible{outline:2px solid var(--accent);outline-offset:3px}',
'.chat-fab svg{grid-area:1/1;width:27px;height:27px;transition:transform .3s cubic-bezier(.22,1,.36,1),opacity .2s ease}',
'.chat-fab .ci-down{opacity:0;transform:rotate(-90deg) scale(.6)}',
'.chat-fab.is-open .ci-chat{opacity:0;transform:rotate(90deg) scale(.6)}',
'.chat-fab.is-open .ci-down{opacity:1;transform:none}',
'.chat-badge{position:absolute;top:-3px;right:-3px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--odr,#d8344a);color:#fff;font:700 11px/20px var(--sans);font-style:normal;text-align:center;box-shadow:0 0 0 2px var(--surface);pointer-events:none}',
'.chat-badge.dot{min-width:0;width:13px;height:13px;padding:0;top:1px;right:1px}',
'.chat-badge[hidden]{display:none}',
'.tb-chat{position:relative}',
'.tb-chat .chat-badge{top:2px;right:calc(50% - 25px);min-width:18px;height:18px;padding:0 5px;font-size:10px;line-height:18px}',
'.tb-chat .chat-badge.dot{width:10px;height:10px;min-width:0;padding:0;top:6px;right:calc(50% - 16px)}',

'.chat{position:fixed;right:24px;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:900;width:min(392px,calc(100vw - 48px));height:min(640px,calc(100vh - 176px));min-height:320px;display:flex;flex-direction:column;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:var(--r-lg,18px);box-shadow:var(--sh-3,0 16px 40px rgba(0,0,0,.22)),0 30px 60px -30px rgba(0,0,0,.35);overflow:hidden;font:400 15px/1.45 var(--sans);opacity:0;transform:translateY(14px) scale(.97);transform-origin:calc(100% - 30px) 100%;transition:opacity .2s ease,transform .3s cubic-bezier(.22,1,.36,1)}',
'.chat[hidden]{display:none}',
'.chat.on{opacity:1;transform:none}',
'.chat *,.chat *::before,.chat *::after{box-sizing:border-box}',
'.chat button{font-family:inherit}',
'.chat-head{flex:none;display:flex;align-items:center;gap:8px;padding:12px 12px 11px 16px;border-bottom:1px solid var(--hair,var(--line));background:var(--surface)}',
'.chat-hl{flex:1;min-width:0}',
'.chat-title{display:block;font:600 1.02rem/1.25 var(--sans);color:var(--ink)}',
'.chat-sub{display:flex;align-items:center;gap:6px;margin-top:2px;font:500 .74rem/1.25 var(--sans);color:var(--muted);white-space:nowrap;overflow:hidden}',
'.chat-sub span{overflow:hidden;text-overflow:ellipsis}',
'.chat-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--muted)}',
'.chat-dot.ok{background:var(--c2,#1f9d6b);box-shadow:0 0 0 3px color-mix(in srgb,var(--c2,#1f9d6b) 22%,transparent)}',
'.chat-dot.wait{background:var(--warn,#c27a0e);animation:chatPulse 1s ease-in-out infinite}',
'.chat-dot.err{background:var(--odr,#d8344a)}',
'@keyframes chatPulse{50%{opacity:.3}}',
'.chat-ib{flex:none;width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid var(--line);border-radius:50%;background:transparent;color:var(--ink);font:700 .85rem var(--sans);cursor:pointer;transition:border-color .2s,background .2s}',
'.chat-ib:hover{border-color:var(--accent)}',
'.chat-ib:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
'.chat-ib svg{width:18px;height:18px}',
'.chat-me.has-name{background:var(--uc,var(--accent));border-color:transparent;color:var(--surface)}',

'.chat-main{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}',
'.chat-body{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;background:var(--bg)}',
'.chat-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:8px 10px 12px;display:flex;flex-direction:column}',
'.chat-list::before{content:"";flex:1 0 0}',
'.chat-more{align-self:center;margin:6px 0 4px;font:500 .8rem var(--sans);color:var(--accent);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 14px;cursor:pointer}',
'.chat-more[hidden]{display:none}',
'.chat-more:disabled{opacity:.6;cursor:default}',
'.cmw{display:flex;flex-direction:column;flex:none}',
'.cm-day{align-self:center;margin:14px 0 4px;font:600 .7rem/1.3 var(--sans);letter-spacing:.02em;color:var(--muted);background:var(--surface);border:1px solid var(--hair,var(--line));border-radius:999px;padding:3px 10px}',
'.cm-day[hidden]{display:none}',
'.cm{display:flex;align-items:flex-start;gap:8px;margin-top:10px}',
'.cmw.cont .cm{margin-top:3px}',
'.cm-av{flex:none;width:30px;height:30px;margin-top:1px;border-radius:50%;display:grid;place-items:center;font:700 .82rem/1 var(--sans);color:var(--surface);background:var(--uc,var(--accent));user-select:none}',
'.cmw.cont .cm-av{visibility:hidden;height:1px}',
'.cm-col{min-width:0;max-width:min(80%,520px);display:flex;flex-direction:column;align-items:flex-start}',
'.cm-b{position:relative;max-width:100%;padding:7px 11px 7px;background:var(--surface);color:var(--ink);border:1px solid var(--hair,var(--line));border-radius:16px 16px 16px 16px;border-top-left-radius:6px;box-shadow:var(--sh-1,none);overflow-wrap:anywhere;word-break:break-word;outline:0}',
'.cmw.cont .cm-b{border-top-left-radius:6px}',
'.cm-n{display:block;margin:0 0 1px;font:600 .78rem/1.3 var(--sans);color:var(--uc,var(--accent))}',
'.cmw.cont .cm-n{display:none}',
'.cm-t{white-space:pre-wrap;font-size:.95rem;line-height:1.42}',
'.cm-t::after{content:"";display:inline-block;width:44px;height:1px}',
'.cm-time{position:absolute;right:9px;bottom:4px;display:flex;align-items:center;gap:3px;font:500 .66rem/1 var(--sans);color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}',
'.cm-t a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}',
'.cm-t a.cm-code{font:600 .9em var(--mono);text-decoration:none;padding:0 4px;border-radius:5px;background:color-mix(in srgb,var(--accent) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent) 32%,transparent);white-space:nowrap}',
'.cmw.own .cm{flex-direction:row-reverse}',
'.cmw.own .cm-av,.cmw.own .cm-n{display:none}',
'.cmw.own .cm-col{align-items:flex-end}',
'.cmw.own .cm-b{background:var(--accent);color:var(--surface);border-color:transparent;border-radius:16px;border-top-right-radius:6px}',
'.cmw.own .cm-time{color:color-mix(in srgb,var(--surface) 78%,transparent)}',
'.cmw.own .cm-t a{color:inherit}',
'.cmw.own .cm-t a.cm-code{background:color-mix(in srgb,var(--surface) 22%,transparent);border-color:color-mix(in srgb,var(--surface) 45%,transparent)}',
'.cmw.is-pending .cm-b{opacity:.72}',
'.cmw.can-act .cm-b{cursor:pointer}',
'.cmw.is-sel .cm-b{box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 50%,transparent)}',
'.cmw.own.is-sel .cm-b{box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 35%,var(--surface))}',
'.cm-acts{display:none;flex-wrap:wrap;gap:6px;margin-top:6px}',
'.cmw.is-sel .cm-acts{display:flex}',
'.cm-act{font:600 .76rem/1 var(--sans);color:var(--odr,#d8344a);background:var(--surface);border:1px solid color-mix(in srgb,var(--odr,#d8344a) 40%,var(--line));border-radius:999px;padding:7px 12px;cursor:pointer}',
'.cm-act.armed{background:var(--odr,#d8344a);border-color:var(--odr,#d8344a);color:#fff}',
'.cmw.is-new{animation:cmIn .34s cubic-bezier(.22,1,.36,1)}',
'@keyframes cmIn{from{opacity:0;transform:translateY(8px)}}',
'.chat-state{margin:auto;max-width:310px;padding:22px 14px;text-align:center;color:var(--muted);font-size:.9rem;line-height:1.5}',
'.chat-state svg{display:block;width:40px;height:40px;margin:0 auto 10px;color:var(--accent)}',
'.chat-state b{display:block;margin-bottom:4px;color:var(--ink);font-size:1rem}',
'.chat-state p{margin:0;max-width:none}',
'.chat-state code{font:600 .85em var(--mono);color:var(--ink)}',
'.chat-state button{margin-top:12px}',
'.chat-load{display:flex;flex-direction:column;gap:10px;margin-top:auto;padding:4px 0}',
'.chat-load i{display:block;height:34px;border-radius:14px;background:color-mix(in srgb,var(--ink) 7%,transparent);animation:chatPulse 1.2s ease-in-out infinite}',
'.chat-load i:nth-child(1){width:58%}.chat-load i:nth-child(2){width:42%;animation-delay:.15s}.chat-load i:nth-child(3){width:66%;align-self:flex-end;animation-delay:.3s}',
'.chat-jump{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;font:600 .78rem/1 var(--sans);color:var(--surface);background:var(--accent);border:0;border-radius:999px;padding:8px 14px;box-shadow:var(--sh-2,0 4px 14px rgba(0,0,0,.18));cursor:pointer;z-index:2}',
'.chat-jump[hidden]{display:none}',
'.chat-toast{position:absolute;left:50%;bottom:12px;z-index:3;max-width:calc(100% - 24px);padding:9px 14px;border-radius:12px;background:var(--ink);color:var(--surface);font:500 .82rem/1.35 var(--sans);text-align:center;opacity:0;transform:translate(-50%,8px);pointer-events:none;transition:opacity .2s ease,transform .2s ease}',
'.chat-toast.on{opacity:1;transform:translate(-50%,0)}',

'.chat-foot{flex:none;padding:8px 10px;border-top:1px solid var(--hair,var(--line));background:var(--surface)}',
'.chat-note{margin:0 0 8px;padding:8px 10px;border-radius:10px;font-size:.8rem;line-height:1.4;color:var(--ink);background:color-mix(in srgb,var(--odr,#d8344a) 9%,transparent);border:1px solid color-mix(in srgb,var(--odr,#d8344a) 30%,transparent);max-width:none}',
'.chat-note[hidden]{display:none}',
'.chat-form{display:flex;align-items:flex-end;gap:8px}',
'.chat-form[hidden],.chat-join[hidden]{display:none}',
'.chat-field{flex:1;min-width:0;margin:0;border:1px solid var(--line);border-radius:20px;background:var(--bg);color:var(--ink);font:400 15px/1.4 var(--sans);padding:9px 14px;outline:0;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;appearance:none}',
'.chat-field::placeholder{color:var(--muted);opacity:1}',
'.chat-field:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent)}',
'.chat-field:disabled{opacity:.6}',
'textarea.chat-field{display:block;resize:none;height:40px;max-height:132px;overflow-y:auto}',
'.chat-send{flex:none;width:40px;height:40px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:var(--accent);color:var(--surface);cursor:pointer;transition:transform .15s,opacity .2s}',
'.chat-send:disabled{opacity:.35;cursor:default}',
'.chat-send:not(:disabled):active{transform:scale(.9)}',
'.chat-send svg{width:20px;height:20px}',
'.chat-cnt{display:block;margin:3px 50px 0 0;text-align:right;font:500 .68rem var(--mono);color:var(--muted)}',
'.chat-cnt[hidden]{display:none}',
'.chat-cnt.warn{color:var(--odr,#d8344a)}',
'.chat-join{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
'.chat-join .chat-field{flex:1 1 150px}',
'.chat-btn{flex:none;font:600 .88rem/1 var(--sans);color:var(--surface);background:var(--accent);border:0;border-radius:20px;padding:12px 16px;cursor:pointer;transition:transform .15s,opacity .2s}',
'.chat-btn:active{transform:scale(.96)}',
'.chat-btn:disabled{opacity:.5;cursor:default}',
'.chat-btn.ghost{color:var(--accent);background:transparent;border:1px solid var(--line)}',
'.chat-join p{flex-basis:100%;margin:0;font-size:.74rem;line-height:1.4;color:var(--muted);max-width:none}',

'.chat-sheet{position:absolute;inset:0;z-index:4;overflow-y:auto;background:var(--surface);padding:16px 16px 20px;opacity:0;transform:translateY(8px);transition:opacity .18s ease,transform .22s cubic-bezier(.22,1,.36,1)}',
'.chat-sheet[hidden]{display:none}',
'.chat-sheet.on{opacity:1;transform:none}',
'.cs-sec{margin:0 0 20px}',
'.cs-h{display:block;margin:0 0 8px;font:600 .68rem/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}',
'.cs-row{display:flex;gap:8px}',
'.cs-p{margin:8px 0 0;font-size:.82rem;line-height:1.5;color:var(--muted);max-width:none}',
'.cs-p b{color:var(--ink);font-weight:600}',
'.cs-id{display:block;margin:6px 0 0;padding:7px 9px;font:600 .78rem/1.35 var(--mono);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;word-break:break-all;user-select:all}',
'.cs-own{border-top:1px solid var(--hair,var(--line));padding-top:14px}',
'.cs-tog{display:flex;align-items:center;justify-content:space-between;width:100%;padding:0;margin:0;background:none;border:0;color:var(--muted);font:600 .68rem/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;text-align:left}',
'.cs-tog::after{content:"+";font:600 1rem var(--mono);color:var(--muted)}',
'.cs-tog[aria-expanded=true]::after{content:"\\2212"}',
'.cs-ownb[hidden]{display:none}',
'.cs-ownb .chat-btn{margin-top:10px}',
'.cs-rules{display:block;width:100%;height:150px;margin-top:10px;padding:8px;font:400 11px/1.4 var(--mono);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;resize:vertical}',
'.cs-rules[hidden]{display:none}',
'.cs-ok{margin-top:10px;padding:8px 10px;border-radius:10px;font-size:.8rem;line-height:1.45;color:var(--ink);background:color-mix(in srgb,var(--c2,#1f9d6b) 10%,transparent);border:1px solid color-mix(in srgb,var(--c2,#1f9d6b) 35%,transparent);max-width:none}',
'.cs-ok[hidden]{display:none}',

'@media (max-width:760px){',
'  .chat{left:0;right:0;top:0;bottom:auto;width:100%;height:100%;min-height:0;border:0;border-radius:0;box-shadow:none;padding-top:env(safe-area-inset-top,0px);transform:translateY(28px)}',
'  .chat.on{transform:none}',
'  .chat-head{padding:10px 10px 9px 16px}',
'  .chat-foot{padding-bottom:calc(8px + env(safe-area-inset-bottom,0px))}',
'  .chat-field,textarea.chat-field{font-size:16px}',
'  .cm-col{max-width:84%}',
'  .chat-fab{right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:54px;height:54px}',
'  body:not(.landing-open) .chat-fab{display:none}',
'  html.chat-lock,html.chat-lock body{overflow:hidden}',
'  .tabbar.has-chat{grid-template-columns:repeat(6,1fr)}',
'  .tabbar.has-chat.no-calc{grid-template-columns:repeat(5,1fr)}',
'  html.has-chat .landing{padding-bottom:calc(86px + env(safe-area-inset-bottom,0px))}',
'  :root.px .tabbar.has-chat .tb{font-size:.74rem;letter-spacing:0}',
'}',
'@media (min-width:761px){html.has-chat:not(.px) .wow-top{bottom:96px}}',
':root.px .chat{border:var(--pxd,3px) solid var(--line);box-shadow:6px 6px 0 0 var(--pxs,#000)}',
':root.px .chat-fab{box-shadow:4px 4px 0 0 var(--pxs,#000)}',
':root.px .cm-b{border-width:2px;box-shadow:none}',
':root.px .chat-field{border-width:2px}',
'@media (max-width:760px){:root.px .chat{border:0;box-shadow:none}}',
'@media (prefers-reduced-motion:reduce){.chat,.chat-fab,.chat-fab svg,.chat-sheet,.chat-toast{transition:none}.cmw.is-new{animation:none}.chat-dot.wait,.chat-load i{animation:none}}',
'@media print{.chat,.chat-fab,.tb-chat{display:none!important}}'
].join('\n');

/* ---------- состояние ---------- */
var ui = {}, fb = null;
var me = { uid: ls(K.uid) || '', name: ls(K.name) || '' };
var isOpen = false, started = false, connected = false, authed = false, banned = false;
var initialDone = false, more = false, loadingMore = false, dot = false;
var unread = 0, lastSent = 0, onlineN = 0, pushed = false, swallow = 0, afterPop = null;
var order = [], M = new Map(), pending = new Set();
var lastFocus = null, toastT = 0, offT = 0;

/* ---------- мелочи ---------- */
function el(tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function dayKey(t) { var d = new Date(t); return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate(); }
var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function dayLabel(t) {
  var d = new Date(t), now = new Date(), k = dayKey(t), y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (k === dayKey(now)) return 'Сегодня';
  if (k === dayKey(y)) return 'Вчера';
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
}
function hue(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return [1, 2, 3, 4, 5, 6, 7, 9][h % 8]; }
function initial(n) { var c = Array.from(String(n || '?').trim())[0] || '?'; return c.toUpperCase(); }
function cleanName(n) { return String(n || '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX); }
function tidy(t) { return String(t || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f\u202a-\u202e]/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_LEN); }
function isPerm(e) { var s = String((e && (e.code || e.message)) || '').toLowerCase(); return s.indexOf('permission') >= 0; }
function isAdmin() { return !!me.uid && ls(K.admin) === me.uid; }
function nearBottom() { var l = ui.list; return !l || l.scrollHeight - l.scrollTop - l.clientHeight < 120; }
function scrollBottom(smooth) {
  var l = ui.list; if (!l) return;
  if (smooth && !reduce && l.scrollTo) l.scrollTo({ top: l.scrollHeight, behavior: 'smooth' }); else l.scrollTop = l.scrollHeight;
  ui.jump.hidden = true;
}
function toast(msg, ms) {
  var t = ui.toast; if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, ms || 3200);
}

/* ---------- коды дефектов в сообщениях становятся ссылками на карточки 2499р ---------- */
var CODES = null;
function expand(s) {
  var m = s.match(/^(\d\d)\.(.+)$/); if (!m) return [];
  var ds = m[2].replace(/\d\d\./g, '').match(/\d/g) || [];
  return ds.map(function (d) { return m[1] + '.' + d; });
}
function knownCodes() {
  if (CODES) return CODES;
  CODES = { full: new Set(), short: new Set() };
  D.querySelectorAll('#groups details.sub > summary code').forEach(function (c) {
    c.textContent.split(',').forEach(function (x) {
      x = x.trim(); if (!x) return; CODES.full.add(x);
      expand(x).forEach(function (k) { CODES.short.add(k); });
    });
  });
  return CODES;
}
function codeOk(c) { var S = knownCodes(); return S.full.has(c) || S.short.has((expand(c) || [])[0]); }
function addCodes(node, s) {
  if (!s) return;
  var re = /(^|[^\d.,])(\d{2}\.\d(?:-\d)?)(?!\d|\.\d)/g, last = 0, m;
  while ((m = re.exec(s))) {
    var code = m[2], start = m.index + m[1].length;
    if (!codeOk(code)) continue;
    if (start > last) node.appendChild(D.createTextNode(s.slice(last, start)));
    var a = el('a', 'cm-code'); a.href = '#' + code; a.dataset.code = code; a.textContent = code; a.title = 'Открыть карточку дефекта ' + code;
    node.appendChild(a);
    last = start + code.length;
  }
  if (last < s.length) node.appendChild(D.createTextNode(s.slice(last)));
}
function rich(node, text) {
  var re = /https?:\/\/[^\s<>"']+/g, last = 0, m;
  while ((m = re.exec(text))) {
    var url = m[0], tr = url.match(/[).,!?:;»"']+$/);
    if (tr) url = url.slice(0, -tr[0].length);
    addCodes(node, text.slice(last, m.index));
    var a = el('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow ugc';
    a.textContent = url.length > 64 ? url.slice(0, 61) + '…' : url;
    node.appendChild(a);
    last = m.index + url.length; re.lastIndex = last;
  }
  addCodes(node, text.slice(last));
}
/* переход к карточке так же, как это делает поиск сайта */
function curDoc() {
  var tr = D.getElementById('doc-trn'); if (tr && !tr.hidden) return 'trn';
  var o = D.getElementById('doc-odt'), t = D.getElementById('doc-2143');
  return o && !o.hidden ? 'odt' : t && !t.hidden ? '2143' : '2499';
}
function landingOpen() { var l = D.getElementById('landing'); return !!l && !l.classList.contains('is-hidden'); }
function showDoc(d, then) {
  if (curDoc() !== d || landingOpen()) {
    var b = D.querySelector('.sitem[data-doc="' + d + '"]') || D.querySelector('.lcard[data-doc="' + d + '"]');
    if (b) b.click();
  }
  var n = 0;
  (function wait() {
    var s = D.getElementById('doc-' + d);
    if ((s && !s.hidden && !landingOpen()) || n++ > 40) setTimeout(then, 60); else setTimeout(wait, 40);
  })();
}
function openCode(code) {
  var go = function () {
    showDoc('2499', function () {
      var a = el('a'); a.setAttribute('data-go', code); a.href = '#' + code; a.style.display = 'none';
      D.body.appendChild(a); a.click(); a.remove();
    });
  };
  if (mqM.matches) close(go); else go();
}

/* ---------- разметка ---------- */
function build() {
  var st = el('style'); st.id = 'chat-css'; st.textContent = CSS; D.head.appendChild(st);
  R.classList.add('has-chat');

  ui.fab = el('button', 'chat-fab', IC.chat + IC.down + '<span class="chat-badge" hidden></span>');
  ui.fab.type = 'button'; ui.fab.title = 'Чат';
  ui.fab.setAttribute('aria-controls', 'chat'); ui.fab.setAttribute('aria-expanded', 'false'); ui.fab.setAttribute('aria-label', 'Открыть чат');
  D.body.appendChild(ui.fab);
  ui.fabBadge = ui.fab.querySelector('.chat-badge');

  var bar = D.getElementById('tabbar');
  if (bar) {
    ui.tab = el('button', 'tb tb-chat', IC.chat.replace('class="ci-chat"', 'class="ico-smooth"') + IC.chatPx + '<span>Чат</span><i class="chat-badge" hidden></i>');
    ui.tab.type = 'button'; ui.tab.dataset.act = 'chat';
    ui.tab.setAttribute('aria-controls', 'chat'); ui.tab.setAttribute('aria-label', 'Чат');
    var top = bar.querySelector('.tb[data-act="top"]');
    bar.insertBefore(ui.tab, top || null);
    bar.classList.add('has-chat');
    ui.tabBadge = ui.tab.querySelector('.chat-badge');
  }

  var p = el('section', 'chat');
  p.id = 'chat'; p.hidden = true; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Чат посетителей');
  p.innerHTML =
    '<header class="chat-head">' +
      '<div class="chat-hl"><b class="chat-title">Чат</b><span class="chat-sub"><i class="chat-dot"></i><span class="chat-st">подключение…</span></span></div>' +
      '<button type="button" class="chat-ib chat-me" aria-label="Имя и настройки" title="Имя и настройки"></button>' +
      '<button type="button" class="chat-ib chat-x" aria-label="Закрыть чат" title="Закрыть">' + IC.x + '</button>' +
    '</header>' +
    '<div class="chat-main">' +
      '<div class="chat-body">' +
        '<div class="chat-list" role="log" aria-live="polite" aria-relevant="additions">' +
          '<button type="button" class="chat-more" hidden>Показать сообщения раньше</button>' +
        '</div>' +
        '<button type="button" class="chat-jump" hidden>' + IC.arrow + '<span>Новые сообщения</span></button>' +
        '<div class="chat-toast" role="status" aria-live="polite"></div>' +
      '</div>' +
      '<div class="chat-foot">' +
        '<p class="chat-note" hidden></p>' +
        '<form class="chat-join" hidden>' +
          '<input class="chat-field chat-name" type="text" maxlength="' + NAME_MAX + '" placeholder="Как вас зовут?" autocomplete="nickname" enterkeyhint="go" aria-label="Ваше имя">' +
          '<button type="submit" class="chat-btn">Войти в чат</button>' +
          '<p>Имя увидят все участники. Регистрация не нужна — читать можно и без имени.</p>' +
        '</form>' +
        '<form class="chat-form" hidden>' +
          '<textarea class="chat-field chat-in" rows="1" maxlength="' + MAX_LEN + '" placeholder="Сообщение" enterkeyhint="send" aria-label="Текст сообщения"></textarea>' +
          '<button type="submit" class="chat-send" aria-label="Отправить" title="Отправить" disabled>' + IC.send + '</button>' +
        '</form>' +
        '<span class="chat-cnt" hidden></span>' +
      '</div>' +
      '<div class="chat-sheet" hidden>' +
        '<div class="cs-sec">' +
          '<span class="cs-h">Ваше имя в чате</span>' +
          '<form class="cs-row cs-nameform"><input class="chat-field cs-name" type="text" maxlength="' + NAME_MAX + '" placeholder="Имя" autocomplete="nickname" aria-label="Новое имя"><button type="submit" class="chat-btn">Сохранить</button></form>' +
          '<p class="cs-p">Новое имя будет у следующих сообщений, отправленные раньше не изменятся.</p>' +
        '</div>' +
        '<div class="cs-sec">' +
          '<span class="cs-h">Как пользоваться</span>' +
          '<p class="cs-p">Коды дефектов в сообщениях — например, <b>21.1-2</b> — становятся ссылками на карточку в распоряжении 2499р. Своё сообщение можно удалить: нажмите на него.</p>' +
        '</div>' +
        '<div class="cs-sec cs-own">' +
          '<button type="button" class="cs-tog" aria-expanded="false">Для владельца сайта: модерация</button>' +
          '<div class="cs-ownb" hidden>' +
            '<p class="cs-p">Ваш ID в чате:</p><code class="cs-id">появится после подключения</code>' +
            '<p class="cs-p">Чтобы удалять чужие сообщения и блокировать нарушителей прямо отсюда, скопируйте правила с вашим ID и вставьте их в Firebase: <b>Realtime Database → Правила</b> → заменить всё → <b>Опубликовать</b>.</p>' +
            '<button type="button" class="chat-btn ghost cs-copy">Скопировать правила с моим ID</button>' +
            '<textarea class="cs-rules" readonly hidden aria-label="Текст правил"></textarea>' +
            '<p class="cs-ok" hidden></p>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="chat-btn ghost cs-done">Готово</button>' +
      '</div>' +
    '</div>';
  D.body.appendChild(p);
  ui.p = p;
  var q = function (s) { return p.querySelector(s); };
  ui.dot = q('.chat-dot'); ui.st = q('.chat-st'); ui.me = q('.chat-me'); ui.x = q('.chat-x');
  ui.list = q('.chat-list'); ui.more = q('.chat-more'); ui.jump = q('.chat-jump'); ui.toast = q('.chat-toast');
  ui.note = q('.chat-note'); ui.join = q('.chat-join'); ui.nameIn = q('.chat-name');
  ui.form = q('.chat-form'); ui.in = q('.chat-in'); ui.send = q('.chat-send'); ui.cnt = q('.chat-cnt');
  ui.sheet = q('.chat-sheet'); ui.csName = q('.cs-name'); ui.csId = q('.cs-id'); ui.csTog = q('.cs-tog'); ui.csOwn = q('.cs-ownb');
  ui.csRules = q('.cs-rules'); ui.csOk = q('.cs-ok');
}

/* ---------- открыть / закрыть ---------- */
function open() {
  if (isOpen) return;
  isOpen = true; lastFocus = D.activeElement;
  ui.p.hidden = false;
  requestAnimationFrame(function () { requestAnimationFrame(function () { ui.p.classList.add('on'); }); });
  ui.fab.classList.add('is-open'); ui.fab.setAttribute('aria-expanded', 'true');
  if (mqM.matches) {
    R.classList.add('chat-lock');
    try { history.pushState({ chat: 1, prev: history.state }, ''); pushed = true; } catch (e) { pushed = false; }
  }
  fit(); syncComposer(); start();
  unread = 0; dot = false; badge(); markSeen();
  setTimeout(function () {
    scrollBottom();
    if (!isTouch) { var f = !ui.form.hidden ? ui.in : !ui.join.hidden ? ui.nameIn : ui.x; try { f.focus({ preventScroll: true }); } catch (e) {} }
  }, 40);
}
function hide() {
  if (!isOpen) return;
  isOpen = false; closeSheet();
  ui.p.classList.remove('on');
  ui.fab.classList.remove('is-open'); ui.fab.setAttribute('aria-expanded', 'false');
  R.classList.remove('chat-lock');
  setTimeout(function () { if (!isOpen) { ui.p.hidden = true; ui.p.style.height = ''; ui.p.style.top = ''; } }, reduce ? 0 : 260);
  badge();
  if (lastFocus && lastFocus.focus && D.contains(lastFocus) && lastFocus !== D.body) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
}
/* закрыть; then — что сделать после того, как браузер вернёт шаг истории */
function close(then) {
  if (!isOpen) { if (then) then(); return; }
  hide();
  if (pushed && history.state && history.state.chat) {
    pushed = false;
    var done = false, fire = function () { if (done) return; done = true; if (then) then(); };
    swallow++; afterPop = fire;
    history.back();
    setTimeout(fire, 600);
    setTimeout(function () { if (swallow > 0) swallow--; }, 2500);
  } else { pushed = false; if (then) then(); }
}
function toggle() { if (isOpen) close(); else open(); }
/* системная «Назад» на телефоне закрывает чат, а не уводит на главную (встраиваемся в цепочку сайта) */
var prevPop = window.__trnPop;
window.__trnPop = function (e) {
  if (swallow > 0) { swallow--; var f = afterPop; afterPop = null; if (f) setTimeout(f, 0); return true; }
  if (isOpen && pushed) { pushed = false; hide(); return true; }
  return typeof prevPop === 'function' ? prevPop(e) : false;
};
/* клавиатура телефона не должна закрывать поле ввода */
function fit() {
  var p = ui.p, vv = window.visualViewport;
  if (!isOpen || !mqM.matches || !vv) { p.style.height = ''; p.style.top = ''; return; }
  var stick = nearBottom();
  p.style.height = Math.round(vv.height) + 'px';
  p.style.top = Math.round(vv.offsetTop) + 'px';
  if (stick) ui.list.scrollTop = ui.list.scrollHeight;
}

/* ---------- настройки ---------- */
function openSheet() {
  ui.csName.value = me.name;
  ui.csId.textContent = me.uid || 'появится после подключения';
  ui.sheet.hidden = false;
  requestAnimationFrame(function () { ui.sheet.classList.add('on'); });
  if (!isTouch) setTimeout(function () { try { ui.csName.focus(); } catch (e) {} }, 30);
}
function closeSheet() { ui.sheet.classList.remove('on'); ui.sheet.hidden = true; }
function updateMe() {
  var b = ui.me;
  if (me.name) { b.classList.add('has-name'); b.textContent = initial(me.name); b.style.setProperty('--uc', 'var(--g' + hue(me.uid || me.name) + ')'); b.title = me.name + ' — имя и настройки'; }
  else { b.classList.remove('has-name'); b.innerHTML = IC.user; b.title = 'Имя и настройки'; }
}
function setName(n) {
  n = cleanName(n); if (!n) return false;
  me.name = n; ls(K.name, n); updateMe(); syncComposer(); return true;
}
function copyRules() {
  if (!me.uid) { toast('Подождите, пока чат подключится'); return; }
  var txt = JSON.stringify(rules(me.uid), null, 2);
  var after = function (ok) {
    ls(K.admin, me.uid); refreshOwn();
    ui.csOk.hidden = false;
    ui.csOk.textContent = (ok ? 'Правила скопированы. ' : 'Скопируйте текст из поля выше. ') +
      'Вставьте их в Firebase → Realtime Database → Правила вместо старых и нажмите «Опубликовать». После этого на этом устройстве у каждого сообщения появятся кнопки «Удалить» и «Заблокировать».';
  };
  var fallback = function () {
    ui.csRules.hidden = false; ui.csRules.value = txt; ui.csRules.focus(); ui.csRules.select();
    var ok = false; try { ok = D.execCommand('copy'); } catch (e) {}
    after(ok);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { after(true); }, fallback);
  else fallback();
}

/* ---------- поле ввода ---------- */
function syncComposer() {
  if (!ui.form) return;
  var canWrite = configured;
  ui.join.hidden = !canWrite || !!me.name;
  ui.form.hidden = !canWrite || !me.name;
  ui.in.disabled = banned;
  ui.in.placeholder = banned ? 'Вы заблокированы модератором' : 'Сообщение';
  syncSend();
}
function autosize() { var t = ui.in; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 132) + 'px'; }
function syncSend() {
  var v = ui.in.value, len = v.length;
  ui.send.disabled = !v.trim() || banned;
  ui.cnt.hidden = len < MAX_LEN - 100 || ui.form.hidden;
  ui.cnt.textContent = len + ' / ' + MAX_LEN;
  ui.cnt.classList.toggle('warn', len >= MAX_LEN);
}
function note(msg) { ui.note.hidden = !msg; ui.note.textContent = msg || ''; }

/* ---------- состояние подключения ---------- */
function setSt(kind, text) { ui.dot.className = 'chat-dot ' + kind; ui.st.textContent = text; }
function refreshStatus() {
  if (!ui.st) return;
  if (!configured) return setSt('err', 'не подключён');
  if (navigator.onLine === false) return setSt('err', 'нет интернета');
  if (!fb || !connected) return setSt('wait', 'подключение…');
  setSt('ok', onlineN >= 2 ? 'в сети: ' + onlineN : 'в сети');
}
function stateCard(html) {
  clearStates();
  var s = el('div', 'chat-state', html); s.dataset.state = '1';
  ui.list.appendChild(s);
  return s;
}
function clearStates() { ui.list.querySelectorAll('[data-state]').forEach(function (x) { x.remove(); }); }
function showSetup() {
  var miss = hasKey && !dbURL;
  stateCard(IC.chat.replace('class="ci-chat"', '') +
    '<b>' + (miss ? 'В настройках нет адреса базы' : 'Чат пока не подключён') + '</b>' +
    (miss
      ? '<p>В блоке firebaseConfig в файле <code>chat.js</code> не хватает строки <code>databaseURL</code>. Скопируйте адрес со страницы Realtime Database (он начинается с https://) и вставьте его.</p>'
      : '<p>Владельцу сайта: вставьте настройки Firebase в начало файла <code>chat.js</code> — после этого здесь появятся сообщения.</p>'));
}
function showLoading() { if (!order.length) { clearStates(); var s = el('div', 'chat-load', '<i></i><i></i><i></i>'); s.dataset.state = '1'; ui.list.appendChild(s); } }
function showEmpty() {
  if (order.length) { clearStates(); return; }
  var s = stateCard(IC.chat.replace('class="ci-chat"', '') + '<b>Здесь пока тихо</b><p class="chat-empty-p"></p>');
  rich(s.querySelector('.chat-empty-p'), 'Напишите первым: задайте вопрос коллегам или поделитесь находкой. Коды вроде 21.1-2 сами станут ссылками.');
}
function showFail(text, retry) {
  if (order.length) { toast(text, 5000); return; }
  var s = stateCard(IC.chat.replace('class="ci-chat"', '') + '<b>Не получилось подключиться</b><p></p>');
  s.querySelector('p').textContent = text;
  if (retry) {
    var b = el('button', 'chat-btn ghost', 'Повторить'); b.type = 'button';
    b.addEventListener('click', function () { started = false; start(); });
    s.appendChild(b);
  }
}

/* ---------- подключение к Firebase (загружается только когда чат открыли) ---------- */
function start() {
  if (started) return;
  started = true;
  refreshStatus();
  if (!configured) { showSetup(); return; }
  showLoading();
  Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-database.js')])
    .then(function (mods) {
      var A = mods[0], U = mods[1], B = mods[2];
      var app = A.getApps().find(function (a) { return a.name === 'chat'; }) || A.initializeApp(cfg, 'chat');
      var auth = U.initializeAuth(app, { persistence: [U.indexedDBLocalPersistence, U.browserLocalPersistence, U.inMemoryPersistence] });
      var db = B.getDatabase(app, dbURL);
      fb = { app: app, auth: auth, db: db, B: B, U: U };
      listen();
      U.onAuthStateChanged(auth, function (user) {
        if (!user) return;
        var changed = me.uid !== user.uid;
        me.uid = user.uid; ls(K.uid, user.uid); authed = true;
        if (changed) refreshOwn();
        updateMe(); note(''); watchMe();
        if (connected) presence();
      });
      U.signInAnonymously(auth).catch(authFail);
    })
    .catch(function () {
      started = false; setSt('err', 'нет связи');
      showFail('Не удалось загрузить чат. Проверьте интернет и попробуйте ещё раз (если не поможет — обновите страницу).', true);
    });
}
function authFail(e) {
  var c = String((e && e.code) || '');
  var msg = /operation-not-allowed|admin-restricted/.test(c)
    ? 'Писать пока нельзя: в Firebase не включён анонимный вход (Authentication → Способ входа → Анонимный → Включить).'
    : /api-key|invalid-api-key/.test(c)
      ? 'Писать пока нельзя: в chat.js неверный apiKey.'
      : /network/.test(c)
        ? 'Нет связи с сервером. Читать можно, отправка заработает, когда появится интернет.'
        : 'Не удалось войти в чат (' + (c || 'ошибка') + '). Читать сообщения можно.';
  note(msg);
}
function readFail(e) {
  if (isPerm(e)) showFail('База не отдаёт сообщения: в Firebase не опубликованы правила из файла firebase-rules.json (Realtime Database → Правила).', false);
  else showFail('Ошибка чтения: ' + ((e && e.message) || e), true);
  setSt('err', 'ошибка');
}
function listen() {
  var B = fb.B, db = fb.db, mref = B.ref(db, 'messages');
  var q = B.query(mref, B.orderByKey(), B.limitToLast(LIMIT));
  B.onChildAdded(q, function (s) { addMsg(s.key, s.val(), !initialDone); }, readFail);
  B.onChildRemoved(q, function (s) {
    var k = s.key; if (!M.has(k)) return;
    /* при сдвиге «последних 100» старое сообщение выпадает из окна — его не трогаем, удаляем только настоящие удаления */
    B.get(B.child(mref, k)).then(function (x) { if (!x.exists()) removeMsg(k); }).catch(function () {});
  });
  B.onValue(q, function (s) {
    initialDone = true; more = s.size >= LIMIT; ui.more.hidden = !more;
    clearStates(); showEmpty(); scrollBottom(); markSeen();
  }, function () {}, { onlyOnce: true });
  B.onValue(B.ref(db, '.info/connected'), function (s) {
    connected = s.val() === true; refreshStatus();
    if (connected && authed) presence();
  });
  B.onValue(B.ref(db, 'online'), function (s) { onlineN = s.size || 0; refreshStatus(); }, function () {});
}
function presence() {
  var B = fb.B, r = B.ref(fb.db, 'online/' + me.uid);
  B.onDisconnect(r).remove().then(function () { return B.set(r, true); }).catch(function () {});
}
var watchedBan = '';
function watchMe() {
  if (watchedBan === me.uid) return; watchedBan = me.uid;
  var B = fb.B;
  B.onValue(B.ref(fb.db, 'banned/' + me.uid), function (s) {
    banned = s.val() === true; syncComposer();
    if (banned) note('Модератор ограничил вам отправку сообщений.'); else if (/Модератор/.test(ui.note.textContent)) note('');
  }, function () {});
}

/* ---------- сообщения ---------- */
function findPos(k) { var lo = 0, hi = order.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (order[mid] < k) lo = mid + 1; else hi = mid; } return lo; }
function makeEl(m) {
  var w = el('div', 'cmw');
  w.dataset.k = m.k;
  w.style.setProperty('--uc', 'var(--g' + hue(m.uid) + ')');
  w.innerHTML = '<div class="cm-day" hidden><span></span></div><div class="cm"><span class="cm-av" aria-hidden="true"></span><div class="cm-col"><div class="cm-b"><b class="cm-n"></b><span class="cm-t"></span><span class="cm-time"></span></div><div class="cm-acts"></div></div></div>';
  w.querySelector('.cm-av').textContent = initial(m.name);
  w.querySelector('.cm-n').textContent = m.name;
  rich(w.querySelector('.cm-t'), m.text);
  m.el = w; m.day = w.querySelector('.cm-day');
  setTime(m); markOwn(m);
  return w;
}
function setTime(m) {
  var t = m.el.querySelector('.cm-time');
  if (pending.has(m.k)) { m.el.classList.add('is-pending'); t.innerHTML = IC.clock; t.title = 'Отправляется…'; }
  else { m.el.classList.remove('is-pending'); t.textContent = hm(m.ts); t.title = new Date(m.ts).toLocaleString('ru-RU'); }
}
function markOwn(m) {
  var own = !!me.uid && m.uid === me.uid;
  m.el.classList.toggle('own', own);
  m.el.classList.toggle('can-act', own || isAdmin());
}
function refreshOwn() { M.forEach(markOwn); }
function decorate(i) {
  if (i < 0 || i >= order.length) return;
  var m = M.get(order[i]), p = i > 0 ? M.get(order[i - 1]) : null;
  var same = !!p && dayKey(p.ts) === dayKey(m.ts);
  m.day.hidden = same;
  if (!same) m.day.firstChild.textContent = dayLabel(m.ts);
  m.el.classList.toggle('cont', !!(same && p.uid === m.uid && m.ts - p.ts < GROUP_MS));
}
function addMsg(k, v, quiet) {
  if (!k || !v || typeof v.text !== 'string' || M.has(k)) return;
  var m = { k: k, uid: String(v.uid || ''), name: cleanName(v.name) || 'Гость', text: String(v.text).slice(0, MAX_LEN), ts: typeof v.ts === 'number' ? v.ts : Date.now() };
  var own = !!me.uid && m.uid === me.uid, stick = nearBottom() || own;
  if (!order.length) clearStates();
  var i = findPos(k);
  order.splice(i, 0, k); M.set(k, m);
  var w = makeEl(m), next = i + 1 < order.length ? M.get(order[i + 1]).el : null;
  ui.list.insertBefore(w, next);
  decorate(i); decorate(i + 1);
  if (quiet) return;
  if (!reduce) { w.classList.add('is-new'); setTimeout(function () { w.classList.remove('is-new'); }, 400); }
  if (isOpen) {
    if (stick) scrollBottom(true); else ui.jump.hidden = false;
    markSeen();
  } else if (!own) { unread++; badge(); }
}
function removeMsg(k) {
  var m = M.get(k); if (!m) return;
  var i = order.indexOf(k);
  if (i >= 0) order.splice(i, 1);
  M.delete(k); m.el.remove();
  decorate(i);
  if (initialDone && !order.length) showEmpty();
}
function loadMore() {
  if (!fb || !order.length || loadingMore) return;
  loadingMore = true; ui.more.disabled = true; ui.more.textContent = 'Загружаем…';
  var B = fb.B;
  B.get(B.query(B.ref(fb.db, 'messages'), B.orderByKey(), B.endBefore(order[0]), B.limitToLast(PAGE))).then(function (s) {
    var l = ui.list, h0 = l.scrollHeight, t0 = l.scrollTop, n = 0;
    s.forEach(function (c) { addMsg(c.key, c.val(), true); n++; });
    l.scrollTop = t0 + (l.scrollHeight - h0);
    more = n >= PAGE;
  }).catch(function () { toast('Не удалось загрузить старые сообщения'); }).then(function () {
    loadingMore = false; ui.more.disabled = false; ui.more.textContent = 'Показать сообщения раньше'; ui.more.hidden = !more;
  });
}
function send(e) {
  if (e) e.preventDefault();
  var text = tidy(ui.in.value);
  if (!text) return;
  if (!me.name) { syncComposer(); return; }
  if (!fb || !authed) { toast('Подключаемся… попробуйте через пару секунд'); return; }
  if (banned) { toast('Модератор ограничил вам отправку сообщений'); return; }
  var wait = lastSent + RATE_MS + 250 - Date.now();
  if (wait > 0) { toast('Не так часто — подождите ' + Math.ceil(wait / 1000) + ' с'); return; }
  var prevSent = lastSent; lastSent = Date.now();
  var B = fb.B, key = B.push(B.ref(fb.db, 'messages')).key, upd = {};
  upd['messages/' + key] = { uid: me.uid, name: me.name, text: text, ts: B.serverTimestamp() };
  upd['last/' + me.uid] = B.serverTimestamp();
  pending.add(key);
  ui.in.value = ''; autosize(); syncSend();
  B.update(B.ref(fb.db), upd).then(function () {
    pending.delete(key); var m = M.get(key); if (m) setTime(m);
  }, function (err) {
    pending.delete(key); lastSent = prevSent;
    if (!ui.in.value) { ui.in.value = text; autosize(); syncSend(); }
    toast(banned ? 'Модератор ограничил вам отправку сообщений'
      : isPerm(err) ? 'Сервер не принял сообщение. Подождите пару секунд и отправьте ещё раз.'
      : 'Не отправлено: ' + ((err && err.message) || 'ошибка'), 4500);
  });
  scrollBottom(true);
}

/* ---------- действия с сообщением ---------- */
function toggleSel(w) {
  var m = M.get(w.dataset.k); if (!m || !fb) return;
  var own = m.uid === me.uid, adm = isAdmin();
  if (!own && !adm) return;
  var was = w.classList.contains('is-sel');
  ui.list.querySelectorAll('.cmw.is-sel').forEach(function (x) { x.classList.remove('is-sel'); });
  if (was) return;
  var acts = w.querySelector('.cm-acts'); acts.innerHTML = '';
  acts.appendChild(actBtn('del', 'Удалить'));
  if (adm && !own) acts.appendChild(actBtn('ban', 'Заблокировать автора'));
  w.classList.add('is-sel');
  if (w === ui.list.lastElementChild && nearBottom()) setTimeout(function () { scrollBottom(true); }, 30);
}
function actBtn(a, t) { var b = el('button', 'cm-act'); b.type = 'button'; b.dataset.cact = a; b.textContent = t; return b; }
function doAct(b) {
  if (!b.classList.contains('armed')) {
    b.classList.add('armed'); b.dataset.t = b.textContent;
    b.textContent = b.dataset.cact === 'del' ? 'Точно удалить?' : 'Точно заблокировать?';
    setTimeout(function () { if (b.isConnected && b.classList.contains('armed')) { b.classList.remove('armed'); b.textContent = b.dataset.t; } }, 3500);
    return;
  }
  var w = b.closest('.cmw'), m = w && M.get(w.dataset.k), B = fb.B; if (!m) return;
  if (b.dataset.cact === 'del') {
    B.remove(B.ref(fb.db, 'messages/' + m.k)).catch(function (e) {
      toast(isPerm(e) ? 'Нет прав на удаление. Опубликованы ли в Firebase правила с вашим ID?' : 'Не удалось удалить', 5000);
    });
  } else {
    B.set(B.ref(fb.db, 'banned/' + m.uid), true).then(function () {
      w.classList.remove('is-sel'); toast('Автор заблокирован. Его сообщения можно удалить по одному.', 4500);
    }, function (e) { toast(isPerm(e) ? 'Нет прав. Опубликуйте в Firebase правила с вашим ID.' : 'Не удалось заблокировать', 5000); });
  }
}

/* ---------- непрочитанные ---------- */
function markSeen() {
  if (!isOpen || !order.length) return;
  var k = order[order.length - 1], s = ls(K.seen);
  if (!s || k > s) ls(K.seen, k);
}
function badge() {
  var txt = unread > 0 ? (unread > 99 ? '99+' : String(unread)) : '';
  var show = !isOpen && (unread > 0 || dot);
  [ui.fabBadge, ui.tabBadge].forEach(function (b) {
    if (!b) return;
    b.hidden = !show; b.textContent = show ? txt : ''; b.classList.toggle('dot', show && !txt);
  });
  var extra = show ? (unread ? ', новых сообщений: ' + unread : ', есть новые сообщения') : '';
  ui.fab.setAttribute('aria-label', (isOpen ? 'Свернуть чат' : 'Открыть чат') + extra);
  if (ui.tab) ui.tab.setAttribute('aria-label', 'Чат' + extra);
}
/* лёгкая проверка при загрузке страницы: есть ли новое с прошлого визита (без подключения к чату) */
function peek() {
  if (!configured || started || navigator.onLine === false || !window.fetch) return;
  fetch(dbURL + '/messages.json?orderBy=%22%24key%22&limitToLast=1').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || started) return;
    var k = Object.keys(j)[0]; if (!k) return;
    var s = ls(K.seen), u = ls(K.uid);
    if ((!s || k > s) && j[k] && j[k].uid !== u) { dot = true; badge(); }
  }).catch(function () {});
}

/* ---------- события ---------- */
function wire() {
  ui.fab.addEventListener('click', toggle);
  if (ui.tab) ui.tab.addEventListener('click', function () { open(); });
  ui.x.addEventListener('click', function () { close(); });
  ui.me.addEventListener('click', function () { if (ui.sheet.hidden) openSheet(); else closeSheet(); });
  p_on(ui.sheet.querySelector('.cs-done'), 'click', closeSheet);
  p_on(ui.sheet.querySelector('.cs-nameform'), 'submit', function (e) {
    e.preventDefault();
    if (setName(ui.csName.value)) { closeSheet(); toast('Имя сохранено'); } else toast('Введите имя');
  });
  p_on(ui.csTog, 'click', function () { var o = ui.csOwn.hidden; ui.csOwn.hidden = !o; ui.csTog.setAttribute('aria-expanded', String(o)); });
  p_on(ui.sheet.querySelector('.cs-copy'), 'click', copyRules);
  ui.join.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!setName(ui.nameIn.value)) { ui.nameIn.focus(); toast('Введите имя — его увидят другие участники'); return; }
    setTimeout(function () { try { ui.in.focus(); } catch (x) {} }, 30);
  });
  ui.form.addEventListener('submit', send);
  ui.in.addEventListener('input', function () { autosize(); syncSend(); });
  ui.in.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch) { e.preventDefault(); send(); }
  });
  ui.more.addEventListener('click', loadMore);
  ui.jump.addEventListener('click', function () { scrollBottom(true); });
  ui.list.addEventListener('scroll', function () { if (!ui.jump.hidden && nearBottom()) ui.jump.hidden = true; }, { passive: true });
  ui.list.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (a) { if (a.dataset.code) { e.preventDefault(); openCode(a.dataset.code); } return; }
    var b = e.target.closest('.cm-act'); if (b) { doAct(b); return; }
    var bub = e.target.closest('.cm-b');
    if (bub) { var sel = window.getSelection && String(window.getSelection()); if (!sel) toggleSel(bub.closest('.cmw')); }
  });
  D.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !isOpen) return;
    if (!ui.sheet.hidden) { closeSheet(); return; }
    if (mqM.matches || ui.p.contains(D.activeElement)) { e.stopPropagation(); close(); }
  });
  if (window.visualViewport) { visualViewport.addEventListener('resize', fit); visualViewport.addEventListener('scroll', fit); }
  if (mqM.addEventListener) mqM.addEventListener('change', function () {
    if (!isOpen) return;
    if (!mqM.matches) R.classList.remove('chat-lock'); else R.classList.add('chat-lock');
    fit();
  });
  window.addEventListener('online', refreshStatus);
  window.addEventListener('offline', refreshStatus);
  /* когда вкладка долго скрыта — отключаемся (бережём батарею и бесплатный лимит подключений) */
  D.addEventListener('visibilitychange', function () {
    if (!fb) return;
    if (D.hidden) { clearTimeout(offT); offT = setTimeout(function () { fb.B.goOffline(fb.db); }, 60000); }
    else { clearTimeout(offT); fb.B.goOnline(fb.db); }
  });
}
function p_on(n, ev, fn) { if (n) n.addEventListener(ev, fn); }

function init() {
  if (!D.body) return;
  build(); wire(); updateMe(); syncComposer(); refreshStatus(); badge();
  setTimeout(peek, 2500);
}
if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
})();
