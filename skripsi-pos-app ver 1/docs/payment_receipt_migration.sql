USE umkm_pos;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'confirmed' AFTER payment_method,
  ADD COLUMN IF NOT EXISTS proof_type VARCHAR(30) DEFAULT 'none' AFTER payment_status,
  ADD COLUMN IF NOT EXISTS payment_proof_name VARCHAR(255) NULL AFTER proof_type,
  ADD COLUMN IF NOT EXISTS payment_proof_data LONGTEXT NULL AFTER payment_proof_name,
  ADD COLUMN IF NOT EXISTS qris_reference VARCHAR(100) NULL AFTER payment_proof_data,
  ADD COLUMN IF NOT EXISTS qris_confirmed_at DATETIME NULL AFTER qris_reference;

UPDATE sales
SET payment_status = COALESCE(payment_status, 'confirmed'),
    proof_type = COALESCE(proof_type, 'none')
WHERE payment_status IS NULL OR proof_type IS NULL;
