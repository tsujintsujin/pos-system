-- Add a public read-only DEMO role.
-- Additive only: new enum value + new role row. No existing data is touched.
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'DEMO';
