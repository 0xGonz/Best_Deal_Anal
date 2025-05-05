import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, Briefcase, Clock, DollarSign, PieChart } from "lucide-react";
import { Deal } from "@/lib/types";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";
import { PERCENTAGE_CALCULATION, FINANCIAL_CALCULATION, SCORE_CALCULATION, PIPELINE_METRICS } from "@/lib/constants/calculation-constants";
import { PADDING, MARGIN, GAP } from "@/lib/constants/spacing-constants";

type PipelineStat = {
  label: string;
  value: string | number;
  trend?: number;
  icon: React.ReactNode;
  iconColor: string;
};

type PipelineStatsProps = {
  deals: Deal[] | undefined;
  filteredDeals: Deal[] | undefined;
  stage: string;
};

export default function PipelineStats({ deals, filteredDeals, stage }: PipelineStatsProps) {
  if (!deals || !filteredDeals) return null;
  
  // Calculate statistics for the current view
  const totalDealsCount = filteredDeals.length;
  
  // Calculate deal value based on actual deal data
  const totalDealValue = filteredDeals.reduce((sum, deal) => {
    // Use actual valuation if available, otherwise use target raise amount
    const dealValue = deal.valuation 
      ? parseFloat(deal.valuation.replace(/[^0-9.-]+/g, '')) 
      : deal.targetRaise 
        ? parseFloat(deal.targetRaise.replace(/[^0-9.-]+/g, '')) 
        : 0;
    return sum + dealValue;
  }, 0);
  
  // Calculate average deal score
  const avgScore = filteredDeals.reduce((sum, deal) => sum + (deal.score || 0), 0) / 
    (filteredDeals.length || 1);
  
  // Calculate stage-specific stats
  const stageDeals = stage !== 'all' ? filteredDeals : deals.filter(d => d.stage === 'diligence');
  
  // Calculate actual trends based on proportions in pipeline using percentage calculation constants
  const totalTrend = deals.length > 0 ? 
    PERCENTAGE_CALCULATION.DEFAULT_ROUNDING((filteredDeals.length / deals.length) * PERCENTAGE_CALCULATION.DECIMAL_TO_PERCENTAGE) - PERCENTAGE_CALCULATION.BASE_VALUE : 0;
  const stageTrend = deals.length > 0 ? 
    PERCENTAGE_CALCULATION.DEFAULT_ROUNDING((stageDeals.length / deals.length) * PERCENTAGE_CALCULATION.DECIMAL_TO_PERCENTAGE) - PERCENTAGE_CALCULATION.BASE_VALUE : 0;
  const valueTrend = filteredDeals.length > 0 ? 
    PERCENTAGE_CALCULATION.DEFAULT_ROUNDING((totalDealValue / filteredDeals.length) / FINANCIAL_CALCULATION.MILLION) : 0;
  
  // Calculate stage conversion rate (for different stages this would be calculated differently)
  const conversionRate = stage === 'all' ? 
    (deals.filter(d => d.stage === 'invested').length / (deals.length || 1)) * PERCENTAGE_CALCULATION.DECIMAL_TO_PERCENTAGE :
    (filteredDeals.length / (deals.length || 1)) * PERCENTAGE_CALCULATION.DECIMAL_TO_PERCENTAGE;
  
  const stageLabel = stage === 'all' ? "In Diligence" : 
    stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  // Count deals by stage
  const initialReviewCount = deals.filter(d => d.stage === 'initial_review').length;
  const screeningCount = deals.filter(d => d.stage === 'screening').length;
  const diligenceCount = deals.filter(d => d.stage === 'diligence').length;
  const icReviewCount = deals.filter(d => d.stage === 'ic_review').length;
  const closingCount = deals.filter(d => d.stage === 'closing').length;
  const investedCount = deals.filter(d => d.stage === 'invested').length;
  
  // Calculate conversion percentages using percentage calculation constants
  const screeningPercent = deals.length > 0 ? 
    PERCENTAGE_CALCULATION.DEFAULT_ROUNDING((screeningCount / deals.length) * PERCENTAGE_CALCULATION.DECIMAL_TO_PERCENTAGE) : 0;
  const diligencePercent = deals.length > 0 ? 
    PERCENTAGE_CALCULATION.DEFAULT_ROUNDING((diligenceCount / deals.length) * PERCENTAGE_CALCULATION.DECIMAL_TO_PERCENTAGE) : 0;
  const icPercent = deals.length > 0 ? 
    PERCENTAGE_CALCULATION.DEFAULT_ROUNDING((icReviewCount / deals.length) * PERCENTAGE_CALCULATION.DECIMAL_TO_PERCENTAGE) : 0;
  const investmentPercent = deals.length > 0 ? 
    PERCENTAGE_CALCULATION.DEFAULT_ROUNDING((investedCount / deals.length) * PERCENTAGE_CALCULATION.DECIMAL_TO_PERCENTAGE) : 0;
  
  // Calculate average days in current stage for stage-specific tabs
  const calculateAverageDaysInStage = (deals: Deal[], stageName: string): number => {
    if (deals.length === 0) return 0;
    
    const today = new Date();
    let totalDays = 0;
    let dealsWithTimeline = 0;
    
    deals.forEach(deal => {
      // Use the last update date or creation date to calculate days in stage
      const referenceDate = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt);
      const dayDiff = Math.floor((today.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayDiff > 0) {
        totalDays += dayDiff;
        dealsWithTimeline++;
      }
    });
    
    return dealsWithTimeline > 0 ? Math.round(totalDays / dealsWithTimeline) : 0;
  };
  
  // Create different stats for all deals vs. specific stage
  let stats: PipelineStat[] = [];
  
  if (stage === 'all') {
    // For "All Deals" tab - show pipeline distribution
    stats = [
      {
        label: "Total Deals",
        value: totalDealsCount,
        trend: totalTrend, 
        icon: <Briefcase />,
        iconColor: "bg-blue-100 text-blue-600"
      },
      {
        label: "In Screening",
        value: screeningCount,
        trend: stageTrend,
        icon: <Clock />,
        iconColor: "bg-violet-100 text-violet-600"
      },
      {
        label: "In Diligence",
        value: diligenceCount,
        trend: Math.round(diligencePercent - PIPELINE_METRICS.TARGET_DILIGENCE_RATE),
        icon: <Target />,
        iconColor: "bg-emerald-100 text-emerald-600"
      },
      {
        label: "Investment Rate",
        value: formatPercentage(investmentPercent, FINANCIAL_CALCULATION.DEFAULT_PRECISION),
        trend: investmentPercent - PIPELINE_METRICS.TARGET_INVESTMENT_RATE, // Compare to target investment rate
        icon: <PieChart />,
        iconColor: "bg-amber-100 text-amber-600"
      },
    ];
  } else {
    // For specific stage tabs - focus on stage metrics
    const stageName = stage.replace('_', ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    const averageDaysInStage = calculateAverageDaysInStage(filteredDeals, stage);
    const maxDaysInStage = filteredDeals.length > 0 ? 
      Math.max(...filteredDeals.map(d => {
        const creationDate = new Date(d.createdAt);
        const today = new Date();
        return Math.floor((today.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
      })) : 0;
    
    stats = [
      {
        label: `Deals in ${stageName}`,
        value: filteredDeals.length,
        // Compare to baseline rate of deals in this stage vs. total pipeline
        trend: deals.length > 0 ? Math.round((filteredDeals.length / deals.length) * 100) - (deals.filter(d => d.stage === stage).length / Math.max(deals.length, 1) * 100) : 0,
        icon: <Briefcase />,
        iconColor: "bg-blue-100 text-blue-600"
      },
      {
        label: `Avg Days in ${stageName}`,
        value: averageDaysInStage,
        trend: (() => {
          // Compare average days in stage with target days
          const targetDays = stage === 'initial_review' ? PIPELINE_METRICS.TARGET_DAYS.INITIAL_REVIEW :
            stage === 'screening' ? PIPELINE_METRICS.TARGET_DAYS.SCREENING :
            stage === 'diligence' ? PIPELINE_METRICS.TARGET_DAYS.DILIGENCE :
            stage === 'ic_review' ? PIPELINE_METRICS.TARGET_DAYS.IC_REVIEW :
            stage === 'closing' ? PIPELINE_METRICS.TARGET_DAYS.CLOSING : 14;
          // Negative trend means we're taking longer than target (bad)
          // Positive trend means we're faster than target (good)
          return targetDays > 0 ? Math.round((targetDays - averageDaysInStage) / targetDays * 100) : 0;
        })(),
        icon: <Clock />,
        iconColor: "bg-violet-100 text-violet-600"
      },
      {
        label: `Longest in ${stageName}`,
        value: maxDaysInStage,
        trend: (() => {
          // Compare maximum days in stage with 2x target days (as a threshold for concern)
          const targetDays = stage === 'initial_review' ? PIPELINE_METRICS.TARGET_DAYS.INITIAL_REVIEW * 2 :
            stage === 'screening' ? PIPELINE_METRICS.TARGET_DAYS.SCREENING * 2 :
            stage === 'diligence' ? PIPELINE_METRICS.TARGET_DAYS.DILIGENCE * 2 :
            stage === 'ic_review' ? PIPELINE_METRICS.TARGET_DAYS.IC_REVIEW * 2 :
            stage === 'closing' ? PIPELINE_METRICS.TARGET_DAYS.CLOSING * 2 : 28;
          // Negative trend means we're taking much longer than target (bad)
          // Positive trend means we're within reasonable timeframe (good)
          return targetDays > 0 ? Math.round((targetDays - maxDaysInStage) / targetDays * 100) : 0;
        })(),
        icon: <Target />,
        iconColor: "bg-emerald-100 text-emerald-600"
      },
      {
        label: "Next Stage Rate",
        value: formatPercentage(
          // Calculate actual progression rate based on data
          deals.filter(d => d.stage > stage).length / 
            Math.max(deals.filter(d => d.stage >= stage).length, 1) * 
            PERCENTAGE_CALCULATION.DECIMAL_TO_PERCENTAGE,
          FINANCIAL_CALCULATION.DEFAULT_PRECISION
        ),
        // Calculate trend based on progression changes
        trend: deals.filter(d => d.stage === stage).length > 0 ? 
          Math.round((filteredDeals.length / deals.filter(d => d.stage === stage).length) * 100) - 100 : 0,
        icon: <PieChart />,
        iconColor: "bg-amber-100 text-amber-600"
      },
    ];
  }

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 ${GAP.MD} ${MARGIN.LAYOUT.COMPONENT}`}>
      {stats.map((stat, index) => (
        <Card key={index} className="bg-white overflow-hidden h-full">
          <CardContent className="pt-3 xs:pt-4 sm:pt-6 p-2 xs:p-3 sm:p-6 h-full flex flex-col">
            <div className="flex justify-between items-start mb-1 xs:mb-2 sm:mb-3">
              <h3 className="text-[10px] xs:text-xs sm:text-sm font-medium text-neutral-600 truncate mr-1 max-w-[75%]">{stat.label}</h3>
              <div className={`rounded-full ${stat.iconColor} p-1 xs:p-1.5 sm:p-2.5 flex-shrink-0`}>
                <div className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-5 sm:w-5">{stat.icon}</div>
              </div>
            </div>
            
            <div className="flex items-end flex-wrap mt-auto">
              <span className="text-sm xs:text-base sm:text-xl md:text-2xl font-bold mr-1 sm:mr-2 truncate max-w-full">
                {stat.value}
              </span>
              
              {/* Trend indicator */}
              {stat.trend !== undefined && (
                <div className="flex items-center">
                  {stat.trend > 0 ? (
                    <div className="text-success flex items-center text-[9px] xs:text-xs">
                      <TrendingUp className="h-2.5 w-2.5 xs:h-3 xs:w-3 mr-0.5 xs:mr-1" />
                      {stat.trend}%
                    </div>
                  ) : stat.trend < 0 ? (
                    <div className="text-danger flex items-center text-[9px] xs:text-xs">
                      <TrendingDown className="h-2.5 w-2.5 xs:h-3 xs:w-3 mr-0.5 xs:mr-1" />
                      {Math.abs(stat.trend)}%
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
