import React, { useMemo, useEffect, useRef } from 'react';
import { LiFiWidget, WidgetConfig, widgetEvents, WidgetEvent } from '@lifi/widget';
import { EthereumProvider } from '@lifi/widget-provider-ethereum';

// Reown / WalletConnect Project ID (Verified working project ID)
const WALLET_CONNECT_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '5432e3507d41270bee46b7b85bbc2ef8';

interface LiFiSwapWidgetProps {
  onSwapSuccess?: (txData: any) => void;
  onWalletChange?: (walletAddress: string | null) => void;
}

export const LiFiSwapWidget: React.FC<LiFiSwapWidgetProps> = ({ onSwapSuccess, onWalletChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Comprehensive wallet detection to sync with parent rewards dashboard
  useEffect(() => {
    if (!onWalletChange) return;

    let isDisposed = false;
    let lastDetectedAddress: string | null = null;

    const scanForWalletAddress = async (): Promise<string | null> => {
      if (typeof window === 'undefined') return null;

      // 1. Check window.ethereum directly
      try {
        const eth = (window as any).ethereum;
        if (eth) {
          if (eth.selectedAddress && typeof eth.selectedAddress === 'string' && eth.selectedAddress.startsWith('0x')) {
            return eth.selectedAddress.toLowerCase();
          }
          if (Array.isArray(eth.accounts) && eth.accounts.length > 0 && typeof eth.accounts[0] === 'string') {
            return eth.accounts[0].toLowerCase();
          }
          if (Array.isArray(eth.providers)) {
            for (const p of eth.providers) {
              if (p?.selectedAddress && typeof p.selectedAddress === 'string') {
                return p.selectedAddress.toLowerCase();
              }
            }
          }
          const accs = await eth.request({ method: 'eth_accounts' });
          if (accs && Array.isArray(accs) && accs.length > 0 && typeof accs[0] === 'string') {
            return accs[0].toLowerCase();
          }
        }
      } catch {}

      // 2. Check other popular Web3 wallet extensions
      try {
        const altProviders = [
          (window as any).coinbaseWalletExtension,
          (window as any).okxwallet,
          (window as any).trustwallet?.ethereum,
          (window as any).phantom?.ethereum,
          (window as any).rabby,
          (window as any).binancew3w?.ethereum,
          (window as any).bitkeep?.ethereum,
        ];
        for (const p of altProviders) {
          if (p?.selectedAddress && typeof p.selectedAddress === 'string') {
            return p.selectedAddress.toLowerCase();
          }
          if (p?.request) {
            try {
              const accs = await p.request({ method: 'eth_accounts' });
              if (accs && accs.length > 0) return accs[0].toLowerCase();
            } catch {}
          }
        }
      } catch {}

      // 3. Check localStorage for Wagmi store (used internally by LI.FI Ethereum provider)
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('wagmi') || key.startsWith('wc@2:') || key.includes('walletconnect') || key.includes('lifi'))) {
            const val = localStorage.getItem(key);
            if (val && val.includes('0x')) {
              const match = val.match(/0x[a-fA-F0-9]{40}/);
              if (match) return match[0].toLowerCase();
            }
          }
        }
      } catch {}

      // 4. Check DOM inside LI.FI widget container
      try {
        if (containerRef.current) {
          const innerText = containerRef.current.innerText || '';
          const match = innerText.match(/0x[a-fA-F0-9]{40}/);
          if (match) return match[0].toLowerCase();

          const elements = containerRef.current.querySelectorAll('[title*="0x"], [aria-label*="0x"], [data-value*="0x"]');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const str = (el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('data-value') || '');
            const m = str.match(/0x[a-fA-F0-9]{40}/);
            if (m) return m[0].toLowerCase();
          }
        }
      } catch {}

      return null;
    };

    const triggerCheck = async () => {
      if (isDisposed) return;
      const detected = await scanForWalletAddress();
      if (detected !== lastDetectedAddress) {
        lastDetectedAddress = detected;
        onWalletChange(detected);
      }
    };

    // Run immediately
    triggerCheck();

    // Fast polling (400ms) to sync immediately upon wallet approval
    const pollTimer = setInterval(triggerCheck, 400);

    // Mutation observer on widget DOM
    let observer: MutationObserver | null = null;
    if (containerRef.current && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        triggerCheck();
      });
      observer.observe(containerRef.current, { childList: true, subtree: true, attributes: true });
    }

    // Storage event listener
    const handleStorage = () => triggerCheck();
    window.addEventListener('storage', handleStorage);

    // Ethers / window.ethereum accountsChanged
    if ((window as any).ethereum?.on) {
      (window as any).ethereum.on('accountsChanged', (accs: string[]) => {
        const addr = accs && accs.length > 0 ? accs[0].toLowerCase() : null;
        lastDetectedAddress = addr;
        onWalletChange(addr);
      });
    }

    return () => {
      isDisposed = true;
      clearInterval(pollTimer);
      if (observer) observer.disconnect();
      window.removeEventListener('storage', handleStorage);
    };
  }, [onWalletChange]);

  // Prevent internal widget routing/focus from causing the host webpage to scroll to top
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastInteractionTime = 0;
    let savedScrollY = window.scrollY;

    const isWidgetNode = (el: any): boolean => {
      if (!el || typeof el.closest !== 'function') return false;
      return !!(
        (containerRef.current && containerRef.current.contains(el)) ||
        el.closest?.('[id*="widget"]') ||
        el.closest?.('[data-testid*="widget"]') ||
        el.closest?.('.MuiModal-root') ||
        el.closest?.('.MuiPopover-root') ||
        el.closest?.('.MuiMenu-root')
      );
    };

    const handleInteraction = () => {
      lastInteractionTime = Date.now();
      if (window.scrollY > 150) {
        savedScrollY = window.scrollY;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('pointerdown', handleInteraction, { capture: true, passive: true });
      container.addEventListener('mousedown', handleInteraction, { capture: true, passive: true });
      container.addEventListener('touchstart', handleInteraction, { capture: true, passive: true });
      container.addEventListener('click', handleInteraction, { capture: true, passive: true });
      container.addEventListener('focusin', handleInteraction, { capture: true, passive: true });
      container.addEventListener('keydown', handleInteraction, { capture: true, passive: true });
    }

    const originalScrollTo = window.scrollTo;
    const originalScroll = window.scroll;
    const originalDocScrollTo = document.documentElement?.scrollTo;
    const originalBodyScrollTo = document.body?.scrollTo;

    const shouldBlockScroll = (args: any[]): boolean => {
      let targetY: number | undefined;
      if (typeof args[0] === 'object' && args[0] !== null) {
        targetY = args[0].top;
      } else if (typeof args[1] === 'number') {
        targetY = args[1];
      }

      // If the scroll target is not attempting to scroll back up to the top, allow normally
      if (targetY === undefined || targetY > 50) {
        return false;
      }

      // If the window is already at the very top, allow
      if (window.scrollY < 100) {
        return false;
      }

      // Detect calls originating from TanStack Router, LI.FI, or internal scroll-restoration
      try {
        const stack = new Error().stack || '';
        if (
          stack.includes('router-core') ||
          stack.includes('@tanstack') ||
          stack.includes('scroll-restoration') ||
          stack.includes('@lifi') ||
          stack.includes('lifi')
        ) {
          return true;
        }
      } catch {
        // ignore
      }

      // Block if the user recently clicked or touched something inside the widget
      if (Date.now() - lastInteractionTime < 3500) {
        return true;
      }

      // Block if focus is currently within the widget
      if (document.activeElement && isWidgetNode(document.activeElement)) {
        return true;
      }

      return false;
    };

    window.scrollTo = function (...args: any[]) {
      if (shouldBlockScroll(args)) {
        return;
      }
      return originalScrollTo.apply(this, args as any);
    };

    window.scroll = function (...args: any[]) {
      if (shouldBlockScroll(args)) {
        return;
      }
      return originalScroll.apply(this, args as any);
    };

    if (originalDocScrollTo) {
      document.documentElement.scrollTo = function (...args: any[]) {
        if (shouldBlockScroll(args)) {
          return;
        }
        return originalDocScrollTo.apply(this, args as any);
      };
    }

    if (originalBodyScrollTo) {
      document.body.scrollTo = function (...args: any[]) {
        if (shouldBlockScroll(args)) {
          return;
        }
        return originalBodyScrollTo.apply(this, args as any);
      };
    }

    // Intercept HTMLElement.prototype.focus to prevent browser focus-scroll jumps
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (options?: FocusOptions) {
      if (isWidgetNode(this) || Date.now() - lastInteractionTime < 3500) {
        return originalFocus.call(this, { ...options, preventScroll: true });
      }
      return originalFocus.call(this, options);
    };

    // Instant safety restoration in case any unhandled mechanism abruptly drops scroll to top
    const handleScroll = () => {
      const isRecent = Date.now() - lastInteractionTime < 2500;
      const isFocused = document.activeElement && isWidgetNode(document.activeElement);

      if ((isRecent || isFocused) && window.scrollY < 50 && savedScrollY > 150) {
        originalScrollTo.call(window, { top: savedScrollY, behavior: 'instant' });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.scrollTo = originalScrollTo;
      window.scroll = originalScroll;
      if (originalDocScrollTo) document.documentElement.scrollTo = originalDocScrollTo;
      if (originalBodyScrollTo) document.body.scrollTo = originalBodyScrollTo;
      HTMLElement.prototype.focus = originalFocus;
      window.removeEventListener('scroll', handleScroll);
      if (container) {
        container.removeEventListener('pointerdown', handleInteraction, { capture: true });
        container.removeEventListener('mousedown', handleInteraction, { capture: true });
        container.removeEventListener('touchstart', handleInteraction, { capture: true });
        container.removeEventListener('click', handleInteraction, { capture: true });
        container.removeEventListener('focusin', handleInteraction, { capture: true });
        container.removeEventListener('keydown', handleInteraction, { capture: true });
      }
    };
  }, []);

  // Listen to LI.FI swap completion events to capture and record verified transactions
  useEffect(() => {
    const handleRouteCompleted = (route: any) => {
      try {
        let txHash = '';
        if (route.steps) {
          for (const step of route.steps) {
            if (step.execution?.process) {
              for (const proc of step.execution.process) {
                if (proc.txHash) {
                  txHash = proc.txHash;
                  break;
                }
              }
            }
            if (txHash) break;
          }
        }

        const txData = {
          walletAddress: route.fromAddress,
          chainId: route.fromChainId,
          txHash,
          fromToken: route.fromToken,
          toToken: route.toToken,
          fromAmount: route.fromAmount,
          toAmount: route.toAmount,
          volumeUSD: route.fromAmountUSD ? parseFloat(route.fromAmountUSD) : 0,
          lifiRouteId: route.id,
          rawRouteData: route,
        };

        if (onSwapSuccess) {
          onSwapSuccess(txData);
        }
      } catch (err) {
        console.error('Error handling completed LI.FI swap:', err);
      }
    };

    widgetEvents.on(WidgetEvent.RouteExecutionCompleted, handleRouteCompleted);

    return () => {
      widgetEvents.off(WidgetEvent.RouteExecutionCompleted, handleRouteCompleted);
    };
  }, [onSwapSuccess]);
  // Verified registered integration-string on portal.li.fi is 'nova-p2p'
  const partnerName = import.meta.env.VITE_VELORA_PARTNER || 'nova-p2p';
  const lifiApiKey = import.meta.env.VITE_LIFI_API_KEY;
  // 1.5% Fee (0.015) active and routed to user's Default EVM wallet on portal.li.fi
  const lifiFee = import.meta.env.VITE_LIFI_FEE ? parseFloat(import.meta.env.VITE_LIFI_FEE) : 0.015;

  const widgetConfig: WidgetConfig = useMemo(
    () => ({
      integrator: partnerName,
      apiKey: lifiApiKey || undefined,
      // Wide layout variant as requested
      variant: 'wide',
      subvariant: 'default',
      appearance: 'light',

      // Internal wallet management forces LI.FI to run its full native modal logic
      // for injected wallets, WalletConnect QR code modal, and Coinbase Wallet
      walletConfig: {
        forceInternalWalletManagement: true,
      },

      // Official LI.FI Ethereum Provider configuration
      providers: [
        EthereumProvider({
          walletConnect: {
            projectId: WALLET_CONNECT_PROJECT_ID,
            showQrModal: true,
            qrModalOptions: {
              themeMode: 'light',
              themeVariables: {
                '--wcm-z-index': '99999',
              },
            },
            metadata: {
              name: 'NovaP2P',
              description: 'NovaP2P Decentralized Exchange',
              url: typeof window !== 'undefined' ? window.location.origin : 'https://novap2p.com',
              icons: ['https://novap2p.com/favicon-96x96.png'],
            },
          },
          coinbase: {
            appName: 'NovaP2P',
            appLogoUrl: 'https://novap2p.com/favicon-96x96.png',
          },
          metaMask: {
            dappMetadata: {
              name: 'NovaP2P',
              url: typeof window !== 'undefined' ? window.location.origin : 'https://novap2p.com',
              iconUrl: 'https://novap2p.com/favicon-96x96.png',
            },
          },
        }),
      ],

      // Supported Networks:
      // Ethereum (1), BNB Smart Chain (56), Polygon (137), Arbitrum (42161), Optimism (10), Base (8453)
      chains: {
        allow: [1, 56, 137, 42161, 10, 8453],
      },

      // Preloaded popular tokens for instant discovery and selection on all enabled chains
      // All additional tokens are fetched dynamically from LI.FI API
      tokens: {
        popular: [
          // Ethereum Mainnet (1)
          {
            chainId: 1,
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            symbol: 'USDT',
            decimals: 6,
            name: 'Tether USD',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
          },
          {
            chainId: 1,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            symbol: 'USDC',
            decimals: 6,
            name: 'USD Coin',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
          },
          {
            chainId: 1,
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'ETH',
            decimals: 18,
            name: 'Ether',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
          },
          // BNB Smart Chain (56)
          {
            chainId: 56,
            address: '0x55d398326f99059fF775485246999027B3197955',
            symbol: 'USDT',
            decimals: 18,
            name: 'Tether USD',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
          },
          {
            chainId: 56,
            address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            symbol: 'USDC',
            decimals: 18,
            name: 'Binance-Peg USD Coin',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
          },
          {
            chainId: 56,
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'BNB',
            decimals: 18,
            name: 'BNB',
            logoURI:
              'https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png?1547034615',
          },
          // Polygon (137)
          {
            chainId: 137,
            address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            symbol: 'USDT',
            decimals: 6,
            name: 'Tether USD',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
          },
          {
            chainId: 137,
            address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            symbol: 'USDC',
            decimals: 6,
            name: 'USD Coin',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
          },
          {
            chainId: 137,
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'POL',
            decimals: 18,
            name: 'Polygon Ecosystem Token',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
          },
          // Arbitrum (42161)
          {
            chainId: 42161,
            address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            symbol: 'USDT',
            decimals: 6,
            name: 'Tether USD',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
          },
          {
            chainId: 42161,
            address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            symbol: 'USDC',
            decimals: 6,
            name: 'USD Coin',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
          },
          {
            chainId: 42161,
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'ETH',
            decimals: 18,
            name: 'Ether',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
          },
          {
            chainId: 42161,
            address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
            symbol: 'ARB',
            decimals: 18,
            name: 'Arbitrum',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png',
          },
          // Optimism (10)
          {
            chainId: 10,
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            symbol: 'USDT',
            decimals: 6,
            name: 'Tether USD',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
          },
          {
            chainId: 10,
            address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            symbol: 'USDC',
            decimals: 6,
            name: 'USD Coin',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
          },
          {
            chainId: 10,
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'ETH',
            decimals: 18,
            name: 'Ether',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
          },
          // Base (8453)
          {
            chainId: 8453,
            address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            symbol: 'USDC',
            decimals: 6,
            name: 'USD Coin',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
          },
          {
            chainId: 8453,
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'ETH',
            decimals: 18,
            name: 'Ether',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
          },
        ],
      },

      // Default Chains and Tokens (USDC to USDT on Ethereum)
      fromChain: 1, // Ethereum
      fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      toChain: 1, // Ethereum
      toToken: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      // No initial fromAmount so it stays in the clean single exchange card by default.
      // When the user enters an amount, the wide variant automatically opens the routes card.

      // Fee & Commission configuration (1.50% directed to user's partner account 0x9b708d93d1230DA9957F71D07beC6F9a1EE31C12)
      // Fully active and verified on portal.li.fi under integrator 'nova-p2p'
      feeConfig: {
        fee: lifiFee,
        name: 'NovaP2P Fee',
        showFeePercentage: true,
      },

      // Custom theme matching NovaP2P branding
      theme: {
        palette: {
          primary: { main: '#4F7DF3' },
          secondary: { main: '#ff5500' },
        },
        shape: {
          borderRadius: 20,
          borderRadiusSecondary: 16,
        },
        typography: {
          fontFamily: 'Inter, sans-serif',
        },
        container: {
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          '@media (max-width: 640px)': {
            borderRadius: '18px',
            minWidth: '0 !important',
            maxWidth: '100% !important',
            width: '100% !important',
          },
        },
      },
    }),
    [partnerName]
  );

  return (
    <div ref={containerRef} className="w-full max-w-4xl mx-auto flex justify-center items-center px-0">
      <style>{`
        /* LiFi Swap Widget Mobile Responsiveness */
        #widget-app-expanded-container,
        div[id^="widget-app-expanded-container"] {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          display: flex !important;
          justify-content: center !important;
        }

        #widget-relative-container,
        div[id^="widget-relative-container"] {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          margin: 0 auto !important;
        }

        #widget-scrollable-container,
        div[id^="widget-scrollable-container"] {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        @media (max-width: 640px) {
          #widget-relative-container,
          div[id^="widget-relative-container"] {
            border-radius: 18px !important;
            max-width: 100% !important;
            min-width: 0 !important;
            width: 100% !important;
          }

          /* Compact PageContainer padding on mobile so content never overflows */
          div[id^="widget-relative-container"] .MuiContainer-root,
          div[id^="widget-scrollable-container"] > div {
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          /* Scale SelectTokenButton header and text on mobile screens */
          div[id^="widget-relative-container"] [class*="MuiCardHeader-root"] {
            padding: 8px 6px !important;
          }

          div[id^="widget-relative-container"] [class*="MuiCardHeader-title"] {
            width: auto !important;
            max-width: 65px !important;
            min-width: 0 !important;
            font-size: 14px !important;
          }

          div[id^="widget-relative-container"] [class*="MuiCardHeader-subheader"] {
            width: auto !important;
            max-width: 65px !important;
            min-width: 0 !important;
            font-size: 11px !important;
          }

          div[id^="widget-relative-container"] [class*="MuiCardContent-root"] {
            padding: 6px 4px !important;
          }

          div[id^="widget-relative-container"] [data-testid="widget-reverse-tokens-button"] {
            width: 28px !important;
            height: 28px !important;
            min-width: 28px !important;
          }
        }
      `}</style>
      <div className="w-full max-w-full flex justify-center items-center">
        <LiFiWidget config={widgetConfig} integrator={partnerName} />
      </div>
    </div>
  );
};
