/*
  Warnings:

  - You are about to drop the column `firstName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `users` table. All the data in the column will be lost.
  - Added the required column `fullName` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- First, add the fullName column as nullable
ALTER TABLE "users" ADD COLUMN "fullName" TEXT;

-- Update existing rows to combine firstName and lastName
UPDATE "users" SET "fullName" = 
  CASE 
    WHEN "firstName" IS NOT NULL AND "lastName" IS NOT NULL THEN CONCAT("firstName", ' ', "lastName")
    WHEN "firstName" IS NOT NULL THEN "firstName"
    WHEN "lastName" IS NOT NULL THEN "lastName"
    ELSE 'User'
  END;

-- Make fullName non-nullable
ALTER TABLE "users" ALTER COLUMN "fullName" SET NOT NULL;

-- Drop the old columns
ALTER TABLE "users" DROP COLUMN "firstName";
ALTER TABLE "users" DROP COLUMN "lastName";
