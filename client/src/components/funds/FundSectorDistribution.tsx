import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { FundAllocation, Deal } from "@/lib/types";
import { getSectorColor } from "@/lib/constants/chart-constants";
import { formatPercentage } from '@/lib/utils';

interface SectorData {
  sector: string;
  count: number;
  percentage: number;
}

interface LabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  index: number;
  name?: string;
  value?: number;
  payload?: any;
}

const renderCustomizedLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent
}: LabelProps) => {
  // Only show label if segment is large enough (> 5%)
  if (percent < 0.05) return null;
  
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
  const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor="middle" 
      dominantBaseline="central"
      fontSize={12}
      fontWeight="bold"
    >
      {formatPercentage(percent * 100, 2)}
    </text>
  );
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{payload: any}>;
  sectorData: SectorData[];
}

const CustomTooltip = ({ active, payload, sectorData }: TooltipProps) => {
  if (active && payload && payload.length && sectorData) {
    const data = payload[0].payload;
    
    // Calculate the total from the actual data array
    const totalCount = sectorData.reduce((sum: number, item: SectorData) => sum + item.count, 0);
    
    // Calculate percentage correctly
    const percentage = data.count / totalCount * 100;
    
    return (
      <div className="bg-white p-2 border border-neutral-200 rounded-md shadow-sm">
        <p className="font-medium text-black">{data.sector}</p>
        <p className="text-black"><span className="font-medium text-black">Amount:</span> ${data.count.toLocaleString()}</p>
        <p className="text-black"><span className="font-medium text-black">Percentage:</span> <span className="font-bold">{formatPercentage(percentage, 0)}</span></p>
      </div>
    );
  }
  return null;
};

interface FundSectorDistributionProps {
  allocations: FundAllocation[];
  deals: Deal[];
}

const FundSectorDistribution: React.FC<FundSectorDistributionProps> = ({ 
  allocations,
  deals
 }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Process allocations into sector data that matches the dashboard format
  const sectorData = React.useMemo((): SectorData[] => {
    // Handle null or undefined allocations to avoid runtime errors
    if (!allocations || allocations.length === 0) {
      return [];
    }
    
    // Filter to include only funded allocations with weights
    const fundedAllocations = allocations.filter(allocation => 
      allocation && allocation.status === 'funded'
    );
    
    // If no funded allocations, show nothing
    if (fundedAllocations.length === 0) {
      return [];
    }
    
    // Group by sector and sum amounts
    const sectorTotals = new Map<string, number>();
    const totalAmount = fundedAllocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
    
    fundedAllocations.forEach(allocation => {
      // Use the allocation's security type as sector
      const sector = allocation.securityType || "Other";
      const currentTotal = sectorTotals.get(sector) || 0;
      
      sectorTotals.set(sector, currentTotal + (allocation.amount || 0));
    });
    
    // Convert to the format needed for the pie chart - matching dashboard format
    return Array.from(sectorTotals.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by amount (descending)
      .map(([sector, amount]): SectorData => ({
        sector,
        count: amount,
        percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
      }));
  }, [allocations]);
  
  // Get the total called capital (funded allocations) for display
  const totalCalledCapital = React.useMemo(() => {
    return allocations
      .filter(allocation => allocation.status === 'funded')
      .reduce((sum, allocation) => sum + allocation.amount, 0);
  }, [allocations]);

  // Process data for chart display - handling "Other" categories
  const processedData = React.useMemo(() => {
    if (sectorData.length <= 8) return sectorData;
    
    const topSectors = sectorData.slice(0, 7);
    const otherSectors = sectorData.slice(7);
    
    const otherCount = otherSectors.reduce((sum, item) => sum + item.count, 0);
    const otherPercentage = otherSectors.reduce((sum, item) => sum + item.percentage, 0);
    
    return [
      ...topSectors,
      {
        sector: 'Other Sectors',
        count: otherCount,
        percentage: otherPercentage
      }
    ];
  }, [sectorData]);
  
  return (
    <Card className="h-full w-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle>Sector Distribution</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {processedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-neutral-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            <p>No allocation data available to display sector distribution.</p>
          </div>
        ) : (
          <div className="h-[300px] xs:h-[320px] sm:h-[380px] md:h-[420px] w-full relative overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={processedData}
                  cx={windowWidth < 640 ? "50%" : "40%"}
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  innerRadius={windowWidth < 375 ? 45 : windowWidth < 480 ? 50 : windowWidth < 640 ? 60 : 80}
                  outerRadius={windowWidth < 375 ? 90 : windowWidth < 480 ? 100 : windowWidth < 640 ? 120 : 140}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {processedData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getSectorColor(entry.sector)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip sectorData={processedData} />} />
                <Legend 
                  verticalAlign={windowWidth < 640 ? "bottom" : "middle"}
                  align={windowWidth < 640 ? "center" : "right"}
                  layout={windowWidth < 640 ? "horizontal" : "vertical"}
                  payload={
                    processedData.map((item, index) => {
                      const totalCount = processedData.reduce((sum, i) => sum + i.count, 0);
                      const percentage = item.count / totalCount * 100;
                      // Truncate long sector names on small screens
                      const displayName = windowWidth < 640 && item.sector.length > 12 ? 
                        item.sector.substring(0, 10) + '...' : item.sector;
                      return {
                        value: windowWidth < 640 ? 
                          `${displayName}` : 
                          `${item.sector} `,
                        type: 'circle',
                        id: item.sector,
                        color: getSectorColor(item.sector),
                      };
                    })
                  }
                  iconSize={windowWidth < 640 ? 8 : 10}
                  wrapperStyle={windowWidth < 640 ? { bottom: 0, maxWidth: '100%', overflowX: 'hidden' } : { right: 0, top: 20 }}
                  formatter={(value: string, entry) => {
                    const totalCount = processedData.reduce((sum, i) => sum + i.count, 0);
                    const item = processedData.find(item => item.sector === entry.id);
                    if (!item) return <span className="text-[10px] xs:text-xs sm:text-sm font-medium text-black">{value}</span>;
                    const percentage = item.count / totalCount * 100;
                    
                    return (
                      <span className="text-[10px] xs:text-xs sm:text-sm font-medium text-black">
                        {value} <span className="font-bold">({formatPercentage(percentage, 0)})</span>
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FundSectorDistribution;
