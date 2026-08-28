// FETCH REELS DYNAMICALLY
async function loadReels() {
  try {
    const res = await fetch('reels.json?t=' + new Date().getTime());
    if(!res.ok) return;
    const reels = await res.json();
    const container = document.getElementById('reels-container');
    container.innerHTML = '';
    
    if(reels.length === 0) {
      container.innerHTML = '<p class="text-white/50 text-center col-span-full">Пока нет добавленных видео.</p>';
      return;
    }

    reels.forEach(reel => {
      const html = `
        <a href="${reel.url}" target="_blank" class="reel-card p-6 flex flex-col h-full group">
          <div class="w-full aspect-video bg-black/40 rounded-lg mb-4 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition">
            <svg class="w-12 h-12 text-white/50 group-hover:text-white transition" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <h3 class="text-xl font-heading mb-2 text-white group-hover:text-rose-200 transition">${reel.title}</h3>
          <p class="text-sm text-white/60 font-light line-clamp-3">${reel.description || ''}</p>
        </a>
      `;
      container.innerHTML += html;
    });
  } catch(e) {
    console.error("No reels found or error loading", e);
  }
}
loadReels();

// SCROLL ENGINE
const TOTAL_FRAMES = 340; 
const PAGE_COUNT = 4;
const LERP = 0.04;
const CONCURRENCY = 24;

const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) || innerWidth < 768;
const FRAME_DIR = isMobile ? 'frames-mobile' : 'frames-webp';

const canvas = document.getElementById('gl-canvas');
const ctx = canvas.getContext('2d');
let canvasDpr = 1;

function resize() {
  canvasDpr = Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 2);
  canvas.width  = innerWidth * canvasDpr;
  canvas.height = innerHeight * canvasDpr;
  canvas.style.width  = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const frames = new Array(TOTAL_FRAMES);
let loadedCount = 0;
let isReady = false;

function frameName(i) {
  return `${FRAME_DIR}/frame_${String(i + 1).padStart(6, '0')}.webp`;
}

async function loadAll() {
  const queue = Array.from({length: TOTAL_FRAMES}, (_, i) => i);
  async function worker() {
    while (queue.length) {
      const i = queue.shift();
      await new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => {
          frames[i] = img;
          loadedCount++;
          const pct = Math.round(loadedCount / TOTAL_FRAMES * 100);
          const bar = document.getElementById('progress-bar');
          if (bar) bar.style.width = pct + '%';
          if (loadedCount === 1) {
            isReady = true;
            startAnim();
          }
          if (loadedCount === TOTAL_FRAMES) {
            const loader = document.getElementById('loader');
            if (loader) {
              loader.style.transition = 'opacity 0.8s';
              loader.style.opacity = '0';
              setTimeout(() => loader.style.display = 'none', 800);
            }
          }
          resolve();
        };
        img.src = frameName(i);
      });
    }
  }
  await Promise.all(Array.from({length: CONCURRENCY}, worker));
}

let currentFrame = 0;
let targetFrame  = 0;

window.addEventListener('scroll', () => {
  if (!isReady) return;
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const progress  = maxScroll > 0 ? scrollY / maxScroll : 0;
  targetFrame = progress * (TOTAL_FRAMES - 1);
}, { passive: true });

function drawFrame(idx) {
  const img = frames[Math.max(0, Math.min(idx, TOTAL_FRAMES - 1))];
  if (!img || !img.complete) return;
  
  const W = innerWidth;
  const H = innerHeight;
  
  const r  = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth * r;
  const ih = img.naturalHeight * r;
  const x  = (W - iw) / 2;
  const y  = (H - ih) / 2;
  
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, x, y, iw, ih);
  
  const vig = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  
  const bot = ctx.createLinearGradient(0, H*0.6, 0, H);
  bot.addColorStop(0, 'rgba(0,0,0,0)');
  bot.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H*0.6, W, H*0.4);
}

function startAnim() {
  function loop() {
    requestAnimationFrame(loop);
    currentFrame += (targetFrame - currentFrame) * LERP;
    if (isReady) drawFrame(Math.round(currentFrame));
  }
  loop();
}

const pages    = Array.from(document.querySelectorAll('.page'));
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = pages.indexOf(entry.target);
      pages.forEach((p, i) => p.classList.toggle('is-active', i === idx));
    }
  });
}, { rootMargin: '-40% 0px -40% 0px' });

pages.forEach(p => observer.observe(p));

loadAll();
