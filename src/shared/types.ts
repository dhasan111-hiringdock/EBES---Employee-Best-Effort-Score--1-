import z from "zod";

// User roles
export type UserRole = 'admin' | 'recruiter' | 'account_manager' | 'recruitment_manager';

// User schema
export const UserSchema = z.object({
  id: z.number(),
  mocha_user_id: z.string(),
  email: z.string(),
  user_code: z.string(),
  role: z.enum(['admin', 'recruiter', 'account_manager', 'recruitment_manager']),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type User = z.infer<typeof UserSchema>;

// Client schema
export const ClientSchema = z.object({
  id: z.number(),
  client_code: z.string(),
  name: z.string(),
  short_name: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Client = z.infer<typeof ClientSchema>;

// Team schema
export const TeamSchema = z.object({
  id: z.number(),
  team_code: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Team = z.infer<typeof TeamSchema>;

// API request schemas
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'recruiter', 'account_manager', 'recruitment_manager']),
  password: z.string().min(6),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'recruiter', 'account_manager', 'recruitment_manager']).optional(),
  password: z.string().min(6).optional(),
  is_active: z.boolean().optional(),
});

export const UpdateClientSchema = z.object({
  name: z.string().min(1).optional(),
  short_name: z.string().min(1).max(10).optional(),
  is_active: z.boolean().optional(),
});

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

export const CreateClientSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().min(1).max(10),
});

export const CreateTeamSchema = z.object({
  name: z.string().min(1),
});

export const AssignTeamSchema = z.object({
  user_id: z.number(),
  team_id: z.number(),
});

export const AssignClientSchema = z.object({
  user_id: z.number(),
  client_id: z.number(),
});
