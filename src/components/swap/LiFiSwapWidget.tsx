import React, { useMemo, useEffect, useRef } from 'react';
import { LiFiWidget, WidgetConfig, widgetEvents, WidgetEvent, ChainType } from '@lifi/widget';
import { EthereumProvider } from '@lifi/widget-provider-ethereum';
import { SolanaProvider } from '@lifi/widget-provider-solana';
import { SuiProvider } from '@lifi/widget-provider-sui';
import { TronProvider } from '@lifi/widget-provider-tron';
import { ChainNetwork } from '@tronweb3/tronwallet-abstract-adapter';
import {
  WALLET_CONNECT_PROJECT_ID,
  APPKIT_METADATA,
  FEATURED_WALLET_IDS,
  getAppKit,
} from '../../config/appkit';

interface LiFiSwapWidgetProps {
  onSwapSuccess?: (txData: any) => void;
  onWalletChange?: (walletAddress: string | null) => void;
}

export const LiFiSwapWidget: React.FC<LiFiSwapWidgetProps> = ({ onSwapSuccess, onWalletChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Prevent programmatic scroll-to-top triggered by LI.FI internal navigation or input focus
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastInteractionTime = 0;

    const onWidgetPointer = () => {
      lastInteractionTime = Date.now();
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('pointerdown', onWidgetPointer, { passive: true });
      container.addEventListener('mousedown', onWidgetPointer, { passive: true });
      container.addEventListener('touchstart', onWidgetPointer, { passive: true });
      container.addEventListener('focusin', onWidgetPointer, { passive: true });

      // Prevent empty anchor clicks (#) from jumping to top of page
      const handleAnchorClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const anchor = target?.closest('a');
        if (anchor) {
          const href = anchor.getAttribute('href');
          if (!href || href === '#' || href === 'javascript:void(0)') {
            e.preventDefault();
          }
        }
      };
      container.addEventListener('click', handleAnchorClick, { capture: true });
    }

    const isWidgetAction = (): boolean => {
      if (!containerRef.current) return false;
      const active = document.activeElement;
      if (active && containerRef.current.contains(active)) return true;
      if (Date.now() - lastInteractionTime < 1200) return true;
      const stack = new Error().stack || '';
      return (
        stack.includes('@lifi') ||
        stack.includes('lifi') ||
        stack.includes('Virtualized') ||
        stack.includes('useVirtualizer') ||
        stack.includes('TokenList') ||
        stack.includes('ChainList')
      );
    };

    // Intercept programmatic window.scrollTo calls to top (<= 10) during widget interactions
    const originalScrollTo = window.scrollTo;
    window.scrollTo = function (...args: any[]) {
      const first = args[0];
      let targetTop: number | undefined;
      if (typeof first === 'object' && first !== null) {
        targetTop = first.top;
      } else if (typeof args[1] === 'number') {
        targetTop = args[1];
      }

      if (typeof targetTop === 'number' && targetTop <= 10 && isWidgetAction()) {
        return; // Suppress programmatic scroll-to-top from widget navigation/focus
      }
      return originalScrollTo.apply(window, args as any);
    };

    // Intercept programmatic window.scroll calls to top (<= 10) during widget interactions
    const originalScroll = window.scroll;
    window.scroll = function (...args: any[]) {
      const first = args[0];
      let targetTop: number | undefined;
      if (typeof first === 'object' && first !== null) {
        targetTop = first.top;
      } else if (typeof args[1] === 'number') {
        targetTop = args[1];
      }

      if (typeof targetTop === 'number' && targetTop <= 10 && isWidgetAction()) {
        return;
      }
      return originalScroll.apply(window, args as any);
    };

    // Intercept HTMLElement.prototype.focus to prevent browser auto-scroll on inputs inside widget
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (options?: FocusOptions) {
      if (containerRef.current && containerRef.current.contains(this)) {
        return originalFocus.call(this, { ...options, preventScroll: true });
      }
      return originalFocus.call(this, options);
    };

    // Guard Element.prototype.scrollIntoView inside widget so it never scrolls the main window
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (arg?: boolean | ScrollIntoViewOptions) {
      if (containerRef.current && containerRef.current.contains(this)) {
        const internalScroll = this.closest('#widget-scrollable-container') || this.parentElement;
        if (internalScroll && internalScroll !== document.body && internalScroll !== document.documentElement) {
          return originalScrollIntoView.call(this, arg);
        }
        return;
      }
      return originalScrollIntoView.call(this, arg);
    };

    return () => {
      window.scrollTo = originalScrollTo;
      window.scroll = originalScroll;
      HTMLElement.prototype.focus = originalFocus;
      Element.prototype.scrollIntoView = originalScrollIntoView;
    };
  }, []);

  // Comprehensive multi-chain wallet detection to sync with parent rewards dashboard
  useEffect(() => {
    if (!onWalletChange) return;

    let isDisposed = false;
    let lastDetectedAddress: string | null = null;

    const scanForWalletAddress = async (): Promise<string | null> => {
      if (typeof window === 'undefined') return null;

      // 1. Check AppKit instance
      try {
        const kit = getAppKit();
        if (kit) {
          const addr = kit.getAddress();
          if (addr && typeof addr === 'string') return addr.toLowerCase();
        }
      } catch {}

      // 2. Check window.ethereum directly (EVM)
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

      // 2. Check Solana wallets (Phantom, Solflare)
      try {
        const sol = (window as any).phantom?.solana || (window as any).solana;
        if (sol?.isConnected && sol.publicKey) {
          return sol.publicKey.toString();
        }
      } catch {}

      // 3. Check Tron wallets (TronLink)
      try {
        const tron = (window as any).tronWeb;
        if (tron?.defaultAddress?.base58) {
          return tron.defaultAddress.base58;
        }
      } catch {}

      // 4. Check other popular Web3 wallet extensions
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

      // 5. Check localStorage for Wagmi store or wallet connectors
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('wagmi') || key.startsWith('wc@2:') || key.includes('walletconnect') || key.includes('lifi') || key.includes('solana'))) {
            const val = localStorage.getItem(key);
            if (val) {
              const ethMatch = val.match(/0x[a-fA-F0-9]{40}/);
              if (ethMatch) return ethMatch[0].toLowerCase();
            }
          }
        }
      } catch {}

      // 6. Check DOM inside LI.FI widget container
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

  // Listen to LI.FI swap completion events to capture and record verified transactions
  useEffect(() => {
    const handleRouteCompleted = (route: any) => {
      try {
        let txHash = '';
        if (route.steps && Array.isArray(route.steps)) {
          for (const step of route.steps) {
            // 1. LI.FI Widget v4 execution actions
            if (step.execution?.actions && Array.isArray(step.execution.actions)) {
              for (const action of step.execution.actions) {
                if (action.txHash) {
                  txHash = action.txHash;
                  break;
                }
                if (action.taskId) {
                  txHash = action.taskId;
                  break;
                }
              }
            }
            // 2. LI.FI Widget v3 process fallback
            if (!txHash && step.execution?.process && Array.isArray(step.execution.process)) {
              for (const proc of step.execution.process) {
                if (proc.txHash) {
                  txHash = proc.txHash;
                  break;
                }
              }
            }
            // 3. Step execution txHash
            if (!txHash && step.execution?.txHash) {
              txHash = step.execution.txHash;
            }
            if (!txHash && (step as any).transactionHash) {
              txHash = (step as any).transactionHash;
            }
            if (txHash) break;
          }
        }

        // Fallback to route-level properties
        if (!txHash) {
          txHash = route.txHash || (route as any).transactionHash || (route.id ? `route_${route.id}` : `tx_${Date.now()}`);
        }

        const rawVol =
          route.fromAmountUSD ||
          route.toAmountUSD ||
          route.steps?.[0]?.fromAmountUSD ||
          route.steps?.[0]?.estimate?.fromAmountUSD ||
          route.steps?.[0]?.action?.fromAmountUSD;

        const volumeUSD = rawVol ? parseFloat(String(rawVol)) : 0;

        const txData = {
          walletAddress: route.fromAddress || route.steps?.[0]?.action?.fromAddress,
          chainId: route.fromChainId || route.steps?.[0]?.action?.fromChainId || 1,
          txHash,
          fromToken: route.fromToken || route.steps?.[0]?.action?.fromToken,
          toToken: route.toToken || route.steps?.[0]?.action?.toToken,
          fromAmount: route.fromAmount || route.steps?.[0]?.action?.fromAmount,
          toAmount: route.toAmount || route.steps?.[0]?.action?.toAmount,
          volumeUSD,
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

    const handleRouteUpdated = (update: any) => {
      try {
        const route = update?.route || update;
        if (route) {
          const isDone =
            route.steps?.every((s: any) => s.execution?.status === 'DONE') ||
            update?.action?.status === 'DONE';
          if (isDone) {
            handleRouteCompleted(route);
          }
        }
      } catch {}
    };

    widgetEvents.on(WidgetEvent.RouteExecutionCompleted, handleRouteCompleted);
    widgetEvents.on(WidgetEvent.RouteExecutionUpdated, handleRouteUpdated);

    return () => {
      widgetEvents.off(WidgetEvent.RouteExecutionCompleted, handleRouteCompleted);
      widgetEvents.off(WidgetEvent.RouteExecutionUpdated, handleRouteUpdated);
    };
  }, [onSwapSuccess]);

  // Synchronize CSS variable --widget-card-height with left main swap card ("sath k braber")
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isDisposed = false;

    const syncCardHeight = () => {
      if (isDisposed) return;
      const container = containerRef.current;
      if (!container) return;

      const leftCard = (container.querySelector('#widget-relative-container') ||
        container.querySelector('div[id^="widget-relative-container"]')) as HTMLElement | null;

      if (!leftCard) return;

      const leftHeight = leftCard.offsetHeight;
      if (leftHeight && leftHeight > 100) {
        container.style.setProperty('--widget-card-height', `${leftHeight}px`);
      }
    };

    syncCardHeight();

    let ro: ResizeObserver | null = null;
    const leftCard = containerRef.current?.querySelector('#widget-relative-container') ||
      containerRef.current?.querySelector('div[id^="widget-relative-container"]');

    if (leftCard && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => syncCardHeight());
      ro.observe(leftCard);
    }

    return () => {
      isDisposed = true;
      if (ro) ro.disconnect();
    };
  }, []);
  // Verified registered integration-string on portal.li.fi is 'nova-p2p'
  const partnerName = import.meta.env.VITE_VELORA_PARTNER || 'nova-p2p';
  const lifiApiKey = import.meta.env.VITE_LIFI_API_KEY;
  // 0.5% Fee (0.005) active and routed to user's Default EVM wallet on portal.li.fi
  const lifiFee = import.meta.env.VITE_LIFI_FEE ? parseFloat(import.meta.env.VITE_LIFI_FEE) : 0.005;

  const widgetConfig: WidgetConfig = useMemo(
    () => ({
      integrator: partnerName,
      apiKey: lifiApiKey || undefined,
      // Wide layout variant as requested
      variant: 'wide',
      subvariant: 'default',
      appearance: 'light',
      buildUrl: false,

      // Internal wallet management forces LI.FI to run its full native modal logic
      // for injected wallets, WalletConnect QR code modal, and Coinbase Wallet
      walletConfig: {
        forceInternalWalletManagement: true,
      },

      // Multi-Chain Provider configuration: EVM (Ethereum, Arbitrum, Base, Polygon, etc.), Solana (SVM), Sui (MVM), TRON (TVM)
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
              explorerRecommendedWalletIds: FEATURED_WALLET_IDS,
              featuredWalletIds: FEATURED_WALLET_IDS,
              mobileWallets: [
                {
                  id: 'trust',
                  name: 'Trust Wallet',
                  links: {
                    native: 'trust://',
                    universal: 'https://link.trustwallet.com',
                  },
                },
                {
                  id: 'metamask',
                  name: 'MetaMask',
                  links: {
                    native: 'metamask://',
                    universal: 'https://metamask.app.link',
                  },
                },
                {
                  id: 'coinbase',
                  name: 'Coinbase Wallet',
                  links: {
                    native: 'cbwallet://',
                    universal: 'https://go.cb-w.com',
                  },
                },
                {
                  id: 'phantom',
                  name: 'Phantom',
                  links: {
                    native: 'phantom://',
                    universal: 'https://phantom.app',
                  },
                },
              ],
            } as any,
            metadata: APPKIT_METADATA,
          },
          coinbase: {
            appName: 'Nova P2P',
            appLogoUrl: 'https://novap2p.com/favicon-96x96.png',
          },
          metaMask: {
            dappMetadata: {
              name: 'Nova P2P',
              url: 'https://novap2p.com',
              iconUrl: 'https://novap2p.com/favicon-96x96.png',
            },
          },
        }),
        SolanaProvider(),
        SuiProvider(),
        TronProvider({
          walletConnect: {
            network: ChainNetwork.Mainnet,
            options: {
              projectId: WALLET_CONNECT_PROJECT_ID,
              metadata: APPKIT_METADATA,
            },
          },
        }),
      ],

      // Universal Multi-Chain Coverage: Enables dynamic discovery and routing across
      // EVM (Polygon, Avalanche, Arbitrum, Base, BSC, Optimism, Ethereum, Fantom, etc.),
      // SVM (Solana), TVM (TRON), and MVM (Sui)
      chains: {
        types: {
          allow: [ChainType.EVM, ChainType.SVM, ChainType.TVM, ChainType.MVM],
        },
      },

      // Preloaded popular tokens for instant discovery and selection across all supported ecosystems
      // All additional tokens are fetched dynamically in real-time from LI.FI API
      tokens: {
        popular: [
          // Solana (1151111081099710)
          {
            chainId: 1151111081099710,
            address: '11111111111111111111111111111111',
            symbol: 'SOL',
            decimals: 9,
            name: 'Solana',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
          },
          {
            chainId: 1151111081099710,
            address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            symbol: 'USDC',
            decimals: 6,
            name: 'USD Coin',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
          },
          {
            chainId: 1151111081099710,
            address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
            symbol: 'USDT',
            decimals: 6,
            name: 'Tether USD',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
          },

          // TRON (728126428)
          {
            chainId: 728126428,
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'TRX',
            decimals: 6,
            name: 'TRON',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/tron/info/logo.png',
          },
          {
            chainId: 728126428,
            address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            symbol: 'USDT',
            decimals: 6,
            name: 'Tether USD',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
          },

          // Sui (9270000000000000)
          {
            chainId: 9270000000000000,
            address: '0x2::sui::SUI',
            symbol: 'SUI',
            decimals: 9,
            name: 'Sui',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/sui/info/logo.png',
          },

          // Polygon (137)
          {
            chainId: 137,
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'POL',
            decimals: 18,
            name: 'Polygon Ecosystem Token',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
          },
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

          // Avalanche (43114)
          {
            chainId: 43114,
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'AVAX',
            decimals: 18,
            name: 'Avalanche',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanche/info/logo.png',
          },
          {
            chainId: 43114,
            address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
            symbol: 'USDT',
            decimals: 6,
            name: 'Tether USD',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
          },
          {
            chainId: 43114,
            address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
            symbol: 'USDC',
            decimals: 6,
            name: 'USD Coin',
            logoURI:
              'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
          },
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

      // Fee & Commission configuration (0.50% directed to user's partner account 0x9b708d93d1230DA9957F71D07beC6F9a1EE31C12)
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
        routesContainer: {
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          borderRadius: '24px',
          width: '436px',
          maxWidth: '436px',
          height: 'var(--widget-card-height, 530px)',
          maxHeight: 'var(--widget-card-height, 530px)',
          boxSizing: 'border-box',
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

        /* Equalize width (436px) and height on desktop so both cards are perfectly level ("hight width braber") */
        @media (min-width: 641px) {
          #widget-relative-container,
          div[id^="widget-relative-container"] {
            width: 436px !important;
            max-width: 436px !important;
          }

          /* Expansion Container (Right Column) */
          #widget-app-expanded-container > div:nth-child(2),
          div[id^="widget-app-expanded-container"] > div:nth-child(2) {
            height: var(--widget-card-height, 530px);
            max-height: var(--widget-card-height, 530px);
          }

          /* Route list card matches height and scrolls internally without overflowing */
          #widget-app-expanded-container > div:nth-child(2) .MuiScopedCssBaseline-root,
          div[id^="widget-app-expanded-container"] > div:nth-child(2) .MuiScopedCssBaseline-root {
            height: var(--widget-card-height, 530px) !important;
            max-height: var(--widget-card-height, 530px) !important;
            box-sizing: border-box !important;
          }
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
