import { z } from 'zod'
import { isAddress } from 'viem'

const HEX_RE = /^[0-9a-fA-F]+$/

export const HexSchema = z
  .string()
  .refine((s) => s.length % 2 === 0, { message: 'Invalid hex encoding.' })
  .refine((s) => HEX_RE.test(s), { message: 'Invalid hex encoding.' })

export const MessageEnvelopeSchema = z.object({
  v: z.number().int().min(1).max(1),
  from: z.string().refine((s) => isAddress(s), { message: 'Invalid from address.' }),
  to: z.string().refine((s) => isAddress(s), { message: 'Invalid to address.' }),
  ts: z.string().datetime(),
  nonce: HexSchema.refine((s) => s.length === 32, { message: 'Invalid nonce.' }), // 16 bytes
  iv: HexSchema.refine((s) => s.length === 24, { message: 'Invalid iv.' }), // 12 bytes
  ciphertext: HexSchema.refine((s) => s.length > 0, { message: 'Invalid ciphertext.' }),
  aad: HexSchema.optional(),
})

export type ValidMessageEnvelope = z.infer<typeof MessageEnvelopeSchema>

export function safeParseMessageEnvelope(input: unknown):
  | { ok: true; value: ValidMessageEnvelope }
  | { ok: false; error: string } {
  const res = MessageEnvelopeSchema.safeParse(input)
  if (!res.success) {
    return { ok: false, error: 'Invalid message payload.' }
  }
  return { ok: true, value: res.data }
}

