const puppeteer = require('puppeteer');
const fs = require('fs');

async function createPDFFromText(textFile, outputFile) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Read the text file
  const text = fs.readFileSync(textFile, 'utf8');
  const lines = text.split('\n');
  
  // Create HTML content
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          margin: 20px;
        }
        .header {
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 10px;
        }
        .line {
          margin-bottom: 2px;
        }
      </style>
    </head>
    <body>
      ${lines.map(line => `<div class="line">${line}</div>`).join('')}
    </body>
    </html>
  `;
  
  await page.setContent(html);
  
  // Generate PDF
  await page.pdf({
    path: outputFile,
    format: 'A4',
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    }
  });
  
  await browser.close();
  console.log(`Created: ${outputFile}`);
}

async function createAllPDFs() {
  try {
    await createPDFFromText('computer_po_content.txt', 'computer_po_final.pdf');
    await createPDFFromText('computer_invoice_identical_content.txt', 'computer_invoice_identical_final.pdf');
    await createPDFFromText('computer_invoice_differences_content.txt', 'computer_invoice_differences_final.pdf');
    
    console.log('All computer hardware PDFs created successfully!');
  } catch (error) {
    console.error('Error creating PDFs:', error);
  }
}

createAllPDFs();

