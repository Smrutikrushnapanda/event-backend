import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Registration } from './entities/registrations.entity';

@Injectable()
export class ExcelExportService {
  async generateRegistrationsCSV(registrations: Registration[]): Promise<string> {
    const headers = [
      'Serial No',
      'QR Code',
      'Name',
      'Village',
      'District',
      'Block',
      'Mobile',
      'Aadhaar',
      'Gender',
      'Caste',
      'Category',
      'Behalf Name',
      'Behalf Mobile',
      'Behalf Gender',
      'Is Behalf Attending',
      'Entry Check-in',
      'Lunch Check-in',
      'Dinner Check-in',
      'Session Check-in',
      'Registration Date',
    ];

    const rows = registrations.map((reg, index) => [
      index + 1,
      reg.qrCode,
      reg.name,
      reg.village,
      reg.district,
      reg.block,
      reg.mobile,
      reg.aadhaarOrId,
      reg.gender?.toUpperCase() || 'N/A',
      reg.caste?.toUpperCase() || 'N/A',
      reg.category,
      reg.behalfName || 'N/A',
      reg.behalfMobile || 'N/A',
      reg.behalfGender?.toUpperCase() || 'N/A',
      reg.isBehalfAttending ? 'Yes' : 'No',
      reg.hasEntryCheckIn ? 'Yes' : 'No',
      reg.hasLunchCheckIn ? 'Yes' : 'No',
      reg.hasDinnerCheckIn ? 'Yes' : 'No',
      reg.hasSessionCheckIn ? 'Yes' : 'No',
      new Date(reg.createdAt).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  async generateRegistrationsExcel(registrations: Registration[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registrations');

    // Define columns
    worksheet.columns = [
      { header: 'Serial No', key: 'serial', width: 10 },
      { header: 'QR Code', key: 'qrCode', width: 20 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Village', key: 'village', width: 20 },
      { header: 'District', key: 'district', width: 15 },
      { header: 'Block', key: 'block', width: 15 },
      { header: 'Mobile', key: 'mobile', width: 12 },
      { header: 'Aadhaar', key: 'aadhaar', width: 15 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Caste', key: 'caste', width: 10 },
      { header: 'Category', key: 'category', width: 30 },
      { header: 'Behalf Name', key: 'behalfName', width: 25 },
      { header: 'Behalf Mobile', key: 'behalfMobile', width: 12 },
      { header: 'Behalf Gender', key: 'behalfGender', width: 12 },
      { header: 'Behalf Attending', key: 'isBehalfAttending', width: 15 },
      { header: 'Entry Check-in', key: 'entryCheckIn', width: 12 },
      { header: 'Lunch Check-in', key: 'lunchCheckIn', width: 12 },
      { header: 'Dinner Check-in', key: 'dinnerCheckIn', width: 12 },
      { header: 'Session Check-in', key: 'sessionCheckIn', width: 12 },
      { header: 'Registration Date', key: 'registrationDate', width: 18 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Add data
    registrations.forEach((reg, index) => {
      worksheet.addRow({
        serial: index + 1,
        qrCode: reg.qrCode,
        name: reg.name,
        village: reg.village,
        district: reg.district,
        block: reg.block,
        mobile: reg.mobile,
        aadhaar: reg.aadhaarOrId,
        gender: reg.gender?.toUpperCase() || 'N/A',
        caste: reg.caste?.toUpperCase() || 'N/A',
        category: reg.category,
        behalfName: reg.behalfName || 'N/A',
        behalfMobile: reg.behalfMobile || 'N/A',
        behalfGender: reg.behalfGender?.toUpperCase() || 'N/A',
        isBehalfAttending: reg.isBehalfAttending ? 'Yes' : 'No',
        entryCheckIn: reg.hasEntryCheckIn ? 'Yes' : 'No',
        lunchCheckIn: reg.hasLunchCheckIn ? 'Yes' : 'No',
        dinnerCheckIn: reg.hasDinnerCheckIn ? 'Yes' : 'No',
        sessionCheckIn: reg.hasSessionCheckIn ? 'Yes' : 'No',
        registrationDate: new Date(reg.createdAt).toLocaleString(),
      });
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.values) {
        const lengths = column.values
          .filter(v => v !== null && v !== undefined)
          .map(v => v!.toString().length);
        if (lengths.length > 0) {
          const maxLength = Math.max(...lengths);
          column.width = Math.min(maxLength + 2, 50);
        }
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateBlockExcel(registrations: Registration[], blockName: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${blockName} Block`);

    // Define columns
    worksheet.columns = [
      { header: 'Serial No', key: 'serial', width: 10 },
      { header: 'QR Code', key: 'qrCode', width: 20 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Village', key: 'village', width: 20 },
      { header: 'District', key: 'district', width: 15 },
      { header: 'Mobile', key: 'mobile', width: 12 },
      { header: 'Aadhaar', key: 'aadhaar', width: 15 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Caste', key: 'caste', width: 10 },
      { header: 'Category', key: 'category', width: 30 },
      { header: 'Behalf Name', key: 'behalfName', width: 25 },
      { header: 'Behalf Mobile', key: 'behalfMobile', width: 12 },
      { header: 'Behalf Gender', key: 'behalfGender', width: 12 },
      { header: 'Behalf Attending', key: 'isBehalfAttending', width: 15 },
      { header: 'Entry Check-in', key: 'entryCheckIn', width: 12 },
      { header: 'Lunch Check-in', key: 'lunchCheckIn', width: 12 },
      { header: 'Dinner Check-in', key: 'dinnerCheckIn', width: 12 },
      { header: 'Session Check-in', key: 'sessionCheckIn', width: 12 },
      { header: 'Registration Date', key: 'registrationDate', width: 18 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data
    registrations.forEach((reg, index) => {
      worksheet.addRow({
        serial: index + 1,
        qrCode: reg.qrCode,
        name: reg.name,
        village: reg.village,
        district: reg.district,
        mobile: reg.mobile,
        aadhaar: reg.aadhaarOrId,
        gender: reg.gender?.toUpperCase() || 'N/A',
        caste: reg.caste?.toUpperCase() || 'N/A',
        category: reg.category,
        behalfName: reg.behalfName || 'N/A',
        behalfMobile: reg.behalfMobile || 'N/A',
        behalfGender: reg.behalfGender?.toUpperCase() || 'N/A',
        isBehalfAttending: reg.isBehalfAttending ? 'Yes' : 'No',
        entryCheckIn: reg.hasEntryCheckIn ? 'Yes' : 'No',
        lunchCheckIn: reg.hasLunchCheckIn ? 'Yes' : 'No',
        dinnerCheckIn: reg.hasDinnerCheckIn ? 'Yes' : 'No',
        sessionCheckIn: reg.hasSessionCheckIn ? 'Yes' : 'No',
        registrationDate: new Date(reg.createdAt).toLocaleString(),
      });
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.values) {
        const lengths = column.values
          .filter(v => v !== null && v !== undefined)
          .map(v => v!.toString().length);
        if (lengths.length > 0) {
          const maxLength = Math.max(...lengths);
          column.width = Math.min(maxLength + 2, 50);
        }
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}