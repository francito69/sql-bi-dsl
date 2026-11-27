const slides = Array.from(document.querySelectorAll('.slide'));
const progressFill = document.getElementById('progress-fill');
const currentCount = document.getElementById('current-count');
const currentTitle = document.getElementById('current-title');
const dotNav = document.getElementById('dot-nav');
const overview = document.getElementById('overview');
let currentSlide = 0;

function goToSlide(index) {
  const nextIndex = Math.max(0, Math.min(slides.length - 1, index));
  slides[currentSlide].classList.remove('active');
  slides[currentSlide].setAttribute('aria-hidden', 'true');
  currentSlide = nextIndex;
  slides[currentSlide].classList.add('active');
  slides[currentSlide].setAttribute('aria-hidden', 'false');
  slides[currentSlide].scrollTop = 0;

  const slideNumber = String(currentSlide + 1).padStart(2, '0');
  currentCount.textContent = slideNumber;
  currentTitle.textContent = slides[currentSlide].dataset.title;
  progressFill.style.width = `${((currentSlide + 1) / slides.length) * 100}%`;
  document.getElementById('previous-button').disabled = currentSlide === 0;
  document.getElementById('next-button').disabled = currentSlide === slides.length - 1;

  document.querySelectorAll('.dot-button, .overview-item').forEach((button, index) => {
    button.classList.toggle('active', index === currentSlide);
    if (index === currentSlide) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}

slides.forEach((slide, index) => {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = `dot-button${index === 0 ? ' active' : ''}`;
  dot.setAttribute('aria-label', `Ir a diapositiva ${index + 1}: ${slide.dataset.title}`);
  dot.addEventListener('click', () => goToSlide(index));
  dotNav.appendChild(dot);

  const item = document.createElement('button');
  item.type = 'button';
  item.className = `overview-item${index === 0 ? ' active' : ''}`;
  item.innerHTML = `<span class="overview-number">${String(index + 1).padStart(2, '0')}</span><span>${slide.dataset.title}</span>`;
  item.addEventListener('click', () => {
    goToSlide(index);
    overview.classList.add('hidden');
  });
  overview.appendChild(item);
});

document.getElementById('previous-button').addEventListener('click', () => goToSlide(currentSlide - 1));
document.getElementById('next-button').addEventListener('click', () => goToSlide(currentSlide + 1));
document.querySelectorAll('[data-go]').forEach((button) => {
  button.addEventListener('click', () => goToSlide(Number(button.dataset.go)));
});
document.getElementById('replay-button').addEventListener('click', () => goToSlide(0));
document.getElementById('overview-toggle').addEventListener('click', () => overview.classList.toggle('hidden'));
document.getElementById('fullscreen-toggle').addEventListener('click', async () => {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  else await document.exitFullscreen();
});

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
    event.preventDefault();
    goToSlide(currentSlide + 1);
  } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault();
    goToSlide(currentSlide - 1);
  } else if (event.key === 'Home') {
    goToSlide(0);
  } else if (event.key === 'End') {
    goToSlide(slides.length - 1);
  } else if (event.key.toLowerCase() === 'f') {
    document.getElementById('fullscreen-toggle').click();
  } else if (event.key === 'Escape') {
    overview.classList.add('hidden');
  }
});

document.querySelectorAll('.bar').forEach((bar) => {
  const tooltip = document.getElementById('demo-tooltip');
  bar.addEventListener('pointerenter', () => {
    tooltip.textContent = bar.dataset.value;
    tooltip.classList.add('visible');
  });
  bar.addEventListener('pointermove', (event) => {
    const bounds = bar.closest('.chart-card').getBoundingClientRect();
    tooltip.style.left = `${event.clientX - bounds.left + 9}px`;
    tooltip.style.top = `${event.clientY - bounds.top - 24}px`;
  });
  bar.addEventListener('pointerleave', () => tooltip.classList.remove('visible'));
});

goToSlide(0);
