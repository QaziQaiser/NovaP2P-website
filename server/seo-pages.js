// Server-side wrapper around server/seo-data.js (the shared SEO metadata).
// Adds the one Node-only piece: checking which share images exist in /dist.

import fs from 'fs';
import path from 'path';
import { renderSeoHead as renderHead } from './seo-data.js';

export {
  SITE_ORIGIN,
  PAGES,
  getPage,
  isKnownPath,
  GONE_PATH_RE,
  renderNotFoundHead,
  setAffiliateRates,
} from './seo-data.js';

const fileExists = new Map();

/** Head tags for a request path; share images are used only if deployed in distDir. */
export function renderSeoHead(reqPath, distDir) {
  const hasFile = distDir
    ? (file) => {
        if (!fileExists.has(file)) fileExists.set(file, fs.existsSync(path.join(distDir, file)));
        return fileExists.get(file);
      }
    : undefined;
  return renderHead(reqPath, hasFile);
}
