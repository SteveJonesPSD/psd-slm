-- Add URL field to product_suppliers for tracking source URLs per supplier
ALTER TABLE product_suppliers ADD COLUMN url TEXT;
