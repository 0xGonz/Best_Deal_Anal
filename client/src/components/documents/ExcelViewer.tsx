import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, AlertTriangle, TableIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";

interface ExcelViewerProps {
  documentId: number;
  documentName: string;
  fileType?: string;
}

interface SheetData {
  name: string;
  data: any[][];
  headers: string[];
}

const ExcelViewer = ({ documentId, documentName, fileType }: ExcelViewerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);

  useEffect(() => {
    const loadExcelFile = async () => {
      try {
        setLoading(true);
        const url = `/api/documents/${documentId}/download`;
        
        const response = await fetch(url, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to load Excel file');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        const sheetsData: SheetData[] = [];
        
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          
          // Parse with different options to ensure we get all data
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '', // Default value for empty cells
            raw: false, // Get formatted strings instead of raw values
            blankrows: false // Skip blank rows
          }) as any[][];
          
          console.log(`Sheet ${sheetName}: Found ${jsonData.length} rows`);
          
          if (jsonData.length > 0) {
            // Find the first row with data to use as headers
            let headerRowIndex = 0;
            let headers: string[] = [];
            
            // Look for a row that has multiple non-empty cells
            for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
              const row = jsonData[i];
              if (Array.isArray(row) && row.filter(cell => cell !== null && cell !== undefined && cell !== '').length > 1) {
                headerRowIndex = i;
                headers = row.map((h: any, idx: number) => {
                  const val = h?.toString().trim();
                  return val || `Column ${idx + 1}`;
                });
                break;
              }
            }
            
            // If no good header row found, create headers based on the widest row
            if (headers.length === 0) {
              const maxCols = Math.max(...jsonData.map(row => Array.isArray(row) ? row.length : 0));
              headers = Array(maxCols).fill(0).map((_, i) => `Column ${i + 1}`);
              headerRowIndex = -1; // No header row, start data from row 0
            }
            
            console.log(`Headers found: ${headers.length} columns`);
            
            // Get data rows (skip header row if found)
            const dataStartIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
            const data = jsonData.slice(dataStartIndex).map(row => {
              // Ensure each row has the same number of columns as headers
              if (!Array.isArray(row)) return Array(headers.length).fill('');
              const paddedRow = [...row];
              while (paddedRow.length < headers.length) {
                paddedRow.push('');
              }
              return paddedRow;
            });
            
            sheetsData.push({
              name: sheetName,
              headers,
              data
            });
          }
        });
        
        setSheets(sheetsData);
        setError(null);
      } catch (err) {
        console.error('Error loading Excel file:', err);
        setError('Failed to load Excel file. The file may be corrupted or in an unsupported format.');
      } finally {
        setLoading(false);
      }
    };
    
    loadExcelFile();
  }, [documentId]);

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to download document');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = documentName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Complete",
        description: `${documentName} has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Unable to download the document. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card className="w-full h-[600px] flex items-center justify-center">
        <div className="text-center">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-green-600 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading Excel file...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-[600px] flex flex-col items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 text-yellow-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to Load Excel File</h3>
        <p className="text-sm text-muted-foreground text-center mb-6">{error}</p>
        <Button onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download File
        </Button>
      </Card>
    );
  }

  if (sheets.length === 0) {
    return (
      <Card className="w-full h-[600px] flex flex-col items-center justify-center p-8">
        <FileSpreadsheet className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
        <p className="text-sm text-muted-foreground text-center mb-6">
          This Excel file appears to be empty or contains no readable data.
        </p>
        <Button onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download File
        </Button>
      </Card>
    );
  }

  const currentSheet = sheets[activeSheet];

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between p-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          <div>
            <CardTitle className="text-base font-medium">{documentName}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Excel Spreadsheet • {sheets.length} sheet{sheets.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button onClick={handleDownload} size="sm" variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download
        </Button>
      </CardHeader>
      <div className="flex-1 flex flex-col min-h-0">
        {sheets.length > 1 && (
          <div className="flex-shrink-0 bg-muted/20 border-b">
            <div className="flex gap-1 p-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
              {sheets.map((sheet, index) => (
                <Button
                  key={index}
                  variant={index === activeSheet ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveSheet(index)}
                  className={cn(
                    "h-8 px-4 text-sm font-medium whitespace-nowrap transition-colors",
                    index === activeSheet 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "hover:bg-muted"
                  )}
                >
                  <TableIcon className="h-3.5 w-3.5 mr-1.5" />
                  {sheet.name}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 overflow-auto excel-table-container">
            <table className="excel-table">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 w-14 text-center text-xs font-medium text-gray-500 border-r-2 border-b">
                    <div className="p-2">#</div>
                  </th>
                  {currentSheet.headers.map((header, index) => {
                    const colLetter = index < 26 
                      ? String.fromCharCode(65 + index)
                      : String.fromCharCode(65 + Math.floor(index / 26) - 1) + String.fromCharCode(65 + (index % 26));
                    
                    return (
                      <th
                        key={index}
                        className="relative group bg-gray-50 dark:bg-gray-900 border-r border-b"
                        style={{ minWidth: '150px', maxWidth: '400px' }}
                      >
                        <div className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-400 font-normal">{colLetter}</span>
                            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300 truncate">
                              {header}
                            </span>
                          </div>
                        </div>
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {currentSheet.data.map((row, rowIndex) => (
                  <tr key={rowIndex} className="group">
                    <td className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 text-center text-xs font-medium text-gray-500 border-r-2 border-b">
                      <div className="p-2">{rowIndex + 1}</div>
                    </td>
                    {currentSheet.headers.map((_, colIndex) => {
                      const cellValue = row[colIndex]?.toString() || '';
                      const isNumber = !isNaN(Number(cellValue)) && cellValue !== '';
                      const isPercentage = cellValue.includes('%');
                      const isCurrency = cellValue.includes('$');
                      
                      return (
                        <td
                          key={colIndex}
                          className={cn(
                            "relative border-r border-b transition-colors",
                            "bg-white dark:bg-gray-950 group-hover:bg-gray-50 dark:group-hover:bg-gray-900/50",
                            "hover:!bg-blue-50 dark:hover:!bg-blue-900/30",
                            isNumber && !isPercentage && !isCurrency && "text-right",
                            isCurrency && "text-right text-green-700 dark:text-green-400",
                            isPercentage && "text-right text-blue-700 dark:text-blue-400"
                          )}
                        >
                          <div className="px-3 py-1.5 text-sm truncate" title={cellValue}>
                            {cellValue}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="flex-shrink-0 bg-card border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Sheet: <strong className="text-foreground">{currentSheet.name}</strong></span>
            <span className="text-muted-foreground/70">•</span>
            <span>{currentSheet.data.length} rows × {currentSheet.headers.length} columns</span>
          </div>
          <div className="text-right text-muted-foreground/50">
            Scroll horizontally to see more columns →
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ExcelViewer;