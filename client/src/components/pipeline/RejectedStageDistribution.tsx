import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Deal } from "@/lib/types";
import { REJECTION_CATEGORIES } from "@/lib/constants/rejection-reasons";

interface RejectedStageDistributionProps {
  deals: Deal[];
}

export default function RejectedStageDistribution({ deals }: RejectedStageDistributionProps) {
  if (!deals || deals.length === 0) return null;

  // First, let's categorize deals - both with structured data and legacy free-text reasons
  const categorizeReason = (deal: Deal): { category: string; reason: string } => {
    // If we have structured rejection data, use it
    if (deal.rejectionData && deal.rejectionData.category) {
      return {
        category: deal.rejectionData.category,
        reason: deal.rejectionData.reason || 'Unspecified'
      };
    }
    
    // If we have rejection category but no structured data
    if (deal.rejectionCategory) {
      return {
        category: deal.rejectionCategory,
        reason: deal.rejectionReason || 'Unspecified'
      };
    }
    
    // For legacy free-text rejection reasons, try to categorize them
    const reason = deal.rejectionReason?.toLowerCase() || '';
    
    if (reason.includes('valuation') || reason.includes('price') || reason.includes('expensive')) {
      return { category: 'FINANCIAL', reason: deal.rejectionReason || 'Valuation concerns' };
    }
    if (reason.includes('market') || reason.includes('competitive') || reason.includes('timing')) {
      return { category: 'MARKET', reason: deal.rejectionReason || 'Market concerns' };
    }
    if (reason.includes('team') || reason.includes('management') || reason.includes('founder')) {
      return { category: 'TEAM', reason: deal.rejectionReason || 'Team concerns' };
    }
    if (reason.includes('business model') || reason.includes('revenue') || reason.includes('unit economics')) {
      return { category: 'BUSINESS_MODEL', reason: deal.rejectionReason || 'Business model concerns' };
    }
    if (reason.includes('legal') || reason.includes('compliance') || reason.includes('ip')) {
      return { category: 'DUE_DILIGENCE', reason: deal.rejectionReason || 'Due diligence concerns' };
    }
    if (reason.includes('thesis') || reason.includes('fit') || reason.includes('strategy')) {
      return { category: 'STRATEGIC', reason: deal.rejectionReason || 'Strategic concerns' };
    }
    if (reason.includes('terms') || reason.includes('deal structure')) {
      return { category: 'TERMS', reason: deal.rejectionReason || 'Terms concerns' };
    }
    
    // Default for unspecified or unknown reasons
    return { 
      category: 'OTHER', 
      reason: deal.rejectionReason || 'No reason specified' 
    };
  };

  // Categorize all deals
  const categorizedDeals = deals.map(deal => ({
    ...deal,
    ...categorizeReason(deal)
  }));

  // Count rejections by category
  const rejectionStats = Object.keys(REJECTION_CATEGORIES).map(categoryKey => {
    const categoryDeals = categorizedDeals.filter(deal => deal.category === categoryKey);
    
    return {
      category: REJECTION_CATEGORIES[categoryKey as keyof typeof REJECTION_CATEGORIES].label,
      categoryKey,
      count: categoryDeals.length,
      percentage: Math.round((categoryDeals.length / deals.length) * 100),
      deals: categoryDeals
    };
  }).filter(stat => stat.count > 0); // Only show categories with rejections

  // Count specific reasons within each category
  const getReasonBreakdown = (categoryDeals: any[]) => {
    const reasonCounts: Record<string, number> = {};
    
    categoryDeals.forEach(deal => {
      const reason = deal.reason || 'Unspecified';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    
    return Object.entries(reasonCounts).map(([reason, count]) => ({
      reason,
      count,
      percentage: Math.round((count / categoryDeals.length) * 100)
    }));
  };

  // Get color for category badge
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Market Issues': 'bg-red-100 text-red-700 border-red-200',
      'Financial': 'bg-orange-100 text-orange-700 border-orange-200',
      'Management Team': 'bg-purple-100 text-purple-700 border-purple-200',
      'Business Model': 'bg-blue-100 text-blue-700 border-blue-200',
      'Due Diligence': 'bg-gray-100 text-gray-700 border-gray-200',
      'Strategic Fit': 'bg-green-100 text-green-700 border-green-200',
      'Deal Terms': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'Other': 'bg-yellow-100 text-yellow-700 border-yellow-200'
    };
    return colors[category] || 'bg-neutral-100 text-neutral-700 border-neutral-200';
  };
  
  // Get progress bar color
  const getProgressBarColor = (category: string) => {
    const colors: Record<string, string> = {
      'Market Issues': '#dc2626',
      'Financial': '#ea580c', 
      'Management Team': '#9333ea',
      'Business Model': '#2563eb',
      'Due Diligence': '#6b7280',
      'Strategic Fit': '#16a34a',
      'Deal Terms': '#4f46e5',
      'Other': '#ca8a04'
    };
    return colors[category] || '#6b7280';
  };

  return (
    <Card className="mb-6 h-full w-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg">
          Rejection Category Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-2">
        <div className="space-y-3">
          {rejectionStats.length === 0 ? (
            <div className="text-center text-neutral-500 py-8">
              <p className="text-sm">No rejection reason data available</p>
              <p className="text-xs mt-1">Deals may have been rejected before structured rejection system was implemented</p>
            </div>
          ) : (
            rejectionStats.map(({ category, count, percentage }) => (
              <div key={category} className="space-y-2">
                {/* Category Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getProgressBarColor(category) }}
                    />
                    <span className="text-sm font-medium text-neutral-900">
                      {category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-neutral-600">
                      {count} deal{count !== 1 ? 's' : ''}
                    </span>
                    <span className="font-medium text-neutral-900 min-w-[3rem] text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-neutral-100 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: getProgressBarColor(category)
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>


      </CardContent>
    </Card>
  );
}