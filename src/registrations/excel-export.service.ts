import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as QRCode from 'qrcode';
import { Registration } from './entities/registrations.entity';

@Injectable()
export class ExcelExportService {
  async generateRegistrationsExcel(registrations: Registration[]): Promise<Buffer> {
    console.log(`📊 Generating Excel for ${registrations.length} registrations...`);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registrations');

    // ✅ Set column widths
    worksheet.columns = [
      { header: 'Sr. No.', key: 'srNo', width: 8 },
      { header: 'QR Code', key: 'qrCode', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Aadhaar', key: 'aadhaar', width: 18 },
      { header: 'Village', key: 'village', width: 20 },
      { header: 'GP', key: 'gp', width: 20 },
      { header: 'Block', key: 'block', width: 20 },
      { header: 'District', key: 'district', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
    ];

    // ✅ Style header row
    worksheet.getRow(1).font = { bold: true, size: 11 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 25;

    // ✅ Process registrations in batches to avoid memory issues
    const batchSize = 100;
    for (let batchStart = 0; batchStart < registrations.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, registrations.length);
      console.log(`Processing batch ${batchStart + 1}-${batchEnd} of ${registrations.length}...`);

      for (let i = batchStart; i < batchEnd; i++) {
        const reg = registrations[i];
        const rowIndex = i + 2;

        // ✅ Optimized QR code generation (smaller size, faster)
        const qrCodeDataUrl = await QRCode.toDataURL(reg.qrCode, {
          width: 100,  // ✅ Reduced from 200
          margin: 0,   // ✅ No margin
          errorCorrectionLevel: 'M',  // ✅ Medium (not High)
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const imageId = workbook.addImage({
          buffer: imageBuffer as any,
          extension: 'png',
        });

        worksheet.addRow({
          srNo: i + 1,
          qrCode: '',
          name: reg.name,
          mobile: reg.mobile,
          aadhaar: reg.aadhaarOrId || 'Not Provided',
          village: reg.village,
          gp: reg.gp,
          block: reg.block,
          district: reg.district,
          category: reg.category,
          date: new Date(reg.createdAt).toLocaleDateString('en-IN'),
        });

        // ✅ Smaller QR code image (80x80 instead of 150x150)
        worksheet.addImage(imageId, {
          tl: { col: 1, row: rowIndex - 1 },
          ext: { width: 80, height: 80 },
        });

        // ✅ Smaller row height
        worksheet.getRow(rowIndex).height = 65;
        worksheet.getRow(rowIndex).alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
      }
    }

    // ✅ Add borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    console.log('✅ Excel generation complete');
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  async generateBlockExcel(registrations: Registration[], blockName: string): Promise<Buffer> {
    console.log(`📊 Generating Excel for ${blockName} block (${registrations.length} registrations)...`);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${blockName} Block`);

    worksheet.columns = [
      { header: 'Sr. No.', key: 'srNo', width: 8 },
      { header: 'QR Code', key: 'qrCode', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Aadhaar', key: 'aadhaar', width: 18 },
      { header: 'Village', key: 'village', width: 20 },
      { header: 'GP', key: 'gp', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true, size: 11 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 25;

    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      const rowIndex = i + 2;

      const qrCodeDataUrl = await QRCode.toDataURL(reg.qrCode, {
        width: 100,
        margin: 0,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
      });

      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const imageId = workbook.addImage({
        buffer: imageBuffer as any,
        extension: 'png',
      });

      worksheet.addRow({
        srNo: i + 1,
        qrCode: '',
        name: reg.name,
        mobile: reg.mobile,
        aadhaar: reg.aadhaarOrId || 'Not Provided',
        village: reg.village,
        gp: reg.gp,
        category: reg.category,
        date: new Date(reg.createdAt).toLocaleDateString('en-IN'),
      });

      worksheet.addImage(imageId, {
        tl: { col: 1, row: rowIndex - 1 },
        ext: { width: 80, height: 80 },
      });

      worksheet.getRow(rowIndex).height = 65;
      worksheet.getRow(rowIndex).alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
    }

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    console.log('✅ Block excel generation complete');
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  // ✅ NEW: Generate CSV (lightweight alternative)
  async generateRegistrationsCSV(registrations: Registration[]): Promise<string> {
    console.log(`📊 Generating CSV for ${registrations.length} registrations...`);
    
    const headers = [
      'Sr. No.',
      'QR Code',
      'Name',
      'Mobile',
      'Aadhaar',
      'Village',
      'GP',
      'Block',
      'District',
      'Category',
      'Registration Date',
    ];

    const rows = registrations.map((reg, index) => [
      index + 1,
      reg.qrCode,
      `"${reg.name}"`,
      reg.mobile,
      reg.aadhaarOrId || 'Not Provided',
      `"${reg.village}"`,
      `"${reg.gp}"`,
      `"${reg.block}"`,
      `"${reg.district}"`,
      `"${reg.category}"`,
      new Date(reg.createdAt).toLocaleDateString('en-IN'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    console.log('✅ CSV generation complete');
    return csv;
  }
}