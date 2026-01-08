import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as QRCode from 'qrcode';
import { Registration } from './entities/registrations.entity';

@Injectable()
export class ExcelExportService {
  /**
   * Generate CSV from registrations (fast, no images)
   */
  async generateRegistrationsCSV(registrations: Registration[]): Promise<string> {
    // CSV Header
    const headers = [
      'QR Code',
      'Name',
      'Village',
      'GP',
      'District',
      'Block',
      'Mobile',
      'Aadhaar/ID',
      'Category',
      'Delegate Name',
      'Delegate Mobile',
      'Is Delegate Attending',
      'Entry Check-in',
      'Lunch Check-in',
      'Dinner Check-in',
      'Session Check-in',
      'Registration Date'
    ];

    // Create CSV rows
    const rows = registrations.map(reg => {
      const checkIns = reg.checkIns || [];
      
      return [
        reg.qrCode,
        reg.name,
        reg.village,
        reg.gp,
        reg.district,
        reg.block,
        reg.mobile,
        reg.aadhaarOrId,
        reg.category,
        reg.delegateName || '',
        reg.delegateMobile || '',
        reg.isDelegateAttending ? 'Yes' : 'No',
        checkIns.some(c => c.type === 'entry') ? 'Yes' : 'No',
        checkIns.some(c => c.type === 'lunch') ? 'Yes' : 'No',
        checkIns.some(c => c.type === 'dinner') ? 'Yes' : 'No',
        checkIns.some(c => c.type === 'session') ? 'Yes' : 'No',
        reg.createdAt.toISOString()
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    // Combine headers and rows
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate Excel with QR codes embedded as images
   */
  async generateRegistrationsExcel(registrations: Registration[]): Promise<Buffer> {
    console.log(`📊 Generating Excel with QR codes for ${registrations.length} registrations...`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registrations');

    // Set column widths
    worksheet.columns = [
      { header: 'QR Code', key: 'qrCode', width: 20 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Village', key: 'village', width: 20 },
      { header: 'GP', key: 'gp', width: 20 },
      { header: 'District', key: 'district', width: 15 },
      { header: 'Block', key: 'block', width: 15 },
      { header: 'Mobile', key: 'mobile', width: 12 },
      { header: 'Aadhaar/ID', key: 'aadhaarOrId', width: 15 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Delegate Name', key: 'delegateName', width: 25 },
      { header: 'Delegate Mobile', key: 'delegateMobile', width: 12 },
      { header: 'Is Delegate', key: 'isDelegateAttending', width: 12 },
      { header: 'Entry', key: 'entry', width: 8 },
      { header: 'Lunch', key: 'lunch', width: 8 },
      { header: 'Dinner', key: 'dinner', width: 8 },
      { header: 'Session', key: 'session', width: 8 },
      { header: 'Registered', key: 'createdAt', width: 20 },
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Add data rows with QR codes
    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      const checkIns = reg.checkIns || [];
      const rowIndex = i + 2; // +2 because Excel is 1-indexed and we have a header

      // Add row data
      worksheet.addRow({
        qrCode: reg.qrCode,
        name: reg.name,
        village: reg.village,
        gp: reg.gp,
        district: reg.district,
        block: reg.block,
        mobile: reg.mobile,
        aadhaarOrId: reg.aadhaarOrId,
        category: reg.category,
        delegateName: reg.delegateName || '',
        delegateMobile: reg.delegateMobile || '',
        isDelegateAttending: reg.isDelegateAttending ? 'Yes' : 'No',
        entry: checkIns.some(c => c.type === 'entry') ? '✓' : '✗',
        lunch: checkIns.some(c => c.type === 'lunch') ? '✓' : '✗',
        dinner: checkIns.some(c => c.type === 'dinner') ? '✓' : '✗',
        session: checkIns.some(c => c.type === 'session') ? '✓' : '✗',
        createdAt: reg.createdAt.toISOString().split('T')[0],
      });

      // Generate QR code as image
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(reg.qrCode, {
          width: 150,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        // Convert data URL to buffer
        const base64Data = qrCodeDataUrl.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Add image to workbook - Fix: Cast to any to avoid Buffer type mismatch
        const imageId = workbook.addImage({
          buffer: imageBuffer as any,
          extension: 'png',
        });

        // Set row height to accommodate QR code
        worksheet.getRow(rowIndex).height = 100;

        // Insert image in the QR Code column
        worksheet.addImage(imageId, {
          tl: { col: 0, row: rowIndex - 1 }, // Top-left corner
          ext: { width: 100, height: 100 } // Image size
        });

        // Log progress every 100 registrations
        if ((i + 1) % 100 === 0) {
          console.log(`✅ Processed ${i + 1}/${registrations.length} registrations`);
        }
      } catch (error) {
        console.error(`❌ Error generating QR code for ${reg.qrCode}:`, error);
        // Continue with other registrations even if one fails
      }
    }

    // Apply borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        // Center align check marks
        if (rowNumber > 1) {
          const col = cell.col;
          // Fix: Compare numbers properly
          if (typeof col === 'number' && col >= 13 && col <= 16) { // Entry, Lunch, Dinner, Session columns
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { size: 14 };
          }
        }
      });
    });

    // Freeze the header row
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];

    console.log('✅ Excel generation complete');

    // Generate buffer and return as Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate Excel for specific block with QR codes
   */
  async generateBlockExcel(registrations: Registration[], blockName: string): Promise<Buffer> {
    console.log(`📊 Generating Excel for ${blockName} block with ${registrations.length} registrations...`);
    
    // Use the same method but with filtered registrations
    return this.generateRegistrationsExcel(registrations);
  }

  /**
   * Calculate export statistics
   */
  getExportStatistics(registrations: Registration[]) {
    const totalRegistrations = registrations.length;
    
    const withCheckIns = registrations.filter(r => 
      r.checkIns && r.checkIns.length > 0
    ).length;

    const entryCount = registrations.filter(r => 
      r.checkIns?.some(c => c.type === 'entry')
    ).length;

    const lunchCount = registrations.filter(r => 
      r.checkIns?.some(c => c.type === 'lunch')
    ).length;

    const dinnerCount = registrations.filter(r => 
      r.checkIns?.some(c => c.type === 'dinner')
    ).length;

    const sessionCount = registrations.filter(r => 
      r.checkIns?.some(c => c.type === 'session')
    ).length;

    const withDelegates = registrations.filter(r => r.delegateName).length;

    return {
      totalRegistrations,
      withCheckIns,
      entryCount,
      lunchCount,
      dinnerCount,
      sessionCount,
      withDelegates,
    };
  }
}