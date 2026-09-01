// Lightweight global in-app feedback bus.
// Keeps screen-level success/error messages out of native Alert dialogs while
// remaining usable from async handlers and callbacks without React hooks.
const listeners = new Set();
let timer = null;
let currentId = 0;

export const subscribeFeedback = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const showToast = (message, options = {}) => {
  const payload = {
    id: ++currentId,
    title: options.title || '',
    message: String(message || ''),
    type: options.type || 'info',
    duration: Number.isFinite(options.duration) ? options.duration : 3200,
  };

  listeners.forEach((listener) => listener(payload));

  if (timer) clearTimeout(timer);
  if (payload.duration > 0) {
    timer = setTimeout(() => {
      listeners.forEach((listener) => listener(null));
      timer = null;
    }, payload.duration);
  }
};

export const dismissToast = () => {
  if (timer) clearTimeout(timer);
  timer = null;
  listeners.forEach((listener) => listener(null));
};
