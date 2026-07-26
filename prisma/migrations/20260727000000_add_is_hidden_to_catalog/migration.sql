-- AlterTable
ALTER TABLE "Company" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
