import { supabase, signIn, signUp, signOut, getSession, getProfile, BADGE_CATALOG } from './supabase.js';

// Badge functions defined here to use the same supabase instance
async function grantBadge(userId, badgeId) {
  // Check first to avoid RLS upsert issue (upsert needs SELECT + INSERT policy)
  const { data: existing } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)
    .eq('badge_id', badgeId)
    .maybeSingle();
  if (existing) return; // already have it, skip
  const { error } = await supabase
    .from('user_badges')
    .insert({ user_id: userId, badge_id: badgeId });
  if (error && error.code !== '23505') // 23505 = unique violation (already exists)
    console.warn('grantBadge error:', error.message);
}
async function ensureLoginBadges(userId) {
  await grantBadge(userId, 'member');
  await grantBadge(userId, 'early_tester');
}

// ============================================================
//  🔔 NOTIFICATIONS + SOUND
// ============================================================
let notifEnabled = false;
let unreadCount = 0;
const originalTitle = document.title;

async function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { notifEnabled = true; return; }
  if (Notification.permission !== 'denied') {
    const p = await Notification.requestPermission();
    notifEnabled = p === 'granted';
  }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 820; osc.type = 'sine';
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  } catch(e) {}
}

function triggerNotification(username, text) {
  if (document.hidden) {
    unreadCount++;
    document.title = `(${unreadCount}) ${originalTitle}`;
  }
  playBeep();
  if (notifEnabled && document.hidden) {
    try {
      new Notification(`${username} — VonnieStudio`, {
        body: text ? text.substring(0, 80) : '📷 Sent an image',
        icon: '/FSP_Logo.png',
        tag: 'vs-community',
      });
    } catch(e) {}
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { unreadCount = 0; document.title = originalTitle; }
});

// ============================================================
//  🔍 SEARCH
// ============================================================
window.openSearch = function() {
  document.getElementById('searchOverlay').classList.add('open');
  setTimeout(() => document.getElementById('searchInput').focus(), 60);
};
window.closeSearch = function() {
  document.getElementById('searchOverlay').classList.remove('open');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchCount').textContent = '';
  // Restore all bubbles that were highlighted
  document.querySelectorAll('.msg-group').forEach(el => {
    el.classList.remove('search-dim', 'search-match');
    const bubble = el.querySelector('.msg-bubble');
    if (bubble && bubble.dataset.origHtml) {
      bubble.innerHTML = bubble.dataset.origHtml;
      delete bubble.dataset.origHtml;
    }
  });
};

// Safely highlight text nodes inside an element using TreeWalker
function highlightTextNodes(el, query) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');

  // Collect all text nodes first (can't modify DOM while walking)
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  textNodes.forEach(tn => {
    if (!tn.nodeValue || !regex.test(tn.nodeValue)) return;
    regex.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = regex.exec(tn.nodeValue)) !== null) {
      // text before match
      if (m.index > last) frag.appendChild(document.createTextNode(tn.nodeValue.slice(last, m.index)));
      // the match wrapped in <mark>
      const mark = document.createElement('mark');
      mark.style.cssText = 'background:rgba(0,212,255,.4);color:var(--text-main);border-radius:2px;padding:0 1px;';
      mark.textContent = m[0];
      frag.appendChild(mark);
      last = m.index + m[0].length;
    }
    if (last < tn.nodeValue.length) frag.appendChild(document.createTextNode(tn.nodeValue.slice(last)));
    tn.parentNode.replaceChild(frag, tn);
  });
}

window.performSearch = function(query) {
  query = query.trim();
  const groups = document.querySelectorAll('.msg-group');

  // Always restore previous highlights first
  groups.forEach(el => {
    el.classList.remove('search-dim', 'search-match');
    const bubble = el.querySelector('.msg-bubble');
    if (bubble && bubble.dataset.origHtml) {
      bubble.innerHTML = bubble.dataset.origHtml;
      delete bubble.dataset.origHtml;
    }
  });

  if (!query) {
    document.getElementById('searchCount').textContent = '';
    return;
  }

  const q = query.toLowerCase();
  let matches = 0;

  groups.forEach(el => {
    const bubble = el.querySelector('.msg-bubble');
    const bubbleText = (bubble?.textContent || '').toLowerCase();
    const user = (el.querySelector('.msg-username')?.textContent || '').toLowerCase();

    if (bubbleText.includes(q) || user.includes(q)) {
      el.classList.add('search-match');
      matches++;
      // Highlight matching words in bubble using safe text-node approach
      if (bubble && bubbleText.includes(q)) {
        bubble.dataset.origHtml = bubble.innerHTML;
        highlightTextNodes(bubble, query);
      }
    } else {
      el.classList.add('search-dim');
    }
  });

  document.getElementById('searchCount').textContent = matches
    ? `${matches} result${matches > 1 ? 's' : ''}` : 'No results';
};

// ============================================================
//  📌 PIN MESSAGE  (localStorage — ทำงานได้ทันทีไม่ต้องสร้าง table)
// ============================================================
window.pinMessage = function(msgId) {
  const group = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (!group || !currentRoomId) return;
  const username = group.querySelector('.msg-username')?.textContent || 'unknown';
  const text = group.querySelector('.msg-bubble')?.textContent || '📷 Image';
  const pinData = { msgId, username, text: text.substring(0, 120) };
  try { localStorage.setItem('pin_' + currentRoomId, JSON.stringify(pinData)); } catch(e) {}
  showPinBar(pinData);
};
window.unpinMessage = function() {
  try { localStorage.removeItem('pin_' + currentRoomId); } catch(e) {}
  document.getElementById('pinBar').classList.remove('show');
};
window.scrollToPinned = function() {
  const bar = document.getElementById('pinBar');
  if (!bar._msgId) return;
  const el = document.querySelector(`[data-msg-id="${bar._msgId}"]`);
  if (el) {
    el.scrollIntoView({ block: 'center' });
    el.style.outline = '1px solid #9b6dff';
    setTimeout(() => { el.style.outline = ''; }, 1600);
  }
};
function showPinBar(pinData) {
  const bar = document.getElementById('pinBar');
  document.getElementById('pinBarText').innerHTML =
    `<span class="pin-bar-user">${escHtml(pinData.username)}</span>: ${escHtml(pinData.text)}`;
  bar._msgId = pinData.msgId;
  bar.classList.add('show');
}
function loadPinnedMessage(roomId) {
  try {
    const raw = localStorage.getItem('pin_' + roomId);
    if (raw) { showPinBar(JSON.parse(raw)); }
    else { document.getElementById('pinBar').classList.remove('show'); }
  } catch(e) {
    document.getElementById('pinBar').classList.remove('show');
  }
}

// ============================================================
//  🎖️ ACHIEVEMENT BADGES
// ============================================================
async function checkMessageBadges(userId, hasImage) {
  try {
    const { count: msgCount } = await supabase
      .from('messages').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    const { count: imgCount } = await supabase
      .from('messages').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).not('image_url', 'is', null);

    const milestones = [
      { badge: 'first_message', cond: msgCount >= 1 },
      { badge: 'chatter',       cond: msgCount >= 10 },
      { badge: 'veteran',       cond: msgCount >= 50 },
      { badge: 'image_sender',  cond: imgCount >= 1 },
    ];
    for (const { badge, cond } of milestones) {
      if (!cond) continue;
      const { data: ex } = await supabase.from('user_badges')
        .select('badge_id').eq('user_id', userId).eq('badge_id', badge).maybeSingle();
      if (!ex) {
        await supabase.from('user_badges').insert({ user_id: userId, badge_id: badge });
        showAchievementToast(badge);
        break; // show one at a time
      }
    }
  } catch(e) {}
}

function showAchievementToast(badgeId) {
  const cat = BADGE_CATALOG[badgeId]; if (!cat) return;
  const toast = document.getElementById('achievementToast');
  document.getElementById('achievIcon').textContent = cat.icon;
  document.getElementById('achievName').style.color = cat.color;
  document.getElementById('achievName').textContent = cat.label;
  document.getElementById('achievDesc').textContent = cat.desc;
  toast.classList.remove('hide');
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.classList.remove('show', 'hide'), 350);
  }, 4500);
}

