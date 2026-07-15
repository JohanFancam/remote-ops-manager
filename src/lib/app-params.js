/**
 * Legacy app-params helper kept for any remaining imports.
 * Base44 URL/token bootstrapping has been removed.
 */
export const appParams = {
  appId: 'remote-ops-manager',
  token: null,
  fromUrl: typeof window !== 'undefined' ? window.location.href : '',
  functionsVersion: null,
  appBaseUrl: '',
};
