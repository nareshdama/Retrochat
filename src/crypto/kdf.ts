export async function hkdfSha256(options: {
  ikm: Uint8Array
  salt: Uint8Array
  info: Uint8Array
  length: number
}): Promise<Uint8Array> {
  const { ikm, salt, info, length } = options

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  const key = await crypto.subtle.importKey('raw', ikm.buffer as ArrayBuffer, 'HKDF', false, [
    'deriveBits',
  ])

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      info: info.buffer as ArrayBuffer,
    },
    key,
    length * 8,
  )

  return new Uint8Array(bits)
}

