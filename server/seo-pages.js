// Per-page SEO metadata for novap2p.com.
//
// server.js uses this to put each page's own <title>, description, canonical,
// robots, Open Graph / Twitter tags and JSON-LD into the HTML *before* it is
// sent, so Google sees every page as a separate page without running JavaScript.
//
// Values come from "SEO Metadata for Every Page" (19 Nov 2026). Copy changes
// here; the visible page text lives in the React components.

import fs from 'fs';
import path from 'path';

export const SITE_ORIGIN = 'https://novap2p.com';
const SITE_NAME = 'NovaP2P';
const TWITTER_SITE = '@novap2pofficial';

// Planned 1200x630 share images. Until a file is added to /public (and so to
// /dist), pages fall back to the current icon so share previews never break.
const OG_HOME = 'og-home-1200x630.png';
const OG_SWAP = 'og-nova-swap-1200x630.png';
const OG_DEFAULT = 'og-default-1200x630.png';
const OG_FALLBACK = 'icon-192.png';

const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
const ORG_ID = `${SITE_ORIGIN}/#organization`;

const crumb = (name, p) => ({ name, path: p });
const HOME = crumb('Home', '/');
const SWAP = crumb('Swap', '/swap');
const HELP = crumb('Help Center', '/help-center');
const PARTNERS = crumb('Partners', '/partner-overview');

const SUPPORTED_CHAINS = [
  'Ethereum', 'Arbitrum One', 'Optimism', 'Base', 'Polygon', 'BNB Smart Chain',
  'Avalanche', 'Solana', 'Bitcoin', 'Sui', 'TRON', 'Stellar',
];

// FAQPage data must match the questions/answers visible on the page.
const HOME_FAQ = [
  ['What is P2P trading?', 'Peer-to-peer (P2P) trading allows users to buy and sell USDT directly with each other without a central exchange acting as an intermediary.'],
  ['Is NovaP2P safe?', 'Yes. NovaP2P uses a secure escrow system that locks the USDT during a trade until the seller confirms receipt of payment, protecting both parties.'],
  ['What cryptocurrencies will be supported?', 'At launch, NovaP2P will primarily focus on USDT (Tether) to provide a stable trading environment. More assets will be added in later phases.'],
  ['How does the escrow system work?', "When a trade starts, the seller's USDT is locked in our smart contract escrow. It is only released to the buyer once the seller confirms they have received the fiat payment."],
];

const HELP_FAQ = [
  ['What is Nova P2P?', 'Nova P2P is a peer-to-peer cryptocurrency trading platform that connects buyers and sellers through a structured trading process.'],
  ['How do I create an account?', 'Visit the Nova P2P website, select Sign Up and follow the on-screen instructions to register your account.'],
  ['Where is Nova P2P available?', 'Nova P2P currently provides services in Nigeria. Available features may depend on your account eligibility and the services offered on the platform.'],
  ['Why is identity verification required?', 'Identity verification may be required to establish your identity and meet applicable compliance requirements.'],
  ['What should I do if my verification fails?', 'Check the information submitted and follow any instructions displayed on your account. If the issue continues, contact official support.'],
  ['How do I buy USDT?', "Sign in to your account. Open the Buy section. Review available offers, prices, limits and payment methods. Select an offer and follow the order instructions. Complete the required payment within the specified time. Follow the platform's instructions to complete the trade."],
  ['How do I sell USDT?', 'Sign in and open the Sell section. Review available offers and their conditions. Select an offer and follow the order instructions. Verify that payment has actually arrived in your account. Release the cryptocurrency only after confirming the required payment.'],
  ['What is escrow protection?', 'Where available, escrow is designed to hold cryptocurrency associated with a trade until the required transaction conditions are met. It helps reduce certain trading risks but does not guarantee that every transaction or dispute will be resolved successfully.'],
  ['What if my trade is delayed?', 'Check the order status and instructions. If the issue cannot be resolved through the normal trading process, use the available appeal or support procedure.'],
  ['Which payment methods can I use?', 'Available payment methods depend on the offers displayed on the platform. Always follow the instructions shown for your selected trade.'],
  ['What if I have paid but have not received USDT?', 'Keep your payment evidence and order details. Use the available appeal process or contact support if the issue remains unresolved.'],
  ['Where can I check fees?', 'Review the Fee Structure page before completing a transaction. Applicable fees may depend on the service or transaction.'],
  ['How can I apply to become a merchant?', 'Visit the Apply for Merchant section on the Nova P2P website and follow the application instructions.'],
  ['Is merchant approval guaranteed?', 'No. Applications may be subject to eligibility requirements, verification and platform review.'],
  ['How can I protect my account?', 'Use a strong, unique password. Never share your password or verification codes. Verify payment details before making a transaction. Access the platform through official channels. Never release cryptocurrency based only on a payment screenshot. Report suspicious activity promptly.'],
  ['What if I suspect unauthorized account access?', 'Secure your account using the available security options and contact official support as soon as possible.'],
];

