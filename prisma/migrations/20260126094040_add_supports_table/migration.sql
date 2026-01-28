/*
  Warnings:

  - A unique constraint covering the columns `[sku]` on the table `supports` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sku` to the `supports` table without a default value. This is not possible if the table is not empty.
  - Made the column `theme` on table `supports` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('ACTIF', 'INACTIF', 'EPUISE', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "supports" ADD COLUMN     "color" TEXT,
ADD COLUMN     "compatibleThemes" JSONB,
ADD COLUMN     "material" TEXT NOT NULL DEFAULT 'carton',
ADD COLUMN     "sku" TEXT NOT NULL,
ADD COLUMN     "weight" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "weightUnit" TEXT DEFAULT 'g',
ALTER COLUMN "type" SET DEFAULT 'boite',
ALTER COLUMN "theme" SET NOT NULL,
ALTER COLUMN "theme" SET DEFAULT 'anniversaire',
ALTER COLUMN "dimensions" SET DATA TYPE TEXT,
ALTER COLUMN "maxStock" SET DEFAULT 100,
ALTER COLUMN "status" SET DEFAULT 'actif';

-- CreateIndex
CREATE UNIQUE INDEX "supports_sku_key" ON "supports"("sku");
