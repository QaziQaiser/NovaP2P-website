// Shares the EVM wallet connected in the Market swap (LI.FI widget) with Limit mode.
//
// The LI.FI widget lets the app supply the factory that builds its EVM SDK provider. The factory below
// builds exactly what the widget builds by default (same deps, same options), and only keeps a reference
// to the widget's own `getWalletClient` / `switchChain`. The Market swap therefore behaves the same, and
// Limit mode signs with the very same wallet session (injected wallet or WalletConnect): no second
// connection, no second WalletConnect pairing, and no reconnect when switching tabs.
import { EthereumProvider as LifiEthereumSdkProvider } from '@lifi/sdk-provider-ethereum';
import type { Client } from 'viem';

export interface LifiEvmWalletDeps {
  getWalletClient: () => Promise<Client>;
  switchChain: (chainId: number) => Promise<Client | undefined>;
  disableMessageSigning?: boolean;
}

let deps: LifiEvmWalletDeps | null = null;

/** Used as `sdkProvider` in the widget's EthereumProvider config. Returns the default LI.FI provider. */
export function captureLifiEvmWallet(d: LifiEvmWalletDeps) {
  deps = d;
  return LifiEthereumSdkProvider({
    getWalletClient: d.getWalletClient,
    switchChain: d.switchChain,
    disableMessageSigning: d.disableMessageSigning,
  });
}

export const getLifiEvmWallet = (): LifiEvmWalletDeps | null => deps;
