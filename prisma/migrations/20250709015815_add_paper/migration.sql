/*
  Warnings:

  - You are about to drop the column `age` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "age",
ADD COLUMN     "category" TEXT;

-- CreateTable
CREATE TABLE "Paper" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "author" TEXT,
    "category" TEXT,
    "url" TEXT,
    "comment" TEXT,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);
