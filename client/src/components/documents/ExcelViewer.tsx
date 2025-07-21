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
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (jsonData.length > 0) {
            const headers = jsonData[0].map((h: any, i: number) => h?.toString() || `Column ${i + 1}`);
            const data = jsonData.slice(1);
            
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
    <Card className="w-full h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
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
      <CardContent className="p-0 h-[calc(100vh-300px)]">
        {sheets.length > 1 && (
          <div className="flex gap-1 p-2 bg-muted/30 border-b overflow-x-auto">
            {sheets.map((sheet, index) => (
              <Button
                key={index}
                variant={index === activeSheet ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveSheet(index)}
                className={cn(
                  "h-7 px-3 text-xs font-medium whitespace-nowrap",
                  index === activeSheet && "bg-background shadow-sm border"
                )}
              >
                <TableIcon className="h-3 w-3 mr-1" />
                {sheet.name}
              </Button>
            ))}
          </div>
        )}
        
        <div className="relative h-full overflow-auto excel-table-container">
          <table className="w-full text-sm excel-table">
            <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 border-b-2">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 w-12 text-center text-xs font-medium text-gray-500 border-r-2 border-b">
                  #
                </th>
                {currentSheet.headers.map((header, index) => (
                  <th
                    key={index}
                    className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-r border-b bg-gray-50 dark:bg-gray-900 whitespace-nowrap min-w-[120px]"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 mr-1">{String.fromCharCode(65 + (index % 26))}</span>
                      {header}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSheet.data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                  <td className="sticky left-0 z-20 bg-gray-100 dark:bg-gray-800 w-12 text-center text-xs font-medium text-gray-500 border-r-2">
                    {rowIndex + 1}
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
                          "px-3 py-1.5 border-r border-b whitespace-nowrap",
                          "bg-white dark:bg-gray-950",
                          isNumber && !isPercentage && !isCurrency && "text-right font-mono",
                          isCurrency && "text-right font-medium text-green-700 dark:text-green-400",
                          isPercentage && "text-right text-blue-700 dark:text-blue-400"
                        )}
                      >
                        {cellValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-background border-t px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Sheet: <strong>{currentSheet.name}</strong>
          </span>
          <span>
            {currentSheet.data.length} rows × {currentSheet.headers.length} columns
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExcelViewer;