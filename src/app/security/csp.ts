// Allowed XMTP endpoints for messaging
const XMTP_ENDPOINTS = [
  'https://*.xmtp.network',
  'https://grpc.xmtp.org',
  'https://grpc.dev.xmtp.network',
  'https://grpc.production.xmtp.network',
  'wss://*.xmtp.network',
  'wss://grpc.xmtp.org',
]

// Allowed wallet/RPC endpoints
const WALLET_ENDPOINTS = [
  'https://*.infura.io',
  'https://*.alchemy.com',
  'https://mainnet.infura.io',
  'https://eth-mainnet.alchemyapi.io',
  'wss://*.infura.io',
  'wss://*.alchemy.com',
]

// Combine all allowed connect-src endpoints
const CONNECT_SRC_ENDPOINTS = [
  "'self'",
  ...XMTP_ENDPOINTS,
  ...WALLET_ENDPOINTS,
].join(' ')

export const DEFAULT_PROD_CSP =
  `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; connect-src ${CONNECT_SRC_ENDPOINTS}; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests`

// For development, allow broader connections (can be overridden via env)
export const DEFAULT_DEV_CSP =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: wss: http://localhost:* ws://localhost:*; worker-src 'self' blob:; manifest-src 'self'"

// Notes:
// - We intentionally block inline scripts by omitting 'unsafe-inline' in script-src.
// - We allow 'unsafe-inline' for styles because React uses style attributes in some cases.
// - connect-src is now restricted to known XMTP and wallet RPC endpoints.
// - Add additional endpoints as needed for your deployment.
// - Use DEFAULT_DEV_CSP for development environments where broader access is needed.

