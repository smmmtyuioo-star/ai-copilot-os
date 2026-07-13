import { z } from 'zod'

export const emailSchema = z.string().email('Invalid email address')
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: emailSchema,
  password: passwordSchema,
})

export const chatMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(32000, 'Message too long'),
  conversationId: z.string().optional(),
  model: z.string().optional(),
})

export const workflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['action', 'condition', 'loop', 'delay', 'parallel']),
    config: z.record(z.string(), z.unknown()),
    next: z.array(z.string()),
  })),
})

export const apiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  permissions: z.array(z.string()).min(1, 'At least one permission required'),
})

export const connectorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  provider: z.string().min(1, 'Provider is required'),
  config: z.record(z.string(), z.unknown()),
})
