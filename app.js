/**
 * АНАСТАСИЯ ЕМЕЛЬЯНОВА — СТОРИТЕЛЛИНГ & КИНЕМАТОГРАФИЧЕСКИЙ СКРОЛЛ
 * Скрипт управления скроллом, видеокадрами, модальными окнами и динамическими материалами.
 */

// ==========================================
// 1. КОНСТАНТЫ И НАСТРОЙКИ СКРОЛЛ-ДВИЖКА
// ==========================================
const TOTAL_FRAMES = 340; // Реальное количество кадров в папке frames-webp
const LERP = 0.04;        // Плавность скролла
const CONCURRENCY = 24;   // Количество параллельных потоков загрузки

const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) || window.innerWidth < 768;
const FRAME_DIR = isMobile ? 'frames-mobile' : 'frames-webp';

const canvas = document.getElementById('gl-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let canvasDpr = 1;

function resizeCanvas() {
  if (!canvas || !ctx) return;
  canvasDpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  canvas.width = window.innerWidth * canvasDpr;
  canvas.height = window.innerHeight * canvasDpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ==========================================
// 2. ПРЕДЗАГРУЗКА КАДРОВ
// ==========================================
const frames = new Array(TOTAL_FRAMES);
let loadedCount = 0;
let isReady = false;

function frameName(i) {
  return `${FRAME_DIR}/frame_${String(i + 1).padStart(6, '0')}.webp`;
}

async function loadAllFrames() {
  const queue = Array.from({ length: TOTAL_FRAMES }, (_, i) => i);
  
  async function worker() {
    while (queue.length) {
      const i = queue.shift();
      await new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => {
          frames[i] = img;
          loadedCount++;
          
          const pct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
          const bar = document.getElementById('progress-bar');
          if (bar) bar.style.width = pct + '%';
          
          if (loadedCount === 1) {
            isReady = true;
            startAnimationLoop();
          }
          
          if (loadedCount === TOTAL_FRAMES) {
            const loader = document.getElementById('loader');
            if (loader) {
              loader.style.opacity = '0';
              setTimeout(() => loader.style.display = 'none', 700);
            }
          }
          resolve();
        };
        img.src = frameName(i);
      });
    }
  }

  // Запуск воркеров
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// ==========================================
// 3. ОТРИСОВКА КАДРОВ В CANVAS
// ==========================================
let currentFrame = 0;
let targetFrame = 0;

window.addEventListener('scroll', () => {
  if (!isReady) return;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  targetFrame = progress * (TOTAL_FRAMES - 1);
}, { passive: true });

function drawFrame(idx) {
  if (!ctx) return;
  const img = frames[Math.max(0, Math.min(idx, TOTAL_FRAMES - 1))];
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const W = window.innerWidth;
  const H = window.innerHeight;

  // Cover-fit
  const r = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth * r;
  const ih = img.naturalHeight * r;
  const x = (W - iw) / 2;
  const y = (H - ih) / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, x, y, iw, ih);

  // Тёплая утренняя виньетка для мягкого освещения
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.9);
  vig.addColorStop(0, 'rgba(247, 243, 236, 0.2)');
  vig.addColorStop(1, 'rgba(239, 233, 222, 0.65)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function startAnimationLoop() {
  function loop() {
    requestAnimationFrame(loop);
    currentFrame += (targetFrame - currentFrame) * LERP;
    if (isReady) {
      drawFrame(Math.round(currentFrame));
    }
  }
  loop();
}

// ==========================================
// 4. INTERSECTION OBSERVER ДЛЯ СЕКЦИЙ
// ==========================================
const pages = Array.from(document.querySelectorAll('.page'));
const navLinks = Array.from(document.querySelectorAll('.nav-link'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = pages.indexOf(entry.target);
      pages.forEach((p, i) => p.classList.toggle('is-active', i === idx));
      
      // Подсветка активного пункта навигации
      const currentId = entry.target.getAttribute('id');
      navLinks.forEach(link => {
        const href = link.getAttribute('href');
        link.classList.toggle('active', href === `#${currentId}`);
      });
    }
  });
}, { rootMargin: '-20% 0px -20% 0px' });

pages.forEach(p => observer.observe(p));

// ==========================================
// 5. ИНТЕРАКТИВНОЕ ДЫХАНИЕ (ВДОХ / ВЫДОХ)
// ==========================================
const breathTextEl = document.getElementById('breath-text');
if (breathTextEl) {
  let isInhale = true;
  setInterval(() => {
    isInhale = !isInhale;
    breathTextEl.textContent = isInhale ? 'Вдох' : 'Выдох';
  }, 4000);
}

