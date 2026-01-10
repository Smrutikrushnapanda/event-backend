import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuestPassesTables1704900000000
  implements MigrationInterface
{
  name = 'CreateGuestPassesTables1704900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create guest_passes table
    await queryRunner.query(`
      CREATE TABLE "guest_passes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "qrCode" character varying(20) NOT NULL,
        "category" character varying NOT NULL,
        "sequenceNumber" integer NOT NULL,
        "isAssigned" boolean NOT NULL DEFAULT false,
        "name" character varying(100),
        "mobile" character varying(10),
        "assignedBy" character varying(100),
        "assignedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "hasEntryCheckIn" boolean NOT NULL DEFAULT false,
        "hasLunchCheckIn" boolean NOT NULL DEFAULT false,
        "hasDinnerCheckIn" boolean NOT NULL DEFAULT false,
        "hasSessionCheckIn" boolean NOT NULL DEFAULT false,
        CONSTRAINT "UQ_guest_pass_qrCode" UNIQUE ("qrCode"),
        CONSTRAINT "PK_guest_passes" PRIMARY KEY ("id")
      )
    `);

    // Create guest_check_ins table
    await queryRunner.query(`
      CREATE TABLE "guest_check_ins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying(20) NOT NULL,
        "scannedBy" character varying(50),
        "scannedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "guestPassId" uuid NOT NULL,
        CONSTRAINT "PK_guest_check_ins" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "idx_guest_qr_scan" ON "guest_passes" ("qrCode")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_guest_category" ON "guest_passes" ("category")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_guest_is_assigned" ON "guest_passes" ("isAssigned")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_guest_created_at" ON "guest_passes" ("createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_guest_checkin_type" ON "guest_check_ins" ("type")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_guest_checkin_scanned_at" ON "guest_check_ins" ("scannedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_guest_checkin_pass_id" ON "guest_check_ins" ("guestPassId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_guest_checkin_pass_type" ON "guest_check_ins" ("guestPassId", "type")
    `);

    // Add foreign key
    await queryRunner.query(`
      ALTER TABLE "guest_check_ins" 
      ADD CONSTRAINT "FK_guest_check_ins_pass" 
      FOREIGN KEY ("guestPassId") 
      REFERENCES "guest_passes"("id") 
      ON DELETE CASCADE 
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guest_check_ins" DROP CONSTRAINT "FK_guest_check_ins_pass"`,
    );
    await queryRunner.query(`DROP INDEX "idx_guest_checkin_pass_type"`);
    await queryRunner.query(`DROP INDEX "idx_guest_checkin_pass_id"`);
    await queryRunner.query(`DROP INDEX "idx_guest_checkin_scanned_at"`);
    await queryRunner.query(`DROP INDEX "idx_guest_checkin_type"`);
    await queryRunner.query(`DROP INDEX "idx_guest_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_guest_is_assigned"`);
    await queryRunner.query(`DROP INDEX "idx_guest_category"`);
    await queryRunner.query(`DROP INDEX "idx_guest_qr_scan"`);
    await queryRunner.query(`DROP TABLE "guest_check_ins"`);
    await queryRunner.query(`DROP TABLE "guest_passes"`);
  }
}