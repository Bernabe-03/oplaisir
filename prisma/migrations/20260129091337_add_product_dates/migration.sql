/*
  Warnings:

  - The values [OBSOLETE] on the enum `ProductStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProductStatus_new" AS ENUM ('ACTIF', 'INACTIF', 'EPUISE', 'EXPIRE', 'PROMO');
ALTER TABLE "public"."products" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "status" TYPE "ProductStatus_new" USING ("status"::text::"ProductStatus_new");
ALTER TYPE "ProductStatus" RENAME TO "ProductStatus_old";
ALTER TYPE "ProductStatus_new" RENAME TO "ProductStatus";
DROP TYPE "public"."ProductStatus_old";
ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'ACTIF';
COMMIT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "manufacturingDate" TIMESTAMP(3),
ADD COLUMN     "shelfLifeMonths" INTEGER DEFAULT 0,
ADD COLUMN     "storageConditions" TEXT DEFAULT 'température ambiante';
