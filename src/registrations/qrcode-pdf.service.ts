import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { Registration } from './entities/registrations.entity';

interface QRLabel {
  qrCode: string;
  name: string;
  block: string;
}

@Injectable()
export class QRCodePDFService {
  /**
   * Generate PDF with QR code labels (10mm x 10mm)
   * Multiple QR codes per page in a grid layout
   */
  async generateQRCodePDF(registrations: Registration[]): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`📄 Generating QR code PDF for ${registrations.length} registrations...`);

        const doc = new PDFDocument({
          size: 'A4',
          margin: 20,
          bufferPages: true
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log('✅ PDF generation complete');
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Page dimensions (A4 in points: 595 x 842)
        const pageWidth = 595;
        const pageHeight = 842;
        const margin = 20;

        // QR code dimensions (8mm = 22.68 points) - reduced height
        const qrSize = 22.68; // 8mm in points
        const labelWidth = 105; // Total label width including text
        const labelHeight = 55; // Increased height for full name
        const spacingX = 5; // Horizontal spacing between labels
        const spacingY = 5; // Vertical spacing between labels

        // Calculate grid layout
        const cols = Math.floor((pageWidth - 2 * margin) / (labelWidth + spacingX));
        const rows = Math.floor((pageHeight - 2 * margin) / (labelHeight + spacingY));
        const labelsPerPage = cols * rows;

        console.log(`📊 Layout: ${cols} columns × ${rows} rows = ${labelsPerPage} labels per page`);

        let currentLabel = 0;

        for (const reg of registrations) {
          // Calculate position
          const pageIndex = Math.floor(currentLabel / labelsPerPage);
          const positionInPage = currentLabel % labelsPerPage;
          const col = positionInPage % cols;
          const row = Math.floor(positionInPage / cols);

          // Add new page if needed
          if (positionInPage === 0 && currentLabel > 0) {
            doc.addPage();
            console.log(`📄 Added page ${pageIndex + 1}`);
          }

          // Calculate X and Y position with spacing
          const labelX = margin + col * (labelWidth + spacingX);
          const labelY = margin + row * (labelHeight + spacingY);

          // Generate QR code image
          try {
            const qrCodeDataUrl = await QRCode.toDataURL(reg.qrCode, {
              width: 200, // Generate at high resolution
              margin: 0,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });

            // Convert data URL to buffer
            const base64Data = qrCodeDataUrl.split(',')[1];
            const qrImageBuffer = Buffer.from(base64Data, 'base64');

            // Draw border around the entire label
            doc.rect(labelX, labelY, labelWidth, labelHeight)
               .stroke();

            // QR code on the left with padding
            const qrX = labelX + 3;
            const qrY = labelY + (labelHeight - qrSize) / 2; // Center vertically
            
            doc.image(qrImageBuffer, qrX, qrY, {
              width: qrSize,
              height: qrSize
            });

            // Text on the right side
            const textX = qrX + qrSize + 4;
            const textY = labelY + 16;
            const textWidth = labelWidth - qrSize - 10;

            // Draw full name (allow wrapping, no height limit)
            doc.fontSize(6)
               .font('Helvetica-Bold')
               .text(reg.name, textX, textY, {
                 width: textWidth,
                 align: 'left',
                 lineBreak: true
               });

            // Draw block below name (at bottom of label)
            const blockY = labelY + labelHeight - 18;
            doc.fontSize(5)
               .font('Helvetica')
               .text(reg.block, textX, blockY, {
                 width: textWidth,
                 align: 'left',
                 lineBreak: false,
                 ellipsis: true
               });

            currentLabel++;

            // Log progress every 50 labels
            if (currentLabel % 50 === 0) {
              console.log(`✅ Processed ${currentLabel}/${registrations.length} labels`);
            }
          } catch (error) {
            console.error(`❌ Error generating QR for ${reg.name}:`, error);
            // Continue with other registrations
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
  async generateQRCodePDFForBlock(registrations: Registration[], blockName: string): Promise<Buffer> {
    console.log(`📄 Generating QR code PDF for ${blockName} block (${registrations.length} registrations)...`);
    return this.generateQRCodePDF(registrations);
  }

  /**
   * Parse CSV and generate QR labels
   */
  parseCSVToLabels(csvContent: string): QRLabel[] {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const qrIndex = headers.findIndex(h => h.includes('qr'));
    const nameIndex = headers.findIndex(h => h.includes('name'));
    const blockIndex = headers.findIndex(h => h.includes('block'));

    const labels: QRLabel[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

      if (values.length > Math.max(qrIndex, nameIndex, blockIndex)) {
        labels.push({
          qrCode: values[qrIndex] || '',
          name: values[nameIndex] || '',
          block: values[blockIndex] || ''
        });
      }
    }

    return labels;
  }

  /**
   * Generate PDF from CSV content
   */
  async generateQRCodePDFFromCSV(csvContent: string): Promise<Buffer> {
    const labels = this.parseCSVToLabels(csvContent);
    console.log(`📄 Generating QR PDF from CSV (${labels.length} records)...`);

    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 20,
          bufferPages: true
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const pageWidth = 595;
        const pageHeight = 842;
        const margin = 20;
        const qrSize = 22.68; // 8mm - reduced
        const labelWidth = 105;
        const labelHeight = 55; // Increased for full name
        const spacingX = 5;
        const spacingY = 5;

        const cols = Math.floor((pageWidth - 2 * margin) / (labelWidth + spacingX));
        const rows = Math.floor((pageHeight - 2 * margin) / (labelHeight + spacingY));
        const labelsPerPage = cols * rows;

        let currentLabel = 0;

        for (const label of labels) {
          const positionInPage = currentLabel % labelsPerPage;
          const col = positionInPage % cols;
          const row = Math.floor(positionInPage / cols);

          if (positionInPage === 0 && currentLabel > 0) {
            doc.addPage();
          }

          // Center QR code in label space with spacing
          const labelX = margin + col * (labelWidth + spacingX);
          const labelY = margin + row * (labelHeight + spacingY);

          try {
            const qrCodeDataUrl = await QRCode.toDataURL(label.qrCode, {
              width: 200,
              margin: 0,
              color: { dark: '#000000', light: '#FFFFFF' }
            });

            const base64Data = qrCodeDataUrl.split(',')[1];
            const qrImageBuffer = Buffer.from(base64Data, 'base64');

            // Draw border around the entire label
            doc.rect(labelX, labelY, labelWidth, labelHeight)
               .stroke();

            // QR code on the left with padding
            const qrX = labelX + 3;
            const qrY = labelY + (labelHeight - qrSize) / 2; // Center vertically
            
            doc.image(qrImageBuffer, qrX, qrY, {
              width: qrSize,
              height: qrSize
            });

            // Text on the right side
            const textX = qrX + qrSize + 4;
            const textY = labelY + 15;
            const textWidth = labelWidth - qrSize - 10;
            
            // Draw full name (allow wrapping, no height limit)
            doc.fontSize(6)
               .font('Helvetica-Bold')
               .text(label.name, textX, textY, {
                 width: textWidth,
                 align: 'left',
                 lineBreak: true
               });

            // Draw block at bottom of label
            const blockY = labelY + labelHeight - 10;
            doc.fontSize(5)
               .font('Helvetica')
               .text(label.block, textX, blockY, {
                 width: textWidth,
                 align: 'left',
                 ellipsis: true
               });

            currentLabel++;
          } catch (error) {
            console.error(`❌ Error generating QR for ${label.name}:`, error);
          }
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}