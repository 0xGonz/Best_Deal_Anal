import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { FundAllocation } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatters";
import { useFundMetrics } from '@/hooks/useFundMetrics';

// Reusable type for capital data visualization
export type CapitalDataItem = {
  name: string;
  value: number;
  color: string;
  percentage?: number;
};

// Reusable vertical stacked bar chart component
export const VerticalStackedBarChart: React.FC<{
  data: CapitalDataItem[];
  totalValue: number;
  barSize?: number;
  className?: string;
}> = ({ data, totalValue, barSize = 80, className = "" }) => {
  // Transform data for the chart
  const chartData = [{
    name: "Capital",
    // Create dynamic keys based on data item names
    ...data.reduce((acc, item) => {
      const key = item.name.toLowerCase().replace(/\s+/g, '_');
      acc[key] = item.value;
      return acc;
    }, {} as Record<string, number>),
    total: totalValue
  }];

  return (
    <div className={`flex flex-col items-center justify-center h-full min-h-[230px] ${className}`}>
      <ResponsiveContainer width="100%" height="100%" minHeight={230}>
        <BarChart
          data={chartData}
          margin={{ top: 15, right: 30, left: 20, bottom: 20 }}
          stackOffset="expand"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} />
          <XAxis type="category" dataKey="name" hide={true} />
          <YAxis 
            type="number"
            domain={[0, 1]}
            tickFormatter={(value) => `${(value * 100).toFixed(2)}%`}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
          />
          <Tooltip 
            formatter={(value: number, name: any) => {
              // Proper formatting for tooltip keys
              const displayName = String(name || '')
                .replace(/_/g, ' ')
                .split(' ')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
              return [`${formatCurrency(value)} (${((value/totalValue)*100).toFixed(2)}%)`, displayName];
            }}
            labelFormatter={() => "Capital Distribution"}
          />
          {data.map((item, index) => {
            const dataKey = item.name.toLowerCase().replace(/\s+/g, '_');
            return (
              <Bar 
                key={index}
                dataKey={dataKey}
                stackId="a"
                barSize={barSize}
                fill={item.color}
                name={item.name}
              >
                <LabelList 
                  position="center"
                  formatter={() => item.percentage ? `${item.percentage}%` : ""}
                  style={{ 
                    fill: index === 0 ? '#fff' : '#000', 
                    fontWeight: 'bold' 
                  }}
                />
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Reusable capital breakdown stats component
export const CapitalBreakdownStats: React.FC<{
  data: CapitalDataItem[];
  totalValue: number;
  showSummary?: boolean;
  className?: string;
}> = ({ data, totalValue, showSummary = true, className = "" }) => {
  // Get called percentage for summary display
  const calledPercentage = totalValue > 0 && data.length > 0
    ? Math.round((data[0]?.value || 0) / totalValue * 100)
    : 0;

  return (
    <div className={`flex flex-col justify-center space-y-5 ${className}`}>
      {/* Called Rate Summary - only shown if requested */}
      {showSummary && (
        <div className="bg-gray-50 rounded-lg p-4 shadow-sm">
          <p className="text-sm text-neutral-500">Called Rate</p>
          <div className="flex items-baseline mt-1">
            <span className="text-3xl font-bold">{calledPercentage}%</span>
            <span className="ml-2 text-sm text-neutral-500">of total capital</span>
          </div>
        </div>
      )}
      
      {/* Capital Breakdown */}
      <div className="space-y-3">
        {/* Map through data items */}
        {data.map((item, index) => (
          <div key={index} className="flex items-center">
            <div 
              className="w-4 h-4 rounded-full mr-3" 
              style={{ backgroundColor: item.color }}
            ></div>
            <div className="flex-1">
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-lg font-semibold">{formatCurrency(item.value)}</p>
            </div>
          </div>
        ))}
        
        {/* Total Capital */}
        <div className="flex items-center pt-2 border-t border-gray-200">
          <div className="w-4 h-4 rounded-full bg-gray-200 mr-3"></div>
          <div className="flex-1">
            <p className="text-sm font-medium">Total Capital</p>
            <p className="text-lg font-semibold">{formatCurrency(totalValue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Empty state component for consistent empty displays
export const EmptyCapitalData: React.FC<{
  message?: string;
}> = ({ message = "No allocation data available to calculate capital ratios." }) => (
  <div className="flex flex-col items-center justify-center py-8 text-neutral-500">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-neutral-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <p>{message}</p>
  </div>
);

// Main container component
interface CalledCapitalRatioProps {
  allocations: FundAllocation[];
  totalFundSize: number;
  calledCapital?: number;  // Optional server-calculated value
  uncalledCapital?: number; // Optional server-calculated value
  capitalView?: 'total' | 'called' | 'uncalled'; // Capital view integration
}

const CalledCapitalRatio: React.FC<CalledCapitalRatioProps> = ({ 
  allocations,
  totalFundSize,
  calledCapital,
  uncalledCapital,
  capitalView = 'total'
}) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use unified metrics hook for consistent data
  const fundMetrics = useFundMetrics(allocations, capitalView);

  // Calculate capital data based on unified metrics
  const capitalData = React.useMemo((): CapitalDataItem[] => {
    const { capitalViewData } = fundMetrics;
    
    if (capitalViewData.totalAmount === 0) {
      return [];
    }
    
    return [
      { 
        name: "Called Capital", 
        value: capitalViewData.calledAmount, 
        color: "#4f46e5",
        percentage: capitalViewData.calledPercentage
      },
      { 
        name: "Uncalled Capital", 
        value: capitalViewData.uncalledAmount, 
        color: "#a5b4fc",
        percentage: capitalViewData.uncalledPercentage
      }
    ];
  }, [fundMetrics]);
  
  // Total capital from unified metrics
  const totalCapital = fundMetrics.capitalViewData.totalAmount;

  // Calculate dynamic sizes based on viewport
  const isSmallScreen = windowWidth < 640;
  const isMediumScreen = windowWidth >= 640 && windowWidth < 1024;

  // Dynamic title based on capital view
  const getTitle = () => {
    switch (capitalView) {
      case 'called':
        return 'Called Capital Breakdown';
      case 'uncalled':
        return 'Uncalled Capital Breakdown';
      default:
        return 'Called vs. Uncalled Capital';
    }
  };
  
  return (
    <Card className="h-full w-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="mb-1">{getTitle()}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center py-2">
        {capitalData && capitalData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Chart Section - using modular component */}
            <VerticalStackedBarChart 
              data={capitalData} 
              totalValue={totalCapital} 
            />
            
            {/* Stats Section - using modular component */}
            <CapitalBreakdownStats 
              data={capitalData} 
              totalValue={totalCapital} 
            />
          </div>
        ) : (
          <EmptyCapitalData />
        )}
      </CardContent>
    </Card>
  );
};

export default CalledCapitalRatio;
