import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as QRCode from 'qrcode';
import { GuestPass } from './entities/guest-pass.entity';

@Injectable()
export class GuestExportService {
  /**
   * Generate CSV from guest passes (fast, no images)
   */
  async generateCSV(passes: GuestPass[]): Promise<string> {
    const headers = [
      'QR Code',
      'Category',
      'Sequence Number',
      'Is Assigned',
      'Name',
      'Mobile',
      'Assigned By',
      'Assigned At',
      'Entry Check-in',
      'Lunch Check-in',
      'Dinner Check-in',
      'Session Check-in',
      'Created At',
    ];

    const rows = passes.map((pass) => {
      const checkIns = pass.checkIns || [];

      return [
        pass.qrCode,
        pass.category,
        pass.sequenceNumber,
        pass.isAssigned ? 'Yes' : 'No',
        pass.name || '',
        pass.mobile || '',
        pass.assignedBy || '',
        pass.assignedAt ? pass.assignedAt.toISOString() : '',
        checkIns.some((c) => c.type === 'entry') ? 'Yes' : 'No',
        checkIns.some((c) => c.type === 'lunch') ? 'Yes' : 'No',
        checkIns.some((c) => c.type === 'dinner') ? 'Yes' : 'No',
        checkIns.some((c) => c.type === 'session') ? 'Yes' : 'No',
        pass.createdAt.toISOString(),
      ]
        .map((field) => `"${String(field).replace(/"/g, '""')}"`)
        .join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate Excel with QR codes embedded as images
   */
  async generateExcel(passes: GuestPass[]): Promise<Buffer> {
    console.log(
      `📊 Generating Excel with QR codes for ${passes.length} guest passes...`,
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Guest Passes');

    // Set column widths
    worksheet.columns = [
      { header: 'QR Code', key: 'qrCode', width: 20 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Sequence #', key: 'sequenceNumber', width: 12 },
      { header: 'Assigned', key: 'isAssigned', width: 10 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Mobile', key: 'mobile', width: 12 },
      { header: 'Assigned By', key: 'assignedBy', width: 20 },
      { header: 'Entry', key: 'entry', width: 8 },
      { header: 'Lunch', key: 'lunch', width: 8 },
      { header: 'Dinner', key: 'dinner', width: 8 },
      { header: 'Session', key: 'session', width: 8 },
      { header: 'Created', key: 'createdAt', width: 20 },
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Add data rows with QR codes
    for (let i = 0; i < passes.length; i++) {
      const pass = passes[i];
      const checkIns = pass.checkIns || [];
      const rowIndex = i + 2;

      // Add row data
      worksheet.addRow({
        qrCode: pass.qrCode,
        category: pass.category,
        sequenceNumber: pass.sequenceNumber,
        isAssigned: pass.isAssigned ? 'Yes' : 'No',
        name: pass.name || '',
        mobile: pass.mobile || '',
        assignedBy: pass.assignedBy || '',
        entry: checkIns.some((c) => c.type === 'entry') ? '✓' : '✗',
        lunch: checkIns.some((c) => c.type === 'lunch') ? '✓' : '✗',
        dinner: checkIns.some((c) => c.type === 'dinner') ? '✓' : '✗',
        session: checkIns.some((c) => c.type === 'session') ? '✓' : '✗',
        createdAt: pass.createdAt.toISOString().split('T')[0],
      });

      // Generate QR code as image
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(pass.qrCode, {
          width: 150,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        const base64Data = qrCodeDataUrl.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const imageId = workbook.addImage({
          buffer: imageBuffer as any,
          extension: 'png',
        });

        worksheet.getRow(rowIndex).height = 100;

        worksheet.addImage(imageId, {
          tl: { col: 0, row: rowIndex - 1 },
          ext: { width: 100, height: 100 },
        });

        if ((i + 1) % 100 === 0) {
          console.log(`✅ Processed ${i + 1}/${passes.length} passes`);
        }
      } catch (error) {
        console.error(`❌ Error generating QR code for ${pass.qrCode}:`, error);
      }
    }

    // Apply borders
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        if (rowNumber > 1) {
          const col = cell.col;
          if (typeof col === 'number' && col >= 8 && col <= 11) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { size: 14 };
          }
        }
      });
    });

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    console.log('✅ Excel generation complete');

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}