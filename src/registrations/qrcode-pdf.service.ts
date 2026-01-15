import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { Registration } from './entities/registrations.entity';

interface QRLabel {
  qrCode: string;
  name: string;
  block: string;
  district: string;
}

interface PDFConfig {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  qrSize: number;
  labelWidth: number;
  labelHeight: number;
  spacingX: number;
  spacingY: number;
}

@Injectable()
export class QRCodePDFService {
  private readonly PDF_CONFIG: PDFConfig = {
    pageWidth: 595,
    pageHeight: 842,
    margin: 20,
    qrSize: 20.00,
    labelWidth: 105,
    labelHeight: 46,
    spacingX: 5,
    spacingY: 5,
  };

  /**
   * Generate PDF with QR code labels (8mm x 8mm QR codes)
   * Multiple QR codes per page in a grid layout
   */
  async generateQRCodePDF(
    registrations: Registration[],
    startIndex: number = 1
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!registrations || registrations.length === 0) {
          throw new Error('No registrations provided for PDF generation');
        }

        console.log(`📄 Generating QR code PDF for ${registrations.length} registrations (starting at #${startIndex})...`);

        const doc = new PDFDocument({
          size: 'A4',
          margin: this.PDF_CONFIG.margin,
          bufferPages: true,
          autoFirstPage: true,
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log('✅ PDF generation complete');
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        const { cols, rows, labelsPerPage } = this.calculateGridLayout();

        console.log(`📊 Layout: ${cols} columns × ${rows} rows = ${labelsPerPage} labels per page`);

        let currentLabel = 0;

        for (const reg of registrations) {
          if (!reg.qrCode || !reg.name || !reg.block) {
            console.warn(`⚠️ Skipping invalid registration: ${reg.name || 'Unknown'}`);
            continue;
          }

          const positionInPage = currentLabel % labelsPerPage;
          const col = positionInPage % cols;
          const row = Math.floor(positionInPage / cols);

          if (positionInPage === 0 && currentLabel > 0) {
            doc.addPage();
            console.log(`📄 Added page ${Math.floor(currentLabel / labelsPerPage) + 1}`);
          }

          const labelX = this.PDF_CONFIG.margin + col * (this.PDF_CONFIG.labelWidth + this.PDF_CONFIG.spacingX);
          const labelY = this.PDF_CONFIG.margin + row * (this.PDF_CONFIG.labelHeight + this.PDF_CONFIG.spacingY);

          await this.drawLabel(
            doc,
            {
              qrCode: reg.qrCode,
              name: reg.name,
              block: reg.block,
              district: reg.district,
            },
            labelX,
            labelY
          );

          currentLabel++;

          if (currentLabel % 50 === 0) {
            console.log(`✅ Processed ${currentLabel}/${registrations.length} labels`);
          }
        }

        doc.end();

        console.log(`✅ Generated PDF with ${currentLabel} QR codes on ${Math.ceil(currentLabel / labelsPerPage)} pages`);
      } catch (error) {
        console.error('❌ PDF generation error:', error);
        reject(error);
      }
    });
  }

  /**
   * Generate PDF for a specific range of registrations
   */
  async generateQRCodePDFRange(
    registrations: Registration[],
    startRange: number,
    endRange: number
  ): Promise<Buffer> {
    const start = Math.max(0, startRange - 1);
    const end = Math.min(registrations.length, endRange);
    
    if (start >= registrations.length || start >= end) {
      throw new Error(`Invalid range: ${startRange}-${endRange}`);
    }

    const rangeRegistrations = registrations.slice(start, end);
    
    console.log(`📄 Generating QR PDF for range ${startRange}-${endRange} (${rangeRegistrations.length} items)...`);
    
    return this.generateQRCodePDF(rangeRegistrations, startRange);
  }

  /**
   * Generate QR code PDF for specific block
   */
  async generateQRCodePDFForBlock(
    registrations: Registration[],
    blockName: string,
  ): Promise<Buffer> {
    console.log(`📄 Generating QR code PDF for ${blockName} block (${registrations.length} registrations)...`);
    return this.generateQRCodePDF(registrations, 1);
  }

  /**
   * Generate PDF from CSV content
   */
  async generateQRCodePDFFromCSV(csvContent: string): Promise<Buffer> {
    const labels = this.parseCSVToLabels(csvContent);
    
    if (labels.length === 0) {
      throw new Error('No valid labels found in CSV');
    }

    console.log(`📄 Generating QR PDF from CSV (${labels.length} records)...`);

    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: this.PDF_CONFIG.margin,
          bufferPages: true,
          autoFirstPage: true,
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const { cols, rows, labelsPerPage } = this.calculateGridLayout();

        let currentLabel = 0;

        for (const label of labels) {
          if (!label.qrCode || !label.name || !label.block) {
            console.warn(`⚠️ Skipping invalid label: ${label.name || 'Unknown'}`);
            continue;
          }

          const positionInPage = currentLabel % labelsPerPage;
          const col = positionInPage % cols;
          const row = Math.floor(positionInPage / cols);

          if (positionInPage === 0 && currentLabel > 0) {
            doc.addPage();
          }

          const labelX = this.PDF_CONFIG.margin + col * (this.PDF_CONFIG.labelWidth + this.PDF_CONFIG.spacingX);
          const labelY = this.PDF_CONFIG.margin + row * (this.PDF_CONFIG.labelHeight + this.PDF_CONFIG.spacingY);

          await this.drawLabel(
            doc,
            label,
            labelX,
            labelY
          );

          currentLabel++;

          if (currentLabel % 50 === 0) {
            console.log(`✅ Processed ${currentLabel}/${labels.length} labels`);
          }
        }

        doc.end();
        console.log(`✅ Generated PDF with ${currentLabel} QR codes from CSV`);
      } catch (error) {
        console.error('❌ CSV PDF generation error:', error);
        reject(error);
      }
    });
  }

  /**
   * Parse CSV and generate QR labels
   */
  parseCSVToLabels(csvContent: string): QRLabel[] {
    try {
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV must have headers and at least one data row');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const qrIndex = headers.findIndex(h => h.includes('qr'));
      const nameIndex = headers.findIndex(h => h.includes('name'));
      const blockIndex = headers.findIndex(h => h.includes('block'));
      const districtIndex = headers.findIndex(h => h.includes('district'));

      if (qrIndex === -1 || nameIndex === -1 || blockIndex === -1 || districtIndex === -1) {
        throw new Error('CSV must contain columns for qr, name, block and district');
      }

      const labels: QRLabel[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

        if (values.length > Math.max(qrIndex, nameIndex, blockIndex, districtIndex)) {
          const label = {
            qrCode: values[qrIndex] || '',
            name: values[nameIndex] || '',
            block: values[blockIndex] || '',
            district: values[districtIndex] || '',
          };

          if (label.qrCode && label.name && label.block) {
            labels.push(label);
          }
        }
      }

      console.log(`✅ Parsed ${labels.length} valid labels from CSV`);
      return labels;
    } catch (error) {
      console.error('❌ CSV parsing error:', error);
      throw error;
    }
  }

  /**
   * Calculate grid layout based on configuration
   */
  private calculateGridLayout() {
    const cols = Math.floor(
      (this.PDF_CONFIG.pageWidth - 2 * this.PDF_CONFIG.margin) / 
      (this.PDF_CONFIG.labelWidth + this.PDF_CONFIG.spacingX)
    );
    const rows = Math.floor(
      (this.PDF_CONFIG.pageHeight - 2 * this.PDF_CONFIG.margin) / 
      (this.PDF_CONFIG.labelHeight + this.PDF_CONFIG.spacingY)
    );
    const labelsPerPage = cols * rows;

    return { cols, rows, labelsPerPage };
  }

  /**
   * Draw a single QR code label
   */
  private async drawLabel(
    doc: PDFKit.PDFDocument,
    label: QRLabel,
    labelX: number,
    labelY: number,
  ): Promise<void> {
    try {
      const cleanQrCode = label.qrCode.replace(/^EVENT-/, '');

      const qrCodeDataUrl = await QRCode.toDataURL(label.qrCode, {
        width: 300,
        margin: 0,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      const base64Data = qrCodeDataUrl.split(',')[1];
      const qrImageBuffer = Buffer.from(base64Data, 'base64');

      // Border
      //doc
      //  .rect(labelX, labelY, this.PDF_CONFIG.labelWidth, this.PDF_CONFIG.labelHeight)
      //  .lineWidth(1)
      //  .stroke();

      const padding = 6;
      const topPadding = 8;

      // --- QR ---
      const qrX = labelX + padding;
      const qrY = labelY + topPadding;

      doc.image(qrImageBuffer, qrX, qrY, {
        width: this.PDF_CONFIG.qrSize,
        height: this.PDF_CONFIG.qrSize,
      });

      // QR text below (no EVENT-)
      doc
        .font('Helvetica')
        .fontSize(4)
        .fillColor('#000000')
        .text(cleanQrCode, qrX, qrY + this.PDF_CONFIG.qrSize + 1, {
          width: this.PDF_CONFIG.qrSize,
          align: 'center',
        });

      // --- TEXT AREA ---
      const textX = qrX + this.PDF_CONFIG.qrSize + 8;
      const textWidth = this.PDF_CONFIG.labelWidth - (this.PDF_CONFIG.qrSize + padding * 3);

      let currentY = labelY + 10;

      // ✅ NAME (UPPERCASE, wrap enabled)
      currentY = doc
        .font('Helvetica-Bold')
        .fontSize(5)
        .fillColor('#000000')
        .text(`NAME: ${label.name.toUpperCase()}`, textX, currentY, {
          width: textWidth,
          lineGap: 0,
        }).y;

      // DISTRICT
      currentY = doc
        .font('Helvetica')
        .fontSize(5)
        .fillColor('#000000')
        .text(`DISTRICT: ${label.district.toUpperCase()}`, textX, currentY, {
          width: textWidth,
          lineGap: 0,
        }).y;

      // BLOCK
      doc
        .font('Helvetica')
        .fontSize(5)
        .fillColor('#000000')
        .text(`BLOCK: ${label.block.toUpperCase()}`, textX, currentY, {
          width: textWidth,
          lineGap: 0,
        });

      doc.fillColor('#000000');
    } catch (error) {
      console.error(`❌ Error generating QR for ${label.name}:`, error);
      throw error;
    }
  }

  /**
   * Get estimated number of pages for given number of registrations
   */
  getEstimatedPages(registrationCount: number): number {
    const { labelsPerPage } = this.calculateGridLayout();
    return Math.ceil(registrationCount / labelsPerPage);
  }

  /**
   * Get PDF configuration details
   */
  getPDFConfig() {
    const { cols, rows, labelsPerPage } = this.calculateGridLayout();
    return {
      ...this.PDF_CONFIG,
      cols,
      rows,
      labelsPerPage,
    };
  }
}