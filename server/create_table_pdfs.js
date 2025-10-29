const puppeteer = require('puppeteer');
const fs = require('fs');

async function createTablePDF(textFile, outputFile) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Read the text file
  const text = fs.readFileSync(textFile, 'utf8');
  const lines = text.split('\n');
  
  // Parse the content
  let header = '';
  let vendorInfo = '';
  let items = [];
  let financials = '';
  let paymentInfo = '';
  
  let currentSection = 'header';
  let itemData = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('PURCHASE ORDER') || line.includes('INVOICE')) {
      header = line;
      currentSection = 'vendor';
    } else if (line.includes('PO Number:') || line.includes('Invoice Number:') || 
               line.includes('Date:') || line.includes('Vendor:') || line.includes('Address:')) {
      vendorInfo += line + '<br>';
    } else if (line.includes('Item #DescriptionQtyUnit PriceTotal')) {
      currentSection = 'items';
    } else if (line.includes('Subtotal:') || line.includes('Discount:') || 
               line.includes('Tax:') || line.includes('Total:')) {
      financials += line + '<br>';
    } else if (line.includes('Payment Instructions:') || line.includes('Terms & Conditions:')) {
      currentSection = 'payment';
      paymentInfo += line + '<br>';
    } else if (currentSection === 'items' && line.match(/^\d{3}$/)) {
      // Item number
      if (Object.keys(itemData).length > 0) {
        items.push(itemData);
      }
      itemData = { itemNo: line };
    } else if (currentSection === 'items' && itemData.itemNo && !itemData.description) {
      // Description
      itemData.description = line;
    } else if (currentSection === 'items' && itemData.description && !itemData.details) {
      // Details (Qty$UnitPrice$Total)
      const match = line.match(/^(\d+)\$(\d+(?:\.\d+)?)\$(\d+(?:\.\d+)?)$/);
      if (match) {
        itemData.qty = match[1];
        itemData.unitPrice = match[2];
        itemData.total = match[3];
      }
    } else if (currentSection === 'payment') {
      paymentInfo += line + '<br>';
    }
  }
  
  // Add the last item
  if (Object.keys(itemData).length > 0) {
    items.push(itemData);
  }
  
  // Create HTML with proper table
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          margin: 20px;
        }
        .header {
          font-weight: bold;
          font-size: 18px;
          text-align: center;
          margin-bottom: 20px;
        }
        .vendor-info {
          margin-bottom: 20px;
          line-height: 1.5;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
          vertical-align: top;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .item-no {
          width: 8%;
          text-align: center;
        }
        .description {
          width: 50%;
        }
        .qty {
          width: 10%;
          text-align: center;
        }
        .unit-price {
          width: 16%;
          text-align: right;
        }
        .total {
          width: 16%;
          text-align: right;
        }
        .financials {
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .payment-info {
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="header">${header}</div>
      
      <div class="vendor-info">${vendorInfo}</div>
      
      <table>
        <thead>
          <tr>
            <th class="item-no">Item #</th>
            <th class="description">Description</th>
            <th class="qty">Qty</th>
            <th class="unit-price">Unit Price</th>
            <th class="total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td class="item-no">${item.itemNo}</td>
              <td class="description">${item.description}</td>
              <td class="qty">${item.qty}</td>
              <td class="unit-price">$${item.unitPrice}</td>
              <td class="total">$${item.total}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="financials">${financials}</div>
      
      <div class="payment-info">${paymentInfo}</div>
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
  console.log(`Created table PDF: ${outputFile}`);
}

async function createAllTablePDFs() {
  try {
    // Create text files first
    const poContent = `PURCHASE ORDER
PO Number: PO-00456
Date: 15/08/2023
Vendor: Tech Solutions Inc.
Address: 123 Tech Street, Silicon Valley, CA 94000
Item #DescriptionQtyUnit PriceTotal
301
Dell OptiPlex Desktop - Intel i7, 16GB RAM, 512GB SSD
2$1200$2400
302
HP LaserJet Pro Printer - Wireless, Duplex Printing
1$350$350
303
Microsoft Office 365 Business - Annual License
5$120$600
304
Cisco Catalyst Switch - 24 Port Gigabit
1$800$800
305
Samsung 27" Monitor - 4K UHD, USB-C
3$450$1350
Subtotal:$5500
Discount:-$275
Tax:$522.5
Total:$5747.5
Payment Instructions:
Tech Solutions Bank
Acc. No: 4567 0000 2222 3333
Sort Code: 12-34-56
Terms & Conditions:
All purchase orders are payable within thirty (30) days of the order date.`;

    const invoiceIdenticalContent = `INVOICE
Invoice Number: INV-00456
Date: 15/08/2023
Vendor: Tech Solutions Inc.
Address: 123 Tech Street, Silicon Valley, CA 94000
Item #DescriptionQtyUnit PriceTotal
301
Dell OptiPlex Desktop - Intel i7, 16GB RAM, 512GB SSD
2$1200$2400
302
HP LaserJet Pro Printer - Wireless, Duplex Printing
1$350$350
303
Microsoft Office 365 Business - Annual License
5$120$600
304
Cisco Catalyst Switch - 24 Port Gigabit
1$800$800
305
Samsung 27" Monitor - 4K UHD, USB-C
3$450$1350
Subtotal:$5500
Discount:-$275
Tax:$522.5
Total:$5747.5
Payment Instructions:
Tech Solutions Bank
Acc. No: 4567 0000 2222 3333
Sort Code: 12-34-56
Terms & Conditions:
All purchase orders are payable within thirty (30) days of the order date.`;

    const invoiceDifferencesContent = `INVOICE
Invoice Number: INV-00456
Date: 15/08/2023
Vendor: Tech Solutions Inc.
Address: 123 Tech Street, Silicon Valley, CA 94000
Item #DescriptionQtyUnit PriceTotal
301
Dell OptiPlex Desktop - Intel i7, 16GB RAM, 512GB SSD
2$1200$2400
302
HP LaserJet Pro Printer - Wireless, Duplex Printing
1$350$350
303
Microsoft Office 365 Business Premium - Annual License
5$120$600
304
Cisco Catalyst Switch - 24 Port Gigabit
2$800$1600
305
Samsung 27" Monitor - 4K UHD, USB-C
3$480$1440
Subtotal:$6390
Discount:-$275
Tax:$611.5
Total:$6726.5
Payment Instructions:
Tech Solutions Bank
Acc. No: 4567 0000 2222 3333
Sort Code: 12-34-56
Terms & Conditions:
All purchase orders are payable within thirty (30) days of the order date.`;

    // Write text files
    fs.writeFileSync('temp_po.txt', poContent);
    fs.writeFileSync('temp_invoice_identical.txt', invoiceIdenticalContent);
    fs.writeFileSync('temp_invoice_differences.txt', invoiceDifferencesContent);

    // Create PDFs
    await createTablePDF('temp_po.txt', 'computer_po_table.pdf');
    await createTablePDF('temp_invoice_identical.txt', 'computer_invoice_identical_table.pdf');
    await createTablePDF('temp_invoice_differences.txt', 'computer_invoice_differences_table.pdf');
    
    // Clean up temp files
    fs.unlinkSync('temp_po.txt');
    fs.unlinkSync('temp_invoice_identical.txt');
    fs.unlinkSync('temp_invoice_differences.txt');
    
    console.log('All computer hardware table PDFs created successfully!');
  } catch (error) {
    console.error('Error creating table PDFs:', error);
  }
}

createAllTablePDFs();

