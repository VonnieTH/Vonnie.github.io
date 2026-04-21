// ============================================================
//  DATA
// ============================================================
var SOCIALS = [
  { name:"Vonnie_Channel",  color:"#FF0000",         handle:"YouTube",  icon:"fa-brands fa-youtube",   url:"https://www.youtube.com/@Vonnie_Channel"    },
  { name:"Vonnie Studio",   color:"var(--purple)",   handle:"Discord",  icon:"fa-brands fa-discord",   url:"https://discord.gg/fntGjBaVZ4"              },
  { name:"NoBuy1926",       color:"#FF4500",         handle:"Reddit",   icon:"fa-brands fa-reddit",    url:"https://www.reddit.com/user/NoBuy1926/"     },
  { name:"Vonnie_GamingTH", color:"var(--text-main)",handle:"X",        icon:"fa-brands fa-x-twitter", url:"https://x.com/Vonnie_GamingTH"              }
];

var SEARCH_INDEX = [
  { title:"Home",         page:"home",     desc:"Welcome screen, stats, featured project, activity log" },
  { title:"About Me",     page:"about",    desc:"Profile, skills, education, interests" },
  { title:"Projects",     page:"projects", desc:"VonnieStudio Wiki, tech stack, WIP projects" },
  { title:"Contact",      page:"contact",  desc:"Social channels, availability, timezone" },
  { title:"YouTube",      page:"home",     desc:"Vonnie_Channel on YouTube" },
  { title:"Discord",      page:"home",     desc:"Vonnie Studio Discord server" },
  { title:"Reddit",       page:"home",     desc:"NoBuy1926 on Reddit" },
  { title:"X / Twitter",  page:"home",     desc:"Vonnie_GamingTH on X" },
  { title:"Machine Learning", page:"about",desc:"ML skill, Python, AI models" },
  { title:"Security",     page:"about",    desc:"Cybersecurity focus area" }
];

// ============================================================
//  PAGE ROUTING
// ============================================================
var currentPage = 'home';

function navigate(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(function(el) {
    el.classList.add('hidden');
  });
  // Show target
  var target = document.getElementById('page-' + page);
  if (target) {
    target.classList.remove('hidden');
    // Re-trigger card animations
    target.querySelectorAll('.wiki-card, .stats-row, .wiki-banner, .proj-filter-row').forEach(function(el) {
      el.style.animation = 'none';
      el.offsetHeight; // reflow
      el.style.animation = '';
    });
  }
  // Update drawer active state
  document.querySelectorAll('.drawer-link').forEach(function(a) {
    a.classList.toggle('active', a.dataset.page === page);
  });
  // Update page title
  var titles = { home:'HOME', about:'ABOUT_ME', projects:'PROJECTS', contact:'CONTACT' };
  var titleEl = target && target.querySelector('.page-title');
  if (titleEl) titleEl.textContent = '// ' + (titles[page] || page.toUpperCase());

  currentPage = page;
  window.scrollTo(0, 0);

  // Page-specific inits
  if (page === 'contact') buildContactSocials();
}

// ============================================================
//  SOCIALS BUILD
// ============================================================
function buildSocialGrid(containerId) {
  var grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';
  SOCIALS.forEach(function(s) {
    var div = document.createElement('div');
    div.className = 'social-row';
    div.style.cursor = 'pointer';
    div.dataset.url  = s.url;
    div.dataset.name = s.handle;
    div.addEventListener('click', function(){ openLink(this.dataset.url, this.dataset.name); });
    div.innerHTML =
      '<div class="social-icon"><i class="' + s.icon + '" style="font-size:14px;color:' + s.color + '"></i></div>' +
      '<span class="social-name">' + s.name + '</span>' +
      '<span class="social-handle">' + s.handle + '</span>';
    grid.appendChild(div);
  });
}

