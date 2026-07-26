-- Ensure each non-null product barcode uniquely identifies one product.
-- Duplicate barcodes are cleared (kept on the lowest id) so the unique index can be created.

UPDATE "Product" AS p
SET barcode = NULL
WHERE p.barcode IS NOT NULL
  AND p.barcode <> ''
  AND p.id NOT IN (
    SELECT MIN(id)
    FROM "Product"
    WHERE barcode IS NOT NULL AND barcode <> ''
    GROUP BY barcode
  );

CREATE UNIQUE INDEX IF NOT EXISTS "Product_barcode_key" ON "Product"("barcode");