const PARTNER_FAQ = [
  ['1. How can I join the Partner or BDM Program?', 'To join as a Partner, you need an active Twitter/X account, a Telegram channel or group, and a YouTube channel with a real community. For BDM applicants, YouTube is optional alongside your crypto/affiliate marketing network experience. Click Become a Partner (or Become a BDM), connect your wallet, fill out the form, and submit. Applications are reviewed and approved within 24 hours.'],
  ['2. What is the commission rate?', 'The platform charges a 0.5% trading fee. Partners earn 20% of this fee for the lifetime of every user they refer (equal to 0.1% of referred trading volume). BDMs earn a 10% override of the fee on volume generated by their Partners, or the full 20% when referring traders through their own direct link.'],
  ['3. How does cashback work?', 'Every normal user receives 5% cashback on their trades — whether they come directly or through a Partner/BDM referral link. Partners and BDMs do NOT receive cashback on the volume generated by their referred users (they earn commission instead). However, if a Partner or BDM executes personal swaps with their own wallet, they receive 5% cashback like any normal user.'],
  ['4. What will I see in the Partner or BDM Dashboard?', 'After approval, connect your registered wallet to view real-time data. Partners see total earnings, pending balance, referred volume, active users, live commissions table, and payouts. BDMs have a dedicated command portal showing managed volume, override earnings, active partners, searchable partner performance table, and payout history.'],
  ['5. What is the minimum withdrawal amount?', 'The minimum withdrawal amount for both Partners and BDMs is $100 USDT.'],
  ['6. How long do payouts take?', 'Payouts are processed within 24 hours and are supported across all major networks including BNB Smart Chain, Ethereum, Arbitrum, Optimism, Base, Polygon, Solana, and TRON.'],
  ['7. Can users register with any wallet?', 'Users who join through your referral link must connect a new wallet that has not been previously registered or attributed on Nova Swap.'],
  ['8. How do Partners and BDMs get support?', 'Approved Partners and BDMs receive priority support through live chat on the website as well as dedicated live support on Telegram.'],
  ['9. What are the eligibility requirements?', 'Partners should have an active Twitter/X presence, Telegram community, and YouTube channel reaching real crypto traders. BDMs should demonstrate crypto affiliate/BD experience and the ability to onboard and manage multiple creator partners.'],
  ['10. Is tracking real-time?', 'Yes. Both the Partner Dashboard and BDM Dashboard update in real time so you can monitor referred volume, active users, partner performance, and commission earnings as soon as trades complete.'],
];

const NOINDEX = 'noindex, nofollow';

