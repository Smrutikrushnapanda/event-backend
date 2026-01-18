import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { GuestPassesController } from './guest-passes.controller';
import { GuestPassesService } from './guest-passes.service';
import { GuestExportService } from './guest-export.service';
import { GuestPDFService } from './guest-pdf.service';
import { GuestPass } from './entities/guest-pass.entity';
import { GuestCheckIn } from './entities/guest-checkin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GuestPass, GuestCheckIn]),
    
    // ✅ PRODUCTION-SAFE MULTER CONFIGURATION
    MulterModule.register({
      // File size limits
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB max
        files: 1, // Only 1 file at a time
      },
      
      // File filter for security
      fileFilter: (req, file, callback) => {
        // Only allow Excel and CSV files
        const allowedMimes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
          'text/csv', // .csv
        ];
        
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = extname(file.originalname).toLowerCase();
        
        if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
          callback(null, true);
        } else {
          callback(
            new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed'),
            false,
          );
        }
      },
      
      // ✅ MEMORY STORAGE (Best for production with load balancers)
      // Files are stored in memory, not disk
      // Automatically cleaned up after processing
      // Works with multiple servers/containers
      storage: undefined, // undefined = memory storage (default)
    }),
  ],
  controllers: [GuestPassesController],
  providers: [
    GuestPassesService,
    GuestExportService,
    GuestPDFService,
  ],
  exports: [GuestPassesService],
})
export class GuestPassesModule {}