function buildContactSocials() {
  var grid = document.getElementById('contact-social-grid');
  if (!grid || grid.dataset.built) return;
  grid.dataset.built = '1';
  grid.style.display = 'flex';
  grid.style.flexDirection = 'column';
  SOCIALS.forEach(function(s) {
    var div = document.createElement('div');
    div.className = 'social-row contact-social-row';
    div.style.cursor = 'pointer';
    div.addEventListener('click', function(){ openLink(s.url, s.handle); });
    div.innerHTML =
      '<div class="social-icon"><i class="' + s.icon + '" style="font-size:16px;color:' + s.color + '"></i></div>' +
      '<div style="flex:1;">' +
        '<div class="social-name">' + s.name + '</div>' +
        '<div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);margin-top:1px;">' + s.url + '</div>' +
      '</div>' +
      '<span class="social-handle">' + s.handle + '</span>';
    grid.appendChild(div);
  });
}

// ============================================================
//  LINK MODAL
// ============================================================
function openLink(url, name) {
  document.getElementById('modal-url').textContent  = url;
  document.getElementById('modal-name').textContent = name;
  document.getElementById('modal-confirm').onclick  = function() { window.open(url, '_blank'); closeModal(); };
  document.getElementById('link-modal').classList.add('open');
}
function closeModal() {
  document.getElementById('link-modal').classList.remove('open');
}

// ============================================================
//  LOADER
// ============================================================
(function() {
  var bar    = document.getElementById('ld-bar');
  var pct    = document.getElementById('ld-pct');
  var rows   = document.getElementById('ld-scan-rows');
  var timeel = document.getElementById('ld-time');
  var started = Date.now();

  setInterval(function() {
    var s = ((Date.now() - started) / 1000) | 0;
    timeel.textContent = String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  }, 500);

  function setBar(v) { bar.style.width = v + '%'; pct.textContent = v + '%'; }

  var scanSteps = [
    'Checking system integrity',
    'Scanning memory segments',
    'Verifying kernel modules',
    'Analyzing network signatures',
    'Running antivirus engine',
    'Checking browser environment',
    'Validating session tokens',
    'Finalizing security check'
  ];
  var i = 0;

  function addRow(label, cb) {
    var row = document.createElement('div'); row.className = 'ld-scan-row';
    var dot = document.createElement('div'); dot.className = 'ld-scan-dot';
    var lbl = document.createElement('span'); lbl.className = 'ld-scan-label'; lbl.textContent = '[SCAN] ' + label + '...';
    var val = document.createElement('span'); val.className = 'ld-scan-val'; val.textContent = '';
    row.appendChild(dot); row.appendChild(lbl); row.appendChild(val);
    rows.appendChild(row);
    setTimeout(function() {
      dot.classList.add('ok');
      lbl.textContent = '[OK]   ' + label;
      val.textContent = 'CLEAR';
      if (cb) cb();
    }, 360);
  }

  function scanNext() {
    if (i >= scanSteps.length) { setBar(85); setTimeout(showCaptcha, 400); return; }
    setBar(Math.round((i / scanSteps.length) * 80));
    addRow(scanSteps[i], function() { setTimeout(scanNext, 150); });
    i++;
  }

  setTimeout(scanNext, 400);

  function showCaptcha() {
    var box = document.getElementById('ld-captcha');
    box.classList.add('show');
    if (window.grecaptcha && window.grecaptcha.render) { renderCaptcha(); }
    else {
      var t = setInterval(function() {
        if (window.grecaptcha && window.grecaptcha.render) { clearInterval(t); renderCaptcha(); }
      }, 200);
    }
  }

  function renderCaptcha() {
    try {
      window.grecaptcha.render('recaptcha-box', {
        sitekey: '6LdEz58sAAAAAKArp6E4icYsTU7kfLsgHilK32cN',
        theme: 'dark',
        callback: function() { onCaptchaPass(); }
      });
    } catch(e) {}
  }

  window.onCaptchaPass = function() {
    setBar(100);
    setTimeout(function() {
      document.getElementById('loader').classList.add('hidden');
      var app = document.getElementById('app');
      app.classList.add('visible');
      // Boot sequence
      navigate('home');
      buildSocialGrid('social-grid');
      setTimeout(startTypingAnimation, 400);
      setTimeout(startCounters, 600);
      setTimeout(startGlitch, 1200);
    }, 600);
  };
})();

