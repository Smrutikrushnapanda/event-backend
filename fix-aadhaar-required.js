const { Client } = require('pg');

async function fixDatabase() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_eujgh6mtIS0U@ep-noisy-mountain-ad4csgn1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Step 1: Fix NULL Aadhaar values
    console.log('\n🔧 Step 1: Fixing NULL Aadhaar values...');
    const aadhaarResult = await client.query(`
      UPDATE event_registrations 
      SET "aadhaarOrId" = 'PENDING-' || SUBSTRING(id::text, 1, 12)
      WHERE "aadhaarOrId" IS NULL
    `);
    console.log(`✅ Fixed ${aadhaarResult.rowCount} registrations with NULL Aadhaar`);

    // Step 2: Fix NULL type in check_ins
    console.log('\n🔧 Step 2: Fixing NULL check-in types...');
    const typeResult = await client.query(`
      UPDATE check_ins 
      SET type = 'entry' 
      WHERE type IS NULL
    `);
    console.log(`✅ Fixed ${typeResult.rowCount} check-ins with NULL type`);

    // Step 3: Make aadhaarOrId NOT NULL
    console.log('\n🔧 Step 3: Making aadhaarOrId NOT NULL...');
    await client.query(`
      ALTER TABLE event_registrations 
      ALTER COLUMN "aadhaarOrId" SET NOT NULL
    `);
    console.log('✅ Column "aadhaarOrId" is now NOT NULL');

    // Step 4: Make type NOT NULL
    console.log('\n🔧 Step 4: Making check_ins type NOT NULL...');
    await client.query(`
      ALTER TABLE check_ins 
      ALTER COLUMN type SET NOT NULL
    `);
    console.log('✅ Column "type" is now NOT NULL');

    // Verify
    console.log('\n📊 Verification:');
    const checkAadhaar = await client.query(
      'SELECT COUNT(*) FROM event_registrations WHERE "aadhaarOrId" IS NULL'
    );
    const checkType = await client.query(
      'SELECT COUNT(*) FROM check_ins WHERE type IS NULL'
    );
    
    console.log(`   - Registrations with NULL Aadhaar: ${checkAadhaar.rows[0].count}`);
    console.log(`   - Check-ins with NULL type: ${checkType.rows[0].count}`);
    
    console.log('\n🎉 Database fully fixed! Aadhaar is now REQUIRED.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

fixDatabase();