import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface CSVViewerProps {
  documentId: number;
  documentName: string;
  fileType?: string;
}

interface CSVData {
  headers: string[];
  rows: string[][];
}

const CSVViewer = ({ documentId, documentName, fileType }: CSVViewerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<CSVData | null>(null);

  useEffect(() => {
    const loadCSVFile = async () => {
      try {
        setLoading(true);
        const url = `/api/documents/${documentId}/download`;
        
        const response = await fetch(url, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to load CSV file');
        }
        
        const text = await response.text();
        
        // Parse CSV
        const lines = text.trim().split('\n');
        if (lines.length === 0) {
          throw new Error('CSV file is empty');
        }
        
        // Simple CSV parser (handles basic cases)
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Skip next quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current);
          return result;
        };
        
        const headers = parseCSVLine(lines[0]);
        const rows = lines.slice(1).map(line => parseCSVLine(line));
        
        setCsvData({ headers, rows });
        setError(null);
      } catch (err) {
        console.error('Error loading CSV file:', err);
        setError('Failed to load CSV file. The file may be corrupted or in an unsupported format.');
      } finally {
        setLoading(false);
      }
    };
    
    loadCSVFile();
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
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-blue-600 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading CSV file...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-[600px] flex flex-col items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 text-yellow-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to Load CSV File</h3>
        <p className="text-sm text-muted-foreground text-center mb-6">{error}</p>
        <Button onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download File
        </Button>
      </Card>
    );
  }

  if (!csvData || csvData.rows.length === 0) {
    return (
      <Card className="w-full h-[600px] flex flex-col items-center justify-center p-8">
        <FileSpreadsheet className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
        <p className="text-sm text-muted-foreground text-center mb-6">
          This CSV file appears to be empty or contains no readable data.
        </p>
        <Button onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download File
        </Button>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          {documentName}
        </CardTitle>
        <Button onClick={handleDownload} size="sm" variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[500px] border rounded-md">
          <table className="w-full">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                {csvData.headers.map((header, index) => (
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
              {csvData.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-muted/50">
                  {csvData.headers.map((_, colIndex) => (
                    <td
                      key={colIndex}
                      className="px-4 py-2 text-sm border-b whitespace-nowrap"
                    >
                      {row[colIndex] || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {csvData.rows.length} rows × {csvData.headers.length} columns
        </div>
      </CardContent>
    </Card>
  );
};

export default CSVViewer;