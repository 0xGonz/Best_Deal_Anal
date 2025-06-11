import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Deal, TimelineEvent } from "@/lib/types";
import { DealStageLabels } from "@shared/schema";
import { getDealStageBadgeClass, formatPercentage } from "@/lib/utils/format";
import { TIME_CALCULATION } from "@/lib/constants/calculation-constants";

type StageDistributionProps = {
  deals: Deal[] | undefined;
  stage: string;
};

// Map badge classes to vibrant chart colors
const getStageColorClass = (stage: string): string => {
  const badgeClass = getDealStageBadgeClass(stage);
  
  // Extract the color part from the badge class and convert to vibrant chart colors
  if (badgeClass.includes('bg-gray')) return 'bg-gray-500';
  if (badgeClass.includes('bg-blue')) return 'bg-blue-500';
  if (badgeClass.includes('bg-indigo')) return 'bg-indigo-500';
  if (badgeClass.includes('bg-purple')) return 'bg-purple-500';
  if (badgeClass.includes('bg-amber')) return 'bg-amber-500';
  if (badgeClass.includes('bg-emerald')) return 'bg-emerald-500';
  if (badgeClass.includes('bg-teal')) return 'bg-teal-500';
  if (badgeClass.includes('bg-red')) return 'bg-red-500';
  if (badgeClass.includes('bg-yellow')) return 'bg-yellow-500';
  
  return 'bg-gray-500'; // Default
};

export default function StageDistribution({ deals, stage }: StageDistributionProps) {
  if (!deals || deals.length === 0) return null;
  
  // Function to calculate days in stage for each deal using timeline events
  const calculateDaysInStage = (deal: Deal): number => {
    // Use timeline events if available, otherwise fall back to creation date
    if (deal.timelineEvents && deal.timelineEvents.length > 0) {
      // Find the earliest timeline event with the current stage
      const stageEvent = deal.timelineEvents
        .filter((event: TimelineEvent) => event.eventType === 'stage_change' && event.metadata?.newStage === deal.stage)
        .sort((a: TimelineEvent, b: TimelineEvent) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      
      if (stageEvent) {
        const stageChangeDate = new Date(stageEvent.createdAt);
        const today = new Date();
        return Math.max(1, Math.floor((today.getTime() - stageChangeDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }
    
    // Fall back to creation date if timeline events aren't available
    const creationDate = new Date(deal.createdAt);
    const today = new Date();
    return Math.max(1, Math.floor((today.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24)));
  };
  
  // Different visualizations based on whether we're viewing all deals or a specific stage
  if (stage !== 'all') {
    // For specific stage view, show "Days in Stage" visualization
    const stageName = stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    const colorClass = getStageColorClass(stage);
    
    // Calculate days in stage for each deal
    const dealDays = deals.map(deal => ({
      id: deal.id,
      name: deal.name,
      days: calculateDaysInStage(deal),
    }));
    
    // Sort by days (descending)
    dealDays.sort((a, b) => b.days - a.days);
    
    // Type for our category stats
    type CategoryStat = {
      label: string;
      count: number;
      percentage?: number;
    };
    
    // Calculate distribution categories using configured constants
    const { RECENT, SHORT, MEDIUM, LONG } = TIME_CALCULATION.DAY_CATEGORIES;
    const categories: CategoryStat[] = [
      { label: `< ${RECENT} days`, count: dealDays.filter(d => d.days < RECENT).length },
      { label: `${RECENT}-${SHORT} days`, count: dealDays.filter(d => d.days >= RECENT && d.days < SHORT).length },
      { label: `${SHORT}-${MEDIUM} days`, count: dealDays.filter(d => d.days >= SHORT && d.days < MEDIUM).length },
      { label: `${MEDIUM}+ days`, count: dealDays.filter(d => d.days >= MEDIUM && d.days < LONG).length },
    ];
    
    // Calculate percentages
    categories.forEach(cat => {
      cat.percentage = Math.round((cat.count / deals.length) * 100) || 0;
    });
    
    return (
      <Card className="mb-6 h-full w-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">
            Days in {stageName} Stage
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-3 sm:space-y-4">
            {categories.map((cat, index) => (
              <div key={index} className="space-y-1">
                <div className="flex flex-wrap sm:flex-nowrap justify-between items-center">
                  <div className="flex items-center mb-1 sm:mb-0 min-w-[100px] sm:min-w-[120px] max-w-[65%] sm:max-w-[70%]">
                    <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${colorClass} mr-1.5 sm:mr-2 flex-shrink-0`}></div>
                    <span className="text-xs sm:text-sm font-medium truncate text-black">{cat.label}</span>
                  </div>
                  <div className="flex items-center ml-auto sm:ml-0">
                    <span className="text-xs sm:text-sm text-black mr-1.5 sm:mr-2 whitespace-nowrap">{cat.count} deals</span>
                    <span className="text-[10px] sm:text-xs text-black bg-neutral-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      <span className="font-bold">{formatPercentage(cat.percentage || 0, 0)}</span>
                    </span>
                  </div>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-2 sm:h-2.5">
                  <div 
                    className={`${colorClass} h-2 sm:h-2.5 rounded-full transition-all duration-300 ease-in-out`} 
                    style={{ width: `${cat.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Stats only - no individual deals listing */}
        </CardContent>
      </Card>
    );
  }
  
  // For "All Deals" view, show the regular stage distribution
  // Group deals by stage
  const stageGroups = deals.reduce((acc: Record<string, Deal[]>, deal: Deal) => {
    const stage = deal.stage;
    if (!acc[stage]) {
      acc[stage] = [];
    }
    acc[stage].push(deal);
    return acc;
  }, {});
  
  // Calculate stats for each stage
  const stageStats = Object.entries(stageGroups).map(([stageName, stageDeals]) => ({
    stage: stageName,
    label: DealStageLabels[stageName as keyof typeof DealStageLabels] || stageName,
    count: stageDeals.length,
    percentage: Math.round((stageDeals.length / deals.length) * 100),
    colorClass: getStageColorClass(stageName)
  }));
  
  // Sort by count (descending)
  stageStats.sort((a, b) => b.count - a.count);
  
  return (
    <Card className="mb-6 h-full w-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg">
          Deal Stage Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-3 sm:space-y-4">
          {stageStats.map((stat) => (
            <div key={stat.stage} className="space-y-1">
              <div className="flex flex-wrap sm:flex-nowrap justify-between items-center">
                <div className="flex items-center mb-1 sm:mb-0 min-w-[100px] sm:min-w-[120px] max-w-[65%] sm:max-w-[70%]">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${stat.colorClass} mr-1.5 sm:mr-2 flex-shrink-0`}></div>
                  <span className="text-xs sm:text-sm font-medium truncate text-black">{stat.label}</span>
                </div>
                <div className="flex items-center ml-auto sm:ml-0">
                  <span className="text-xs sm:text-sm text-black mr-1.5 sm:mr-2 whitespace-nowrap">{stat.count} deals</span>
                  <span className="text-[10px] sm:text-xs text-black bg-neutral-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    <span className="font-bold">{formatPercentage(stat.percentage, 0)}</span>
                  </span>
                </div>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-2 sm:h-2.5">
                <div 
                  className={`${stat.colorClass} h-2 sm:h-2.5 rounded-full transition-all duration-300 ease-in-out`} 
                  style={{ width: `${stat.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}