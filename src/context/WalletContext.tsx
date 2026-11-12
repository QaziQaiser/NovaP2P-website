import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { BrowserProvider, JsonRpcSigner, Contract, formatUnits, parseUnits, MaxUint256 } from 'ethers';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from '../constants/chains';
import { NATIVE_TOKEN_ADDRESS } from '../constants/tokens';
import { getAppKit, openAppKitModal } from '../config/appkit';

// Minimal ERC20 ABI for balance and approval
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

interface WalletContextType {
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  syncExternalWallet: (address: string | null) => void;
  switchNetwork: (targetChainId: number) => Promise<void>;
  getTokenBalance: (tokenAddress: string, decimals: number) => Promise<string>;
  checkAllowance: (tokenAddress: string, spender: string) => Promise<bigint>;
  approveToken: (tokenAddress: string, spender: string, amount?: bigint) => Promise<boolean>;
  signMessage: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [externalWallet, setExternalWallet] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);

  const normalizeDisplayAddress = useCallback((addr: string) => {
    return addr.startsWith('0x') ? addr.toLowerCase() : addr;
  }, []);

  const syncExternalWallet = useCallback(
    (address: string | null) => {
      setExternalWallet(address ? normalizeDisplayAddress(address) : null);
    },
    [normalizeDisplayAddress]
  );

  const activeAccount = account || externalWallet;

  // Track dynamically announced EIP-6963 providers (fast mobile in-app browser & extension detection)
  const [announcedProvider, setAnnouncedProvider] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAnnounceProvider = (event: any) => {
      const detail = event?.detail;
      if (detail?.provider) {
        setAnnouncedProvider((prev: any) => prev || detail.provider);
      }
    };
    window.addEventListener('eip6963:announceProvider', onAnnounceProvider);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', onAnnounceProvider);
  }, []);

  // Initialize provider if window.ethereum or an EIP-6963 provider exists
  const getEthereumObject = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return announcedProvider;
  }, [announcedProvider]);

  const handleAccountsChanged = useCallback(async (accounts: string[]) => {
    if (accounts.length === 0) {
      setAccount(null);
      setSigner(null);
    } else {
      setAccount(accounts[0]);
      const eth = getEthereumObject();
      if (eth) {
        const bp = new BrowserProvider(eth);
        setProvider(bp);
        const s = await bp.getSigner();
        setSigner(s);
      }
    }
  }, []);

  const handleChainChanged = useCallback((chainIdHex: string) => {
    const numericChainId = parseInt(chainIdHex, 16);
    setChainId(numericChainId);
  }, []);

  // Check initial connection and continuously monitor wallet changes
  useEffect(() => {
    const eth = getEthereumObject();
    if (!eth) return;

    const checkConnection = async () => {
      try {
        const accounts = await eth.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          if (!account || accounts[0].toLowerCase() !== account.toLowerCase()) {
            setAccount(accounts[0]);
            const bp = new BrowserProvider(eth);
            setProvider(bp);
            const s = await bp.getSigner();
            setSigner(s);
            const network = await bp.getNetwork();
            setChainId(Number(network.chainId));
          }
        } else if (account && (!accounts || accounts.length === 0)) {
          setAccount(null);
          setSigner(null);
        }
      } catch (err: any) {
        console.error('Error checking wallet connection:', err);
      }
    };

    // Run initial check
    checkConnection();

    // Poll periodically to catch connections made inside external widgets/modals
    const pollInterval = setInterval(checkConnection, 1200);

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      clearInterval(pollInterval);
      if (eth.removeListener) {
        eth.removeListener('accountsChanged', handleAccountsChanged);
        eth.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [account, handleAccountsChanged, handleChainChanged]);

  // Sync wallet state when connected via WalletConnect AppKit / Web3Modal
  // Includes mobile foreground resume sync (visibilitychange/focus/pageshow) and fallback poll
  useEffect(() => {
    const kit = getAppKit();
    if (!kit) return;

    const applyAppKitAddress = (addr?: string | null) => {
      if (!addr) return;
      const normalized = normalizeDisplayAddress(addr);
      setAccount((prev) => (prev === normalized ? prev : normalized));
      setIsConnecting(false);
      const eth = getEthereumObject();
      if (eth) {
        const bp = new BrowserProvider(eth);
        setProvider(bp);
        bp.getSigner().then(setSigner).catch(() => {});
      }
    };

    const syncAppKitNow = () => {
      try {
        const addr =
          kit.getAddress?.('eip155') ||
          kit.getAddress?.('solana') ||
          kit.getAddress?.();
        if (addr) {
          applyAppKitAddress(addr);
        } else if (kit.getIsConnectedState?.() === false) {
          setExternalWallet(null);
          if (!getEthereumObject()) {
            setAccount(null);
            setSigner(null);
          }
        }
      } catch {
        // Ignore transient initialization errors
      }
    };

    // Run immediately on mount
    syncAppKitNow();

    let unsubscribeAccount: (() => void) | undefined;
    let unsubscribeState: (() => void) | undefined;

    try {
      unsubscribeAccount = kit.subscribeAccount((state) => {
        if (state?.address) {
          applyAppKitAddress(state.address);
        } else if (state?.isConnected === false) {
          setExternalWallet(null);
          if (!getEthereumObject()) {
            setAccount(null);
            setSigner(null);
          }
        }
      });

      if (typeof kit.subscribeState === 'function') {
        unsubscribeState = kit.subscribeState((modalState: any) => {
          if (modalState?.open === false) {
            setIsConnecting(false);
            syncAppKitNow();
          }
        });
      }
    } catch (err) {
      console.warn('AppKit account subscription error:', err);
    }

    // Mobile wallet deep-link returns often restore browser tab visibility without firing immediate WS events
    const onResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      syncAppKitNow();
      setTimeout(syncAppKitNow, 350);
    };

    window.addEventListener('focus', onResume);
    window.addEventListener('pageshow', onResume);
    document.addEventListener('visibilitychange', onResume);

    // Lightweight fallback poll for mobile WalletConnect relay completion
    const pollAppKit = setInterval(() => {
      syncAppKitNow();
    }, 1200);

    return () => {
      clearInterval(pollAppKit);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('pageshow', onResume);
      document.removeEventListener('visibilitychange', onResume);
      if (typeof unsubscribeAccount === 'function') unsubscribeAccount();
      if (typeof unsubscribeState === 'function') unsubscribeState();
    };
  }, [normalizeDisplayAddress, getEthereumObject]);

  const connectWallet = async () => {
    const eth = getEthereumObject();
    if (eth) {
      try {
        setIsConnecting(true);
        const accounts = await eth.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          const bp = new BrowserProvider(eth);
          const s = await bp.getSigner();
          const network = await bp.getNetwork();

          setAccount(accounts[0]);
          setProvider(bp);
          setSigner(s);
          setChainId(Number(network.chainId));
          return;
        }
      } catch (err: any) {
        console.warn('Direct ethereum request canceled or failed, falling back to AppKit modal:', err);
      } finally {
        setIsConnecting(false);
      }
    }

    // Modern mobile & multi-chain WalletConnect AppKit modal (Trust Wallet, MetaMask, Coinbase, Phantom, Solana, TRON)
    try {
      setIsConnecting(true);
      await openAppKitModal('Connect');
    } catch (err) {
      console.error('Failed to open AppKit modal:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setExternalWallet(null);
    setSigner(null);
    try {
      const kit = getAppKit();
      kit?.disconnect();
    } catch {}
  };

  const switchNetwork = async (targetChainId: number) => {
    const eth = getEthereumObject();
    if (!eth) return;

    const chainHex = `0x${targetChainId.toString(16)}`;
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainHex }],
      });
      setChainId(targetChainId);
    } catch (switchError: any) {
      // Chain has not been added yet to wallet
      if (switchError.code === 4902 && SUPPORTED_CHAINS[targetChainId]) {
        const chain = SUPPORTED_CHAINS[targetChainId];
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainHex,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: chain.rpcUrls,
              blockExplorerUrls: chain.blockExplorerUrls,
            },
          ],
        });
        setChainId(targetChainId);
      } else {
        console.error('Failed to switch network:', switchError);
      }
    }
  };

  const getTokenBalance = async (tokenAddress: string, decimals: number): Promise<string> => {
    if (!account) return '0';
    const eth = getEthereumObject();
    if (!eth) return '0';

    try {
      const bp = provider || new BrowserProvider(eth);
      if (tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
        const balance = await bp.getBalance(account);
        return formatUnits(balance, decimals);
      } else {
        const contract = new Contract(tokenAddress, ERC20_ABI, bp);
        const balance = await contract.balanceOf(account);
        return formatUnits(balance, decimals);
      }
    } catch (err) {
      console.error(`Error fetching balance for ${tokenAddress}:`, err);
      return '0';
    }
  };

  const checkAllowance = async (tokenAddress: string, spender: string): Promise<bigint> => {
    if (!account) return 0n;
    if (tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
      return MaxUint256; // Native ETH needs no ERC20 approval
    }
    const eth = getEthereumObject();
    if (!eth) return 0n;

    try {
      const bp = provider || new BrowserProvider(eth);
      const contract = new Contract(tokenAddress, ERC20_ABI, bp);
      const allowance = await contract.allowance(account, spender);
      return BigInt(allowance.toString());
    } catch (err) {
      console.error(`Error checking allowance for ${tokenAddress}:`, err);
      return 0n;
    }
  };

  const approveToken = async (
    tokenAddress: string,
    spender: string,
    amount: bigint = MaxUint256
  ): Promise<boolean> => {
    if (!signer || !account) {
      throw new Error('Wallet not connected');
    }
    try {
      const contract = new Contract(tokenAddress, ERC20_ABI, signer);
      const tx = await contract.approve(spender, amount);
      await tx.wait(1);
      return true;
    } catch (err) {
      console.error('Approval failed:', err);
      throw err;
    }
  };

  const signMessage = async (message: string): Promise<string> => {
    if (!signer) {
      const eth = getEthereumObject();
      if (eth) {
        const bp = new BrowserProvider(eth);
        const s = await bp.getSigner();
        return await s.signMessage(message);
      }
      throw new Error('Wallet not connected or signer unavailable');
    }
    return await signer.signMessage(message);
  };

  return (
    <WalletContext.Provider
      value={{
        account: activeAccount,
        chainId,
        isConnected: !!activeAccount,
        isConnecting,
        provider,
        signer,
        connectWallet,
        disconnectWallet,
        syncExternalWallet,
        switchNetwork,
        getTokenBalance,
        checkAllowance,
        approveToken,
        signMessage,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

