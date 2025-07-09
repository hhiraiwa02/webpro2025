/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Paper` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Paper` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Paper` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Paper" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT NOT NULL DEFAULT 'default@example.com',
ADD COLUMN     "password" TEXT NOT NULL DEFAULT 'defaultpassword';

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
