document.addEventListener('DOMContentLoaded', initDarkThemeBanner);

function initDarkThemeBanner() {
  const banner = document.getElementById('banner');
  if (!banner) return;

  const lightImage = extractBannerImage(banner.style.backgroundImage) || '/img/m1.png';
  const darkImage = '/img/dark-theme-night-sky.png';
  let transitionToken = 0;
  let transitionTimer = null;

  banner.classList.add('banner-theme-swap');
  banner.style.setProperty('--banner-light-image', `url('${lightImage}')`);
  banner.style.setProperty('--banner-dark-image', `url('${darkImage}')`);

  const apply = (animate) => {
    const mode = document.documentElement.getAttribute('data-user-color-scheme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = mode === 'dark' || (!mode && prefersDark);
    const currentIsDark = banner.classList.contains('banner-theme-dark');

    if (!animate) {
      banner.classList.add('banner-theme-no-transition');
      banner.classList.toggle('banner-theme-dark', isDark);
      banner.offsetHeight;
      banner.classList.remove('banner-theme-no-transition');
      return;
    }

    if (currentIsDark === isDark) {
      return;
    }

    const token = ++transitionToken;
    if (transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }
    banner.classList.add('banner-theme-no-transition');
    banner.classList.toggle('banner-theme-dark', currentIsDark);
    banner.offsetHeight;
    transitionTimer = window.setTimeout(() => {
      if (token !== transitionToken) return;
      banner.classList.remove('banner-theme-no-transition');
      banner.classList.toggle('banner-theme-dark', isDark);
      transitionTimer = null;
    }, 20);
  };

  apply(false);
  window.setTimeout(() => apply(true), 20);

  const observer = new MutationObserver(() => apply(true));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-user-color-scheme']
  });

  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (media && typeof media.addEventListener === 'function' && !document.documentElement.hasAttribute('data-user-color-scheme')) {
    media.addEventListener('change', () => apply(true));
  }
}

function extractBannerImage(backgroundImage) {
  if (!backgroundImage || backgroundImage === 'none') return '';
  const match = backgroundImage.match(/url\(["']?(.*?)["']?\)/i);
  return match ? match[1] : '';
}