// ==========================================
// 6. ДИНАМИЧЕСКИЕ REELS (ЗАГРУЗКА ИЗ reels.json)
// ==========================================
async function loadReels() {
  const container = document.getElementById('reels-container');
  if (!container) return;

  try {
    const res = await fetch('reels.json?t=' + new Date().getTime());
    if (!res.ok) throw new Error('Cannot load reels');
    const reels = await res.json();
    
    container.innerHTML = '';

    if (!reels || reels.length === 0) {
      // Приятные дефолтные карточки с полезными материалами
      const defaultMaterials = [
        {
          title: 'Почему мы срываемся в пятницу вечером',
          description: 'Разбор биохимии кортизола и простых шагов, как остановить переедание после тяжёлой рабочей недели.',
          url: 'https://t.me/AnastasiaEmelyanova'
        },
        {
          title: '3 ошибки в приседаниях, которые убивают колени',
          description: 'Понятная биомеханика: как включать ягодицы и беречь суставы в домашней тренировке.',
          url: 'https://t.me/AnastasiaEmelyanova'
        },
        {
          title: 'Как перестать делить еду на «плохую» и «хорошую»',
          description: 'Практика осознанного питания без строгих запретов, подсчёта калорий до грамма и чувства вины.',
          url: 'https://t.me/AnastasiaEmelyanova'
        }
      ];

      defaultMaterials.forEach(item => {
        container.innerHTML += createReelCard(item);
      });
      return;
    }

    reels.forEach(reel => {
      container.innerHTML += createReelCard(reel);
    });

  } catch (e) {
    console.warn('Reels loader notice:', e);
  }
}

function createReelCard(item) {
  return `
    <a href="${item.url}" target="_blank" rel="noopener" class="reel-card p-6 flex flex-col justify-between group">
      <div>
        <div class="w-full aspect-video bg-sageLight/60 rounded-2xl mb-5 flex items-center justify-center border border-sage/20 group-hover:bg-sageLight transition overflow-hidden">
          <span class="w-12 h-12 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-sageDark group-hover:scale-110 transition transform">
            <svg class="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </span>
        </div>
        <h4 class="font-serif text-xl font-medium text-graphite mb-2 group-hover:text-sageDark transition">${item.title}</h4>
        <p class="text-xs text-graphiteMuted font-light leading-relaxed mb-4 line-clamp-3">${item.description || ''}</p>
      </div>
      <span class="text-xs uppercase tracking-wider text-sageDark font-semibold flex items-center gap-1 group-hover:translate-x-1 transition transform">
        Смотреть разбор →
      </span>
    </a>
  `;
}

loadReels();

// ==========================================
// 7. МОДАЛЬНЫЕ ОКНА И ФОРМЫ СВЯЗИ
// ==========================================
window.openBookingModal = function(tariffName) {
  const modal = document.getElementById('booking-modal');
  const title = document.getElementById('modal-title');
  const inputTariff = document.getElementById('form-tariff');
  const btnTg = document.getElementById('btn-tg-direct');
  const btnWa = document.getElementById('btn-wa-direct');

  if (title && tariffName) {
    title.textContent = `Запись: ${tariffName}`;
  }
  if (inputTariff && tariffName) {
    inputTariff.value = tariffName;
  }

  // Обновляем ссылки мессенджеров с предзаполненным текстом
  const msg = encodeURIComponent(`Здравствуйте, Анастасия! Хочу записаться на: ${tariffName}`);
  if (btnTg) btnTg.href = `https://t.me/AnastasiaEmelyanova?text=${msg}`;
  if (btnWa) btnWa.href = `https://wa.me/79774162517?text=${msg}`;

  if (modal) {
    modal.classList.remove('hidden');
  }
};

window.closeBookingModal = function() {
  const modal = document.getElementById('booking-modal');
  if (modal) modal.classList.add('hidden');
};

window.handleBookingSubmit = function(e) {
  e.preventDefault();
  const name = document.getElementById('client-name').value;
  const contact = document.getElementById('client-contact').value;
  const tariff = document.getElementById('form-tariff').value;
  const note = document.getElementById('client-note').value;

  // Формируем сообщение для отправки в Telegram
  const text = `Здравствуйте, Анастасия!%0AМеня зовут ${encodeURIComponent(name)}.%0AКонтакты: ${encodeURIComponent(contact)}%0AИнтересует тариф: ${encodeURIComponent(tariff)}%0A${note ? 'Заметка: ' + encodeURIComponent(note) : ''}`;
  
  window.open(`https://t.me/AnastasiaEmelyanova?text=${text}`, '_blank');
  
  alert(`Спасибо, ${name}! Заявка принята. Сейчас откроется диалог в Telegram для подтверждения удобного времени.`);
  closeBookingModal();
  e.target.reset();
};

// Модалка оплаты видео-тренировок
window.openPaymentModal = function(title, price) {
  const modal = document.getElementById('payment-modal');
  const titleEl = document.getElementById('pay-title');
  if (titleEl && title) titleEl.textContent = title;
  if (modal) modal.classList.remove('hidden');
};

window.closePaymentModal = function() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.classList.add('hidden');
};

window.handlePaymentSubmit = function(e) {
  e.preventDefault();
  const email = document.getElementById('pay-email').value;
  const name = document.getElementById('pay-name').value;

  alert(`Спасибо, ${name}! Заказ оформлен на почту ${email}. Вы будете перенаправлены на защищённую платёжную страницу.`);
  closePaymentModal();
  e.target.reset();
};

// Аккордеон Публичной оферты
window.toggleOfferAccordion = function() {
  const content = document.getElementById('offer-content');
  const chevron = document.getElementById('offer-chevron');
  if (!content) return;

  const isHidden = content.classList.contains('hidden');
  content.classList.toggle('hidden', !isHidden);
  if (chevron) {
    chevron.textContent = isHidden ? '▲ Свернуть' : '▼ Развернуть';
  }
};

// Мобильное меню
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
if (mobileMenuBtn && mobileMenu) {
  mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });

  document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
    });
  });
}

// Запуск загрузки кадров
loadAllFrames();
