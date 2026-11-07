import { createAppKit, AppKit } from '@reown/appkit';
import {
  mainnet,
  bsc,
  polygon,
  arbitrum,
  optimism,
  base,
  avalanche,
  solana,
  tron,
} from '@reown/appkit/networks';

/**
 * Reown / WalletConnect Project ID for Nova P2P
 */
export const WALLET_CONNECT_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'eea4a502863666d6408ffd0969ad7456';

/**
 * DApp Metadata configuration for WalletConnect AppKit & Web3Modal
 */
export const APPKIT_METADATA = {
  name: 'Nova P2P',
  description: 'Nova P2P Universal Cross-Chain DEX',
  url: 'https://novap2p.com',
  icons: ['https://novap2p.com/favicon-96x96.png'],
};

/**
 * Featured Wallet IDs:
 * 1. Trust Wallet: Official WalletConnect asset ID '4622a2b78d6b63f4b1559140f7a59a82cbb5b72855e3b1b4b1666dd150244799'
 * 2. MetaMask: 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96'
 * 3. Coinbase Wallet: 'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa'
 * 4. Phantom: 'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393'
 */
export const FEATURED_WALLET_IDS = [
  '4622a2b78d6b63f4b1559140f7a59a82cbb5b72855e3b1b4b1666dd150244799', // Trust Wallet
  'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
  'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
  'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393', // Phantom
];

let appKitInstance: AppKit | null = null;

/**
 * Returns the singleton AppKit instance with multi-chain support (EVM + Non-EVM Solana & TRON)
 */
export const getAppKit = (): AppKit | null => {
  if (typeof window === 'undefined') return null;

  if (!appKitInstance) {
    try {
      appKitInstance = createAppKit({
        adapters: [],
        networks: [mainnet, bsc, polygon, arbitrum, optimism, base, avalanche, solana, tron],
        defaultNetwork: mainnet,
        projectId: WALLET_CONNECT_PROJECT_ID,
        metadata: APPKIT_METADATA,
        featuredWalletIds: FEATURED_WALLET_IDS,
        enableEIP6963: true,
        enableInjected: true,
        enableCoinbase: true,
        enableWalletConnect: true,
        allWallets: 'SHOW',
        themeMode: 'light',
        themeVariables: {
          '--w3m-color-mix': '#4F7DF3',
          '--w3m-color-mix-strength': 15,
          '--w3m-accent': '#4F7DF3',
          '--w3m-border-radius-master': '16px',
          '--w3m-z-index': 99999,
        },
      });
    } catch (err) {
      console.warn('Failed to initialize Reown AppKit:', err);
    }
  }

  return appKitInstance;
};

/**
 * Programmatically open the AppKit connection modal
 */
export const openAppKitModal = async (view?: 'Connect' | 'Account' | 'Networks' | 'WhatIsAWallet') => {
  const kit = getAppKit();
  if (kit) {
    try {
      await kit.open(view ? { view } : undefined);
    } catch (err) {
      console.error('Error opening AppKit modal:', err);
    }
  }
};
