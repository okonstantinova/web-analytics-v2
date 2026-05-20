import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';
import { trackWebVital, trackEngagedSession } from './analyticsService';

const ENGAGEMENT_WINDOW_MS = 10000;
const ENGAGEMENT_MIN_SCROLL_PX = 50;

export function initWebVitals() {
  onCLS((m) => trackWebVital('CLS', m.value, m.rating));
  onINP((m) => trackWebVital('INP', m.value, m.rating));
  onLCP((m) => trackWebVital('LCP', m.value, m.rating));
  onFCP((m) => trackWebVital('FCP', m.value, m.rating));
  onTTFB((m) => trackWebVital('TTFB', m.value, m.rating));
}

export function initEngagedSession() {
  let fired = false;
  const start = Date.now();

  function fire() {
    if (fired) return;
    fired = true;
    trackEngagedSession();
    cleanup();
  }

  function onClick() {
    if (Date.now() - start <= ENGAGEMENT_WINDOW_MS) fire();
  }

  function onScroll() {
    if (Date.now() - start <= ENGAGEMENT_WINDOW_MS && window.scrollY > ENGAGEMENT_MIN_SCROLL_PX) {
      fire();
    }
  }

  function cleanup() {
    window.removeEventListener('click', onClick);
    window.removeEventListener('scroll', onScroll);
  }

  window.addEventListener('click', onClick, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.setTimeout(cleanup, ENGAGEMENT_WINDOW_MS);
}
