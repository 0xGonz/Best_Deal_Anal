import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatPercentage } from '@/lib/utils/format';
import { FINANCIAL_CALCULATION } from '@/lib/constants/calculation-constants';

// Define interfaces for our component
// We'll use Recharts' own type system

interface SectorStatItem {
  sector: string;
  count: number;
  percentage: number;
}

// Use centralized chart colors for consistency
import { getSectorColor, FALLBACK_COLORS } from '@/lib/constants/chart-constants';

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
  payload?: Array<{payload: SectorStatItem}>;
  sectorData: SectorStatItem[];
}

const CustomTooltip = ({ active, payload, sectorData }: TooltipProps) => {
  if (active && payload && payload.length && sectorData) {
    const data = payload[0].payload;
    
    // Calculate the total count from the actual sectored data array
    const totalCount = sectorData.reduce((sum: number, item: SectorStatItem) => sum + item.count, 0);
    
    // Calculate percentage correctly
    const percentage = data.count / totalCount * 100;
    
    return (
      <div className="bg-white p-2 border border-neutral-200 rounded-md shadow-sm">
        <p className="font-medium text-black">{data.sector}</p>
        <p className="text-black"><span className="font-medium text-black">Count:</span> {data.count}</p>
        <p className="text-black"><span className="font-medium text-black">Percentage:</span> <span className="font-bold">{formatPercentage(percentage, 0)}</span></p>
      </div>
    );
  }
  return null;
};

export default function SectorDistributionChart() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: sectorStats = [], isLoading } = useQuery<SectorStatItem[]>({
    queryKey: ['/api/dashboard/sector-stats'],
  });

  // Sort stats by count (descending) and limit to top 8 sectors
  const processedData = React.useMemo(() => {
    // Create a copy of the array to avoid mutating the original data
    const sortedStats = [...sectorStats].sort((a, b) => b.count - a.count);
    
    // Map specific sectors to friendly display names if needed
    const mappedStats = sortedStats.map(item => ({
      ...item,
      // You can map sector names here if needed
      // sector: sectorNameMapping[item.sector] || item.sector
    }));
    
    if (mappedStats.length <= 8) return mappedStats;
    
    const topSectors = mappedStats.slice(0, 7);
    const otherSectors = mappedStats.slice(7);
    
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
  }, [sectorStats]);

  return (
    <Card className="h-full w-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle>Sector Distribution</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-[380px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : processedData.length === 0 ? (
          <div className="flex justify-center items-center h-[380px]">
            <p className="text-neutral-500">No sector data available</p>
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
}