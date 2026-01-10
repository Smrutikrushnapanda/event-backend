import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { GuestPass } from './entities/guest-pass.entity';

@Injectable()
export class GuestPDFService {
  /**
   * Generate PDF with QR code labels (10mm x 10mm)
   */
  async generateQRCodePDF(passes: GuestPass[]): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        // ✅ CHECK: If no passes exist
        if (!passes || passes.length === 0) {
          console.log('⚠️ No guest passes found. Generate passes first.');
          reject(new Error('No guest passes found. Please generate passes first.'));
          return;
        }

        console.log(
          `📄 Generating QR code PDF for ${passes.length} guest passes...`,
        );

        const doc = new PDFDocument({
          size: 'A4',
          margin: 20,
          bufferPages: true,
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log('✅ PDF generation complete');
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Page dimensions
        const pageWidth = 595;
        const pageHeight = 842;
        const margin = 20;

        // QR code dimensions (8mm = 22.68 points)
        const qrSize = 22.68;
        const labelWidth = 105;
        const labelHeight = 55;
        const spacingX = 5;
        const spacingY = 5;

        // Calculate grid layout
        const cols = Math.floor(
          (pageWidth - 2 * margin) / (labelWidth + spacingX),
        );
        const rows = Math.floor(
          (pageHeight - 2 * margin) / (labelHeight + spacingY),
        );
        const labelsPerPage = cols * rows;

        console.log(
          `📊 Layout: ${cols} columns × ${rows} rows = ${labelsPerPage} labels per page`,
        );

        let currentLabel = 0;

        for (const pass of passes) {
          const pageIndex = Math.floor(currentLabel / labelsPerPage);
          const positionInPage = currentLabel % labelsPerPage;
          const col = positionInPage % cols;
          const row = Math.floor(positionInPage / cols);

          if (positionInPage === 0 && currentLabel > 0) {
            doc.addPage();
            console.log(`📄 Added page ${pageIndex + 1}`);
          }

          const labelX = margin + col * (labelWidth + spacingX);
          const labelY = margin + row * (labelHeight + spacingY);

          try {
            // ✅ Validate QR code data
            if (!pass.qrCode) {
              console.warn(`⚠️ Skipping pass ${pass.id} - no QR code`);
              continue;
            }

            const qrCodeDataUrl = await QRCode.toDataURL(pass.qrCode, {
              width: 200,
              margin: 0,
              color: {
                dark: '#000000',
                light: '#FFFFFF',
              },
            });

            const base64Data = qrCodeDataUrl.split(',')[1];
            const qrImageBuffer = Buffer.from(base64Data, 'base64');

            // Draw border
            doc.rect(labelX, labelY, labelWidth, labelHeight).stroke();

            // QR code on the left
            const qrX = labelX + 3;
            const qrY = labelY + (labelHeight - qrSize) / 2;

            doc.image(qrImageBuffer, qrX, qrY, {
              width: qrSize,
              height: qrSize,
            });

            // Text on the right
            const textX = qrX + qrSize + 4;
            const textY = labelY + 16;
            const textWidth = labelWidth - qrSize - 10;

            // ✅ Display name or category (with fallback)
            const displayName = pass.name || `${pass.category} Guest`;

            doc
              .fontSize(6)
              .font('Helvetica-Bold')
              .text(displayName, textX, textY, {
                width: textWidth,
                align: 'left',
                lineBreak: true,
              });

            // QR Code at bottom
            const qrTextY = labelY + labelHeight - 18;
            doc
              .fontSize(5)
              .font('Helvetica')
              .text(pass.qrCode, textX, qrTextY, {
                width: textWidth,
                align: 'left',
                lineBreak: false,
                ellipsis: true,
              });

            currentLabel++;

            if (currentLabel % 50 === 0) {
              console.log(
                `✅ Processed ${currentLabel}/${passes.length} labels`,
              );
            }
          } catch (error) {
            console.error(`❌ Error generating QR for ${pass.qrCode}:`, error);
            // Continue with other passes
          }
        }

        // ✅ CHECK: If no labels were generated
        if (currentLabel === 0) {
          reject(new Error('Failed to generate any QR codes. All passes may be invalid.'));
          return;
        }

        doc.end();

        console.log(
          `✅ Generated PDF with ${currentLabel} QR codes on ${Math.ceil(currentLabel / labelsPerPage)} pages`,
        );
      } catch (error) {
        console.error('❌ PDF generation error:', error);
        reject(error);
      }
    });
  }
}