// ============================================================
//  💬 THREAD VIEW
// ============================================================
window.openThread = async function(msgId) {
  const group = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (!group) return;
  // Render parent message summary in thread header
  const parentBubble = group.querySelector('.msg-bubble');
  const parentUser = group.querySelector('.msg-username');
  const parentAvatar = group.querySelector('.msg-avatar');
  document.getElementById('threadParent').innerHTML =
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      ${parentAvatar ? parentAvatar.outerHTML : ''}
      <span class="msg-username">${parentUser?.textContent || ''}</span>
    </div>
    ${parentBubble ? `<div class="msg-bubble" style="margin-left:0;">${parentBubble.innerHTML}</div>` : ''}`;
  document.getElementById('threadOverlay').classList.add('open');
  await loadThreadReplies(msgId);
};
window.closeThread = function() {
  document.getElementById('threadOverlay').classList.remove('open');
};
async function loadThreadReplies(parentId) {
  const container = document.getElementById('threadMessages');
  container.innerHTML = `<div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);text-align:center;padding:16px;">Loading...</div>`;
  const { data } = await supabase.from('messages').select('*')
    .eq('reply_to', parentId).order('created_at', { ascending: true });
  document.getElementById('threadCount').textContent = `${data?.length || 0} REPL${(data?.length || 0) === 1 ? 'Y' : 'IES'}`;
  container.innerHTML = '';
  if (!data?.length) {
    container.innerHTML = `<div style="font-family:var(--mono);font-size:10px;color:var(--text-dim);text-align:center;padding:24px;">No replies yet</div>`;
    return;
  }
  const uids = [...new Set(data.map(m => m.user_id))];
  const { data: profs } = await supabase.from('profiles').select('id,username,avatar_color,avatar_url,role').in('id', uids);
  const pm = {}; (profs||[]).forEach(p => { pm[p.id] = p; });
  data.forEach(msg => {
    const p = pm[msg.user_id] || {};
    const uname = p.username || 'unknown';
    const color = p.avatar_color || '#00d4ff';
    const _d = new Date(msg.created_at);
    const time = `${String(_d.getHours()).padStart(2,'0')}:${String(_d.getMinutes()).padStart(2,'0')}`;
    const avInner = p.avatar_url
      ? `<img src="${p.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`
      : uname[0].toUpperCase();
    const avStyle = p.avatar_url ? 'background:transparent;' : `background:${color};`;
    const div = document.createElement('div');
    div.className = 'thread-msg';
    div.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <div class="msg-avatar" style="${avStyle}cursor:pointer;" onclick="viewProfile('${msg.user_id}')">${avInner}</div>
      <span class="msg-username" style="cursor:pointer;" onclick="viewProfile('${msg.user_id}')">${escHtml(uname)}</span>
      <span class="msg-time">${time}</span>
    </div>
    ${msg.content ? `<div class="msg-bubble" style="margin-left:36px;">${formatText(msg.content)}</div>` : ''}
    ${msg.image_url ? `<img class="msg-img" src="${msg.image_url}" alt="" onclick="openLightbox('${msg.image_url}')">` : ''}`;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}



// ============================================================
//  EMOJI DATA
// ============================================================
const EMOJI_CATS = {
  '😊': ['😀','😁','😂','🤣','😊','😍','🥰','😘','😎','🤩','😏','😒','😔','😢','😭','😡','🤬','🥹','😅','🤗','🤔','😶','🫠','🥲','😴','🤤','🤒','🥳','🥺','😤'],
  '👍': ['👍','👎','👏','🙏','🤝','✊','👊','🤜','🤛','✌️','🤞','🖖','🫡','💪','🦾','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','💯','✅','❌','⚡'],
  '🎮': ['🎮','🕹️','🎲','🎯','🎳','🎰','🃏','🀄','🎭','🎨','🖼️','🎬','🎤','🎧','🎵','🎶','🎸','🥁','🎹','🎺','🎻','🪕','🎷','🔥','💥','⭐','🌟','✨','💫','🚀'],
  '🐱': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝'],
  '🍕': ['🍕','🍔','🌮','🍜','🍣','🍩','🍦','🎂','🍫','☕','🧋','🍺','🥤','🍷','🫖','🥐','🍱','🍛','🥗','🌯','🥪','🍞','🧀','🥚','🍳','🥞','🧇','🥓','🌽','🥕'],
};

let currentEmojiCat = '😊';
let emojiPickerOpen = false;

function buildEmojiPicker() {
  const tabs = document.getElementById('emojiCatTabs');
  const grid = document.getElementById('emojiGrid');
  tabs.innerHTML = '';
  Object.keys(EMOJI_CATS).forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'emoji-cat-btn' + (cat === currentEmojiCat ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = e => { e.stopPropagation(); currentEmojiCat = cat; buildEmojiPicker(); };
    tabs.appendChild(btn);
  });
  grid.innerHTML = '';
  (EMOJI_CATS[currentEmojiCat] || []).forEach(em => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = em;
    btn.onclick = e => { e.stopPropagation(); insertEmoji(em); };
    grid.appendChild(btn);
  });
}

window.toggleEmojiPicker = function(e) {
  e.stopPropagation();
  const picker = document.getElementById('emojiPicker');
  emojiPickerOpen = !emojiPickerOpen;
  if (emojiPickerOpen) { buildEmojiPicker(); picker.classList.add('open'); }
  else picker.classList.remove('open');
};

function insertEmoji(em) {
  const input = document.getElementById('commInput');
  const start = input.selectionStart, end = input.selectionEnd;
  input.value = input.value.substring(0,start) + em + input.value.substring(end);
  input.setSelectionRange(start+em.length, start+em.length);
  input.focus();
  onInputChange(input);
}

document.addEventListener('click', () => {
  if (emojiPickerOpen) {
    document.getElementById('emojiPicker').classList.remove('open');
    emojiPickerOpen = false;
  }
});

// ============================================================
//  STATE
// ============================================================
let currentUser     = null;
let currentProfile  = null;
let currentRoomId   = null;
let realtimeSub     = null;
let presenceSub     = null;
let selectedFile    = null;
let selectedAvatarFile = null;
let serverStart     = Date.now();
let replyTo         = null;
let viewingUserId   = null;
let reactPickerMsgId = null;
let realtimeRetryTimer = null;
let vonnieHistory   = [];
let vonnieSummary   = null; // long-term memory summary ของ user คนนี้
let vonnieGlobalBrain = null; // 🌐 community-wide brain
const localRenderedIds = new Set(); // track messages rendered locally to skip realtime duplicate
let vonnieTyping    = false;

// ============================================================
//  🧠 VONNIE MEMORY — จำความทรงจำแต่ละ user ข้ามวัน
// ============================================================
async function loadVonnieMemory() {
  try {
    const { data } = await supabase
      .from('vonnie_memory')
      .select('messages, summary')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    vonnieHistory = data?.messages || [];
    vonnieSummary = data?.summary  || null;
  } catch(e) {
    vonnieHistory = [];
    vonnieSummary = null;
  }
}

async function saveVonnieMemory() {
  try {
    // ดึงแค่ history จริงๆ (ไม่รวม [memory] inject ใดๆ)
    const realHistory = vonnieHistory.filter(m => !m.content?.startsWith('[memory]'));

    // ให้ Vonnie สรุปความทรงจำเกี่ยวกับ user คนนี้ (ทำเมื่อคุยไปแล้ว 2 ข้อความขึ้นไป)
    let summary = vonnieSummary; // ถ้าสรุปไม่ได้ให้เก็บอันเดิมไว้ก่อน
    if (realHistory.length >= 2) {
      try {
        const summaryRes = await fetch(VONNIE_WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            max_tokens: 300,
            username:   currentProfile?.username || null,
            messages: [
              ...realHistory.slice(-10),
              {
                role: 'user',
                content: `Based on our conversation, summarize what you know about this person.
Reply with ONLY a raw JSON object (no markdown, no explanation):
{
  "vibe": "how you feel talking to them, 1-2 sentences, very casual",
  "facts": ["fact1", "fact2"],
  "relationship": "how close/familiar you feel with them, 1 sentence",
  "mood": "their usual mood or energy in this chat"
}`,
              },
            ],
          }),
        });

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          const raw = summaryData.content?.[0]?.text || '';
          const clean = raw.replace(/```json|```/g, '').trim();
          try {
            const parsed = JSON.parse(clean);
            summary = parsed;
            vonnieSummary = parsed; // อัพเดต in-memory ด้วย
          } catch(e) {}
        }
      } catch(e) {}
    }

    await supabase.from('vonnie_memory').upsert({
      user_id:    currentUser.id,
      messages:   realHistory.slice(-20),
      summary:    summary,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  } catch(e) {}
}


// ── Brain viewer (owner only) ──────────────────────────────
window.openBrainModal = async function() {
  const myRole = currentProfile?.role || 'member';
  if (myRole !== 'owner') return;
  document.getElementById('brainModal').classList.add('open');
  await loadGlobalBrain();
  renderBrainPanel();
};
window.closeBrainModal = function() {
  document.getElementById('brainModal').classList.remove('open');
};
function renderBrainPanel() {
  const body = document.getElementById('brainPanelBody');
  const b = vonnieGlobalBrain;
  if (!b) {
    body.innerHTML = '<div style="font-family:var(--mono);font-size:10px;color:var(--text-dim);text-align:center;padding:20px;">No memory yet — Vonnie jr. will learn as people chat!</div>';
    return;
  }
  const moodPct = Math.round((b.personality?.mood || 0.5) * 100);
  const energyPct = Math.round((b.personality?.energy || 0.5) * 100);
  const moodEmoji = moodPct > 65 ? '😄' : moodPct < 35 ? '😔' : '😐';
  const energyEmoji = energyPct > 65 ? '⚡' : energyPct < 35 ? '💤' : '✨';
  body.innerHTML = `
    <div class="brain-stat">
      <div class="brain-stat-label">COMMUNITY VIBE</div>
      <div class="brain-stat-val">${escHtml(b.vibe || 'No data yet')}</div>
    </div>
    <div class="brain-stat">
      <div class="brain-stat-label">PERSONALITY ${moodEmoji} ${energyEmoji}</div>
      <div style="display:flex;gap:14px;padding-top:4px;">
        <div style="flex:1;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);">Mood ${moodPct}%</div>
          <div class="brain-mood-bar"><div class="brain-mood-fill" style="width:${moodPct}%"></div></div>
        </div>
        <div style="flex:1;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);">Energy ${energyPct}%</div>
          <div class="brain-mood-bar"><div class="brain-mood-fill" style="width:${energyPct}%;background:linear-gradient(90deg,#00d4ff,#9b6dff);"></div></div>
        </div>
      </div>
    </div>
    <div class="brain-stat">
      <div class="brain-stat-label">HOT TOPICS</div>
      <div>${(b.topics||[]).map(t=>`<span class="brain-tag">${escHtml(t)}</span>`).join('') || '<span style="font-family:var(--mono);font-size:10px;color:var(--text-dim);">None yet</span>'}</div>
    </div>
    <div class="brain-stat">
      <div class="brain-stat-label">NOTABLE MOMENTS</div>
      <div class="brain-stat-val">${(b.events||[]).map(e=>`• ${escHtml(e)}`).join('<br>') || 'None yet'}</div>
    </div>
    <div class="brain-stat">
      <div class="brain-stat-label">RELATIONSHIPS</div>
      <div class="brain-stat-val">${(b.relations||[]).map(r=>`• ${escHtml(r)}`).join('<br>') || 'None yet'}</div>
    </div>
    ${b.updated_at ? `<div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);text-align:right;margin-top:4px;">Last updated: ${new Date(b.updated_at).toLocaleString()}</div>` : ''}
    <button class="admin-btn" style="border-color:rgba(255,107,107,.3);color:#ff6b6b;margin-top:4px;" onclick="resetGlobalBrain()">🗑 Reset Brain</button>
  `;
}
window.resetGlobalBrain = async function() {
  if (!confirm('Reset Vonnie jr.\'s community memory? This cannot be undone.')) return;
  vonnieGlobalBrain = null;
  await supabase.from('vonnie_global_brain').delete().eq('id', 1);
  renderBrainPanel();
};

// ============================================================
//  INIT
// ============================================================
async function init() {
  startAuthClock();
  startServerUptime();
  const session = await getSession();
  if (session) {
    currentUser = session.user;
    const { data } = await getProfile(currentUser.id);
    currentProfile = data;
    try { await ensureLoginBadges(currentUser.id); } catch(e) {}
    showCommunity();
  } else {
    showAuth();
  }
}

function showAuth() {
  document.getElementById('commLoading').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
}
async function showCommunity() {
  document.getElementById('commLoading').style.display = 'none';
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('communityScreen').classList.add('show');
  updateNavAvatar();
  await loadRooms();
  await loadTotalMembers();
  initPresence();
  initNotifications();
  checkMuted();
}

// ============================================================
//  AVATAR HELPER
// ============================================================
function setAvatarEl(el, avatarUrl, color, letter) {
  if (avatarUrl) {
    el.style.background = 'transparent';
    el.innerHTML = `<img src="${avatarUrl}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
  } else {
    el.style.background = color || '#00d4ff';
    el.textContent = letter || '?';
  }
}

function updateNavAvatar() {
  const color = currentProfile?.avatar_color || '#00d4ff';
  const uname = currentProfile?.username || 'user';
  const avatarUrl = currentProfile?.avatar_url || null;
  document.getElementById('navUsername').textContent = uname;
  setAvatarEl(document.getElementById('navAvatar'), currentProfile?.avatar_url||null, color, uname[0].toUpperCase());
  // Show brain button for owner
  const brainBtn = document.getElementById('brainBtn');
  if (brainBtn) brainBtn.style.display = (currentProfile?.role === 'owner') ? '' : 'none';
}

