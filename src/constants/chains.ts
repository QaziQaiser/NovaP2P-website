export interface ChainConfig {
  id: number;
  name: string;
  icon: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  1: {
    id: 1,
    name: 'Ethereum',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth.llamarpc.com', 'https://cloudflare-eth.com'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  137: {
    id: 137,
    name: 'Polygon',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  42161: {
    id: 42161,
    name: 'Arbitrum',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
  10: {
    id: 10,
    name: 'Optimism',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.optimism.io'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
  },
  8453: {
    id: 8453,
    name: 'Base',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
};

export const DEFAULT_CHAIN_ID = 1;

