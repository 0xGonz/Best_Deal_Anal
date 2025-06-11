import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
// PDF parsing will be imported dynamically when needed

export interface ExtractedData {
  sheets?: { [sheetName: string]: any[] };
  data?: any[];
  text?: string; // For PDF text content
  metadata: {
    fileName: string;
    fileType: string;
    extractedAt: Date;
    totalRows: number;
    totalColumns: number;
    sheetNames?: string[];
    pageCount?: number; // For PDFs
  };
}

export class DataExtractor {
  
  /**
   * Extract data from Excel files (.xlsx, .xls, .xlsm)
   */
  static async extractExcelData(filePath: string, fileName: string): Promise<ExtractedData> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheets: { [sheetName: string]: any[] } = {};
      let totalRows = 0;
      let maxColumns = 0;

      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, // Use array format to preserve structure
          defval: null // Use null for empty cells
        });
        
        sheets[sheetName] = jsonData;
        totalRows += jsonData.length;
        
        // Calculate max columns across all sheets
        jsonData.forEach(row => {
          if (Array.isArray(row) && row.length > maxColumns) {
            maxColumns = row.length;
          }
        });
      }

      return {
        sheets,
        metadata: {
          fileName,
          fileType: 'excel',
          extractedAt: new Date(),
          totalRows,
          totalColumns: maxColumns,
          sheetNames: workbook.SheetNames
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract Excel data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract data from CSV files
   */
  static async extractCSVData(filePath: string, fileName: string): Promise<ExtractedData> {
    return new Promise((resolve, reject) => {
      const data: any[] = [];
      let maxColumns = 0;

      fs.createReadStream(filePath)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim() // Clean up headers
        }))
        .on('data', (row) => {
          data.push(row);
          const columnCount = Object.keys(row).length;
          if (columnCount > maxColumns) {
            maxColumns = columnCount;
          }
        })
        .on('end', () => {
          resolve({
            data,
            metadata: {
              fileName,
              fileType: 'csv',
              extractedAt: new Date(),
              totalRows: data.length,
              totalColumns: maxColumns
            }
          });
        })
        .on('error', (error) => {
          reject(new Error(`Failed to extract CSV data: ${error.message}`));
        });
    });
  }

  /**
   * Extract text from PDF files
   */
  static async extractPdfData(filePath: string, fileName: string): Promise<ExtractedData> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      return {
        text: pdfData.text,
        metadata: {
          fileName,
          fileType: 'pdf',
          extractedAt: new Date(),
          totalRows: 0, // PDFs don't have rows
          totalColumns: 0, // PDFs don't have columns
          pageCount: pdfData.numpages
        }
      };
    } catch (error) {
      console.error(`Error extracting PDF data from ${fileName}:`, error);
      throw new Error(`Failed to extract PDF data: ${error.message}`);
    }
  }

  /**
   * Main extraction method that determines file type and calls appropriate extractor
   */
  static async extractData(filePath: string, fileName: string): Promise<ExtractedData> {
    const extension = path.extname(fileName).toLowerCase();
    
    if (['.xlsx', '.xls', '.xlsm'].includes(extension)) {
      return this.extractExcelData(filePath, fileName);
    } else if (extension === '.csv') {
      return this.extractCSVData(filePath, fileName);
    } else if (extension === '.pdf') {
      return this.extractPdfData(filePath, fileName);
    } else {
      throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  /**
   * Format extracted data for AI consumption
   * Returns a clean, structured representation suitable for AI analysis
   */
  static formatForAI(extractedData: ExtractedData): string {
    let formatted = `File: ${extractedData.metadata.fileName}\n`;
    formatted += `Type: ${extractedData.metadata.fileType.toUpperCase()}\n`;
    
    if (extractedData.metadata.fileType === 'pdf') {
      formatted += `Pages: ${extractedData.metadata.pageCount || 0}\n`;
    } else {
      formatted += `Rows: ${extractedData.metadata.totalRows}, Columns: ${extractedData.metadata.totalColumns}\n`;
    }
    
    formatted += `Extracted: ${extractedData.metadata.extractedAt.toISOString()}\n\n`;

    if (extractedData.text) {
      // PDF file with text content
      formatted += '=== DOCUMENT CONTENT ===\n';
      formatted += this.formatPdfForAI(extractedData.text);
    } else if (extractedData.sheets) {
      // Excel file with multiple sheets
      for (const [sheetName, sheetData] of Object.entries(extractedData.sheets)) {
        formatted += `=== SHEET: ${sheetName} ===\n`;
        formatted += this.formatSheetData(sheetData);
        formatted += '\n';
      }
    } else if (extractedData.data) {
      // CSV file
      formatted += '=== DATA ===\n';
      formatted += this.formatSheetData(extractedData.data);
    }

    return formatted;
  }

  /**
   * Format PDF text for AI consumption
   */
  static formatPdfForAI(text: string): string {
    if (!text || text.trim().length === 0) return 'No text content available\n';
    
    // Clean up the text for better AI processing
    let formatted = text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n') // Clean up multiple line breaks
      .trim();
    
    // Limit text length for AI processing (keep first 5000 characters)
    if (formatted.length > 5000) {
      formatted = formatted.substring(0, 5000) + '\n... (content truncated)';
    }
    
    return formatted + '\n';
  }

  /**
   * Helper method to format sheet/data arrays
   */
  private static formatSheetData(data: any[]): string {
    if (!data || data.length === 0) return 'No data found\n';

    let formatted = '';
    
    // Limit to first 100 rows for AI processing
    const limitedData = data.slice(0, 100);
    
    limitedData.forEach((row, index) => {
      if (Array.isArray(row)) {
        // Excel array format
        formatted += `Row ${index + 1}: ${row.map(cell => cell || '').join('\t')}\n`;
      } else if (typeof row === 'object') {
        // CSV object format
        formatted += `Row ${index + 1}: ${Object.entries(row).map(([key, value]) => `${key}=${value || ''}`).join('\t')}\n`;
      }
    });

    if (data.length > 100) {
      formatted += `... (${data.length - 100} more rows)\n`;
    }

    return formatted;
  }
}