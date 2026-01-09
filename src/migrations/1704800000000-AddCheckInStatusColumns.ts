import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCheckInStatusColumns1704800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add status columns with default false
    await queryRunner.addColumns('event_registrations', [
      new TableColumn({
        name: 'hasEntryCheckIn',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'hasLunchCheckIn',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'hasDinnerCheckIn',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'hasSessionCheckIn',
        type: 'boolean',
        default: false,
      }),
    ]);

    // Create indexes for fast filtering
    await queryRunner.query(
      `CREATE INDEX "idx_registration_entry_status" ON "event_registrations" ("hasEntryCheckIn")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_registration_lunch_status" ON "event_registrations" ("hasLunchCheckIn")`
    );

    // Populate existing data
    console.log('📊 Populating check-in status columns from existing data...');
    
    await queryRunner.query(`
      UPDATE event_registrations r
      SET 
        "hasEntryCheckIn" = EXISTS (
          SELECT 1 FROM check_ins c 
          WHERE c."registrationId" = r.id AND c.type = 'entry'
        ),
        "hasLunchCheckIn" = EXISTS (
          SELECT 1 FROM check_ins c 
          WHERE c."registrationId" = r.id AND c.type = 'lunch'
        ),
        "hasDinnerCheckIn" = EXISTS (
          SELECT 1 FROM check_ins c 
          WHERE c."registrationId" = r.id AND c.type = 'dinner'
        ),
        "hasSessionCheckIn" = EXISTS (
          SELECT 1 FROM check_ins c 
          WHERE c."registrationId" = r.id AND c.type = 'session'
        )
    `);

    console.log('✅ Check-in status columns added and populated');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "idx_registration_entry_status"`);
    await queryRunner.query(`DROP INDEX "idx_registration_lunch_status"`);

    // Drop columns
    await queryRunner.dropColumns('event_registrations', [
      'hasEntryCheckIn',
      'hasLunchCheckIn',
      'hasDinnerCheckIn',
      'hasSessionCheckIn',
    ]);
  }
}