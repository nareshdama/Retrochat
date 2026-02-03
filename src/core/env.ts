export type EnvShape = {
  VITE_APP_ENV: 'development' | 'staging' | 'production'
  VITE_API_BASE_URL: string
}

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvValidationError'
  }
}

const REQUIRED_KEYS = ['VITE_APP_ENV', 'VITE_API_BASE_URL'] as const
const VALID_APP_ENVS = ['development', 'staging', 'production'] as const

function validateEnv(rawEnv: ImportMetaEnv): EnvShape {
  // Check for missing required keys - treat empty strings as missing
  const missing = REQUIRED_KEYS.filter((key) => {
    const value = rawEnv[key]
    return value === undefined || value === null || value === ''
  })

  if (missing.length > 0) {
    throw new EnvValidationError(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please check your .env file or environment configuration.'
    )
  }

  const appEnv = rawEnv.VITE_APP_ENV
  if (!VALID_APP_ENVS.includes(appEnv as typeof VALID_APP_ENVS[number])) {
    throw new EnvValidationError(
      `Invalid VITE_APP_ENV: "${appEnv}". ` +
      `Must be one of: ${VALID_APP_ENVS.join(', ')}`
    )
  }

  const apiBaseUrl = rawEnv.VITE_API_BASE_URL
  try {
    const url = new URL(apiBaseUrl)
    // Validate it's an HTTP(S) URL
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new EnvValidationError(
        `Invalid VITE_API_BASE_URL protocol: "${url.protocol}". Must be http: or https:`
      )
    }
  } catch (err) {
    if (err instanceof EnvValidationError) {
      throw err
    }
    throw new EnvValidationError(
      `Invalid VITE_API_BASE_URL: "${apiBaseUrl}". Must be a valid absolute URL.`
    )
  }

  return {
    VITE_APP_ENV: appEnv as EnvShape['VITE_APP_ENV'],
    VITE_API_BASE_URL: apiBaseUrl,
  }
}

// Validate environment at module load time - throws if invalid
let validatedEnv: EnvShape

try {
  validatedEnv = validateEnv(import.meta.env)
} catch (err) {
  // Log error for visibility
  // eslint-disable-next-line no-console
  console.error('[env] Configuration error:', err instanceof Error ? err.message : err)
  
  // In development, provide more helpful error
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('[env] Hint: Copy .env.example to .env.development and fill in the values.')
  }
  
  // Re-throw to prevent app from starting with invalid config
  throw err
}

/**
 * Validated environment configuration.
 * Accessing this value is guaranteed to return valid configuration
 * because validation happens at module load time.
 */
export const env: EnvShape = validatedEnv

/**
 * Type-safe environment check helpers
 */
export const isDevelopment = env.VITE_APP_ENV === 'development'
export const isStaging = env.VITE_APP_ENV === 'staging'
export const isProduction = env.VITE_APP_ENV === 'production'

