/*
  # Database Backup and Rollback Procedures

  1. New Functions
    - `create_pre_migration_backup(backup_name TEXT)` - Creates snapshot of critical tables
    - `restore_from_backup(backup_name TEXT)` - Restores data from backup schema
    - `list_backups()` - Lists all available backup schemas
    - `delete_backup(backup_name TEXT)` - Removes old backup schemas

  2. Purpose
    - Protect data integrity before migrations
    - Enable quick rollback if migrations fail
    - Provide audit trail of schema changes

  3. Usage
    - Before migration: `SELECT create_pre_migration_backup('20250113_customer_fields');`
    - If rollback needed: `SELECT restore_from_backup('20250113_customer_fields');`
    - List backups: `SELECT list_backups();`
    - Cleanup: `SELECT delete_backup('old_backup_name');`

  4. Important Notes
    - Backups are stored in separate schemas (backup_*)
    - Each backup includes all critical business tables
    - Backups should be cleaned up after successful migration
    - Maximum 10 backups recommended to avoid storage issues
*/

-- Function to create backup of critical tables
CREATE OR REPLACE FUNCTION create_pre_migration_backup(backup_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tables TEXT[] := ARRAY[
    'customer_profile',
    'item_record',
    'invoice_record',
    'invoice_line_item',
    'invoice_payment',
    'sales_order',
    'sales_order_line_item',
    'qbo_connection',
    'qbo_sync_history',
    'organization'
  ];
  table_name TEXT;
  backup_schema TEXT;
  row_count INTEGER;
  total_rows INTEGER := 0;
BEGIN
  -- Sanitize backup name (only alphanumeric and underscore)
  backup_name := regexp_replace(backup_name, '[^a-zA-Z0-9_]', '', 'g');
  backup_schema := 'backup_' || backup_name;
  
  -- Create backup schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', backup_schema);
  
  -- Store metadata about this backup
  EXECUTE format(
    'CREATE TABLE %I.backup_metadata (
      created_at TIMESTAMPTZ DEFAULT NOW(),
      backup_name TEXT,
      tables_backed_up TEXT[],
      total_rows INTEGER
    )',
    backup_schema
  );
  
  -- Backup each table
  FOREACH table_name IN ARRAY tables
  LOOP
    -- Check if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = table_name
    ) THEN
      -- Create backup copy
      EXECUTE format(
        'CREATE TABLE %I.%I AS SELECT * FROM public.%I',
        backup_schema, table_name, table_name
      );
      
      -- Get row count
      EXECUTE format('SELECT COUNT(*) FROM %I.%I', backup_schema, table_name) INTO row_count;
      total_rows := total_rows + row_count;
      
      RAISE NOTICE 'Backed up %.%: % rows', backup_schema, table_name, row_count;
    ELSE
      RAISE NOTICE 'Table public.% does not exist, skipping', table_name;
    END IF;
  END LOOP;
  
  -- Store metadata
  EXECUTE format(
    'INSERT INTO %I.backup_metadata (backup_name, tables_backed_up, total_rows) VALUES ($1, $2, $3)',
    backup_schema
  ) USING backup_name, tables, total_rows;
  
  RETURN format('Backup created: %s (%s rows across %s tables)', 
    backup_schema, total_rows, array_length(tables, 1));
END;
$$;

-- Function to restore from backup
CREATE OR REPLACE FUNCTION restore_from_backup(backup_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tables TEXT[] := ARRAY[
    'customer_profile',
    'item_record',
    'invoice_record',
    'invoice_line_item',
    'invoice_payment',
    'sales_order',
    'sales_order_line_item',
    'qbo_connection',
    'qbo_sync_history',
    'organization'
  ];
  table_name TEXT;
  backup_schema TEXT;
  row_count INTEGER;
  total_rows INTEGER := 0;
BEGIN
  -- Sanitize backup name
  backup_name := regexp_replace(backup_name, '[^a-zA-Z0-9_]', '', 'g');
  backup_schema := 'backup_' || backup_name;
  
  -- Verify backup exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = backup_schema
  ) THEN
    RAISE EXCEPTION 'Backup schema % does not exist', backup_schema;
  END IF;
  
  -- Restore each table
  FOREACH table_name IN ARRAY tables
  LOOP
    -- Check if backup table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = backup_schema AND table_name = table_name
    ) THEN
      -- Disable triggers temporarily
      EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER ALL', table_name);
      
      -- Truncate current table
      EXECUTE format('TRUNCATE TABLE public.%I CASCADE', table_name);
      
      -- Restore from backup
      EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM %I.%I',
        table_name, backup_schema, table_name
      );
      
      -- Re-enable triggers
      EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER ALL', table_name);
      
      -- Get row count
      EXECUTE format('SELECT COUNT(*) FROM public.%I', table_name) INTO row_count;
      total_rows := total_rows + row_count;
      
      RAISE NOTICE 'Restored public.%: % rows', table_name, row_count;
    ELSE
      RAISE NOTICE 'Backup table %.% does not exist, skipping', backup_schema, table_name;
    END IF;
  END LOOP;
  
  RETURN format('Restore completed from %s: %s rows restored', backup_schema, total_rows);
END;
$$;

-- Function to list all backups
CREATE OR REPLACE FUNCTION list_backups()
RETURNS TABLE (
  backup_schema TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    schema_name::TEXT as backup_schema
  FROM information_schema.schemata
  WHERE schema_name LIKE 'backup_%'
  ORDER BY schema_name DESC;
$$;

-- Function to delete old backup
CREATE OR REPLACE FUNCTION delete_backup(backup_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  backup_schema TEXT;
BEGIN
  -- Sanitize backup name
  backup_name := regexp_replace(backup_name, '[^a-zA-Z0-9_]', '', 'g');
  backup_schema := 'backup_' || backup_name;
  
  -- Verify backup exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = backup_schema
  ) THEN
    RAISE EXCEPTION 'Backup schema % does not exist', backup_schema;
  END IF;
  
  -- Drop the backup schema and all its tables
  EXECUTE format('DROP SCHEMA %I CASCADE', backup_schema);
  
  RETURN format('Backup deleted: %s', backup_schema);
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION create_pre_migration_backup IS 'Creates a snapshot backup of critical tables before migrations. Usage: SELECT create_pre_migration_backup(''backup_name'');';
COMMENT ON FUNCTION restore_from_backup IS 'Restores data from a backup schema. Usage: SELECT restore_from_backup(''backup_name'');';
COMMENT ON FUNCTION list_backups IS 'Lists all available backup schemas. Usage: SELECT * FROM list_backups();';
COMMENT ON FUNCTION delete_backup IS 'Deletes a backup schema. Usage: SELECT delete_backup(''backup_name'');';
