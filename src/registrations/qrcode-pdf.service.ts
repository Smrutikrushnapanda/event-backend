import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { Registration } from './entities/registrations.entity';

interface QRLabel {
  qrCode: string;
  name: string;
  block: string;
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
    pageWidth: 595, // A4 width in points
    pageHeight: 842, // A4 height in points
    margin: 20,
    qrSize: 22.68, // 8mm in points (1mm = 2.835 points)
    labelWidth: 105,
    labelHeight: 60,
    spacingX: 5,
    spacingY: 5,
  };

  /**
   * Generate PDF with QR code labels (8mm x 8mm QR codes)
   * Multiple QR codes per page in a grid layout
   */
  async generateQRCodePDF(registrations: Registration[]): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!registrations || registrations.length === 0) {
          throw new Error('No registrations provided for PDF generation');
        }

        console.log(`📄 Generating QR code PDF for ${registrations.length} registrations...`);

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

        // Calculate grid layout
        const { cols, rows, labelsPerPage } = this.calculateGridLayout();

        console.log(`📊 Layout: ${cols} columns × ${rows} rows = ${labelsPerPage} labels per page`);

        let currentLabel = 0;

        for (const reg of registrations) {
          // Validate registration data
          if (!reg.qrCode || !reg.name || !reg.block) {
            console.warn(`⚠️ Skipping invalid registration: ${reg.name || 'Unknown'}`);
            continue;
          }

          // Calculate position
          const positionInPage = currentLabel % labelsPerPage;
          const col = positionInPage % cols;
          const row = Math.floor(positionInPage / cols);

          // Add new page if needed
          if (positionInPage === 0 && currentLabel > 0) {
            doc.addPage();
            console.log(`📄 Added page ${Math.floor(currentLabel / labelsPerPage) + 1}`);
          }

          // Calculate X and Y position with spacing
          const labelX = this.PDF_CONFIG.margin + col * (this.PDF_CONFIG.labelWidth + this.PDF_CONFIG.spacingX);
          const labelY = this.PDF_CONFIG.margin + row * (this.PDF_CONFIG.labelHeight + this.PDF_CONFIG.spacingY);

          // Draw label
          await this.drawLabel(doc, {
            qrCode: reg.qrCode,
            name: reg.name,
            block: reg.block,
          }, labelX, labelY);

          currentLabel++;

          // Log progress every 50 labels
          if (currentLabel % 50 === 0) {
            console.log(`✅ Processed ${currentLabel}/${registrations.length} labels`);
          }
        }

        // Finalize PDF
        doc.end();

        console.log(`✅ Generated PDF with ${currentLabel} QR codes on ${Math.ceil(currentLabel / labelsPerPage)} pages`);
      } catch (error) {
        console.error('❌ PDF generation error:', error);
        reject(error);
      }
    });
  }

  /**
   * Generate QR code PDF for specific block
   */
  async generateQRCodePDFForBlock(
    registrations: Registration[],
    blockName: string,
  ): Promise<Buffer> {
    console.log(`📄 Generating QR code PDF for ${blockName} block (${registrations.length} registrations)...`);
    return this.generateQRCodePDF(registrations);
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

          await this.drawLabel(doc, label, labelX, labelY);

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

      if (qrIndex === -1 || nameIndex === -1 || blockIndex === -1) {
        throw new Error('CSV must contain columns for qr, name, and block');
      }

      const labels: QRLabel[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

        if (values.length > Math.max(qrIndex, nameIndex, blockIndex)) {
          const label = {
            qrCode: values[qrIndex] || '',
            name: values[nameIndex] || '',
            block: values[blockIndex] || '',
          };

          // Only add valid labels
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
      // Generate QR code image
      const qrCodeDataUrl = await QRCode.toDataURL(label.qrCode, {
        width: 200, // Generate at high resolution
        margin: 0,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      // Convert data URL to buffer
      const base64Data = qrCodeDataUrl.split(',')[1];
      const qrImageBuffer = Buffer.from(base64Data, 'base64');

      // Draw border around the entire label
      doc
        .rect(labelX, labelY, this.PDF_CONFIG.labelWidth, this.PDF_CONFIG.labelHeight)
        .stroke();

      // QR code on the left with padding
      const qrX = labelX + 3;
      const qrY = labelY + (this.PDF_CONFIG.labelHeight - this.PDF_CONFIG.qrSize) / 2; // Center vertically

      doc.image(qrImageBuffer, qrX, qrY, {
        width: this.PDF_CONFIG.qrSize,
        height: this.PDF_CONFIG.qrSize,
      });

      // Text on the right side
      const textX = qrX + this.PDF_CONFIG.qrSize + 4;
      const textStartY = labelY + 6;
      const textWidth = this.PDF_CONFIG.labelWidth - this.PDF_CONFIG.qrSize - 10;

      // Draw NAME in bold and uppercase
      doc
        .fontSize(6)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(label.name.toUpperCase(), textX, textStartY, {
          width: textWidth,
          align: 'left',
          lineBreak: true,
        });

      // Draw BLOCK NAME in uppercase and bold
      const blockY = textStartY + 12;
      doc
        .fontSize(5)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(label.block.toUpperCase(), textX, blockY, {
          width: textWidth,
          align: 'left',
          lineBreak: true,
        });

      // Draw QR Code ID at bottom
      const qrIdY = labelY + this.PDF_CONFIG.labelHeight - 10;
      doc
        .fontSize(4)
        .font('Helvetica')
        .fillColor('#666666')
        .text(`ID: ${label.qrCode}`, textX, qrIdY, {
          width: textWidth,
          align: 'left',
          lineBreak: false,
          ellipsis: true,
        });

      // Reset fill color to black for next label
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