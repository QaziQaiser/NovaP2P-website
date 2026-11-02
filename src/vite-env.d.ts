/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VELORA_API_KEY?: string;
  readonly VITE_LIFI_API_KEY?: string;
  readonly VITE_LIFI_FEE?: string;
  readonly VITE_VELORA_API_URL?: string;
  readonly VITE_VELORA_PARTNER?: string;
  readonly VITE_VELORA_PARTNER_ADDRESS?: string;
  readonly VITE_VELORA_PARTNER_FEE_BPS?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID?: string;
  readonly VITE_EMAILJS_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