// path -> metadata. `schema` lists the page-level types; BreadcrumbList is
// added automatically from `breadcrumb`.
export const PAGES = {
  '/': {
    title: 'NovaP2P – Cross-Chain Crypto Swap Across 70+ Blockchains',
    description: 'Swap USDT, USDC, ETH and more across 70+ blockchains in one step. Best-route quotes, 0.5% flat fee, 5% cashback, non-custodial. P2P USDT trading too.',
    og: OG_HOME,
    schema: ['Organization', 'WebSite', 'WebApplication', 'FAQPage'],
    faq: HOME_FAQ,
  },

  // Nova Swap
  '/swap': {
    title: 'Nova Swap – Swap Crypto Across 70+ Chains | NovaP2P',
    description: 'Connect your wallet and swap USDT, USDC, ETH and more across 70+ blockchains. Best route via LI.FI, full cost before you sign, 0.5% fee, 5% cashback.',
    og: OG_SWAP,
    schema: ['WebApplication'],
    breadcrumb: [HOME, SWAP],
  },
  '/how-swap-works': {
    title: 'How Nova Swap Works – Cross-Chain Swaps Step by Step',
    description: 'Learn how Nova Swap routes your tokens across DEXs and bridges: connect a wallet, compare routes, sign once and receive tokens on another chain.',
    og: OG_SWAP,
    schema: ['WebPage'],
    breadcrumb: [HOME, SWAP, crumb('How Swap Works', '/how-swap-works')],
  },
  '/supported-chains': {
    title: 'Supported Chains – 70+ Blockchains on Nova Swap',
    description: 'See the blockchains Nova Swap supports, from Ethereum, Arbitrum, Base and BNB Chain to Solana and Bitcoin, routed through LI.FI across 70+ networks.',
    og: OG_SWAP,
    schema: ['WebPage', 'ItemList'],
    breadcrumb: [HOME, SWAP, crumb('Supported Chains', '/supported-chains')],
  },
  '/swap-fees': {
    title: 'Nova Swap Fees – 0.5% Flat Fee + 5% Cashback | NovaP2P',
    description: 'Nova Swap charges a flat 0.5% fee shown in every quote, plus network gas and bridge costs. Every user gets 5% cashback on eligible swap fees.',
    og: OG_SWAP,
    schema: ['WebPage'],
    breadcrumb: [HOME, SWAP, crumb('Swap Fees', '/swap-fees')],
  },

  // Company
  '/about': {
    title: 'About NovaP2P – The Team Behind Nova Swap & P2P',
    description: 'Meet the team behind NovaP2P: Nova Swap for cross-chain swaps across 70+ blockchains, and an escrow-protected P2P USDT marketplace in Nigeria.',
    og: OG_DEFAULT,
    schema: ['AboutPage', 'Organization', 'Person'],
    breadcrumb: [HOME, crumb('About', '/about')],
  },

  // P2P
  '/merchant': {
    title: 'Become a P2P Merchant in Nigeria – 0% Maker Fees | NovaP2P',
    description: 'Apply to the NovaP2P Verified Merchant Program: post USDT buy and sell offers for naira, pay 0% maker fees and get priority merchant support.',
    og: OG_DEFAULT,
    schema: ['WebPage'],
    breadcrumb: [HOME, crumb('Merchant', '/merchant')],
  },
  '/fee-structure': {
    title: 'NovaP2P Fees – P2P Trading & Nova Swap Fee Structure',
    description: 'All NovaP2P fees in one place: 0.5% on Nova Swap with 5% cashback, 0% P2P maker fee, $0.03 taker fee and the $20 annual platform fee.',
    og: OG_DEFAULT,
    schema: ['WebPage'],
    breadcrumb: [HOME, crumb('Fee Structure', '/fee-structure')],
  },

  // Support
  '/help-center': {
    title: 'Help Center & FAQs – Nova Swap and P2P Support | NovaP2P',
    description: 'Answers to common questions about Nova Swap, cross-chain swaps, P2P trading, escrow, fees, verification and account security on NovaP2P.',
    og: OG_DEFAULT,
    schema: ['FAQPage'],
    faq: HELP_FAQ,
    breadcrumb: [HOME, HELP],
  },
  '/contact': {
    title: 'Contact NovaP2P – Support, Partners & Business Enquiries',
    description: 'Get in touch with the NovaP2P team about Nova Swap, P2P trades, merchant onboarding, partnerships or media enquiries.',
    og: OG_DEFAULT,
    schema: ['ContactPage'],
    breadcrumb: [HOME, crumb('Contact', '/contact')],
  },
  '/contact-support': {
    title: 'Contact Support – Help with Swaps & P2P Trades | NovaP2P',
    description: 'Need help with a swap or a P2P trade? Contact NovaP2P support with your transaction details and our team will review your case.',
    og: OG_DEFAULT,
    schema: ['ContactPage'],
    breadcrumb: [HOME, HELP, crumb('Contact Support', '/contact-support')],
  },
  '/dispute-support': {
    title: 'P2P Dispute Support – How to Open a Dispute | NovaP2P',
    description: 'Payment problem on a P2P trade? Learn how to open a dispute on NovaP2P, what evidence to provide and how escrowed USDT is handled.',
    og: OG_DEFAULT,
    schema: ['WebPage'],
    breadcrumb: [HOME, HELP, crumb('Dispute Support', '/dispute-support')],
  },
  '/report-issue': {
    title: 'Report an Issue – Bugs, Scams & Security | NovaP2P',
    description: 'Report a bug, suspected scam, phishing site or security problem on NovaP2P or Nova Swap so our team can investigate it quickly.',
    og: OG_DEFAULT,
    schema: ['WebPage'],
    breadcrumb: [HOME, HELP, crumb('Report an Issue', '/report-issue')],
  },

  // Legal
  '/risk-disclosure': {
    title: 'Crypto Risk Disclosure – Swaps & P2P Trading | NovaP2P',
    description: 'Understand the risks of cross-chain swaps and P2P crypto trading on NovaP2P, including price volatility, bridge risk, wrong networks and fraud.',
    og: OG_DEFAULT,
    schema: ['WebPage'],
    breadcrumb: [HOME, crumb('Risk Disclosure', '/risk-disclosure')],
  },
  '/terms-of-service': {
    title: 'Terms of Service | NovaP2P',
    description: 'The terms that govern your use of NovaP2P, Nova Swap and the P2P marketplace, including user obligations, fees and limitations of liability.',
    og: OG_DEFAULT,
    schema: ['WebPage'],
    breadcrumb: [HOME, crumb('Terms of Service', '/terms-of-service')],
  },
  '/privacy-policy': {
    title: 'Privacy Policy | NovaP2P',
    description: 'How NovaP2P collects, uses, stores and protects your personal data when you use Nova Swap, the P2P marketplace and our website.',
    og: OG_DEFAULT,
    schema: ['WebPage'],
    breadcrumb: [HOME, crumb('Privacy Policy', '/privacy-policy')],
  },
  '/aml-kyc-policy': {
    title: 'AML & KYC Policy | NovaP2P',
    description: "NovaP2P's anti-money-laundering and know-your-customer policy: identity verification, monitoring and record-keeping for P2P accounts.",
    og: OG_DEFAULT,
    schema: ['WebPage'],
    breadcrumb: [HOME, crumb('AML & KYC Policy', '/aml-kyc-policy')],
  },
  '/cookie-policy': {
    title: 'Cookie Policy | NovaP2P',
    description: 'Which cookies NovaP2P uses, why we use them and how you can manage your cookie preferences on our website.',
    og: OG_DEFAULT,
    schema: ['WebPage'],
    breadcrumb: [HOME, crumb('Cookie Policy', '/cookie-policy')],
  },

  // Partners
  '/become-partner': {
    title: 'Become a Nova Swap Partner – Earn Swap Commissions',
    description: "Join the Nova Swap partner program: share your link, earn commission on your referrals' swap fees and track results in your partner dashboard.",
    og: OG_SWAP,
    schema: ['WebPage'],
    breadcrumb: [HOME, PARTNERS, crumb('Become a Partner', '/become-partner')],
  },
  '/become-bdm': {
    title: 'Become a Nova Swap BDM – Business Development Program',
    description: 'Apply to become a Nova Swap Business Development Manager: onboard partners, grow swap volume and earn commission across your network.',
    og: OG_SWAP,
    schema: ['WebPage'],
    breadcrumb: [HOME, PARTNERS, crumb('Become a BDM', '/become-bdm')],
  },
  '/partner-overview': {
    title: 'Nova Swap Partner & BDM Program Overview | NovaP2P',
    description: 'How the Nova Swap partner and BDM program works: who can join, how referrals are tracked, how commissions are paid and how to apply.',
    og: OG_SWAP,
    schema: ['WebPage'],
    breadcrumb: [HOME, PARTNERS, crumb('Program Overview', '/partner-overview')],
  },
  '/commission': {
    title: 'Nova Swap Commission Structure & Cashback Rules',
    description: 'See how Nova Swap partner and BDM commissions are calculated and paid, and how the 5% user cashback on eligible swap fees works.',
    og: OG_SWAP,
    schema: ['WebPage'],
    breadcrumb: [HOME, PARTNERS, crumb('Commission', '/commission')],
  },
  '/partner-faq': {
    title: 'Nova Swap Partner & BDM FAQ | NovaP2P',
    description: 'Answers to common questions from Nova Swap partners and BDMs about sign-up, referral tracking, commission payouts and program rules.',
    og: OG_SWAP,
    schema: ['FAQPage'],
    faq: PARTNER_FAQ,
    breadcrumb: [HOME, PARTNERS, crumb('Partner FAQ', '/partner-faq')],
  },

  // Logged-in tools and admin: keep out of Google.
  '/partner-dashboard': { title: 'Partner Dashboard | NovaP2P', robots: NOINDEX, og: OG_SWAP },
  '/bdm-dashboard': { title: 'BDM Dashboard — Nova Swap Business Development Portal | NovaP2P', robots: NOINDEX, og: OG_SWAP },
  '/affiliate-review': { title: 'Review Affiliate Application — Nova Swap Admin | NovaP2P', robots: NOINDEX, og: OG_SWAP },
  '/swap-admin': { title: 'Swap Admin | NovaP2P', robots: NOINDEX, og: OG_SWAP },
};

