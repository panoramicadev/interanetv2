-- Agregar columna kofulido a stg_maeddo si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'ventas' 
        AND table_name = 'stg_maeddo' 
        AND column_name = 'kofulido'
    ) THEN
        ALTER TABLE ventas.stg_maeddo ADD COLUMN kofulido TEXT;
    END IF;
END $$;
