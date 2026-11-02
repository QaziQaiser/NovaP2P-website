export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  chainId: number;
  logoURI: string;
}

// Native ETH sentinel address used in ParaSwap / DEX aggregators
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const POPULAR_TOKENS: Record<number, Token[]> = {
  1: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId: 1,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      chainId: 1,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      address: NATIVE_TOKEN_ADDRESS,
      chainId: 1,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      chainId: 1,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      decimals: 8,
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      chainId: 1,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
    },
  ],
  137: [
    {
      symbol: 'USDC',
      name: 'USD Coin (PoS)',
      decimals: 6,
      address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      chainId: 137,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174/logo.png',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      chainId: 137,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0xc2132D05D31c914a87C6611C10748AEb04B58e8F/logo.png',
    },
  ],
  42161: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      chainId: 42161,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0xaf88d065e77c8cC2239327C5EDb3A432268e5831/logo.png',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      chainId: 42161,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9/logo.png',
    },
  ],
};

export const DEFAULT_PAY_TOKEN = POPULAR_TOKENS[1][0]; // USDC
export const DEFAULT_RECEIVE_TOKEN = POPULAR_TOKENS[1][1]; // USDT

