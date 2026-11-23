import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// tawk.to live chat widget. Chats are answered in the tawk.to dashboard (dashboard.tawk.to) or its apps.
const TAWK_SRC = 'https://embed.tawk.to/6b03fd9f8e6f59d4de499336/1k83pde4s';

type TawkApi = {
  onLoad?: () => void;
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
  [key: string]: unknown;
};

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

let loaded = false;
let ready = false;
let wantHidden = false;
let wantOpen = false;

const applyState = () => {
  const api = window.Tawk_API;
  if (!ready || !api) return;
  if (wantHidden) api.hideWidget?.();
  else api.showWidget?.();
  if (wantOpen && !wantHidden) {
    wantOpen = false;
    api.maximize?.();
  }
};

const loadTawk = () => {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();
  const prevOnLoad = window.Tawk_API.onLoad;
  window.Tawk_API.onLoad = () => {
    prevOnLoad?.();
    ready = true;
    applyState();
  };
  const s = document.createElement('script');
  s.async = true;
  s.src = TAWK_SRC;
  s.charset = 'UTF-8';
  s.setAttribute('crossorigin', '*');
  document.body.appendChild(s);
};

/** Shows the tawk.to chat bubble on public pages and hides it on the portals/admin. */
export const TawkToWidget = ({ hidden }: { hidden: boolean }) => {
  const location = useLocation();

  useEffect(() => {
    wantHidden = hidden;
    // Don't load the script at all until a page that shows the widget is visited
    if (!hidden) loadTawk();
    applyState();
  }, [hidden]);

  // Old "Open Live Chat" email links use ?chat=open
  useEffect(() => {
    if (new URLSearchParams(location.search).get('chat') === 'open') {
      wantOpen = true;
      applyState();
    }
  }, [location.search]);

  return null;
};