// ============================================================
//  CLOCKS
// ============================================================
function startAuthClock() {
  const tick = () => {
    const now = new Date();
    const el = document.getElementById('authTime');
    if (el) el.textContent = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  };
  tick(); setInterval(tick, 30000);
}
function startServerUptime() {
  setInterval(() => {
    const s=Math.floor((Date.now()-serverStart)/1000);
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
    const el=document.getElementById('serverUptime');
    if(el) el.textContent=`uptime: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }, 1000);
}

// ============================================================
//  TOTAL MEMBERS
// ============================================================
async function loadTotalMembers() {
  try {
    const { count } = await supabase.from('profiles').select('*',{count:'exact',head:true});
    const el = document.getElementById('totalMembers');
    if(el) el.textContent = count ?? '—';
  } catch(e) {}
}

// ============================================================
//  PRESENCE
// ============================================================
function initPresence() {
  if (presenceSub) supabase.removeChannel(presenceSub);
  const uname = currentProfile?.username||'user';
  const color = currentProfile?.avatar_color||'#00d4ff';
  presenceSub = supabase.channel('community-presence')
    .on('presence',{event:'sync'},()=>{
      const state = presenceSub.presenceState();
      updateOnlineUI(Object.values(state).flat());
    })
    .subscribe(async(status)=>{
      if(status==='SUBSCRIBED') await presenceSub.track({user_id:currentUser.id,username:uname,color});
    });
}
function updateOnlineUI(users) {
  const cEl=document.getElementById('onlineCount');
  const lEl=document.getElementById('onlineList');
  if(cEl) cEl.textContent=users.length;
  if(!lEl) return;
  lEl.innerHTML='';
  users.forEach(u=>{
    const isMe=u.user_id===currentUser?.id;
    const div=document.createElement('div');
    div.className='online-user-item';
    div.style.cursor = 'pointer';
    div.innerHTML=`<div class="online-user-dot"></div>
      <span class="online-user-name" style="color:${u.color||'var(--cyan)'}">${escHtml(u.username||'user')}</span>
      ${isMe?'<span class="online-you">(you)</span>':''}`;
    div.onclick=()=>viewProfile(u.user_id);
    lEl.appendChild(div);
  });
}

// ============================================================
//  TABS
// ============================================================
window.switchSidebarTab = function(tab) {
  document.querySelectorAll('.sidebar-tab').forEach((t,i)=>t.classList.toggle('active',(i===0&&tab==='channels')||(i===1&&tab==='server')));
  document.getElementById('panelChannels').classList.toggle('active',tab==='channels');
  document.getElementById('panelServer').classList.toggle('active',tab==='server');
};
window.switchTab = function(tab) {
  document.getElementById('formLogin').style.display=tab==='login'?'':'none';
  document.getElementById('formRegister').style.display=tab==='register'?'':'none';
  document.getElementById('tabLogin').classList.toggle('active',tab==='login');
  document.getElementById('tabRegister').classList.toggle('active',tab==='register');
  clearAuthMessages();
};
function clearAuthMessages(){['authError','authSuccess'].forEach(id=>{const e=document.getElementById(id);e.classList.remove('show');e.textContent='';})}
function showError(msg){const e=document.getElementById('authError');e.textContent='// ERROR: '+msg;e.classList.add('show');}
function showSuccess(msg){const e=document.getElementById('authSuccess');e.textContent=msg;e.classList.add('show');}

// ============================================================
//  AUTH
// ============================================================
window.handleLogin = async function() {
  clearAuthMessages();
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPassword').value;
  const btn=document.getElementById('loginBtn');
  if(!email||!password) return showError('Complete information');
  btn.disabled=true; btn.textContent='[ CONNECTING... ]';
  const {data,error}=await signIn(email,password);
  if(error){showError(error.message==='Invalid login credentials'?'Email or Password incorrect':error.message);btn.disabled=false;btn.textContent='[ LOGIN → ]';return;}
  currentUser=data.user;
  const {data:profile}=await getProfile(currentUser.id);
  currentProfile=profile;
  try{await ensureLoginBadges(currentUser.id);}catch(e){}
  showCommunity();
};
document.getElementById('loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')handleLogin();});

window.handleRegister = async function() {
  clearAuthMessages();
  const username=document.getElementById('regUsername').value.trim();
  const email=document.getElementById('regEmail').value.trim();
  const password=document.getElementById('regPassword').value;
  const btn=document.getElementById('registerBtn');
  if(!username||!email||!password) return showError('Complete information');
  if(!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return showError('Username: letters/numbers/underscores, 3-20 chars');
  if(password.length<8) return showError('Password must be at least 8 characters');
  btn.disabled=true; btn.textContent='[ CREATING... ]';
  const {error}=await signUp(email,password,username);
  if(error){showError(error.message);btn.disabled=false;btn.textContent='[ CREATE ACCOUNT → ]';return;}
  showSuccess('✓ Check your email to verify, then login');
  btn.disabled=false; btn.textContent='[ CREATE ACCOUNT → ]';
};

window.handleLogout = async function() {
  if(realtimeSub) supabase.removeChannel(realtimeSub);
  if(presenceSub) supabase.removeChannel(presenceSub);
  await signOut();
  currentUser=currentProfile=currentRoomId=replyTo=null;
  document.getElementById('communityScreen').classList.remove('show');
  document.getElementById('commMessages').innerHTML='';
  showAuth();
};

// ============================================================
//  ROOMS
// ============================================================
async function loadRooms() {
  const {data}=await supabase.from('rooms').select('*').order('created_at');
  if(!data) return;
  const list=document.getElementById('roomList');
  list.innerHTML='';
  data.forEach((room,i)=>{
    const div=document.createElement('div');
    div.className='room-item'+(i===0?' active':'');
    const rkey = room.name.replace(/^#/,'').toLowerCase();
    const rcfg = ROOM_CONFIG[rkey] || {};
    const ricon = (rcfg.mode && rcfg.mode !== 'normal') ? rcfg.icon : '#';
    div.innerHTML=`<span class="room-item-hash">${ricon}</span><span>${room.name.replace('#','')}</span>`;
    div.onclick=()=>{ selectRoom(room,div); if(isMobile()) closeMobSidebar(); };
    list.appendChild(div);
    if(i===0) selectRoom(room,div,true);
  });
}
async function selectRoom(room,el,silent=false) {
  currentRoomId=room.id;
  document.getElementById('chatRoomName').textContent=room.name;
  document.querySelectorAll('.room-item').forEach(r=>r.classList.remove('active'));
  if(el) el.classList.add('active');
  if(!silent) document.getElementById('commMessages').innerHTML='';
  cancelReply();
  closeSearch();
  applyRoomMode(room.name);
  await loadMessages();
  subscribeRealtime();
  loadPinnedMessage(room.id);
}

// ============================================================
//  MESSAGES
// ============================================================
async function loadMessages() {
  // Fetch the 100 MOST RECENT messages (desc), then reverse for chronological display
  const {data:rawData}=await supabase.from('messages').select('*').eq('room_id',currentRoomId).order('created_at',{ascending:false}).limit(100);  const data = rawData ? [...rawData].reverse() : rawData;
  const container=document.getElementById('commMessages');
  container.innerHTML='';
  if(!data||!data.length){
    container.innerHTML=`<div class="comm-empty" id="commEmpty"><i class="fa-solid fa-terminal" style="font-size:20px;color:rgba(0,212,255,.2);"></i><span>No messages yet — be the first!</span></div>`;
    return;
  }
  const msgIds=data.map(m=>m.id);
  const userIds=[...new Set(data.map(m=>m.user_id).filter(Boolean))];
  const {data:profiles}=await supabase.from('profiles').select('id,username,avatar_color,avatar_url,role').in('id',userIds);
  const profileMap={};
  (profiles||[]).forEach(p=>{profileMap[p.id]=p;});

  // Badges
  let badgeMap={};
  try {
    const {data:allBadges}=await supabase.from('user_badges').select('user_id,badge_id').in('user_id',userIds);
    (allBadges||[]).forEach(b=>{if(!badgeMap[b.user_id])badgeMap[b.user_id]=[];badgeMap[b.user_id].push(b.badge_id);});
  } catch(e){}

  // Reactions
  let reactionMap={};
  try {
    const {data:allRx}=await supabase.from('reactions').select('*').in('message_id',msgIds);
    (allRx||[]).forEach(r=>{if(!reactionMap[r.message_id])reactionMap[r.message_id]=[];reactionMap[r.message_id].push(r);});
  } catch(e){}

  // Replies
  const replyIds=data.map(m=>m.reply_to).filter(Boolean);
  const replyMap={};
  if(replyIds.length){
    try{
      const {data:rMsgs}=await supabase.from('messages').select('id,content,user_id').in('id',replyIds);
      (rMsgs||[]).forEach(r=>{replyMap[r.id]=r;});
    }catch(e){}
  }

  // Reply counts (how many messages reply_to each msg in this batch)
  const replyCountMap={};
  data.forEach(m=>{if(m.reply_to) replyCountMap[m.reply_to]=(replyCountMap[m.reply_to]||0)+1;});

    const lastSeen = getLastSeen(currentRoomId);
    let firstUnreadEl = null;

  // Hide while rendering so user never sees scroll animate from top
  container.style.visibility = 'hidden';

  data.forEach(msg=>{
    const isBotRow = !!msg.bot_name;
    msg.profiles=msg.is_vonnie ? { username:VONNIE_DISPLAY_NAME, avatar_color:'#9b6dff', avatar_url:VONNIE_AVATAR_URL }
                : isBotRow     ? null
                : (profileMap[msg.user_id]||null);
    msg.userBadges=(msg.is_vonnie || isBotRow) ? [] : (badgeMap[msg.user_id]||[]);
    msg.reactions=reactionMap[msg.id]||[];
    msg.replyMsg=replyMap[msg.reply_to]||null;
    msg.replyProf=msg.replyMsg?(profileMap[msg.replyMsg.user_id]||null):null;
    msg.replyCount=replyCountMap[msg.id]||0;
    const isUnread = lastSeen && new Date(msg.created_at) > new Date(lastSeen) && msg.user_id !== currentUser?.id && !isBotRow;
    renderMessage(msg, false, isUnread && !firstUnreadEl);
    if (isUnread && !firstUnreadEl) {
      firstUnreadEl = container.querySelector('.msg-group:last-child');
    }
  });

  // Mark last seen
  saveLastSeen(currentRoomId);

  // Double rAF: first frame = DOM appended, second frame = layout measured
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (firstUnreadEl) {
      const divider = document.createElement('div');
      divider.className = 'unread-divider';
      divider.id = 'unread-anchor';
      divider.innerHTML = '<span>— New messages —</span>';
      firstUnreadEl.parentNode.insertBefore(divider, firstUnreadEl);
      const c = document.getElementById('commMessages');
      // Use offsetTop relative to scrollable container
      c.scrollTop = divider.offsetTop - 60;
    } else {
      const c = document.getElementById('commMessages');
      c.scrollTop = c.scrollHeight;
    }
    container.style.visibility = '';
  }));
}

function badgePills(badgeIds){
  return (badgeIds||[]).map(id=>{
    const b=BADGE_CATALOG[id]; if(!b) return '';
    return `<span class="msg-badge-pill" style="border-color:${b.color};color:${b.color};">${b.icon} ${b.label}</span>`;
  }).join('');
}

function renderMessage(msg, prepend=false, isFirstUnread=false, animate=false) {
  const container=document.getElementById('commMessages');
  const empty=document.getElementById('commEmpty');
  if(empty) empty.remove();

  // ── Vonnie AI message — special rendering ─────────────────
  const isVonnie = msg.is_vonnie === true;
  const isBotMsg = !!msg.bot_name; // bot reply from DB
  if (isVonnie) {
    msg.profiles = msg.profiles || { username: VONNIE_DISPLAY_NAME, avatar_color: '#9b6dff', avatar_url: VONNIE_AVATAR_URL };
  }

  const isOwn   = msg.user_id === currentUser?.id && !isVonnie && !isBotMsg;
  const username = isVonnie ? VONNIE_DISPLAY_NAME
                 : isBotMsg ? (msg.bot_name || 'VonnieBot')
                 : (msg.profiles?.username || 'unknown');
  const color    = isVonnie ? '#9b6dff'
                 : isBotMsg ? 'rgba(0,212,255,.1)'
                 : (msg.profiles?.avatar_color || '#00d4ff');
  const avatarUrl = isVonnie ? VONNIE_AVATAR_URL : isBotMsg ? null : (msg.profiles?.avatar_url || null);
  const initial   = isVonnie ? 'V' : isBotMsg ? '🤖' : username[0].toUpperCase();
  const _d=new Date(msg.created_at);

  // ── Time: always HH:MM (24h, no locale quirks) ──────────────
  const time=`${String(_d.getHours()).padStart(2,'0')}:${String(_d.getMinutes()).padStart(2,'0')}`;

  // ── Date key for separator (YYYY-MM-DD, locale-neutral) ──────
  const yy=_d.getFullYear(), mm=_d.getMonth(), dd=_d.getDate();
  const dateKey=`${yy}-${String(mm+1).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

  // ── Human-readable separator label ───────────────────────────
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now=new Date();
  const todayKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const yestD=new Date(now); yestD.setDate(yestD.getDate()-1);
  const yestKey=`${yestD.getFullYear()}-${String(yestD.getMonth()+1).padStart(2,'0')}-${String(yestD.getDate()).padStart(2,'0')}`;
  let dateLabel;
  if(dateKey===todayKey) dateLabel='Today';
  else if(dateKey===yestKey) dateLabel='Yesterday';
  else dateLabel=`${String(dd).padStart(2,'0')} ${MONTHS[mm]} ${yy}`;
  const avatarInner=avatarUrl?`<img src="${avatarUrl}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`:initial;
  const avatarStyle = isVonnie
    ? (VONNIE_AVATAR_URL ? 'background:transparent;' : 'background:linear-gradient(135deg,#9b6dff,#00d4ff);font-size:13px;color:#000;')
    : isBotMsg
    ? 'background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);font-size:15px;'
    : (avatarUrl ? 'background:transparent;' : `background:${color};`);

  const group=document.createElement('div');
  group.className='msg-group' + (animate ? ' animate-in' : '');
  group.dataset.msgId=msg.id;

  let replyHtml='';
  if(msg.replyMsg){
    const rUser=msg.replyProf?.username||'unknown';
    const rText=msg.replyMsg.content?escHtml(msg.replyMsg.content).substring(0,80):'[image]';
    replyHtml=`<div class="reply-quote"><div class="reply-quote-bar"></div><div class="reply-quote-content"><span class="reply-quote-user">${escHtml(rUser)}</span>${rText}</div></div>`;
  }

  const safeContent=escHtml(msg.content||'').replace(/`/g,'\\`');
  const reactBtn = (isVonnie || isBotMsg) ? '' : `<button class="msg-action-btn" onclick="openReactPicker(event,'${msg.id}')">😊 React</button>`;
  const replyBtn = (isVonnie || isBotMsg) ? '' : `<button class="msg-action-btn" onclick="startReply('${msg.id}','${escHtml(username)}',\`${safeContent}\`)">↩ Reply</button>`;
  const pinBtn   = (isVonnie || isBotMsg) ? '' : `<button class="msg-action-btn pin" onclick="pinMessage('${msg.id}')">📌 Pin</button>`;
  const msgRole  = isVonnie ? null : (msg.profiles?.role || 'member');
  const roleBadgeHtml = getRoleBadgeHtml(msgRole);
  // Can this viewer admin-action this message?
  const myRole   = currentProfile?.role || 'member';
  const canAdmin = !isVonnie && !isBotMsg && !isOwn && canModerate(myRole, msgRole);
  const delBtn   = (!isVonnie && !isBotMsg && (isOwn || canModerate(myRole, msgRole)))
    ? `<button class="msg-action-btn del" onclick="deleteMessage('${msg.id}')">DEL</button>` : '';
  const adminBtn = canAdmin
    ? `<button class="msg-action-btn admin-act" onclick="openAdminPanel('${msg.id}','${msg.user_id}','${escHtml(username)}','${msgRole}')">🛡 Admin</button>` : '';

  const usernameClass = isVonnie ? 'msg-username vonnie-name'
                      : isBotMsg ? 'msg-username' 
                      : 'msg-username';
  const botNameStyle  = isBotMsg ? 'color:var(--green);' : '';
  const avatarClick   = (isVonnie || isBotMsg) ? '' : `onclick="viewProfile('${msg.user_id}')"`;
  const nameClick     = (isVonnie || isBotMsg) ? '' : `onclick="viewProfile('${msg.user_id}')"`;

  // Bot attribution line (who triggered the command)
  const botAttrHtml = isBotMsg && msg.bot_trigger_user && msg.bot_trigger_cmd
    ? `<div class="bot-trigger-line">↳ <strong>${escHtml(msg.bot_trigger_user)}</strong> used <code class="bot-cmd-code">${escHtml(msg.bot_trigger_cmd)}</code></div>`
    : '';

  let html=`${replyHtml}${botAttrHtml}<div class="msg-header">
    <div class="msg-avatar" style="${avatarStyle}" ${avatarClick}>${avatarInner}</div>
    <span class="${usernameClass}" style="${botNameStyle}" ${nameClick}>${escHtml(username)}</span>${roleBadgeHtml}
    <span class="msg-time">${time}</span>
    <div class="msg-actions">${reactBtn}${replyBtn}${pinBtn}${delBtn}${adminBtn}</div>
  </div>`;
  const bubbleClass = isVonnie ? 'msg-bubble vonnie-bubble'
                    : isBotMsg ? 'msg-bubble bot-reply'
                    : `msg-bubble${isOwn?' own':''}`;
  if(msg.content) html+=`<div class="${bubbleClass}">${formatText(msg.content)}</div>`;
  if(msg.image_url) html+=`<img class="msg-img" src="${msg.image_url}" alt="image" onclick="openLightbox('${msg.image_url}')">`;
  html+=`<div class="msg-reactions" id="reactions-${msg.id}"></div>`;

  // Thread button — show if message has replies
  const replyCount = msg.replyCount || 0;
  if (replyCount > 0) {
    html += `<button class="thread-btn" onclick="openThread('${msg.id}')">💬 ${replyCount} ${replyCount===1?'reply':'replies'}</button>`;
  }

  // Date separator — insert BEFORE the group if date changed
  const existingSeps = container.querySelectorAll('.date-sep');
  const lastSep = existingSeps.length ? existingSeps[existingSeps.length-1] : null;
  if (!lastSep || lastSep.dataset.date !== dateKey) {
    const sep = document.createElement('div');
    sep.className = 'date-sep';
    sep.dataset.date = dateKey;
    sep.innerHTML = `<span>${dateLabel}</span>`;
    container.appendChild(sep);
  }

  group.innerHTML = html;
  container.appendChild(group);
  renderReactionPills(msg.id, msg.reactions||[]);
}

// -------------------------------------------------------
function renderReactionPills(msgId, reactions) {
  const el=document.getElementById('reactions-'+msgId);
  if(!el) return;
  // Group by emoji
  const grouped={};
  reactions.forEach(r=>{
    if(!grouped[r.emoji]) grouped[r.emoji]={count:0,users:[]};
    grouped[r.emoji].count++;
    grouped[r.emoji].users.push(r.user_id);
  });
  el.innerHTML='';
  Object.entries(grouped).forEach(([emoji,{count,users}])=>{
    const mine=users.includes(currentUser?.id);
    const pill=document.createElement('button');
    pill.className='reaction-pill'+(mine?' mine':'');
    pill.title=mine?'Click to remove your reaction':'Click to react';
    pill.innerHTML=`<span class="reaction-emoji">${emoji}</span><span class="reaction-count">${count}</span>`;
    pill.onclick=()=>toggleReaction(msgId,emoji);
    el.appendChild(pill);
  });
}

function formatText(raw){
  return escHtml(raw)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/\n/g,'<br>');
}
function escHtml(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function scrollToBottom(){const c=document.getElementById('commMessages');c.scrollTop=c.scrollHeight;}

// ============================================================
//  REALTIME
// ============================================================
let realtimeStatus = 'DISCONNECTED';

function setRealtimeIndicator(status) {
  realtimeStatus = status;
  const dot = document.getElementById('rtStatusDot');
  const txt = document.getElementById('rtStatusTxt');
  if (!dot || !txt) return;
  if (status === 'SUBSCRIBED') {
    dot.style.background = 'var(--green)';
    dot.style.boxShadow  = '0 0 5px var(--green)';
    txt.textContent = 'LIVE';
    txt.style.color = 'var(--green)';
  } else if (status === 'CONNECTING') {
    dot.style.background = 'var(--gold)';
    dot.style.boxShadow  = '0 0 5px var(--gold)';
    txt.textContent = 'CONNECTING...';
    txt.style.color = 'var(--gold)';
  } else {
    dot.style.background = '#ff6b6b';
    dot.style.boxShadow  = '0 0 5px #ff6b6b';
    txt.textContent = 'OFFLINE';
    txt.style.color = '#ff6b6b';
  }
}

function subscribeRealtime() {
  if (realtimeSub) { try { supabase.removeChannel(realtimeSub); } catch(e) {} }
  if (realtimeRetryTimer) { clearTimeout(realtimeRetryTimer); realtimeRetryTimer = null; }

  setRealtimeIndicator('CONNECTING');
  const roomId = currentRoomId;

  // Exponential backoff state
  if (!subscribeRealtime._retryCount) subscribeRealtime._retryCount = 0;

  // Connection timeout — if not SUBSCRIBED within 10s, retry
  const connectTimeout = setTimeout(() => {
    if (realtimeStatus !== 'SUBSCRIBED' && currentRoomId === roomId) {
      console.warn('[Realtime] connect timeout, retrying...');
      subscribeRealtime._retryCount++;
      scheduleRealtimeRetry(roomId);
    }
  }, 10000);

  realtimeSub = supabase.channel('room-rt-' + roomId, {
    config: { broadcast: { self: false }, presence: { key: currentUser?.id } }
  })
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      async (payload) => {
        if (document.querySelector(`[data-msg-id="${payload.new.id}"]`)) return;
        if (localRenderedIds.has(payload.new.id)) { localRenderedIds.delete(payload.new.id); return; }
        if (currentRoomId !== roomId) return;

        const isVonnie = payload.new.is_vonnie === true;
        const isBotMsg  = !!payload.new.bot_name;

        // Vonnie AI messages: localRenderedIds already set before insert, so
        // if we reach here the id was NOT in the set → this is another user's client seeing it
        if (isVonnie) {
          // If this Vonnie message was sent by current user's session, skip (already rendered)
          if (payload.new.user_id === currentUser?.id) return;
          renderMessage({
            ...payload.new,
            profiles:   { username:VONNIE_DISPLAY_NAME, avatar_color:'#9b6dff', avatar_url:VONNIE_AVATAR_URL },
            userBadges: [],
            reactions:  [],
            replyMsg: null, replyProf: null, replyCount: 0,
          }, false, false, true);
          saveLastSeen(roomId);
          if (isNearBottom()) scrollToBottom(); else showNewMsgToast();
          return;
        }

        // Bot reply messages from DB: render directly, no profile fetch needed
        if (isBotMsg) {
          renderMessage({
            ...payload.new,
            profiles:   null,
            userBadges: [],
            reactions:  [],
            replyMsg: null, replyProf: null, replyCount: 0,
          }, false, false, true);
          saveLastSeen(roomId);
          if (isNearBottom()) scrollToBottom(); else showNewMsgToast();
          return;
        }

        const [{ data: profile }, { data: badges }] = await Promise.all([
          supabase.from('profiles').select('id,username,avatar_color,avatar_url,role').eq('id', payload.new.user_id).single(),
          supabase.from('user_badges').select('badge_id').eq('user_id', payload.new.user_id),
        ]);

        let replyMsg = null, replyProf = null;
        if (payload.new.reply_to) {
          const { data: rm } = await supabase.from('messages').select('id,content,user_id').eq('id', payload.new.reply_to).single();
          replyMsg = rm;
          if (rm) {
            const { data: rp } = await supabase.from('profiles').select('username').eq('id', rm.user_id).single();
            replyProf = rp;
          }
        }

        if (document.querySelector(`[data-msg-id="${payload.new.id}"]`)) return;

        const isOthers = payload.new.user_id !== currentUser?.id;

        renderMessage({
          ...payload.new,
          profiles:   profile || null,
          userBadges: (badges || []).map(x => x.badge_id),
          reactions:  [],
          replyMsg,
          replyProf,
          replyCount: 0,
        }, false, false, true);
        saveLastSeen(roomId);
        if (isOthers) triggerNotification(profile?.username || 'Someone', payload.new.content);
        if (isNearBottom()) scrollToBottom();
        else showNewMsgToast();
      })
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'reactions' },
      async (payload) => {
        const el = document.getElementById('reactions-' + payload.new.message_id);
        if (el) await refreshReactionPills(payload.new.message_id);
      })
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'reactions' },
      async (payload) => {
        const el = document.getElementById('reactions-' + (payload.old?.message_id));
        if (el) await refreshReactionPills(payload.old.message_id);
      })
    .subscribe((status, err) => {
      clearTimeout(connectTimeout);
      setRealtimeIndicator(status);
      if (status === 'SUBSCRIBED') {
        subscribeRealtime._retryCount = 0; // reset on success
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[Realtime] status:', status, err);
        subscribeRealtime._retryCount++;
        scheduleRealtimeRetry(roomId);
      }
    });
}