// ============================================================
//  TYPING ANIMATION
// ============================================================
function startTypingAnimation() {
  var el = document.getElementById('typedTitle');
  if (!el) return;
  var full = 'VonnieStudio Wiki';
  el.innerHTML = '';
  var spans = full.split('').map(function(c) {
    var s = document.createElement('span');
    s.textContent = c;
    s.style.opacity = '0';
    el.appendChild(s);
    return s;
  });
  spans.forEach(function(s, idx) {
    setTimeout(function() {
      s.style.transition = 'opacity .05s';
      s.style.opacity = '1';
    }, idx * 55 + Math.random() * 20);
  });
}

// ============================================================
//  GLITCH LINE
// ============================================================
var glitchMessages = [
  'SYSTEM ONLINE — ALL MODULES LOADED',
  'USER_VERIFIED — ACCESS GRANTED',
  'WIKI_DB CONNECTED — 4 ENTRIES',
  'VONNIESTUDIO_WIKI v2.0 ACTIVE',
  'SECURITY SCAN COMPLETE — 0 THREATS'
];
var glitchIdx = 0;

function startGlitch() {
  var el = document.getElementById('glitchLine');
  if (!el) return;
  setInterval(function() {
    // Quick glitch scramble
    var chars = '!@#$%^&*<>?/\\|[]{}';
    var target = glitchMessages[(++glitchIdx) % glitchMessages.length];
    var steps = 6, step = 0;
    var iv = setInterval(function() {
      if (step >= steps) { el.textContent = target; clearInterval(iv); return; }
      el.textContent = target.split('').map(function(c, i) {
        return i < (step / steps) * target.length ? c : (c === ' ' ? ' ' : chars[Math.floor(Math.random()*chars.length)]);
      }).join('');
      step++;
    }, 60);
  }, 3500);
}

// ============================================================
//  PROJECT FILTER
// ============================================================
function filterProjects(filter) {
  document.querySelectorAll('.proj-filter').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  document.querySelectorAll('#projects-list .project-entry').forEach(function(entry) {
    var tags = (entry.dataset.tags || '').split(' ');
    var show = filter === 'all' || tags.indexOf(filter) !== -1;
    entry.style.display = show ? '' : 'none';
  });
}

// ============================================================
//  SEARCH
// ============================================================
function toggleSearch() {
  var ov = document.getElementById('searchOverlay');
  if (ov.classList.contains('open')) { closeSearch(); }
  else {
    ov.classList.add('open');
    setTimeout(function() { document.getElementById('searchInput').focus(); }, 100);
  }
}
function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('open');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
}
function doSearch(q) {
  var results = document.getElementById('searchResults');
  q = q.trim().toLowerCase();
  if (!q) { results.innerHTML = ''; return; }
  var hits = SEARCH_INDEX.filter(function(item) {
    return item.title.toLowerCase().indexOf(q) !== -1 ||
           item.desc.toLowerCase().indexOf(q) !== -1;
  });
  if (!hits.length) {
    results.innerHTML = '<div class="search-no-results">No results for "' + q + '"</div>';
    return;
  }
  results.innerHTML = hits.map(function(item) {
    return '<div class="search-result-item" onclick="navigate(\'' + item.page + '\');closeSearch();">' +
      '<div class="search-result-title">' + item.title + '</div>' +
      '<div class="search-result-desc">' + item.desc + '</div>' +
      '<div class="search-result-page">→ ' + item.page.toUpperCase() + '</div>' +
    '</div>';
  }).join('');
}

// ============================================================
//  DRAWER
// ============================================================
function toggleDrawer() {
  var d = document.getElementById('drawer');
  if (d.classList.contains('open')) closeDrawer();
  else {
    d.classList.add('open');
    document.getElementById('overlay').classList.add('open');
    document.getElementById('hamburger').classList.add('open');
  }
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}

// ============================================================
//  KEYBOARD
// ============================================================
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeDrawer(); closeModal(); closeShare(); closeSearch(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); toggleSearch(); }
});

