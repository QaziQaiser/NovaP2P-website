import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { renderSeoHead, renderNotFoundHead, isKnownPath, setAffiliateRates } from '../../server/seo-data.js';
import { useAffiliateRates } from '../services/useAffiliateRates';

// Tags owned by the SEO metadata (server/seo-data.js). Everything else in <head>
// (favicons, analytics, fonts, app styles) is left untouched.
const SEO_TAGS =
  'meta[name="description"], link[rel="canonical"], meta[name="robots"], ' +
  'meta[property^="og:"], meta[name^="twitter:"], script[type="application/ld+json"]';

/**
 * Keeps the page's SEO tags in sync with the URL when a visitor moves between
 * pages inside the app. The server already sends the right tags on a full page
 * load; without this, the first page's canonical/description would stay in the
 * head after in-app navigation. Uses the exact same data as the server.
 */
export const SeoHeadSync = () => {
  const { pathname } = useLocation();
  const rates = useAffiliateRates();

  useEffect(() => {
    try {
      setAffiliateRates(rates);
      // Share images are deployed with the site, so they always exist here.
      const html = isKnownPath(pathname) ? renderSeoHead(pathname, () => true) : renderNotFoundHead();
      const tpl = document.createElement('template');
      tpl.innerHTML = html;

      document.head.querySelectorAll(SEO_TAGS).forEach((el) => el.remove());
      tpl.content.querySelectorAll('meta, link, script').forEach((el) => document.head.appendChild(el));

      const title = tpl.content.querySelector('title')?.textContent;
      if (title) document.title = title;
    } catch (err) {
      console.warn('[SEO] Could not update head tags:', err);
    }
  }, [pathname, rates]);

  return null;
};