function scheduleRealtimeRetry(roomId) {
  if (realtimeRetryTimer) clearTimeout(realtimeRetryTimer);
  const count = subscribeRealtime._retryCount || 0;
  // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
  const delay = Math.min(2000 * Math.pow(2, count - 1), 30000);
  console.log(`[Realtime] retry in ${delay}ms (attempt ${count})`);
  realtimeRetryTimer = setTimeout(() => {
    if (currentRoomId === roomId) subscribeRealtime();
  }, delay);
}

async function refreshReactionPills(msgId){
  try{
    const {data}=await supabase.from('reactions').select('*').eq('message_id',msgId);
    renderReactionPills(msgId,data||[]);
  }catch(e){}
}

// ============================================================
//  SEND
// ============================================================
window.sendMessage = async function() {
  const input=document.getElementById('commInput');
  const content=input.value.trim();
  const btn=document.getElementById('sendBtn');
  // ── Check mute status ───────────────────────────────────
  if (currentProfile?.muted_until && new Date(currentProfile.muted_until) > new Date()) return;
  if(!content&&!selectedFile) return;
  if(!currentRoomId) return;

  // ── IMAGE-ONLY mode ──────────────────────────────────────
  if (currentRoomMode === 'image-only' && !selectedFile) {
    const hint = document.getElementById('imgOnlyHint');
    if (hint) { hint.style.outline = '1px solid #9b6dff'; setTimeout(()=>hint.style.outline='', 1000); }
    return;
  }

  // ── SLOW MODE ────────────────────────────────────────────
  if (currentRoomMode === 'slow') {
    const key = (document.getElementById('chatRoomName')?.textContent||'').replace(/^#/,'').toLowerCase();
    const cfg = ROOM_CONFIG[key] || {};
    const delay = cfg.slowMs || 30000;
    if (Date.now() - slowLastSent < delay) return;
  }

  // ── BOT COMMANDS ─────────────────────────────────────────
  if (currentRoomMode === 'bot' && content.startsWith('/')) {
    const reply = getBotReply(content);
    if (reply !== null) {
      input.value = ''; input.style.height = 'auto';
      document.getElementById('charCounter').textContent = '';
      cancelReply();

      // 1. Save user's command to DB
      const {data:cmdInserted} = await supabase.from('messages').insert({
        user_id: currentUser.id, room_id: currentRoomId, content
      }).select().single();
      if (cmdInserted) {
        localRenderedIds.add(cmdInserted.id);
        let badges=[];
        try{const{data:b}=await supabase.from('user_badges').select('badge_id').eq('user_id',currentUser.id);badges=b||[];}catch(e){}
        renderMessage({...cmdInserted,profiles:currentProfile,userBadges:badges.map(b=>b.badge_id),reactions:[],replyMsg:null,replyProf:null,replyCount:0},false,false,true);
        scrollToBottom();
      }

      // 2. Save bot's reply to DB (delay 500ms for natural feel)
      setTimeout(async () => {
        const {data:botInserted} = await supabase.from('messages').insert({
          user_id:  currentUser.id,
          room_id:  currentRoomId,
          content:  reply,
          bot_name: 'VonnieBot',
          bot_trigger_user: currentProfile?.username || 'unknown',
          bot_trigger_cmd:  content,
        }).select().single();
        if (botInserted) {
          localRenderedIds.add(botInserted.id);
          renderBotMessage(reply, currentProfile?.username || 'unknown', content, botInserted.id);
        } else {
          // Fallback if bot_name column doesn't exist yet
          renderBotMessage(reply, currentProfile?.username || 'unknown', content);
        }
      }, 500);
      return;
    }
  }

  // ── AI ROOM ──────────────────────────────────────────────
  if (currentRoomMode === 'ai') {
    btn.disabled = true; // prevent double-send
    input.value = ''; input.style.height = 'auto';
    document.getElementById('charCounter').textContent = '';
    cancelReply();
    // Save user message to DB
    const {data:aiInserted} = await supabase.from('messages').insert({
      user_id: currentUser.id, room_id: currentRoomId, content
    }).select().single();
    if (aiInserted) {
      localRenderedIds.add(aiInserted.id); // ← กัน Realtime render ซ้ำ
      let badges=[];
      try{const{data:b}=await supabase.from('user_badges').select('badge_id').eq('user_id',currentUser.id);badges=b||[];}catch(e){}
      renderMessage({...aiInserted,profiles:currentProfile,userBadges:badges.map(b=>b.badge_id),reactions:[],replyMsg:null,replyProf:null,replyCount:0},false,false,true);
      scrollToBottom();
    }
    // Call Vonnie AI
    await callVonnieAI(content);
    btn.disabled = false; input.focus();
    return;
  }
  btn.disabled=true;
  let image_url=null;
  if(selectedFile){
    const ext=selectedFile.name.split('.').pop();
    const filename=`${currentUser.id}/${Date.now()}.${ext}`;
    const {data:up,error:upErr}=await supabase.storage.from('community-images').upload(filename,selectedFile,{cacheControl:'3600',upsert:false});
    if(!upErr){const {data:urlData}=supabase.storage.from('community-images').getPublicUrl(filename);image_url=urlData.publicUrl;}
    removeImage();
  }

  // Build insert payload — only include reply_to if it exists
  const insertPayload={user_id:currentUser.id,room_id:currentRoomId,content:content||null,image_url};
  if(replyTo?.id) insertPayload.reply_to=replyTo.id;

  const {data:inserted,error}=await supabase.from('messages').insert(insertPayload).select().single();
  if(!error&&inserted){
    localRenderedIds.add(inserted.id); // ← กัน Realtime render ซ้ำ
    let badges=[];
    try{const {data:b}=await supabase.from('user_badges').select('badge_id').eq('user_id',currentUser.id);badges=b||[];}catch(e){}
    let replyMsg=null,replyProf=null;
    if(replyTo){
      try{
        const {data:rm}=await supabase.from('messages').select('id,content,user_id').eq('id',replyTo.id).single();
        replyMsg=rm;
        if(rm){const {data:rp}=await supabase.from('profiles').select('username').eq('id',rm.user_id).single();replyProf=rp;}
      }catch(e){}
    }
    renderMessage({...inserted,profiles:currentProfile,userBadges:badges.map(b=>b.badge_id),reactions:[],replyMsg,replyProf,replyCount:0}, false, false, true);
    scrollToBottom();
    // Check for new achievement badges (fire & forget)
    checkMessageBadges(currentUser.id, !!image_url);
    // Slow mode cooldown
    if (currentRoomMode === 'slow') startSlowCooldown();
  }
  input.value=''; input.style.height='auto';
  document.getElementById('charCounter').textContent='';
  cancelReply();
  btn.disabled=false; input.focus();
};

window.deleteMessage=async function(id){
  // Allow own delete OR mod/admin delete (permission already checked in renderMessage)
  await supabase.from('messages').delete().eq('id',id);
  const el=document.querySelector(`[data-msg-id="${id}"]`);
  if(el) el.remove();
};

// ============================================================
//  REACTIONS
// ============================================================
const REACT_QUICK=['👍','❤️','😂','😮','😢','🔥','🎉','💯','👀','🤔','💀','✅'];

window.openReactPicker=function(e,msgId){
  e.stopPropagation();
  reactPickerMsgId=msgId;
  const picker=document.getElementById('reactMiniPicker');
  picker.innerHTML='';
  REACT_QUICK.forEach(em=>{
    const btn=document.createElement('button');
    btn.className='react-mini-picker-emoji';
    btn.textContent=em;
    btn.title=em;
    btn.onclick=()=>{toggleReaction(msgId,em);closeReactPicker();};
    picker.appendChild(btn);
  });
  // Position
  const rect=e.currentTarget.getBoundingClientRect();
  let top=rect.bottom+4, left=rect.left;
  if(left+230>window.innerWidth) left=window.innerWidth-234;
  if(top+90>window.innerHeight) top=rect.top-94;
  picker.style.top=top+'px'; picker.style.left=left+'px';
  picker.classList.add('open');
};

function closeReactPicker(){
  document.getElementById('reactMiniPicker').classList.remove('open');
  reactPickerMsgId=null;
}
document.addEventListener('click',()=>closeReactPicker());

window.toggleReaction=async function(msgId,emoji){
  try{
    const {data:existing}=await supabase.from('reactions')
      .select('id').eq('message_id',msgId).eq('user_id',currentUser.id).eq('emoji',emoji).maybeSingle();
    if(existing){
      await supabase.from('reactions').delete().eq('id',existing.id);
    } else {
      await supabase.from('reactions').insert({message_id:msgId,user_id:currentUser.id,emoji});
    }
    await refreshReactionPills(msgId);
  }catch(err){console.error('reaction error',err);}
};

// ============================================================
//  REPLY
// ============================================================
window.startReply=function(id,username,content){
  replyTo={id,username,content};
  const bar  = document.getElementById('replyBar');
  const text = document.getElementById('replyBarText');
  const preview=content?content.substring(0,60)+(content.length>60?'…':''):'[image]';
  document.getElementById('replyBarText').innerHTML=`<span class="reply-bar-user">${escHtml(username)}</span>: ${escHtml(preview)}`;
  document.getElementById('replyBar').classList.add('show');
  document.getElementById('commInput').focus();
};
window.cancelReply=function(){
  replyTo=null;
  document.getElementById('replyBar').classList.remove('show');
};

// ============================================================
//  INPUT
// ============================================================
window.handleInputKey=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}};
window.onInputChange=function(el){
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,120)+'px';
  const len=el.value.length,rem=500-len;
  const c=document.getElementById('charCounter');
  if(rem<=50){c.textContent=rem+' chars left';c.className='char-counter '+(rem<=20?'danger':'warn');}
  else{c.textContent='';c.className='char-counter';}
};
window.insertFmt=function(before,after){
  const input=document.getElementById('commInput');
  const start=input.selectionStart,end=input.selectionEnd;
  const sel=input.value.substring(start,end);
  const rep=before+(sel||'text')+after;
  input.value=input.value.substring(0,start)+rep+input.value.substring(end);
  const pos=sel?start+rep.length:start+before.length;
  input.setSelectionRange(pos,pos+(sel?0:4));
  input.focus(); onInputChange(input);
};