// ============================================================
//  SHARE
// ============================================================
function openShare() {
  var url = window.location.href;
  document.getElementById('share-url-display').textContent = url;
  if (!navigator.share) document.getElementById('share-native-btn').style.display = 'none';
  document.getElementById('share-modal').classList.add('open');
}
function closeShare() {
  document.getElementById('share-modal').classList.remove('open');
  document.getElementById('share-toast').textContent = '';
}
function shareAction(type) {
  var url = window.location.href;
  var toast = document.getElementById('share-toast');
  if (type === 'copy') {
    navigator.clipboard.writeText(url).then(function() {
      toast.textContent = '> URL copied to clipboard';
      setTimeout(function(){ toast.textContent = ''; }, 2500);
    });
  } else if (type === 'x') {
    window.open('https://x.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=VonnieStudio+Wiki', '_blank');
  } else if (type === 'native') {
    if (navigator.share) navigator.share({ title: 'VonnieStudio Wiki', url: url });
  }
}

// ============================================================
//  LIVE CLOCK & UPTIME COUNTER
// ============================================================
var sessionStart = Date.now();

function padZ(n) { return String(n).padStart(2, '0'); }

function formatUptime(ms) {
  var s = Math.floor(ms / 1000);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  return padZ(h) + ':' + padZ(m) + ':' + padZ(sec);
}

function updateClocks() {
  var now = new Date();
  var timeStr = padZ(now.getHours()) + ':' + padZ(now.getMinutes()) + ':' + padZ(now.getSeconds());
  var days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var dateStr = days[now.getDay()] + ' ' + padZ(now.getDate()) + '.' + months[now.getMonth()] + '.' + now.getFullYear();
  var uptime = formatUptime(Date.now() - sessionStart);

  // Footer
  var fc = document.getElementById('footerClock');
  var fu = document.getElementById('footerUptime');
  if (fc) fc.textContent = timeStr;
  if (fu) fu.textContent = 'session ' + uptime;

  // Drawer
  var dc = document.getElementById('drawerClockTime');
  var dd = document.getElementById('drawerClockDate');
  var du = document.getElementById('drawerUptime');
  if (dc) dc.textContent = timeStr;
  if (dd) dd.textContent = dateStr;
  if (du) du.textContent = uptime;
}

setInterval(updateClocks, 1000);
updateClocks();

// ============================================================
//  CURSOR EFFECT — glitch trail + glow
// ============================================================
(function() {
  var dot  = document.getElementById('cursorDot');
  var ring = document.getElementById('cursorRing');
  if (!dot || !ring) return;

  // Hide on mobile/touch
  if ('ontouchstart' in window) {
    dot.style.display = 'none';
    ring.style.display = 'none';
    return;
  }

  var mx = 0, my = 0;
  var rx = 0, ry = 0;
  var trails = [];
  var TRAIL_COUNT = 10;

  // Create trail dots
  for (var i = 0; i < TRAIL_COUNT; i++) {
    var t = document.createElement('div');
    t.className = 'cursor-trail';
    document.body.appendChild(t);
    trails.push({ el: t, x: 0, y: 0 });
  }

  document.addEventListener('mousemove', function(e) {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  });

  document.addEventListener('mousedown', function() { ring.classList.add('clicking'); });
  document.addEventListener('mouseup',   function() { ring.classList.remove('clicking'); });

  // Hide cursor outside window
  document.addEventListener('mouseleave', function() {
    dot.style.opacity = '0'; ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', function() {
    dot.style.opacity = '1'; ring.style.opacity = '1';
  });

  var trailPositions = [];
  for (var j = 0; j < TRAIL_COUNT; j++) trailPositions.push({ x: 0, y: 0 });

  function lerp(a, b, t) { return a + (b - a) * t; }

  var glitchTimer = 0;
  function animLoop() {
    // Ring follows with lag
    rx = lerp(rx, mx, 0.18);
    ry = lerp(ry, my, 0.18);
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';

    // Trail cascade
    trailPositions[0].x = lerp(trailPositions[0].x, mx, 0.35);
    trailPositions[0].y = lerp(trailPositions[0].y, my, 0.35);
    for (var k = 1; k < TRAIL_COUNT; k++) {
      trailPositions[k].x = lerp(trailPositions[k].x, trailPositions[k-1].x, 0.6);
      trailPositions[k].y = lerp(trailPositions[k].y, trailPositions[k-1].y, 0.6);
    }

    // Glitch effect — random offset every ~60 frames
    glitchTimer++;
    var glitching = (glitchTimer % 80 < 3);

    trails.forEach(function(tr, idx) {
      var p = trailPositions[idx];
      var alpha = (1 - idx / TRAIL_COUNT) * 0.6;
      var size  = (1 - idx / TRAIL_COUNT) * 5 + 1;
      var gx = glitching && idx < 3 ? p.x + (Math.random() - 0.5) * 12 : p.x;
      var gy = glitching && idx < 3 ? p.y + (Math.random() - 0.5) * 12 : p.y;
      tr.el.style.left = gx + 'px';
      tr.el.style.top  = gy + 'px';
      tr.el.style.width  = size + 'px';
      tr.el.style.height = size + 'px';
      tr.el.style.opacity = alpha;
      // Alternate cyan/purple on glitch
      tr.el.style.background = (glitching && idx < 2) ? '#9b6dff' : 'rgba(0,212,255,0.8)';
      tr.el.style.boxShadow  = (glitching && idx < 2) ? '0 0 6px #9b6dff' : '0 0 4px rgba(0,212,255,.6)';
    });

    requestAnimationFrame(animLoop);
  }
  requestAnimationFrame(animLoop);
})();

