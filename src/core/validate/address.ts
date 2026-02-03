import { z } from 'zod'
import { getAddress, isAddress } from 'viem'

export const AddressSchema = z
  .string()
  .trim()
  .refine((v) => isAddress(v), { message: 'Invalid wallet address.' })
  .transform((v) => getAddress(v))

export type Address = z.infer<typeof AddressSchema>

export function parseAddress(input: unknown): Address {
  return AddressSchema.parse(input)
}

export function safeParseAddress(input: unknown): { ok: true; value: Address } | { ok: false; error: string } {
  const res = AddressSchema.safeParse(input)
  if (!res.success) {
    return { ok: false, error: 'Invalid wallet address.' }
  }
  return { ok: true, value: res.data }
}