// Alias URLs that show the same page as another URL: they get that page's
// tags (including its canonical), so Google treats them as one page.
const ALIASES = {
  '/help': '/help-center',
  '/support': '/contact-support',
};

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const abs = (p) => (p === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${p}`);

function normalizePath(p) {
  let clean = (p || '/').split('?')[0].split('#')[0];
  if (clean.length > 1) clean = clean.replace(/\/+$/, '');
  return clean.toLowerCase() || '/';
}

const ogExists = new Map();
function ogImageUrl(file, distDir) {
  if (file && distDir) {
    if (!ogExists.has(file)) ogExists.set(file, fs.existsSync(path.join(distDir, file)));
    if (ogExists.get(file)) return { url: `${SITE_ORIGIN}/${file}`, large: true };
  }
  return { url: `${SITE_ORIGIN}/${OG_FALLBACK}`, large: false };
}

function organization() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    alternateName: 'Nova P2P',
    url: `${SITE_ORIGIN}/`,
    logo: `${SITE_ORIGIN}/favicon-96x96.png`,
    sameAs: ['https://x.com/novap2pofficial'],
    founder: {
      '@type': 'Person',
      name: 'Muhammad Shakir',
      jobTitle: 'Founder & CEO',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: `${SITE_ORIGIN}/contact`,
    },
  };
}

function buildSchema(pagePath, page, canonical) {
  const graph = [];
  const faqEntities = (list) =>
    list.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    }));

  for (const type of page.schema || []) {
    switch (type) {
      case 'Organization':
        graph.push(organization());
        break;
      case 'WebSite':
        graph.push({
          '@type': 'WebSite',
          '@id': WEBSITE_ID,
          url: `${SITE_ORIGIN}/`,
          name: SITE_NAME,
          alternateName: ['Nova P2P', 'Nova Swap'],
          publisher: { '@id': ORG_ID },
        });
        break;
      case 'WebApplication':
        graph.push({
          '@type': 'WebApplication',
          name: 'Nova Swap',
          url: `${SITE_ORIGIN}/swap`,
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Web',
          description: 'Non-custodial cross-chain crypto swap across 70+ blockchains with best-route quotes via LI.FI.',
          provider: { '@id': ORG_ID },
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        });
        break;
      case 'FAQPage':
        graph.push({
          '@type': 'FAQPage',
          '@id': `${canonical}#faq`,
          mainEntity: faqEntities(page.faq || []),
        });
        break;
      case 'Person':
        graph.push({
          '@type': 'Person',
          name: 'Muhammad Shakir',
          jobTitle: 'Founder & CEO',
          worksFor: { '@id': ORG_ID },
          sameAs: [
            'https://x.com/ShakirNova',
            'https://www.linkedin.com/in/muhammad-shakir-058466255/',
          ],
        });
        break;
      case 'ItemList':
        graph.push({
          '@type': 'ItemList',
          name: 'Blockchains supported by Nova Swap',
          itemListElement: SUPPORTED_CHAINS.map((name, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name,
          })),
        });
        break;
      case 'WebPage':
      case 'AboutPage':
      case 'ContactPage':
        graph.push({
          '@type': type,
          '@id': `${canonical}#webpage`,
          url: canonical,
          name: page.title,
          description: page.description,
          isPartOf: { '@type': 'WebSite', '@id': WEBSITE_ID, url: `${SITE_ORIGIN}/`, name: SITE_NAME },
        });
        if (type === 'AboutPage' && !(page.schema || []).includes('Organization')) {
          graph.push(organization());
        }
        break;
      default:
        break;
    }
  }

  if (page.breadcrumb && page.breadcrumb.length > 1) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: page.breadcrumb.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: abs(c.path),
      })),
    });
  }

  if (!graph.length) return '';
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
    .replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