// ============================================================
//  KONAMI CODE EASTER EGG
// ============================================================
(function() {
  var KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var idx = 0;
  var unlocked = false;

  document.addEventListener('keydown', function(e) {
    if (e.key === KONAMI[idx]) {
      idx++;
      if (idx === KONAMI.length) {
        idx = 0;
        if (!unlocked) {
          unlocked = true;
          showKonamiToast();
          // Show secret nav link
          var link = document.getElementById('secretDrawerLink');
          if (link) link.style.display = '';
        }
        navigate('secret');
        initSecretTerminal();
      }
    } else {
      idx = (e.key === KONAMI[0]) ? 1 : 0;
    }
  });

  function showKonamiToast() {
    var toast = document.getElementById('konamiToast');
    if (!toast) return;
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
  }
})();

// ============================================================
//  SECRET TERMINAL
// ============================================================
var terminalHistory = [];
var terminalHistIdx = -1;
var terminalBooted = false;

var TERMINAL_COMMANDS = {
  help: function() {
    return [
      { text: ' AVAILABLE COMMANDS:', cls: 'line-cyan' },
      { text: '  help        — show this message' },
      { text: '  whoami      — identity check' },
      { text: '  ls          — list files' },
      { text: '  cat secrets — read classified file' },
      { text: '  skills      — skill matrix' },
      { text: '  matrix      — enter the matrix' },
      { text: '  clear       — clear terminal' },
      { text: '  exit        — return to home' },
    ];
  },
  whoami: function() {
    return [
      { text: 'USER: Vonnie Ellipse', cls: 'line-cyan' },
      { text: 'ROLE: Computer Engineering Student' },
      { text: 'LOC:  Thailand (ICT UTC+7)' },
      { text: 'CLEARANCE_LEVEL: ██████ [REDACTED]', cls: 'line-gold' },
      { text: 'STATUS: You found the secret page. Congratulations.', cls: 'line-gold' },
    ];
  },
  ls: function() {
    return [
      { text: 'drwxr-xr-x  projects/', cls: 'line-cyan' },
      { text: 'drwxr-xr-x  skills/' },
      { text: '-rw-r-----  secrets.dat', cls: 'line-gold' },
      { text: '-rw-r--r--  README.md' },
      { text: '-rwxr-xr-x  vonniestudio_wiki.exe', cls: 'line-cyan' },
    ];
  },
  'cat secrets': function() {
    return [
      { text: 'DECRYPTING secrets.dat...', cls: 'line-dim' },
      { text: '' },
      { text: '[SECRET_01] This wiki was built from scratch in raw HTML/CSS/JS.', cls: 'line-gold' },
      { text: '[SECRET_02] The FSP logo is the crest of a fictional space federation.' },
      { text: '[SECRET_03] The Konami code has been a thing since 1986. Classic.', cls: 'line-purple' },
      { text: '[SECRET_04] There may be more Easter eggs hidden in this wiki... 👀', cls: 'line-gold' },
    ];
  },
  skills: function() {
    return [
      { text: 'SKILL_MATRIX.DAT', cls: 'line-cyan' },
    ].concat(SKILLS.map(function(s) {
      var bar = '[' + '█'.repeat(Math.round(s.level / 10)) + '░'.repeat(10 - Math.round(s.level / 10)) + ']';
      return { text: '  ' + (s.name + '          ').slice(0,18) + bar + ' ' + s.level + '%' };
    }));
  },
  matrix: function() {
    return [
      { text: 'INITIATING MATRIX PROTOCOL...', cls: 'line-green' },
      { text: '01001000 01100101 01101100 01101100 01101111', cls: 'line-dim' },
      { text: '00101100 00100000 01001110 01100101 01101111', cls: 'line-dim' },
      { text: 'Translation: "Hello, Neo"', cls: 'line-cyan' },
      { text: 'There is no spoon.', cls: 'line-gold' },
    ];
  },
  clear: function() { return null; /* special */ },
  exit: function() {
    setTimeout(function() { navigate('home'); }, 300);
    return [{ text: 'Returning to home...', cls: 'line-dim' }];
  }
};

