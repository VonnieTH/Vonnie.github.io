var SOCIALS = [
    { name:"Vonnie_Channel",  color:"var(--cyan)",     handle:"YouTube",  icon:"fa-brands fa-youtube",   url:"https://www.youtube.com/@Vonnie_Channel"    },
    { name:"Vonnie Studio",  color:"var(--purple)",   handle:"Discord",  icon:"fa-brands fa-discord",   url:"https://discord.gg/fntGjBaVZ4"              },
    { name:"NoBuy1926",       color:"#FF4500",         handle:"Reddit",   icon:"fa-brands fa-reddit",    url:"https://www.reddit.com/user/NoBuy1926/"     },
    { name:"Vonnie_GamingTH", color:"var(--text-main)",handle:"X",        icon:"fa-brands fa-x-twitter", url:"https://x.com/Vonnie_GamingTH"              }
  ];
  var grid = document.getElementById("social-grid");
  SOCIALS.forEach(function(s) {
    var div = document.createElement('div');
    div.className  = 'social-row';
    div.style.cursor = 'pointer';
    div.dataset.url  = s.url;
    div.dataset.name = s.handle;
    div.addEventListener('click', function(){ openLink(this.dataset.url, this.dataset.name); });
    div.innerHTML = '<div class="social-icon"><i class="' + s.icon + '" style="font-size:14px;color:' + s.color + '"></i></div>'
      + '<span class="social-name">' + s.name + '</span>'
      + '<span class="social-handle">' + s.handle + '</span>';
    grid.appendChild(div);
  });

  function openLink(url, name) {
    var modal = document.getElementById('link-modal');
    document.getElementById('modal-url').textContent  = url;
    document.getElementById('modal-name').textContent = name;
    document.getElementById('modal-confirm').onclick  = function() { window.open(url, '_blank'); closeModal(); };
    modal.classList.add('open');
  }
  function closeModal() {
    document.getElementById('link-modal').classList.remove('open');
  }
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeModal(); });

(function() {
  var bar     = document.getElementById('ld-bar');
  var pct     = document.getElementById('ld-pct');
  var rows    = document.getElementById('ld-scan-rows');
  var timeel  = document.getElementById('ld-time');
  var started = Date.now();

  // clock
  setInterval(function() {
    var s = ((Date.now() - started) / 1000) | 0;
    timeel.textContent = String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  }, 500);

  function setBar(v) { bar.style.width = v + '%'; pct.textContent = v + '%'; }

  // anonymous security scan - no user data shown
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
    if (i >= scanSteps.length) {
      setBar(85);
      setTimeout(showCaptcha, 400);
      return;
    }
    setBar(Math.round((i / scanSteps.length) * 80));
    addRow(scanSteps[i], function() { setTimeout(scanNext, 150); });
    i++;
  }

  setTimeout(scanNext, 400);

  function showCaptcha() {
    // sessionStorage: skip captcha if already passed this session
    if (sessionStorage.getItem('captcha_passed') === '1') {
      setBar(100);
      setTimeout(function() {
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app').classList.add('visible');
      }, 300);
      return;
    }
    var box = document.getElementById('ld-captcha');
    box.classList.add('show');
    if (window.grecaptcha && window.grecaptcha.render) {
      renderCaptcha();
    } else {
      var t = setInterval(function() {
        if (window.grecaptcha && window.grecaptcha.render) {
          clearInterval(t); renderCaptcha();
        }
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
    sessionStorage.setItem('captcha_passed', '1');
    setBar(100);
    setTimeout(function() {
      document.getElementById('loader').classList.add('hidden');
      document.getElementById('app').classList.add('visible');
    }, 600);
  };

})();
function toggleDrawer() {
  var d = document.getElementById('drawer');
  var o = document.getElementById('overlay');
  var h = document.getElementById('hamburger');
  if (d.classList.contains('open')) { closeDrawer(); }
  else { d.classList.add('open'); o.classList.add('open'); h.classList.add('open'); }
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeDrawer();
});

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
    if (navigator.share) navigator.share({ title: 'VonnieStduio Wiki', url: url });
  }
}