/** Metadata for a request path, or null when the path has no entry. */
export function getPage(reqPath) {
  const p = normalizePath(reqPath);
  const key = ALIASES[p] || p;
  const page = PAGES[key];
  return page ? { path: key, page } : null;
}

/**
 * Head tags for a request path. Unknown paths get the homepage tags, matching
 * what the app already shows for them.
 */
export function renderSeoHead(reqPath, distDir) {
  const found = getPage(reqPath) || { path: '/', page: PAGES['/'] };
  const { path: pagePath, page } = found;
  const canonical = abs(pagePath);
  const robots = page.robots || 'index, follow';
  const og = ogImageUrl(page.og, distDir);

  const lines = [
    `<title>${esc(page.title)}</title>`,
  ];
  if (page.description) lines.push(`<meta name="description" content="${esc(page.description)}" />`);
  lines.push(
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta name="robots" content="${esc(robots)}" />`,
    '',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
  );
  if (page.description) lines.push(`<meta property="og:description" content="${esc(page.description)}" />`);
  lines.push(
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(og.url)}" />`,
  );
  if (og.large) {
    lines.push(
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
    );
  }
  lines.push(
    '',
    `<meta name="twitter:card" content="${og.large ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:site" content="${TWITTER_SITE}" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
  );
  if (page.description) lines.push(`<meta name="twitter:description" content="${esc(page.description)}" />`);
  lines.push(`<meta name="twitter:image" content="${esc(og.url)}" />`);

  if (robots === 'index, follow') {
    const schema = buildSchema(pagePath, page, canonical);
    if (schema) lines.push('', schema);
  }
  return lines.map((l) => (l ? `    ${l}` : '')).join('\n');
}
