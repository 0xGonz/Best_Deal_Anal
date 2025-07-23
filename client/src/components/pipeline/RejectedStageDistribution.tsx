import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Deal } from "@/lib/types";
import { REJECTION_CATEGORIES } from "@/lib/constants/rejection-reasons";

interface RejectedStageDistributionProps {
  deals: Deal[];
}

export default function RejectedStageDistribution({ deals }: RejectedStageDistributionProps) {
  if (!deals || deals.length === 0) return null;

  // Count rejections by category
  const rejectionStats = Object.keys(REJECTION_CATEGORIES).map(category => {
    const categoryDeals = deals.filter(deal => 
      deal.rejectionCategory === category || 
      (deal.rejectionData && deal.rejectionData.category === category)
    );
    
    return {
      category,
      count: categoryDeals.length,
      percentage: Math.round((categoryDeals.length / deals.length) * 100),
      deals: categoryDeals
    };
  }).filter(stat => stat.count > 0); // Only show categories with rejections

  // Count specific reasons within each category
  const getReasonBreakdown = (categoryDeals: Deal[]) => {
    const reasonCounts: Record<string, number> = {};
    
    categoryDeals.forEach(deal => {
      const reason = deal.rejectionReason || 
        (deal.rejectionData && deal.rejectionData.reason) || 
        'Unspecified';
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
      'Market': 'bg-red-100 text-red-700 border-red-200',
      'Financial': 'bg-orange-100 text-orange-700 border-orange-200',
      'Team': 'bg-purple-100 text-purple-700 border-purple-200',
      'Product': 'bg-blue-100 text-blue-700 border-blue-200',
      'Legal': 'bg-gray-100 text-gray-700 border-gray-200',
      'Strategic': 'bg-green-100 text-green-700 border-green-200',
      'Other': 'bg-yellow-100 text-yellow-700 border-yellow-200'
    };
    return colors[category] || 'bg-neutral-100 text-neutral-700 border-neutral-200';
  };

  return (
    <Card className="mb-6 h-full w-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg">
          Rejection Reasons Analysis
        </CardTitle>
        <p className="text-xs sm:text-sm text-neutral-600">
          {deals.length} rejected deals categorized by reason
        </p>
      </CardHeader>
      <CardContent className="flex-1 pt-2">
        <div className="space-y-4">
          {rejectionStats.length === 0 ? (
            <div className="text-center text-neutral-500 py-8">
              <p className="text-sm">No rejection reason data available</p>
              <p className="text-xs mt-1">Deals may have been rejected before structured rejection system was implemented</p>
            </div>
          ) : (
            rejectionStats.map(({ category, count, percentage, deals: categoryDeals }) => (
              <div key={category} className="space-y-3">
                {/* Category Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs font-medium ${getCategoryColor(category)}`}
                    >
                      {category}
                    </Badge>
                    <span className="text-sm font-medium text-neutral-900">
                      {count} deal{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-sm text-neutral-600 font-medium">
                    {percentage}%
                  </span>
                </div>

                {/* Reason Breakdown */}
                <div className="ml-4 space-y-2">
                  {getReasonBreakdown(categoryDeals).map(({ reason, count: reasonCount, percentage: reasonPercentage }) => (
                    <div key={reason} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-700 truncate flex-1 mr-2">
                        {reason === 'Other' ? 'Custom reasons' : reason}
                      </span>
                      <div className="flex items-center gap-2 text-neutral-600">
                        <span>{reasonCount}</span>
                        <span className="text-xs">({reasonPercentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-neutral-100 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: getCategoryColor(category).includes('red') ? '#dc2626' :
                                    getCategoryColor(category).includes('orange') ? '#ea580c' :
                                    getCategoryColor(category).includes('purple') ? '#9333ea' :
                                    getCategoryColor(category).includes('blue') ? '#2563eb' :
                                    getCategoryColor(category).includes('gray') ? '#6b7280' :
                                    getCategoryColor(category).includes('green') ? '#16a34a' :
                                    '#ca8a04'
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {rejectionStats.length > 0 && (
          <div className="mt-6 pt-4 border-t border-neutral-200">
            <div className="text-xs text-neutral-600">
              <p>Top rejection category: <span className="font-medium text-neutral-900">
                {rejectionStats[0]?.category} ({rejectionStats[0]?.percentage}%)
              </span></p>
              <p className="mt-1">
                Categories with rejections: {rejectionStats.length} of {Object.keys(REJECTION_CATEGORIES).length}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}