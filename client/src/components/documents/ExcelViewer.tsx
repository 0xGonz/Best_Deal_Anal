import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, AlertTriangle, Eye } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

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
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          {documentName}
        </CardTitle>
        <Button onClick={handleDownload} size="sm" variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download
        </Button>
      </CardHeader>
      <CardContent>
        {sheets.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {sheets.map((sheet, index) => (
              <Button
                key={index}
                variant={index === activeSheet ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSheet(index)}
                className="whitespace-nowrap"
              >
                {sheet.name}
              </Button>
            ))}
          </div>
        )}
        
        <div className="overflow-auto max-h-[500px] border rounded-md">
          <table className="w-full">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                {currentSheet.headers.map((header, index) => (
                  <th
                    key={index}
                    className="text-left px-4 py-2 text-sm font-medium border-b whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSheet.data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-muted/50">
                  {currentSheet.headers.map((_, colIndex) => (
                    <td
                      key={colIndex}
                      className="px-4 py-2 text-sm border-b whitespace-nowrap"
                    >
                      {row[colIndex]?.toString() || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {currentSheet.data.length} rows × {currentSheet.headers.length} columns
        </div>
      </CardContent>
    </Card>
  );
};

export default ExcelViewer;