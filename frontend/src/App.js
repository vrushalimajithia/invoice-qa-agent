import React, { useState, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://localhost:3002';

function App() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [comparisonResponse, setComparisonResponse] = useState(null);
  const [error, setError] = useState('');
  const [manualTexts, setManualTexts] = useState({
    po: '',
    invoice: ''
  });
  const [pdfFiles, setPdfFiles] = useState({
    po: null,
    invoice: null
  });
  const [activeTab, setActiveTab] = useState('pdf'); // 'text' or 'pdf'

  // Handle manual text comparison
  const handleManualComparison = useCallback(async () => {
    if (!manualTexts.po || !manualTexts.invoice) {
      setError('Please enter both PO and Invoice text.');
      return;
    }

    setIsUploading(true);
    setError('');
    setComparisonResponse(null);
    setUploadStatus('Comparing texts...');

    try {
      const response = await axios.post(`${API_BASE_URL}/compare-text`, {
        poText: manualTexts.po,
        invoiceText: manualTexts.invoice
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        params: { t: Date.now() } // Cache busting
      });

      if (response.data.success) {
        setComparisonResponse(response.data);
        setUploadStatus('Text comparison completed successfully!');
      } else {
        // Handle validation errors with more detail
        const errorMessage = response.data.message || 'Text comparison failed';
        const errorDetails = response.data.details;
        
        let fullErrorMessage = errorMessage;
        if (errorDetails) {
          fullErrorMessage += `\n\nDetails: ${errorDetails.suggestion || ''}`;
        }
        
        setError(fullErrorMessage);
      }
    } catch (error) {
      console.error('Text comparison error:', error);
      setError(error.response?.data?.message || 'Text comparison failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [manualTexts]);

  // Handle PDF file upload and comparison
  const handlePDFComparison = useCallback(async () => {
    if (!pdfFiles.po || !pdfFiles.invoice) {
      setError('Please upload both PO and Invoice PDF files.');
      return;
    }

    setIsUploading(true);
    setError('');
    setComparisonResponse(null);
    setUploadStatus('Uploading and processing PDFs...');
    
    try {
      const formData = new FormData();
      formData.append('poFile', pdfFiles.po);
      formData.append('invoiceFile', pdfFiles.invoice);

      const response = await axios.post(`${API_BASE_URL}/compare-pdfs`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        params: { t: Date.now() } // Cache busting
      });

      if (response.data.success) {
        setComparisonResponse(response.data);
        setUploadStatus('PDF comparison completed successfully!');
        setError(''); // Clear any previous errors
      } else {
        const errorMessage = response.data.message || 'PDF comparison failed';
        const errorDetails = response.data.details;
        
        let fullErrorMessage = errorMessage;
        if (errorDetails) {
          fullErrorMessage += `\n\nDetails: ${errorDetails.suggestion || ''}`;
        }
        
        setError(fullErrorMessage);
      }
    } catch (error) {
      console.error('PDF comparison error:', error);
      setError(error.response?.data?.message || 'PDF comparison failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [pdfFiles]);

  // Handle PDF file selection
  const handlePDFFileChange = useCallback((type, file) => {
    console.log('File selected:', { type, name: file?.name, size: file?.size, type: file?.type });
    if (file && file.type === 'application/pdf') {
      setPdfFiles(prev => ({
        ...prev,
        [type]: file
      }));
      setError('');
      setComparisonResponse(null);
      setUploadStatus('');
    } else {
      setError('Please select a valid PDF file.');
    }
  }, []);

  // Handle manual text input change
  const handleTextChange = useCallback((type, value) => {
    setManualTexts(prev => ({
      ...prev,
      [type]: value
    }));
    setError('');
    setComparisonResponse(null);
    setUploadStatus('');
  }, []);

  // Handle reset
  const handleReset = useCallback(() => {
    setIsUploading(false);
    setUploadStatus('');
    setComparisonResponse(null);
    setError('');
    setManualTexts({ po: '', invoice: '' });
    setPdfFiles({ po: null, invoice: null });
    
    // Clear file input values to allow re-uploading the same files
    const poInput = document.getElementById('po-pdf-input');
    const invoiceInput = document.getElementById('invoice-pdf-input');
    if (poInput) poInput.value = '';
    if (invoiceInput) invoiceInput.value = '';
  }, []);

  // Create detailed item data for display
  const createItemData = useCallback(() => {
    console.log('Full comparison response:', comparisonResponse);
    
    // Check if we have item data in the response
    const poItems = comparisonResponse?.poItems || [];
    const invoiceItems = comparisonResponse?.invoiceItems || [];
    
    console.log('PO Items:', poItems);
    console.log('Invoice Items:', invoiceItems);
    
    // If no items found, return empty array
    if (poItems.length === 0 && invoiceItems.length === 0) {
      console.log('No item data found in response - creating fallback items');
      
      // Create fallback items from the differences if available
      if (comparisonResponse?.comparison?.differences) {
        const amountDiff = comparisonResponse.comparison.differences.find(d => d.type === 'amount');
        if (amountDiff) {
          const fallbackItems = [];
          const maxLength = Math.max(amountDiff.poValues?.length || 0, amountDiff.invoiceValues?.length || 0);
          
          for (let i = 0; i < maxLength; i++) {
            const poValue = amountDiff.poValues?.[i] || 'N/A';
            const invoiceValue = amountDiff.invoiceValues?.[i] || 'N/A';
            const valuesMatch = poValue === invoiceValue;
            
            fallbackItems.push({
              itemNo: `Item ${i + 1}`,
              poDescription: 'Description not extracted',
              invoiceDescription: 'Description not extracted',
              poQty: poValue,
              invoiceQty: invoiceValue,
              poUnitCost: poValue,
              invoiceUnitCost: invoiceValue,
              poTotal: poValue,
              invoiceTotal: invoiceValue,
              qtyMatch: valuesMatch,
              unitCostMatch: valuesMatch,
              totalMatch: valuesMatch,
              descriptionMatch: true,
              hasMismatch: !valuesMatch
            });
          }
          return fallbackItems;
        }
      }
      return [];
    }

    // Create a map of items by item number for easy comparison
    const poMap = {};
    const invoiceMap = {};
    
    poItems.forEach(item => {
      poMap[item.itemNo] = item;
    });
    
    invoiceItems.forEach(item => {
      invoiceMap[item.itemNo] = item;
    });

    // Get all unique item numbers
    const allItemNos = [...new Set([...Object.keys(poMap), ...Object.keys(invoiceMap)])];
    
    const detailedItems = allItemNos.map(itemNo => {
      const poItem = poMap[itemNo];
      const invoiceItem = invoiceMap[itemNo];
      
      // Check for mismatches - use actual comparison, not overall flag
      const qtyMatch = poItem?.qty === invoiceItem?.qty;
      const unitCostMatch = poItem?.unitPrice === invoiceItem?.unitPrice;
      const totalMatch = poItem?.total === invoiceItem?.total;
      const descriptionMatch = poItem?.description === invoiceItem?.description;
      
      // Determine if this specific item has any mismatch
      const hasMismatch = !qtyMatch || !unitCostMatch || !totalMatch || !descriptionMatch;
      
      return {
        itemNo,
        poDescription: poItem?.description || 'N/A',
        invoiceDescription: invoiceItem?.description || 'N/A',
        poQty: poItem?.qty || 'N/A',
        invoiceQty: invoiceItem?.qty || 'N/A',
        poUnitCost: poItem?.unitPrice || 'N/A',
        invoiceUnitCost: invoiceItem?.unitPrice || 'N/A',
        poTotal: poItem?.total || 'N/A',
        invoiceTotal: invoiceItem?.total || 'N/A',
        qtyMatch,
        unitCostMatch,
        totalMatch,
        descriptionMatch,
        hasMismatch: hasMismatch && (!qtyMatch || !unitCostMatch || !totalMatch || !descriptionMatch)
      };
    });

    console.log('Created detailed items:', detailedItems);
    return detailedItems;
  }, [comparisonResponse]);

  const items = createItemData();

  return (
    <div className="app">
      <div className="container">
        <h1>📄 AI Invoice Checker</h1>
        <p className="subtitle">Compare PO and Invoice documents for intelligent analysis</p>

        {/* Tab Navigation - Hidden for now */}
        {/* <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            📝 Text Input
          </button>
          <button
            className={`tab-button ${activeTab === 'pdf' ? 'active' : ''}`}
            onClick={() => setActiveTab('pdf')}
          >
            📄 PDF Upload
          </button>
        </div> */}

        {/* Text Input Tab - Hidden for now */}
        {/* {activeTab === 'text' && (
        <div className="manual-text-inputs">
          <div className="text-input-group">
            <label htmlFor="po-text-input" className="text-label">
              📋 Purchase Order (PO) Text
            </label>
            <textarea
              id="po-text-input"
              value={manualTexts.po}
              onChange={(e) => handleTextChange('po', e.target.value)}
              placeholder="Paste your PO text here..."
              className="text-input"
              rows={8}
              disabled={isUploading}
            />
          </div>

          <div className="text-input-group">
            <label htmlFor="invoice-text-input" className="text-label">
              🧾 Invoice Text
            </label>
            <textarea
              id="invoice-text-input"
              value={manualTexts.invoice}
              onChange={(e) => handleTextChange('invoice', e.target.value)}
              placeholder="Paste your Invoice text here..."
              className="text-input"
              rows={8}
              disabled={isUploading}
            />
          </div>

          <div className="text-controls">
            <button
              onClick={handleManualComparison}
              disabled={!manualTexts.po || !manualTexts.invoice || isUploading}
              className="upload-button"
            >
              {isUploading ? 'Comparing...' : 'Compare Texts'}
            </button>
            
            <button
              onClick={handleReset}
              disabled={isUploading}
              className="reset-button"
            >
              Reset
            </button>
          </div>

          {isUploading && (
            <div className="progress-section">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: '100%' }}
                ></div>
              </div>
              <p className="progress-text">{uploadStatus}</p>
            </div>
          )}

          <div className="text-input-help">
            <p><strong>💡 Tip:</strong> Copy and paste the text content from your PO and Invoice documents. The system will automatically detect and compare the key details like amounts, dates, and item descriptions.</p>
          </div>
        </div>
        )} */}

        {/* PDF Upload Section */}
        <div className="pdf-upload-inputs">
            <div className="file-input-group">
              <label htmlFor="po-pdf-input" className="file-label">
                📋 Purchase Order (PO) PDF
              </label>
              <div className="file-input-container">
                <input
                  id="po-pdf-input"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handlePDFFileChange('po', e.target.files[0])}
                  className="file-input-hidden"
                  disabled={isUploading}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('po-pdf-input').click()}
                  className="file-input-button"
                  disabled={isUploading}
                >
                  {pdfFiles.po ? '📄 Change PO File' : '📁 Select PO PDF'}
                </button>
              </div>
              {pdfFiles.po && (
                <div className="file-info">
                  <span className="file-name">📄 {pdfFiles.po.name}</span>
                  <span className="file-size">({(pdfFiles.po.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>

            <div className="file-input-group">
              <label htmlFor="invoice-pdf-input" className="file-label">
                🧾 Invoice PDF
              </label>
              <div className="file-input-container">
                <input
                  id="invoice-pdf-input"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handlePDFFileChange('invoice', e.target.files[0])}
                  className="file-input-hidden"
                  disabled={isUploading}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('invoice-pdf-input').click()}
                  className="file-input-button"
                  disabled={isUploading}
                >
                  {pdfFiles.invoice ? '📄 Change Invoice File' : '📁 Select Invoice PDF'}
                </button>
              </div>
              {pdfFiles.invoice && (
                <div className="file-info">
                  <span className="file-name">📄 {pdfFiles.invoice.name}</span>
                  <span className="file-size">({(pdfFiles.invoice.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>

            {/* File Status Indicator */}
            {pdfFiles.po && pdfFiles.invoice && (
              <div className="files-ready-indicator">
                <div className="ready-status">
                  <span className="ready-icon">✅</span>
                  <span className="ready-text">Both files selected and ready for comparison</span>
                </div>
              </div>
            )}

            <div className="file-controls">
              <button
                onClick={handlePDFComparison}
                disabled={!pdfFiles.po || !pdfFiles.invoice || isUploading}
                className="upload-button"
              >
                {isUploading ? 'Processing PDFs...' : 'Compare PDFs'}
              </button>
              
              <button
                onClick={handleReset}
                disabled={isUploading}
                className="reset-button"
              >
                Reset
              </button>
            </div>

            {isUploading && (
              <div className="progress-section">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: '100%' }}
                  ></div>
                </div>
                <p className="progress-text">{uploadStatus}</p>
              </div>
            )}

        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <div style={{ whiteSpace: 'pre-line' }}>
              ❌ {error}
            </div>
          </div>
        )}

        {/* Results Section */}
        {comparisonResponse && (
          <div className="results-section">
            {/* Overall Status */}
            <div className={`overall-status ${items.some(item => item.hasMismatch) ? 'error' : 'success'}`}>
              {items.some(item => item.hasMismatch) ? (
                <>
                  <span className="status-icon">❌</span>
                  <span className="status-text">Mismatches Found</span>
                </>
              ) : (
                <>
                  <span className="status-icon">✅</span>
                  <span className="status-text">All Items Match</span>
                </>
              )}
            </div>

            {/* Detailed Item-by-Item Comparison */}
            {items.length > 0 && (
              <div className="comparison-section">
                <h3>📊 Detailed Item-by-Item Comparison</h3>
                <div className="table-container">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>Item No</th>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Unit Cost</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const hasAnyMismatch = item.hasMismatch;
                        const statusIcon = hasAnyMismatch ? '❌' : '✅';
                        const statusText = hasAnyMismatch ? 'MISMATCH' : 'MATCH';
                        
                        return (
                          <tr key={item.itemNo} className={hasAnyMismatch ? 'mismatch-row' : 'match-row'}>
                            <td><strong>{item.itemNo}</strong></td>
                            <td>
                              <div className="value-comparison">
                                <div className={`value-row ${!item.descriptionMatch ? 'mismatch' : 'match'}`}>
                                  <span className="label">PO:</span> {item.poDescription}
                                </div>
                                <div className={`value-row ${!item.descriptionMatch ? 'mismatch' : 'match'}`}>
                                  <span className="label">INV:</span> {item.invoiceDescription}
                                </div>
                                {!item.descriptionMatch && <div className="mismatch-indicator">⚠️ Description differs</div>}
                              </div>
                            </td>
                            <td>
                              <div className="value-comparison">
                                <div className={`value-row ${!item.qtyMatch ? 'mismatch' : 'match'}`}>
                                  <span className="label">PO:</span> {item.poQty}
                                </div>
                                <div className={`value-row ${!item.qtyMatch ? 'mismatch' : 'match'}`}>
                                  <span className="label">INV:</span> {item.invoiceQty}
                                </div>
                                {!item.qtyMatch && <div className="mismatch-indicator">⚠️ Qty differs</div>}
                              </div>
                            </td>
                            <td>
                              <div className="value-comparison">
                                <div className={`value-row ${!item.unitCostMatch ? 'mismatch' : 'match'}`}>
                                  <span className="label">PO:</span> ${item.poUnitCost}
                                </div>
                                <div className={`value-row ${!item.unitCostMatch ? 'mismatch' : 'match'}`}>
                                  <span className="label">INV:</span> ${item.invoiceUnitCost}
                                </div>
                                {!item.unitCostMatch && <div className="mismatch-indicator">⚠️ Unit cost differs</div>}
                              </div>
                            </td>
                            <td>
                              <div className="value-comparison">
                                <div className={`value-row ${!item.totalMatch ? 'mismatch' : 'match'}`}>
                                  <span className="label">PO:</span> ${item.poTotal}
                                </div>
                                <div className={`value-row ${!item.totalMatch ? 'mismatch' : 'match'}`}>
                                  <span className="label">INV:</span> ${item.invoiceTotal}
                                </div>
                                {!item.totalMatch && <div className="mismatch-indicator">⚠️ Total differs</div>}
                              </div>
                            </td>
                            <td className="status-cell">
                              <div className={`status-badge ${hasAnyMismatch ? 'mismatch' : 'match'}`}>
                                <span className="status-icon">{statusIcon}</span>
                                <span className="status-text">{statusText}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Financial Summary */}
            {comparisonResponse.comparison?.differences && (
              <div className="financial-summary">
                <h3>💰 Financial Summary</h3>
                <div className="financial-comparison">
                  {comparisonResponse.comparison.differences.map((diff, index) => {
                    if (diff.type === 'amount' && diff.poValues && diff.invoiceValues) {
                      // Check if we have full breakdown (4 values) or just total (1 value)
                      const hasFullBreakdown = diff.poValues.length >= 4 && diff.invoiceValues.length >= 4;
                      
                      return (
                        <div key={index} className="financial-item">
                          {hasFullBreakdown ? (
                            // Full breakdown: Subtotal, Discount, Tax, Total
                            <>
                              <div className="financial-row">
                                <span className="financial-label">Subtotal:</span>
                                <div className="financial-values">
                                  <span className={`po-value ${!diff.match ? 'mismatch' : 'match'}`}>
                                    PO: {diff.poValues[0] || 'N/A'}
                                  </span>
                                  <span className={`invoice-value ${!diff.match ? 'mismatch' : 'match'}`}>
                                    INV: {diff.invoiceValues[0] || 'N/A'}
                                  </span>
                                </div>
                              </div>
                              <div className="financial-row">
                                <span className="financial-label">Discount:</span>
                                <div className="financial-values">
                                  <span className={`po-value ${!diff.match ? 'mismatch' : 'match'}`}>
                                    PO: {diff.poValues[1] || 'N/A'}
                                  </span>
                                  <span className={`invoice-value ${!diff.match ? 'mismatch' : 'match'}`}>
                                    INV: {diff.invoiceValues[1] || 'N/A'}
                                  </span>
                                </div>
                              </div>
                              <div className="financial-row">
                                <span className="financial-label">Tax:</span>
                                <div className="financial-values">
                                  <span className={`po-value ${!diff.match ? 'mismatch' : 'match'}`}>
                                    PO: {diff.poValues[2] || 'N/A'}
                                  </span>
                                  <span className={`invoice-value ${!diff.match ? 'mismatch' : 'match'}`}>
                                    INV: {diff.invoiceValues[2] || 'N/A'}
                                  </span>
                                </div>
                              </div>
                              <div className="financial-row">
                                <span className="financial-label">Total:</span>
                                <div className="financial-values">
                                  <span className={`po-value ${!diff.match ? 'mismatch' : 'match'}`}>
                                    PO: {diff.poValues[3] || 'N/A'}
                                  </span>
                                  <span className={`invoice-value ${!diff.match ? 'mismatch' : 'match'}`}>
                                    INV: {diff.invoiceValues[3] || 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </>
                          ) : (
                            // Just total amount (when files are identical)
                            <div className="financial-row">
                              <span className="financial-label">Total:</span>
                              <div className="financial-values">
                                <span className={`po-value ${!diff.match ? 'mismatch' : 'match'}`}>
                                  PO: {diff.poValues[0] || 'N/A'}
                                </span>
                                <span className={`invoice-value ${!diff.match ? 'mismatch' : 'match'}`}>
                                  INV: {diff.invoiceValues[0] || 'N/A'}
                                </span>
                              </div>
                            </div>
                          )}
                          {!diff.match && (
                            <div className="financial-mismatch">
                              ⚠️ Financial amounts differ between PO and Invoice
                            </div>
                          )}
                    </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

export default App;