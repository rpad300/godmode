import { z } from 'zod';

export const projectSchema = z.object({
    name: z.string()
        .min(3, 'Project name must be at least 3 characters')
        .max(50, 'Project name must be less than 50 characters')
        .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Project name can only contain letters, numbers, spaces, underscores, and hyphens'),
    description: z.string().optional(),
    owner_id: z.string().optional(), // Often set automatically
    company_id: z.string().optional(),
});

export const projectSettingsSchema = z.object({
    userRole: z.string().optional(),
    userRolePrompt: z.string().optional(),
});

export type ProjectSchema = z.infer<typeof projectSchema>;
