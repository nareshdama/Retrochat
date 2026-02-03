export function randomBytes(length: number): Uint8Array {
  if (length <= 0) {
    throw new Error('randomBytes length must be positive')
  }

  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('WebCrypto random generator is not available.')
  }

  const buffer = new Uint8Array(length)
  crypto.getRandomValues(buffer)
  return buffer
}