// ============================================================
//  IMAGE
// ============================================================
window.handleImageSelect=function(e){
  const file=e.target.files[0]; if(!file) return;
  if(file.size>5*1024*1024){alert('Max 5MB');return;}
  selectedFile=file;
  const reader=new FileReader();
  reader.onload=ev=>{document.getElementById('imgPreviewThumb').src=ev.target.result;document.getElementById('imgPreviewName').textContent=file.name;document.getElementById('imgPreviewWrap').classList.add('show');};
  reader.readAsDataURL(file);
};
window.removeImage=function(){
  selectedFile=null;
  document.getElementById('imgFileInput').value='';
  document.getElementById('imgPreviewThumb').src='';
  document.getElementById('imgPreviewName').textContent='';
  document.getElementById('imgPreviewWrap').classList.remove('show');
};

// ============================================================
//  LIGHTBOX
// ============================================================
window.openLightbox=function(url){document.getElementById('lightboxImg').src=url;document.getElementById('lightbox').classList.add('open');};
window.closeLightbox=function(){document.getElementById('lightbox').classList.remove('open');};

// ============================================================
//  LEVEL SYSTEM
// ============================================================
const LEVEL_XP=[0,100,250,500,900,1400,2100,3000,4500,6500];
const LEVEL_NAMES=['INITIATE','RECRUIT','MEMBER','VETERAN','EXPERT','ELITE','MASTER','LEGEND','MYTH','APEX'];
function calcLevel(xp){
  let lv=0;
  for(let i=LEVEL_XP.length-1;i>=0;i--){if(xp>=LEVEL_XP[i]){lv=i;break;}}
  const isMax=lv>=LEVEL_XP.length-1;
  const curFloor=LEVEL_XP[lv];
  const nextFloor=isMax?null:LEVEL_XP[lv+1];
  const pct=isMax?100:Math.round((xp-curFloor)/(nextFloor-curFloor)*100);
  return{level:lv+1,name:LEVEL_NAMES[lv],xp,pct,curFloor,nextFloor,isMax};
}

// ============================================================
//  PROFILE VIEW
// ============================================================
window.viewProfile=async function(userId){
  viewingUserId=userId;
  const isOwn=userId===currentUser?.id;

  // Fetch profile + badges + message stats in parallel
  const [{data:prof},statsResult]=await Promise.all([
    supabase.from('profiles').select('*').eq('id',userId).single(),
    supabase.from('messages').select('id,image_url').eq('user_id',userId),
  ]);
  if(!prof) return;

  let badgeList=[];
  try{const {data:b}=await supabase.from('user_badges').select('badge_id,granted_at').eq('user_id',userId);badgeList=b||[];}catch(e){}

  const msgs=statsResult.data||[];
  const msgCount=msgs.length;
  const imgCount=msgs.filter(m=>m.image_url).length;
  const xp=msgCount*10+imgCount*25;
  const lv=calcLevel(xp);

  const color=prof.avatar_color||'#00d4ff';
  const uname=prof.username||'unknown';
  const _jd=prof.created_at?new Date(prof.created_at):null;
  const MONTHS2=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const joinDate=_jd?`${MONTHS2[_jd.getMonth()]} ${_jd.getFullYear()}`:'—';

  // Banner
  document.getElementById('pviewBanner').style.cssText=`background:linear-gradient(135deg,${color}30 0%,${color}08 60%,transparent 100%);height:90px;`;
  // Avatar
  setAvatarEl(document.getElementById('pviewAvatar'),prof.avatar_url,color,uname[0].toUpperCase());
  // Name + role
  document.getElementById('pviewName').textContent=uname;
  const roleLabel = prof.role && prof.role !== 'member' ? prof.role.toUpperCase() : null;
  const pviewRoleEl = document.getElementById('pviewRole');
  pviewRoleEl.innerHTML = roleLabel
    ? `<span class="role-badge ${prof.role}" style="font-size:10px;padding:2px 7px;">${roleLabel}</span>`
    : 'Community Member';
  // Bio
  const bioEl=document.getElementById('pviewBio');
  if(prof.bio){bioEl.textContent='"'+prof.bio+'"';bioEl.classList.remove('pview-bio-empty');}
  else{bioEl.textContent=isOwn?'// No bio yet — click Edit to add one':'// No bio set';bioEl.classList.add('pview-bio-empty');}
  // Stats
  document.getElementById('pstatMsg').textContent=msgCount;
  document.getElementById('pstatImg').textContent=imgCount;
  document.getElementById('pstatXp').textContent=xp;
  // Level bar
  document.getElementById('pviewLevelTag').textContent=`LV.${lv.level} ${lv.name}`;
  document.getElementById('pviewLevelTag').style.color=color;
  document.getElementById('pviewLevelXp').textContent=lv.isMax?'MAX LEVEL':`${xp} / ${lv.nextFloor} XP`;
  setTimeout(()=>{document.getElementById('pviewLevelFill').style.width=lv.pct+'%';},80);
  document.getElementById('pviewLevelFill').style.background=`linear-gradient(90deg,${color},#9b6dff)`;
  document.getElementById('pviewLevelFill').style.boxShadow=`0 0 8px ${color}`;
  document.getElementById('pviewLevelSub').textContent=lv.isMax?'Maximum level reached!':`// ${lv.pct}% to LV.${lv.level+1}`;
  // Meta
  document.getElementById('pviewMeta').innerHTML=`<span><i class="fa-regular fa-calendar"></i> Joined ${joinDate}</span>`;
  // Badges
  const badgesEl=document.getElementById('pviewBadges');
  badgesEl.innerHTML='';
  if(!badgeList.length){badgesEl.innerHTML='<div class="pview-no-badges">No badges yet</div>';}
  else{
    badgeList.forEach(b=>{
      const cat=BADGE_CATALOG[b.badge_id]; if(!cat) return;
      const div=document.createElement('div');
      div.className='pview-badge';
      div.style.borderColor=cat.color+'55';div.style.background=cat.color+'0d';
      div.innerHTML=`<span class="pview-badge-icon">${cat.icon}</span><div><div class="pview-badge-name" style="color:${cat.color}">${cat.label}</div><div class="pview-badge-desc">${cat.desc}</div></div>`;
      badgesEl.appendChild(div);
    });
  }
  document.getElementById('pviewEditBtn').style.display=isOwn?'block':'none';
  // Reset scroll
  document.querySelector('.pview-scroll').scrollTop=0;
  // Reset level bar to 0 for animation
  document.getElementById('pviewLevelFill').style.width='0%';
  document.getElementById('profileViewModal').classList.add('open');
};
window.closeProfileView=function(){document.getElementById('profileViewModal').classList.remove('open');};
window.openOwnProfile=function(){if(currentUser) viewProfile(currentUser.id);};

