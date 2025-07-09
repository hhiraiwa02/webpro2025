/*
  Warnings:

  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Paper` table without a default value. This is not possible if the table is not empty.
  - Made the column `author` on table `Paper` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Paper" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "author" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "email",
DROP COLUMN "password";
