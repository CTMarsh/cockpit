import { z } from '@hono/zod-openapi'

// Standard error response
export const ErrorSchema = z.object({
  error: z.string()
}).openapi('Error')

// Health check response (used by many modules)
export const HealthSchema = z.object({
  module: z.string(),
  status: z.literal('ok')
}).openapi('Health')

// Standard success response
export const SuccessSchema = z.object({
  ok: z.boolean()
}).openapi('Success')

export const MessageSchema = z.object({
  message: z.string()
}).openapi('Message')

export const DeletedSchema = z.object({
  deleted: z.union([z.string(), z.number()])
}).openapi('Deleted')