function initSecretTerminal() {
  if (terminalBooted) return;
  terminalBooted = true;
  var out = document.getElementById('secretOutput');
  if (!out) return;
  var bootLines = [
    { text: 'VONNIE_TERMINAL v1.0 — KONAMI ACCESS GRANTED', cls: 'line-cyan', delay: 0 },
    { text: 'Initializing secure shell...', cls: 'line-dim', delay: 200 },
    { text: 'Connection established. Welcome, operator.', cls: '', delay: 400 },
    { text: 'Type "help" to see available commands.', cls: 'line-gold', delay: 600 },
    { text: '', delay: 700 },
  ];
  bootLines.forEach(function(l) {
    setTimeout(function() { appendTerminalLine(l.text, l.cls); }, l.delay);
  });
  setTimeout(function() {
    var inp = document.getElementById('secretInput');
    if (inp) inp.focus();
  }, 800);
}

function appendTerminalLine(text, cls) {
  var out = document.getElementById('secretOutput');
  if (!out) return;
  var line = document.createElement('div');
  line.textContent = text;
  if (cls) line.className = cls;
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}

function handleTerminalInput(e) {
  var inp = document.getElementById('secretInput');
  if (!inp) return;

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (terminalHistIdx < terminalHistory.length - 1) {
      terminalHistIdx++;
      inp.value = terminalHistory[terminalHistory.length - 1 - terminalHistIdx] || '';
    }
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (terminalHistIdx > 0) {
      terminalHistIdx--;
      inp.value = terminalHistory[terminalHistory.length - 1 - terminalHistIdx] || '';
    } else {
      terminalHistIdx = -1;
      inp.value = '';
    }
    return;
  }

  if (e.key !== 'Enter') return;
  var cmd = inp.value.trim();
  inp.value = '';
  terminalHistIdx = -1;
  if (!cmd) return;

  terminalHistory.push(cmd);
  appendTerminalLine('root@vonnie:~$ ' + cmd, 'line-dim');

  if (cmd === 'clear') {
    var out = document.getElementById('secretOutput');
    if (out) out.innerHTML = '';
    return;
  }

  var fn = TERMINAL_COMMANDS[cmd];
  if (fn) {
    var lines = fn();
    if (lines) lines.forEach(function(l) { appendTerminalLine(l.text, l.cls || ''); });
  } else {
    appendTerminalLine('command not found: ' + cmd + ' (try "help")', 'line-dim');
  }
}

// Patch navigate() to handle secret page
var _origNavigate = navigate;
navigate = function(page) {
  var secretPage = document.getElementById('page-secret');
  if (page === 'secret') {
    document.querySelectorAll('.page').forEach(function(el) { el.classList.add('hidden'); });
    if (secretPage) { secretPage.classList.remove('hidden'); secretPage.classList.add('show'); }
    document.querySelectorAll('.drawer-link').forEach(function(a) {
      a.classList.toggle('active', a.dataset.page === 'secret');
    });
    currentPage = 'secret';
    window.scrollTo(0, 0);
    setTimeout(function() {
      var inp = document.getElementById('secretInput');
      if (inp) inp.focus();
    }, 200);
    return;
  }
  if (secretPage) { secretPage.classList.add('hidden'); secretPage.classList.remove('show'); }
  _origNavigate(page);
};