import { z } from 'zod'

const HEX_RE = /^[0-9a-fA-F]+$/
const Hex = z
  .string()
  .refine((s) => s.length % 2 === 0, { message: 'Invalid hex.' })
  .refine((s) => HEX_RE.test(s), { message: 'Invalid hex.' })

export const EncryptedBackupFileSchema = z.object({
  format: z.literal('retrochat.encrypted-backup'),
  v: z.literal(1),
  createdAt: z.string().datetime(),
  kdf: z.object({
    name: z.literal('PBKDF2'),
    hash: z.literal('SHA-256'),
    saltHex: Hex,
    iterations: z.number().int().min(50_000).max(2_000_000),
  }),
  aead: z.object({
    name: z.literal('AES-GCM'),
    ivHex: Hex,
    aadLabel: z.literal('retrochat:backup:v1'),
  }),
  ciphertextHex: Hex,
  plaintextHashHex: Hex,
})

export type EncryptedBackupFile = z.infer<typeof EncryptedBackupFileSchema>

