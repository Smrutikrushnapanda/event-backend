const { Client } = require('pg');

async function syncSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Railway database');

    // 1. Add scannedBy to check_ins
    console.log('\n🔧 Checking check_ins table...');
    
    const checkScannedBy = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'check_ins' AND column_name = 'scannedBy'
    `);

    if (checkScannedBy.rows.length === 0) {
      console.log('➕ Adding scannedBy column...');
      await client.query(`
        ALTER TABLE check_ins ADD COLUMN "scannedBy" VARCHAR(255)
      `);
      console.log('✅ scannedBy added');
    } else {
      console.log('✓ scannedBy exists');
    }

    // 2. Add wasDelegate to check_ins
    const checkWasDelegate = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'check_ins' AND column_name = 'wasDelegate'
    `);

    if (checkWasDelegate.rows.length === 0) {
      console.log('➕ Adding wasDelegate column...');
      await client.query(`
        ALTER TABLE check_ins ADD COLUMN "wasDelegate" BOOLEAN DEFAULT false
      `);
      console.log('✅ wasDelegate added');
    } else {
      console.log('✓ wasDelegate exists');
    }

    // 3. Fix NULL values in aadhaarOrId
    console.log('\n🔧 Checking event_registrations...');
    
    const nullAadhaar = await client.query(`
      SELECT COUNT(*) as count 
      FROM event_registrations 
      WHERE "aadhaarOrId" IS NULL
    `);

    if (parseInt(nullAadhaar.rows[0].count) > 0) {
      console.log(`➕ Fixing ${nullAadhaar.rows[0].count} NULL Aadhaar values...`);
      await client.query(`
        UPDATE event_registrations 
        SET "aadhaarOrId" = 'PENDING-' || SUBSTRING(id::text, 1, 12)
        WHERE "aadhaarOrId" IS NULL
      `);
      console.log('✅ Aadhaar values fixed');
    } else {
      console.log('✓ No NULL Aadhaar values');
    }

    // 4. Fix NULL values in check_ins type
    const nullType = await client.query(`
      SELECT COUNT(*) as count 
      FROM check_ins 
      WHERE type IS NULL
    `);

    if (parseInt(nullType.rows[0].count) > 0) {
      console.log(`➕ Fixing ${nullType.rows[0].count} NULL type values...`);
      await client.query(`
        UPDATE check_ins 
        SET type = 'entry' 
        WHERE type IS NULL
      `);
      console.log('✅ Type values fixed');
    } else {
      console.log('✓ No NULL type values');
    }

    // 5. Show final schema
    console.log('\n📊 Final check_ins schema:');
    const checkInsSchema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'check_ins'
      ORDER BY ordinal_position
    `);
    console.table(checkInsSchema.rows);

    console.log('\n🎉 Database schema synchronized!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

syncSchema();