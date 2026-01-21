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

// The filter parameter is simplified to just have "date" instead of "fromDate" and "toDate"

async generateAttendanceReport(
  registrations: Registration[], 
  filters?: {
    date?: string;
    district?: string;
    block?: string;
  }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Attendance Report');

  // Add title and filter info
  worksheet.mergeCells('A1:I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'Event Attendance Report';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  
  // Add filter information
  let filterRow = 2;
  
  // ✅ UPDATED: Show single date instead of date range
  if (filters?.date) {
    worksheet.mergeCells(`A${filterRow}:I${filterRow}`);
    const dateFilterCell = worksheet.getCell(`A${filterRow}`);
    dateFilterCell.value = `Date: ${filters.date}`;
    dateFilterCell.font = { italic: true, size: 12 };
    dateFilterCell.alignment = { horizontal: 'center' };
    filterRow++;
  }
  
  if (filters?.district || filters?.block) {
    worksheet.mergeCells(`A${filterRow}:I${filterRow}`);
    const locationCell = worksheet.getCell(`A${filterRow}`);
    if (filters.block) {
      locationCell.value = `Location: ${filters.block}, ${filters.district}`;
    } else if (filters.district) {
      locationCell.value = `District: ${filters.district}`;
    }
    locationCell.font = { italic: true };
    locationCell.alignment = { horizontal: 'center' };
    filterRow++;
  }

  // Add empty row
  filterRow++;

  // Define columns starting from filterRow
  worksheet.getRow(filterRow).values = [
    'Sl No',
    'Name',
    'District',
    'Block',
    'Category',
    'Entry',
    'Lunch',
    'Dinner',
    'Session'
  ];

  // Style header row
  const headerRow = worksheet.getRow(filterRow);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 25;

  // Set column widths
  worksheet.columns = [
    { key: 'serial', width: 8 },
    { key: 'name', width: 25 },
    { key: 'district', width: 18 },
    { key: 'block', width: 18 },
    { key: 'category', width: 30 },
    { key: 'entry', width: 10 },
    { key: 'lunch', width: 10 },
    { key: 'dinner', width: 10 },
    { key: 'session', width: 10 },
  ];

  // Add data rows
  registrations.forEach((reg, index) => {
    const row = worksheet.addRow({
      serial: index + 1,
      name: reg.name,
      district: reg.district,
      block: reg.block,
      category: reg.category,
      entry: reg.hasEntryCheckIn ? '✓' : '✗',
      lunch: reg.hasLunchCheckIn ? '✓' : '✗',
      dinner: reg.hasDinnerCheckIn ? '✓' : '✗',
      session: reg.hasSessionCheckIn ? '✓' : '✗',
    });

    // Style check-in cells
    ['F', 'G', 'H', 'I'].forEach((col, idx) => {
      const cell = row.getCell(col);
      const checkInTypes = ['hasEntryCheckIn', 'hasLunchCheckIn', 'hasDinnerCheckIn', 'hasSessionCheckIn'];
      const hasCheckIn = reg[checkInTypes[idx]];
      
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { 
        bold: true, 
        size: 12,
        color: { argb: hasCheckIn ? 'FF22C55E' : 'FFEF4444' } // Green or Red
      };
    });

    // Alternate row colors
    if (index % 2 === 0) {
      row.eachCell((cell, colNumber) => {
        if (colNumber <= 5) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' },
          };
        }
      });
    }
  });

  // Add summary statistics at the bottom
  const summaryStartRow = worksheet.rowCount + 2;
  
  worksheet.mergeCells(`A${summaryStartRow}:E${summaryStartRow}`);
  const summaryTitleCell = worksheet.getCell(`A${summaryStartRow}`);
  summaryTitleCell.value = 'Summary Statistics';
  summaryTitleCell.font = { bold: true, size: 12 };
  summaryTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' },
  };

  const entryCount = registrations.filter(r => r.hasEntryCheckIn).length;
  const lunchCount = registrations.filter(r => r.hasLunchCheckIn).length;
  const dinnerCount = registrations.filter(r => r.hasDinnerCheckIn).length;
  const sessionCount = registrations.filter(r => r.hasSessionCheckIn).length;
  const total = registrations.length;

  const stats = [
    ['Total Registrations:', total],
    ['Entry Check-ins:', `${entryCount} (${total > 0 ? Math.round(entryCount/total*100) : 0}%)`],
    ['Lunch Check-ins:', `${lunchCount} (${total > 0 ? Math.round(lunchCount/total*100) : 0}%)`],
    ['Dinner Check-ins:', `${dinnerCount} (${total > 0 ? Math.round(dinnerCount/total*100) : 0}%)`],
    ['Session Check-ins:', `${sessionCount} (${total > 0 ? Math.round(sessionCount/total*100) : 0}%)`],
  ];

  stats.forEach((stat, idx) => {
    const row = worksheet.getRow(summaryStartRow + idx + 1);
    row.getCell(1).value = stat[0];
    row.getCell(2).value = stat[1];
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { horizontal: 'right' };
  });

  // Add borders to all cells
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= filterRow) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
}