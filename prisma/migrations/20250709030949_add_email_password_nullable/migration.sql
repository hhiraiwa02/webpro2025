/*
  Warnings:

  - You are about to drop the column `category` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "category",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "password" TEXT;
