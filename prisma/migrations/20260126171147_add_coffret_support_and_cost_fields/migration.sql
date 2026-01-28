/*
  Warnings:

  - A unique constraint covering the columns `[sku]` on the table `coffrets` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "coffrets" ADD COLUMN     "cost" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "margin" DOUBLE PRECISION DEFAULT 30,
ADD COLUMN     "maxStock" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "minStock" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "supportId" TEXT,
ALTER COLUMN "images" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "supports" ALTER COLUMN "images" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "compatibleThemes" DROP DEFAULT;

-- DropEnum
DROP TYPE "SupportStatus";

-- CreateIndex
CREATE UNIQUE INDEX "coffrets_sku_key" ON "coffrets"("sku");

-- AddForeignKey
ALTER TABLE "coffrets" ADD CONSTRAINT "coffrets_supportId_fkey" FOREIGN KEY ("supportId") REFERENCES "supports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
