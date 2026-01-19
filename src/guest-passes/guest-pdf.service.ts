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

        // QR code dimensions
        const qrSize = 35;
        const labelWidth = 110;
        const labelHeight = 60; // Increased to accommodate all elements
        const spacingX = 3;
        const spacingY = 9;

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

            // ✅ Check if this is a visitor or VVIP (not delegate)
            const isVisitorOrVVIP = pass.category?.toLowerCase() === 'visitor' || 
                                     pass.category?.toLowerCase() === 'vvip';

            // ✅ Add border for Visitors & VVIPs
            if (isVisitorOrVVIP) {
              doc
                .rect(labelX, labelY, labelWidth, labelHeight)
                .stroke('#000000');
            }

            // ✅ QR code on the LEFT
            const qrX = labelX + 3;
            const qrY = labelY + 5;

            doc.image(qrImageBuffer, qrX, qrY, {
              width: qrSize,
              height: qrSize,
            });

            const textX = qrX + qrSize + 8; // 8pt gap from QR
            let textY = labelY + 8;
            const textWidth = labelWidth - qrSize - 12;

            if (isVisitorOrVVIP) {
              // ✅ NEW DESIGN for Visitors and VVIPs
              // Just QR code with border and blank space (no text, no underline)
              
            } else {
              // ✅ ORIGINAL DESIGN for Delegates (UNCHANGED)
              
              // Display Name
              const displayName = pass.name || `${pass.category} Guest`;

              doc
                .fontSize(7)
                .font('Helvetica-Bold')
                .text(displayName, textX, textY, {
                  width: textWidth,
                  align: 'left',
                  lineBreak: true,
                });

              // Calculate height of name text
              const nameHeight = doc.heightOfString(displayName, {
                width: textWidth,
                lineBreak: true,
              });

              textY += nameHeight + 4; // 4pt gap between name and designation

              // Display Designation (if available)
              if (pass.designation) {
                doc
                  .fontSize(6)
                  .font('Helvetica')
                  .text(pass.designation, textX, textY, {
                    width: textWidth,
                    align: 'left',
                    lineBreak: true,
                  });
              }
            }

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