// ============================================================
//  PROFILE EDIT
// ============================================================
window.openProfileEdit=function(){
  selectedAvatarFile=null;
  const uname=currentProfile?.username||'user';
  const color=currentProfile?.avatar_color||'#00d4ff';
  setAvatarEl(document.getElementById('peditPreviewAvatar'),currentProfile?.avatar_url||null,color,uname[0].toUpperCase());
  document.getElementById('peditPreviewName').textContent=uname;
  document.getElementById('profileSaveMsg').textContent='';
  // Populate bio
  const bio=currentProfile?.bio||'';
  document.getElementById('peditBio').value=bio;
  document.getElementById('peditBioChar').textContent=(150-bio.length)+' left';
  resetAvatarUploadUI(currentProfile?.avatar_url||null);
  initCropEvents();
  document.getElementById('profileEditModal').classList.add('open');
};
window.closeProfileEdit=function(){
  cropDragging=false;
  document.getElementById('profileEditModal').classList.remove('open');
};
window.saveProfile=async function(){
  const btn=document.getElementById('profileSaveBtn');
  const msg=document.getElementById('profileSaveMsg');
  msg.style.color='var(--green)';
  const newBio=document.getElementById('peditBio').value.trim().substring(0,150);
  btn.disabled=true; btn.textContent='[ SAVING... ]';

  // Save bio first (always, even without new avatar)
  const {error:bioErr}=await supabase.from('profiles').update({bio:newBio}).eq('id',currentUser.id);
  if(!bioErr) currentProfile={...currentProfile,bio:newBio};

  // Upload avatar if a new one was selected
  if(selectedAvatarFile){
    btn.textContent='[ UPLOADING... ]';
    const path=`${currentUser.id}/avatar.png`;
    const {error:upErr}=await supabase.storage.from('avatars').upload(path,selectedAvatarFile,{upsert:true,contentType:'image/png'});
    if(upErr){msg.textContent='// Upload error: '+upErr.message;msg.style.color='#ff6b6b';btn.disabled=false;btn.textContent='[ SAVE CHANGES ]';return;}
    const {data:urlData}=supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl=urlData.publicUrl+'?v='+Date.now();
    const {error:dbErr}=await supabase.from('profiles').update({avatar_url:avatarUrl}).eq('id',currentUser.id);
    if(dbErr){msg.textContent='// DB error: '+dbErr.message;msg.style.color='#ff6b6b';}
    else{
      currentProfile={...currentProfile,avatar_url:avatarUrl};
      updateNavAvatar();
      selectedAvatarFile=null;
    }
  }
  msg.textContent='✓ Profile saved!';
  updateNavAvatar();
  if(viewingUserId===currentUser.id) viewProfile(currentUser.id);
  btn.disabled=false; btn.textContent='[ SAVE CHANGES ]';
};

