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
    results.innerHTML = '<div class="search-no-results">// No results for "' + q + '"</div>';
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
