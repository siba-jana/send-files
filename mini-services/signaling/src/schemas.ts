import { z } from 'zod'

/** Roles a socket can hold inside a transfer room. */
export const roleSchema = z.enum(['sender', 'receiver'])
export type Role = z.infer<typeof roleSchema>

/** Signaling payload kinds relayed between peers. */
export const signalKindSchema = z.enum(['offer', 'answer', 'ice'])
export type SignalKind = z.infer<typeof signalKindSchema>

export interface SignalEnvelope {
  kind: SignalKind
  data: unknown
}

// ---------------------------------------------------------------- client → server payloads

export const joinSchema = z.object({
  token: z.string().min(1).max(32),
  role: roleSchema,
  auth: z.string().min(1).max(64),
})

export const signalSchema = z.object({
  token: z.string().min(1).max(32),
  payload: z.object({
    kind: signalKindSchema,
    data: z.unknown(),
  }),
})

export const stateSchema = z.object({
  token: z.string().min(1).max(32),
  state: z.string().min(1).max(32),
})

export const doneSchema = z.object({
  token: z.string().min(1).max(32),
})

export const cancelSchema = z.object({
  token: z.string().min(1).max(32),
  reason: z.string().max(200).optional(),
})

export type JoinInput = z.infer<typeof joinSchema>
export type SignalInput = z.infer<typeof signalSchema>
export type StateInput = z.infer<typeof stateSchema>
export type DoneInput = z.infer<typeof doneSchema>
export type CancelInput = z.infer<typeof cancelSchema>

// ---------------------------------------------------------------- acks

export interface AckError {
  code: string
  message: string
}

/** Every client → server event is acknowledged with this shape. */
export type AckResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: AckError }

export interface JoinAckData {
  peers: Role[]
}