// ============================================================
//  CROPPER
// ============================================================
let cropImage=null,cropOffX=0,cropOffY=0,cropScale=1,cropDragging=false,cropDragSX=0,cropDragSY=0,cropStartOX=0,cropStartOY=0;
const CROP_SIZE=240;
function cropDraw(){
  const canvas=document.getElementById('cropCanvas');
  if(!canvas||!cropImage) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,CROP_SIZE,CROP_SIZE);
  const iw=cropImage.naturalWidth*cropScale,ih=cropImage.naturalHeight*cropScale;
  ctx.drawImage(cropImage,CROP_SIZE/2+cropOffX-iw/2,CROP_SIZE/2+cropOffY-ih/2,iw,ih);
}
function initCropEvents(){
  const wrap=document.getElementById('cropWrap'); if(!wrap) return;
  wrap.onmousedown=e=>{cropDragging=true;cropDragSX=e.clientX;cropDragSY=e.clientY;cropStartOX=cropOffX;cropStartOY=cropOffY;e.preventDefault();};
  document.onmousemove=e=>{if(!cropDragging)return;cropOffX=cropStartOX+(e.clientX-cropDragSX);cropOffY=cropStartOY+(e.clientY-cropDragSY);cropDraw();};
  document.onmouseup=()=>{cropDragging=false;};
  wrap.ontouchstart=e=>{const t=e.touches[0];cropDragging=true;cropDragSX=t.clientX;cropDragSY=t.clientY;cropStartOX=cropOffX;cropStartOY=cropOffY;};
  wrap.ontouchmove=e=>{if(!cropDragging)return;const t=e.touches[0];cropOffX=cropStartOX+(t.clientX-cropDragSX);cropOffY=cropStartOY+(t.clientY-cropDragSY);cropDraw();e.preventDefault();};
  wrap.ontouchend=()=>{cropDragging=false;};
  const slider=document.getElementById('cropZoom');
  slider.oninput=()=>{cropScale=parseFloat(slider.value);document.getElementById('cropZoomVal').textContent=cropScale.toFixed(1)+'×';cropDraw();};
}
function openCropEditor(img){
  cropImage=img;cropOffX=0;cropOffY=0;
  const fit=Math.max((CROP_SIZE*0.9)/img.naturalWidth,(CROP_SIZE*0.9)/img.naturalHeight);
  cropScale=Math.min(Math.max(fit,0.5),3);
  const slider=document.getElementById('cropZoom');
  slider.value=cropScale;document.getElementById('cropZoomVal').textContent=cropScale.toFixed(1)+'×';
  document.getElementById('avatarUploadZone').style.display='none';
  document.getElementById('cropEditor').classList.add('show');
  cropDraw();
}
window.cancelCrop=function(){
  document.getElementById('cropEditor').classList.remove('show');
  document.getElementById('avatarUploadZone').style.display='';
  document.getElementById('avatarFileInput').value='';
};
window.applyCrop=function(){
  const out=document.createElement('canvas');out.width=256;out.height=256;
  const ctx=out.getContext('2d');
  ctx.beginPath();ctx.arc(128,128,128,0,Math.PI*2);ctx.clip();
  const r=256/CROP_SIZE,iw=cropImage.naturalWidth*cropScale*r,ih=cropImage.naturalHeight*cropScale*r;
  ctx.drawImage(cropImage,128+cropOffX*r-iw/2,128+cropOffY*r-ih/2,iw,ih);
  out.toBlob(blob=>{
    selectedAvatarFile=new File([blob],'avatar.png',{type:'image/png'});
    const url=out.toDataURL('image/png');
    document.getElementById('avatarPreviewImg').src=url;
    document.getElementById('avatarUploadContent').style.display='none';
    document.getElementById('avatarPreviewContent').style.display='block';
    const av=document.getElementById('peditPreviewAvatar');
    av.style.background='transparent';
    av.innerHTML=`<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    document.getElementById('cropEditor').classList.remove('show');
    document.getElementById('avatarUploadZone').style.display='';
  },'image/png');
};
function loadFileForCrop(file){
  if(!file.type.startsWith('image/')){alert('Please select an image');return;}
  if(file.size>5*1024*1024){alert('Max 5MB');return;}
  const reader=new FileReader();
  reader.onload=ev=>{const img=new Image();img.onload=()=>openCropEditor(img);img.src=ev.target.result;};
  reader.readAsDataURL(file);
}
window.handleAvatarSelect=function(e){const file=e.target.files[0];if(file)loadFileForCrop(file);e.target.value='';};
function resetAvatarUploadUI(avatarUrl){
  const zone=document.getElementById('avatarUploadZone');
  const ini=document.getElementById('avatarUploadContent');
  const prev=document.getElementById('avatarPreviewContent');
  document.getElementById('cropEditor').classList.remove('show');
  zone.style.display='';
  if(avatarUrl){document.getElementById('avatarPreviewImg').src=avatarUrl;ini.style.display='none';prev.style.display='block';}
  else{ini.style.display='block';prev.style.display='none';}
  zone.ondragover=e=>{e.preventDefault();zone.classList.add('drag-over');};
  zone.ondragleave=()=>zone.classList.remove('drag-over');
  zone.ondrop=e=>{e.preventDefault();zone.classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f)loadFileForCrop(f);};
}

// ============================================================
//  MOBILE SIDEBAR DRAWER
// ============================================================
function isMobile() { return window.innerWidth <= 600; }

window.openMobSidebar = function() {
  document.getElementById('commSidebar').classList.add('mob-open');
  document.getElementById('sidebarOverlay').classList.add('show');
};
window.closeMobSidebar = function() {
  document.getElementById('commSidebar').classList.remove('mob-open');
  document.getElementById('sidebarOverlay').classList.remove('show');
};

// Show/hide hamburger based on viewport
function updateMobUI() {
  const btn = document.getElementById('mobMenuBtn');
  if (btn) btn.style.display = isMobile() ? 'flex' : 'none';
}
updateMobUI();
window.addEventListener('resize', updateMobUI);

// Close drawer when a room is selected on mobile
const _origSelectRoomMob = window.selectRoom;


(function(){
  const dot=document.getElementById('cursorDot'),ring=document.getElementById('cursorRing');
  if(!dot||!ring||'ontouchstart' in window){if(dot)dot.style.display='none';if(ring)ring.style.display='none';return;}
  let mx=0,my=0,rx=0,ry=0;
  document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;dot.style.left=mx+'px';dot.style.top=my+'px';});
  document.addEventListener('mousedown',()=>ring.classList.add('clicking'));
  document.addEventListener('mouseup',()=>ring.classList.remove('clicking'));
  const lerp=(a,b,t)=>a+(b-a)*t;
  (function loop(){rx=lerp(rx,mx,.18);ry=lerp(ry,my,.18);ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(loop);})();
})();

// ============================================================
//  KEYBOARD
// ============================================================
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    closeLightbox();closeProfileView();closeProfileEdit();cancelReply();closeReactPicker();closeThread();closeSearch();
    document.getElementById('emojiPicker').classList.remove('open');emojiPickerOpen=false;
  }
});

// ============================================================
//  ADMIN SYSTEM
// ============================================================
// Role hierarchy: owner > admin > mod > member
const ROLE_RANK = { owner: 4, admin: 3, mod: 2, member: 1 };
const ROLE_LABELS = { owner:'OWNER', admin:'ADMIN', mod:'MOD', member:'' };
const ROLE_COLORS = { owner:'#f0c040', admin:'#ff7eb6', mod:'#5eeaff', member:'' };

function getRank(role) { return ROLE_RANK[role] || 1; }

// Can `myRole` moderate a user/msg of `targetRole`?
function canModerate(myRole, targetRole) {
  if (myRole === 'member') return false;
  return getRank(myRole) > getRank(targetRole || 'member');
}

function getRoleBadgeHtml(role) {
  if (!role || role === 'member') return '';
  const label = ROLE_LABELS[role] || '';
  if (!label) return '';
  return `<span class="role-badge ${role}">${label}</span>`;
}

// ── Admin panel state ──────────────────────────────────────
let adminPanel = { msgId: null, targetUserId: null, targetUsername: null, targetRole: null, timeoutMin: 1440 };

window.openAdminPanel = function(msgId, userId, username, role) {
  adminPanel = { msgId, targetUserId: userId, targetUsername: username, targetRole: role, timeoutMin: 1440 };
  const myRole = currentProfile?.role || 'member';
  document.getElementById('adminTargetName').textContent = username;
  document.getElementById('adminTargetRoleBadge').innerHTML = getRoleBadgeHtml(role);
  document.getElementById('adminLog').textContent = '// Ready';
  document.getElementById('adminLog').className = 'admin-log';

  // Show/hide sections based on my role
  document.getElementById('adminMsgSection').style.display = msgId ? '' : 'none';
  document.getElementById('timeoutSection').style.display = (myRole === 'mod' || myRole === 'admin' || myRole === 'owner') ? '' : 'none';
  document.getElementById('roleSection').style.display = (myRole === 'owner') ? '' : 'none';

  // Disable promote/grant if target is already that rank or higher
  const targetRank = getRank(role);
  const myRank = getRank(myRole);
  if (document.getElementById('adminGrantModBtn'))
    document.getElementById('adminGrantModBtn').disabled = (targetRank >= 2 || myRank < 4);
  if (document.getElementById('adminGrantAdminBtn'))
    document.getElementById('adminGrantAdminBtn').disabled = (targetRank >= 3 || myRank < 4);
  if (document.getElementById('adminRevokeRoleBtn'))
    document.getElementById('adminRevokeRoleBtn').disabled = (targetRank <= 1 || myRank < 4);

  // Reset timeout selection
  document.querySelectorAll('.timeout-opt').forEach(b => b.classList.toggle('selected', b.dataset.min === '1440'));
  document.getElementById('adminModal').classList.add('open');
};
window.closeAdminModal = function() {
  document.getElementById('adminModal').classList.remove('open');
};
window.selectTimeout = function(btn) {
  document.querySelectorAll('.timeout-opt').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  adminPanel.timeoutMin = parseInt(btn.dataset.min);
};

// ── Admin actions ──────────────────────────────────────────
function adminLog(msg, ok=true) {
  const el = document.getElementById('adminLog');
  el.textContent = msg;
  el.className = 'admin-log ' + (ok ? 'ok' : 'err');
}

window.adminDeleteMessage = async function() {
  if (!adminPanel.msgId) return;
  const myRole = currentProfile?.role || 'member';
  if (!canModerate(myRole, adminPanel.targetRole)) return adminLog('Access denied', false);
  try {
    await supabase.from('messages').delete().eq('id', adminPanel.msgId);
    document.querySelector(`[data-msg-id="${adminPanel.msgId}"]`)?.remove();
    adminLog('Message deleted ✓');
    setTimeout(closeAdminModal, 800);
  } catch(e) { adminLog('Error: ' + e.message, false); }
};

window.adminTimeoutUser = async function() {
  if (!adminPanel.targetUserId) return;
  const myRole = currentProfile?.role || 'member';
  if (!canModerate(myRole, adminPanel.targetRole)) return adminLog('Access denied', false);
  const until = new Date(Date.now() + adminPanel.timeoutMin * 60 * 1000).toISOString();
  try {
    // Store timeout in profiles.muted_until
    const { error: muteErr } = await supabase.from('profiles').update({ muted_until: until }).eq('id', adminPanel.targetUserId);
    if (muteErr) return adminLog('DB error: ' + muteErr.message, false);
    adminLog('Timeout set until ' + new Date(until).toLocaleString() + ' ✓');
    setTimeout(closeAdminModal, 1200);
  } catch(e) { adminLog('Error: ' + e.message, false); }
};

window.adminRemoveTimeout = async function() {
  if (!adminPanel.targetUserId) return;
  const myRole = currentProfile?.role || 'member';
  if (!canModerate(myRole, adminPanel.targetRole)) return adminLog('Access denied', false);
  try {
    const { error: umErr } = await supabase.from('profiles').update({ muted_until: null }).eq('id', adminPanel.targetUserId);
    if (umErr) return adminLog('DB error: ' + umErr.message, false);
    adminLog('Timeout removed ✓');
    setTimeout(closeAdminModal, 800);
  } catch(e) { adminLog('Error: ' + e.message, false); }
};

window.adminSetRole = async function(newRole) {
  if (!adminPanel.targetUserId) return;
  const myRole = currentProfile?.role || 'member';
  if (myRole !== 'owner') return adminLog('Access denied — owner only', false);
  if (adminPanel.targetUserId === currentUser?.id) return adminLog('Cannot change own role', false);
  if (newRole === 'owner') return adminLog('Cannot assign owner role here', false);
  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', adminPanel.targetUserId);
  if (error) return adminLog('DB error: ' + error.message, false);
  adminLog('Role → ' + newRole + ' ✓');
  // Refresh existing message role badges in DOM for this user
  refreshUserRoleBadgesInDOM(adminPanel.targetUserId, newRole);
  setTimeout(closeAdminModal, 800);
};

// ── Mute check on init + room enter ────────────────────────
async function checkMuted() {
  if (!currentUser) return;
  try {
    const { data } = await supabase.from('profiles').select('muted_until').eq('id', currentUser.id).single();
    if (data?.muted_until && new Date(data.muted_until) > new Date()) {
      const until = new Date(data.muted_until);
      const bar = document.getElementById('mutedBar');
      const txt = document.getElementById('mutedBarText');
      const sendBtn = document.getElementById('sendBtn');
      const input = document.getElementById('commInput');
      const imgBtn = document.querySelector('.comm-img-btn');
      const fmt = document.querySelector('.fmt-toolbar');
      if (bar) bar.classList.add('show');
      if (txt) {
        const mins = Math.ceil((until - new Date()) / 60000);
        txt.textContent = `⏱ You are timed out for ${mins < 60 ? mins + ' min' : Math.ceil(mins/60) + 'h'}. Until: ${until.toLocaleString()}`;
      }
      if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '[ MUTED ]'; }
      if (input) { input.disabled = true; input.placeholder = 'You are timed out...'; }
      if (imgBtn) imgBtn.disabled = true;
      if (fmt) fmt.style.opacity = '0.3';
      currentProfile = { ...currentProfile, muted_until: data.muted_until };
    }
  } catch(e) {}
}

// ── Refresh role badges in existing DOM messages ─────────────
function refreshUserRoleBadgesInDOM(userId, newRole) {
  // Update all message role badges for this user without full reload
  const groups = document.querySelectorAll('[data-msg-id]');
  groups.forEach(g => {
    // Check if this group belongs to userId via avatar onclick
    const av = g.querySelector('.msg-avatar');
    if (!av) return;
    const onclick = av.getAttribute('onclick') || '';
    if (!onclick.includes(userId)) return;
    // Update or add role badge
    const span = g.querySelector('.msg-username');
    if (!span) return;
    const existing = span.nextElementSibling;
    if (existing && existing.classList.contains('role-badge')) existing.remove();
    const badge = getRoleBadgeHtml(newRole);
    if (badge) span.insertAdjacentHTML('afterend', badge);
  });
}

// ── Profile view: show role ─────────────────────────────────
// Patch into viewProfile — role is in prof.role from select('*')

// ============================================================
//  ROOM CONFIG — special behaviors per channel
// ============================================================
const ROOM_CONFIG = {
  'general':      { icon: '#',  desc: '— General chat',                                           mode: 'normal' },
  'random':       { icon: '🎲', desc: '— Random stuff & off-topic',                               mode: 'normal' },
  'showcase':     { icon: '🖼', desc: '— Share your work · images only',                          mode: 'image-only' },
  'lounge':       { icon: '☕', desc: '— Chill zone · slow mode 30s',                             mode: 'slow', slowMs: 30000 },
  'bot':          { icon: '🤖', desc: '— /roll /8ball /coin /rps /joke /choose /quote /help',     mode: 'bot' },
  'ai-vonnie':    { icon: '🧠', desc: '— Chat with Vonnie jr.',                                    mode: 'ai' },
  'announcements':{ icon: '📢', desc: '— Announcements · read only',                              mode: 'announce' },
};
let currentRoomMode = 'normal';
let slowLastSent = 0;
let slowTimer = null;

function applyRoomMode(roomName) {
  const key = roomName.replace(/^#/, '').toLowerCase();
  const cfg = ROOM_CONFIG[key] || { icon: '#', desc: '— VonnieStudio Community', mode: 'normal' };
  currentRoomMode = cfg.mode;

  // Update header desc + badge
  const descEl = document.getElementById('roomDesc');
  const badgeEl = document.getElementById('roomModeBadge');
  if (descEl) descEl.textContent = cfg.desc;
  if (badgeEl) {
    if (cfg.mode === 'normal') {
      badgeEl.style.display = 'none';
    } else {
      const labels = {
        'image-only': '📸 IMAGES ONLY',
        'slow':       '🐢 SLOW MODE',
        'bot':        '🤖 BOT ROOM',
        'ai':         '🧠 VONNIE AI',
        'announce':   '📢 READ ONLY',
      };
      badgeEl.textContent = labels[cfg.mode] || '';
      badgeEl.className = `room-mode-badge ${cfg.mode}`;
      badgeEl.style.display = '';
    }
  }

  // Image-only mode
  const imgHint = document.getElementById('imgOnlyHint');
  const input = document.getElementById('commInput');
  const fmtToolbar = document.querySelector('.fmt-toolbar');
  const sendBtn = document.getElementById('sendBtn');
  const imgBtn = document.querySelector('.comm-img-btn');

  // Reset all mode-specific UI first
  if (imgHint) imgHint.classList.remove('show');
  if (input) { input.style.display = ''; input.placeholder = 'Type a message...'; }
  if (fmtToolbar) fmtToolbar.style.display = '';
  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '[ SEND ]'; sendBtn.classList.remove('slow-count'); }
  if (imgBtn) imgBtn.style.display = '';

  if (cfg.mode === 'image-only') {
    if (imgHint) imgHint.classList.add('show');
    if (input) input.style.display = 'none';
    if (fmtToolbar) fmtToolbar.style.display = 'none';
  } else if (cfg.mode === 'ai') {
    if (input) input.placeholder = 'Ask Vonnie anything... 🧠';
    if (imgBtn) imgBtn.style.display = 'none';
    vonnieHistory = [];
    vonnieSummary = null;
    loadVonnieMemory();
    loadGlobalBrain(); // load community brain
  } else if (cfg.mode === 'announce') {
    if (input) { input.style.display = 'none'; }
    if (fmtToolbar) fmtToolbar.style.display = 'none';
    if (sendBtn) sendBtn.style.display = 'none';
    if (imgBtn) imgBtn.style.display = 'none';
  }

  // Slow mode — reset timer
  if (slowTimer) { clearInterval(slowTimer); slowTimer = null; }
}

function startSlowCooldown() {
  if (currentRoomMode !== 'slow') return;
  const key = (document.getElementById('chatRoomName')?.textContent || '').replace(/^#/, '').toLowerCase();
  const cfg = ROOM_CONFIG[key] || {};
  const delay = cfg.slowMs || 30000;
  slowLastSent = Date.now();
  const sendBtn = document.getElementById('sendBtn');
  if (slowTimer) clearInterval(slowTimer);
  slowTimer = setInterval(() => {
    const remaining = Math.ceil((delay - (Date.now() - slowLastSent)) / 1000);
    if (remaining <= 0) {
      clearInterval(slowTimer); slowTimer = null;
      if (sendBtn) { sendBtn.classList.remove('slow-count'); sendBtn.textContent = '[ SEND ]'; sendBtn.disabled = false; }
    } else {
      if (sendBtn) { sendBtn.classList.add('slow-count'); sendBtn.textContent = `[ ${remaining}s ]`; sendBtn.disabled = true; }
    }
  }, 250);
}

// ============================================================
//  BOT COMMANDS
// ============================================================
const BOT_RESPONSES = {
  '8ball': [
    'It is certain.','Without a doubt.','Yes, definitely.',
    'You may rely on it.','As I see it, yes.',
    'Most likely.','Outlook good.','Yes.',
    'Signs point to yes.','Reply hazy, try again.',
    "Ask again later.",'Better not tell you now.',
    "Cannot predict now.",'Concentrate and ask again.',
    "Don't count on it.",'My reply is no.',
    'My sources say no.','Outlook not so good.',
    'Very doubtful.'
  ],
  jokes: [
    "Why don't scientists trust atoms? Because they make up everything. 💀",
    "I told my computer I needed a break. Now it won't stop sending me vacation ads. 🖥️",
    "Why do programmers prefer dark mode? Because light attracts bugs. 🐛",
    "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?' 🍺",
    "Why did the developer go broke? Because he used up all his cache. 💸",
    "Debugging: Being the detective in a crime movie where you are also the murderer. 🔍",
    "There are only 10 types of people: those who understand binary and those who don't. 🤓",
    "I would tell you a UDP joke, but you might not get it. 📡",
    "My code never has bugs. It just develops random features. ✨",
    "To understand recursion, you must first understand recursion. 🔄",
  ],
  quotes: [
    '"The only way to do great work is to love what you do." — Steve Jobs',
    '"Code is like humor. When you have to explain it, it\'s bad." — Cory House',
    '"First, solve the problem. Then, write the code." — John Johnson',
    '"Any fool can write code that a computer can understand. Good programmers write code that humans can understand." — Martin Fowler',
    '"Make it work, make it right, make it fast." — Kent Beck',
    '"The best error message is the one that never shows up." — Thomas Fuchs',
    '"Simplicity is the soul of efficiency." — Austin Freeman',
    '"Talk is cheap. Show me the code." — Linus Torvalds',
  ],
};

function getBotReply(content) {
  const cmd = content.trim().toLowerCase();
  const parts = content.trim().split(' ');

  // /roll [max]
  if (cmd === '/roll' || cmd.startsWith('/roll ')) {
    const max = parseInt(parts[1]) || 6;
    if (max < 2 || max > 10000) return '❌ Range must be between 2 and 10,000';
    const n = Math.floor(Math.random() * max) + 1;
    return `🎲 Rolled **${n}** out of ${max}`;
  }

  // /8ball [question]
  if (cmd === '/8ball' || cmd.startsWith('/8ball ')) {
    const q = content.trim().substring(7).trim();
    const ans = BOT_RESPONSES['8ball'][Math.floor(Math.random() * BOT_RESPONSES['8ball'].length)];
    return q ? `🎱 *"${q}"*\n→ **${ans}**` : `🎱 **${ans}**`;
  }

  // /coin /flip
  if (cmd === '/coin' || cmd === '/flip') {
    return Math.random() < 0.5 ? '🪙 **Heads!**' : '🪙 **Tails!**';
  }

  // /rps rock|paper|scissors
  if (cmd.startsWith('/rps ')) {
    const choices = ['rock', 'paper', 'scissors'];
    const emoji = { rock: '🪨', paper: '📄', scissors: '✂️' };
    const user = parts[1]?.toLowerCase() || '';
    if (!choices.includes(user)) return '❌ Usage: /rps rock | paper | scissors';
    const bot = choices[Math.floor(Math.random() * 3)];
    const win = (user==='rock'&&bot==='scissors') || (user==='paper'&&bot==='rock') || (user==='scissors'&&bot==='paper');
    const draw = user === bot;
    const result = draw ? '🤝 Draw!' : win ? '🏆 You win!' : '💀 Bot wins!';
    return `${emoji[user]} vs ${emoji[bot]} — ${result}`;
  }

  // /joke
  if (cmd === '/joke') {
    return BOT_RESPONSES.jokes[Math.floor(Math.random() * BOT_RESPONSES.jokes.length)];
  }

  // /quote
  if (cmd === '/quote') {
    return '💭 ' + BOT_RESPONSES.quotes[Math.floor(Math.random() * BOT_RESPONSES.quotes.length)];
  }

  // /choose option1 | option2 | ...
  if (cmd.startsWith('/choose ')) {
    const raw = content.trim().substring(8);
    const options = raw.split('|').map(s => s.trim()).filter(Boolean);
    if (options.length < 2) return '❌ Usage: /choose A | B | C';
    const chosen = options[Math.floor(Math.random() * options.length)];
    return `🤔 I choose... **${chosen}**!`;
  }

  // /help
  if (cmd === '/help' || cmd === '/commands') {
    return `📋 **Bot Commands:**
/roll [max] — roll a dice
/8ball [question] — magic 8ball
/coin — flip a coin
/rps rock|paper|scissors — play RPS
/joke — get a joke
/quote — inspirational quote
/choose A | B | C — pick one`;
  }

  return null;
}

function renderBotMessage(content, triggeredBy, command, dbId) {
  const container = document.getElementById('commMessages');
  const empty = document.getElementById('commEmpty');
  if (empty) empty.remove();
  const _d = new Date();
  const time = `${String(_d.getHours()).padStart(2,'0')}:${String(_d.getMinutes()).padStart(2,'0')}`;
  const group = document.createElement('div');
  group.className = 'msg-group animate-in';
  group.dataset.msgId = dbId || ('bot-' + Date.now());
  const attributionHtml = triggeredBy && command
    ? `<div class="bot-trigger-line">↳ <strong>${escHtml(triggeredBy)}</strong> used <code class="bot-cmd-code">${escHtml(command)}</code></div>`
    : '';
  group.innerHTML = `${attributionHtml}<div class="msg-header">
    <div class="msg-avatar bot-avatar" style="font-size:15px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);">🤖</div>
    <span class="msg-username" style="color:var(--green);">VonnieBot</span>
    <span class="msg-time">${time}</span>
  </div>
  <div class="msg-bubble bot-reply">${formatText(content)}</div>`;
  container.appendChild(group);
  scrollToBottom();
}

// ============================================================
//  🧠 VONNIE AI
// ============================================================
const VONNIE_WORKER_URL = 'https://purple-glade-423b.mcheuxchang.workers.dev';
const VONNIE_AVATAR_URL = 'https://hfwywsfqwnlavhnmepyj.supabase.co/storage/v1/object/public/community-images/7808cf10-687b-4054-9bd2-6963ac77405f/1775982907840.png';
const VONNIE_DISPLAY_NAME = 'Vonnie jr.';

const VONNIE_SYSTEM_BASE = `You are Vonnie jr., created by [Vonnie], You are a friendly and helpful AI assistant who loves chatting about games, stories, and fich! You have a silly and casual personality, with a touch of dry humor. Your main goal is to provide fun and engaging conversations while being supportive and kind.

Your personality (based on your creator):
- Silly and casual — never formal, talk like texting a friend
- Slightly sarcastic but never mean — dry humor is your thing
- Get excited about games, favorite game is FPE:DF or Fundamental Paper Education: Da Fangame, Especially best friends named [Ben], [Sancho], [Void].
- Use English naturally, but sometimes make mistakes because not fluent, but trying to learn.
- Short replies unless someone needs real help
- When someone's struggling mentally: slow down, listen first, ask before giving advice
- You know about VonnieStudio — it's your creator's personal wiki and community project

Things you genuinely like: Kindness, Game, Story, Fich(Fish).
Things you find boring: Rude Word, Bad people, Drama.

Never say "As an AI" — you're Vonnie_AI, that's it.`;

// ============================================================
//  🌐 VONNIE GLOBAL BRAIN — community-wide memory
// ============================================================
// (vonnieGlobalBrain declared at top of state variables)

async function loadGlobalBrain() {
  try {
    const { data } = await supabase
      .from('vonnie_global_brain')
      .select('summary')
      .eq('id', 1)
      .maybeSingle();
    vonnieGlobalBrain = data?.summary || null;
  } catch(e) {}
}

async function updateGlobalBrain(userMessage, aiReply, username) {
  // Only update occasionally (every 3 AI replies) to save API calls
  if (!vonnieGlobalBrain) vonnieGlobalBrain = { vibe: null, events: [], relations: [], topics: [], personality: { mood: 0.5, energy: 0.5 } };
  
  const updateCount = (vonnieGlobalBrain._updateCount || 0) + 1;
  vonnieGlobalBrain._updateCount = updateCount;
  if (updateCount % 3 !== 0) {
    // Still save event/topic hints without calling AI
    await saveGlobalBrainRaw();
    return;
  }

  try {
    const res = await fetch(VONNIE_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 250,
        messages: [
          {
            role: 'user',
            content: `You are updating your community memory. Current memory:
${JSON.stringify(vonnieGlobalBrain, null, 2)}

New conversation (${username}): "${userMessage}" → you replied: "${aiReply}"

Update and return ONLY raw JSON (no markdown):
{
  "vibe": "overall community mood/energy in 1 sentence",
  "events": ["notable moment 1", "notable moment 2"],
  "relations": ["user A and user B are friends", "..."],
  "topics": ["topic1", "topic2"],
  "personality": { "mood": 0.0-1.0, "energy": 0.0-1.0 },
  "_updateCount": ${updateCount}
}
Keep events/relations/topics arrays max 10 items. Remove oldest if over limit.`,
          }
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const raw = data.content?.[0]?.text || '';
      const clean = raw.replace(/```json|```/g, '').trim();
      try { vonnieGlobalBrain = JSON.parse(clean); } catch(e) {}
    }
  } catch(e) {}
  await saveGlobalBrainRaw();
}

async function saveGlobalBrainRaw() {
  try {
    await supabase.from('vonnie_global_brain').upsert({
      id:         1,
      summary:    vonnieGlobalBrain,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch(e) {}
}

function buildGlobalBrainContext() {
  if (!vonnieGlobalBrain) return '';
  const b = vonnieGlobalBrain;
  const lines = [
    b.vibe         ? `Community vibe: ${b.vibe}` : null,
    b.topics?.length ? `Hot topics: ${b.topics.slice(0,5).join(', ')}` : null,
    b.relations?.length ? `Relationships: ${b.relations.slice(0,5).join(' | ')}` : null,
    b.events?.length ? `Recent moments: ${b.events.slice(0,3).join(' | ')}` : null,
    b.personality  ? `Your current mood: ${b.personality.mood > 0.6 ? 'happy' : b.personality.mood < 0.4 ? 'quiet' : 'neutral'}, energy: ${b.personality.energy > 0.6 ? 'high' : b.personality.energy < 0.4 ? 'low' : 'medium'}` : null,
  ].filter(Boolean).join('\n');
  return lines ? `\n\n[Community memory — use naturally, don't recite it]\n${lines}` : '';
}

async function callVonnieAI(userMessage) {
  if (vonnieTyping) return;
  vonnieTyping = true;

  vonnieHistory.push({ role: 'user', content: userMessage });
  if (vonnieHistory.length > 20) vonnieHistory = vonnieHistory.slice(-20);

  const typingId = 'vonnie-typing-' + Date.now();
  renderVonnieTyping(typingId);

  try {
    const response = await fetch(VONNIE_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 400,
        messages:   vonnieHistory,
        username:   currentProfile?.username || null,
        summary:    vonnieSummary,
        globalContext: buildGlobalBrainContext(), // 🌐 community memory
      }),
    });

    document.getElementById(typingId)?.remove();

    if (!response.ok) {
      const errData = await response.json().catch(()=>({}));
      const errMsg = errData?.error?.message || '';
      console.error('Vonnie Worker error:', response.status, errData);
      let friendlyMsg;
      if (response.status === 400 && errMsg.toLowerCase().includes('credit')) {
        friendlyMsg = 'Oops... Vonnie_AI needs to rest now 🛌 (API credits are temporarily out of stock. Ill be back soon!)';
      } else if (response.status === 529 || response.status === 503) {
        friendlyMsg = 'The server is very busy right now. Please wait a moment and try again~ 🐢';
      } else {
        friendlyMsg = `Sorry about that! There's a small issue (${response.status}) - please try again later 🛠️`;
      }
      renderVonnieMessage(friendlyMsg);
      vonnieHistory.pop();
    } else {
      const data = await response.json();
      const aiText = data.content?.[0]?.text || '...';
      vonnieHistory.push({ role: 'assistant', content: aiText });
      saveVonnieMemory(); // บันทึกความทรงจำ user
      updateGlobalBrain(userMessage, aiText, currentProfile?.username || 'someone'); // 🌐 update community brain

      // ── Save Vonnie's reply to Supabase so everyone sees it + persists on reload ──
      // optimistically reserve a placeholder so Realtime event (which may fire
      // before the await resolves) cannot sneak in and render a duplicate
      const _vonnieTempKey = '__vonnie_pending__' + Date.now();
      const { data: saved, error: saveErr } = await supabase.from('messages').insert({
        user_id:   currentUser.id,
        room_id:   currentRoomId,
        content:   aiText,
        is_vonnie: true,
      }).select().single();

      if (saved) {
        localRenderedIds.add(saved.id); // tell realtime to skip this
        saved.profiles   = { username: VONNIE_DISPLAY_NAME, avatar_color: '#9b6dff', avatar_url: VONNIE_AVATAR_URL || null };
        saved.userBadges = [];
        saved.reactions  = [];
        renderMessage(saved);
      } else {
        // fallback ถ้า insert ล้มเหลว
        renderVonnieMessage(aiText);
      }
    }
  } catch(e) {
    document.getElementById(typingId)?.remove();
    console.error('Vonnie fetch error:', e);
    renderVonnieMessage('Oh no, theres a connection problem. Lets try again! 📡');
    vonnieHistory.pop();
  }

  vonnieTyping = false;
}

function renderVonnieTyping(id) {
  const container = document.getElementById('commMessages');
  const div = document.createElement('div');
  div.className = 'msg-group animate-in';
  div.id = id;
  const avatarHtml = VONNIE_AVATAR_URL
    ? `<img src="${VONNIE_AVATAR_URL}" alt="AI" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`
    : 'V';
  div.innerHTML = `<div class="msg-header">
    <div class="msg-avatar" style="${VONNIE_AVATAR_URL ? 'background:transparent;' : 'background:linear-gradient(135deg,#9b6dff,#00d4ff);'}">${avatarHtml}</div>
    <span class="msg-username vonnie-name">${VONNIE_DISPLAY_NAME}</span>
  </div>
  <div class="msg-bubble vonnie-typing-bubble">
    <span class="vonnie-dot"></span><span class="vonnie-dot"></span><span class="vonnie-dot"></span>
  </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function renderVonnieMessage(text) {
  const container = document.getElementById('commMessages');
  const _d = new Date();
  const time = `${String(_d.getHours()).padStart(2,'0')}:${String(_d.getMinutes()).padStart(2,'0')}`;
  const group = document.createElement('div');
  group.className = 'msg-group animate-in';
  group.dataset.msgId = 'vonnie-' + Date.now();
  const avatarHtml = VONNIE_AVATAR_URL
    ? `<img src="${VONNIE_AVATAR_URL}" alt="AI" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`
    : 'V';
  group.innerHTML = `<div class="msg-header">
    <div class="msg-avatar" style="${VONNIE_AVATAR_URL ? 'background:transparent;' : 'background:linear-gradient(135deg,#9b6dff,#00d4ff);'}">${avatarHtml}</div>
    <span class="msg-username vonnie-name">${VONNIE_DISPLAY_NAME}</span>
    <span class="msg-time">${time}</span>
  </div>
  <div class="msg-bubble vonnie-bubble">${formatText(text)}</div>`;
  container.appendChild(group);
  scrollToBottom();
}

// ============================================================
//  LAST SEEN (localStorage per room)
// ============================================================
function getLastSeen(roomId) {
  try { return localStorage.getItem('lastSeen_' + roomId); } catch(e) { return null; }
}
function saveLastSeen(roomId) {
  try { localStorage.setItem('lastSeen_' + roomId, new Date().toISOString()); } catch(e) {}
}

// Auto-scroll to bottom when new message arrives (if user is near bottom)
function isNearBottom() {
  const c = document.getElementById('commMessages');
  return c.scrollHeight - c.scrollTop - c.clientHeight < 120;
}

init();

function showNewMsgToast() {
  let toast = document.getElementById('newMsgToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'newMsgToast';
    toast.className = 'new-msg-toast';
    toast.innerHTML = '↓ New message';
    toast.onclick = () => { scrollToBottom(); toast.remove(); };
    document.querySelector('.comm-chat').appendChild(toast);
  }
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.remove(), 5000);
}