import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { MiniMemo } from '@shared/schema';
import { UserAvatar } from '@/components/common/UserAvatar';

// Import due diligence checklist as a constant to be used throughout the app
export const DUE_DILIGENCE_CHECKLIST = {
  financialReview: 'Financial Review',
  legalReview: 'Legal Review',
  marketAnalysis: 'Market Analysis',
  teamAssessment: 'Team Assessment', 
  customerInterviews: 'Customer Interviews',
  competitorAnalysis: 'Competitor Analysis',
  technologyReview: 'Technology Review',
  businessModelValidation: 'Business Model Validation',
  regulatoryCompliance: 'Regulatory Compliance',
  esgAssessment: 'Background Check'
};

interface MemoUser {
  id: number;
  fullName?: string;
  initials?: string;
  avatarColor?: string | null;
  role?: string;
  username?: string;
}

interface ExtendedMiniMemo extends MiniMemo {
  user?: MemoUser | null;
}

// Takes a Mini Memo object and displays it in a nice format
export function MiniMemoDisplay({ 
  memo, 
  expanded = false, 
  onClick 
}: { 
  memo: ExtendedMiniMemo, 
  expanded?: boolean, 
  onClick?: () => void 
}) {
  // Use proper structured fields from the schema
  const hasAssessment = !!memo.marketRiskScore || !!memo.executionRiskScore || 
                       !!memo.teamStrengthScore || !!memo.productFitScore || 
                       !!memo.valuationScore || !!memo.competitiveAdvantageScore;

  // Check if alignment data exists
  const hasAlignment = !!memo.raiseAmount || !!memo.gpCommitment || !!memo.gpAlignmentPercentage || !!memo.alignmentScore;

  // Calculate assessment average directly from memo fields
  const assessmentAverage = useMemo(() => {
    if (!hasAssessment) return null;
    
    const scores = [
      memo.marketRiskScore,
      memo.executionRiskScore,
      memo.teamStrengthScore,
      memo.productFitScore,
      memo.valuationScore,
      memo.competitiveAdvantageScore
    ].filter(Boolean) as number[];
    
    if (scores.length === 0) return null;
    
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return Math.round((sum / scores.length) * 10) / 10;
  }, [memo, hasAssessment]);

  // Count completed due diligence items
  const dueDiligenceStats = useMemo(() => {
    if (!memo.dueDiligenceChecklist) {
      return { completed: 0, total: Object.keys(DUE_DILIGENCE_CHECKLIST).length, percent: 0 };
    }
    
    const total = Object.keys(DUE_DILIGENCE_CHECKLIST).length;
    const completed = Object.values(memo.dueDiligenceChecklist).filter(Boolean).length;
    return {
      completed,
      total,
      percent: Math.round((completed / total) * 100)
    };
  }, [memo.dueDiligenceChecklist]);

  return (
    <Card 
      className={`border rounded-lg p-3 sm:p-4 shadow-sm transition-all duration-200 ${onClick ? 'hover:shadow-md hover:border-primary-300 cursor-pointer' : ''} ${expanded ? 'shadow-md' : ''}`}
      onClick={onClick}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
        <div className="flex items-center">
          <UserAvatar 
            user={memo.user} 
            size="sm" 
            className="mr-2"
          />
          <div>
            <p className="text-sm font-medium">
              {memo.user?.fullName || "Team Member"}
            </p>
            <p className="text-xs text-neutral-500">
              {memo.createdAt 
                ? new Date(memo.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })
                : ""
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="mt-1 sm:mt-0 text-xs px-2 py-0.5">
            Score: {memo.score}
          </Badge>
          {hasAssessment && assessmentAverage && (
            <Badge variant="outline" className="mt-1 sm:mt-0 text-xs px-2 py-0.5 bg-blue-50">
              Assessment Avg: {assessmentAverage}
            </Badge>
          )}
          {memo.alignmentScore && (
            <Badge variant="outline" className="mt-1 sm:mt-0 text-xs px-2 py-0.5 bg-green-50">
              Alignment: {memo.alignmentScore}/10
            </Badge>
          )}
        </div>
      </div>

      {(hasAssessment || hasAlignment) ? (
        <Tabs defaultValue="thesis" className="w-full mt-3">
          <TabsList className={`grid w-full ${hasAssessment && hasAlignment ? 'grid-cols-4' : hasAssessment ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="thesis" onClick={(e) => e.stopPropagation()}>Thesis</TabsTrigger>
            {hasAssessment && <TabsTrigger value="assessment" onClick={(e) => e.stopPropagation()}>Assessment</TabsTrigger>}
            {hasAlignment && <TabsTrigger value="alignment" onClick={(e) => e.stopPropagation()}>Alignment</TabsTrigger>}
            <TabsTrigger value="diligence" onClick={(e) => e.stopPropagation()}>Due Diligence</TabsTrigger>
          </TabsList>
          
          <TabsContent value="thesis" className="space-y-3 mt-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-neutral-700">Investment Thesis</h4>
              <p className="text-xs sm:text-sm text-neutral-600 mt-1 whitespace-pre-line">{memo.thesis}</p>
            </div>
            {memo.risksAndMitigations && (
              <div>
                <h4 className="text-xs sm:text-sm font-medium text-neutral-700">Risks & Mitigations</h4>
                <p className="text-xs sm:text-sm text-neutral-600 mt-1 whitespace-pre-line">{memo.risksAndMitigations}</p>
              </div>
            )}
            {memo.pricingConsideration && (
              <div>
                <h4 className="text-xs sm:text-sm font-medium text-neutral-700">Pricing Considerations</h4>
                <p className="text-xs sm:text-sm text-neutral-600 mt-1 whitespace-pre-line">{memo.pricingConsideration}</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="assessment" className="space-y-3 mt-3" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-3">
              {memo.marketRiskScore && (
                <div className="p-2 border rounded-md bg-gray-50">
                  <p className="text-xs font-medium">Market Risk</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">High</span>
                    <span className="text-sm font-bold">{memo.marketRiskScore}</span>
                    <span className="text-xs text-gray-500">Low</span>
                  </div>
                  <Progress value={memo.marketRiskScore * 10} className="h-1 mt-1" />
                </div>
              )}
              
              {memo.executionRiskScore && (
                <div className="p-2 border rounded-md bg-gray-50">
                  <p className="text-xs font-medium">Execution Risk</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">High</span>
                    <span className="text-sm font-bold">{memo.executionRiskScore}</span>
                    <span className="text-xs text-gray-500">Low</span>
                  </div>
                  <Progress value={memo.executionRiskScore * 10} className="h-1 mt-1" />
                </div>
              )}
              
              {memo.teamStrengthScore && (
                <div className="p-2 border rounded-md bg-gray-50">
                  <p className="text-xs font-medium">Team Strength</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Weak</span>
                    <span className="text-sm font-bold">{memo.teamStrengthScore}</span>
                    <span className="text-xs text-gray-500">Strong</span>
                  </div>
                  <Progress value={memo.teamStrengthScore * 10} className="h-1 mt-1" />
                </div>
              )}
              
              {memo.productFitScore && (
                <div className="p-2 border rounded-md bg-gray-50">
                  <p className="text-xs font-medium">Product Market Fit</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Poor</span>
                    <span className="text-sm font-bold">{memo.productFitScore}</span>
                    <span className="text-xs text-gray-500">Excellent</span>
                  </div>
                  <Progress value={memo.productFitScore * 10} className="h-1 mt-1" />
                </div>
              )}
              
              {memo.valuationScore && (
                <div className="p-2 border rounded-md bg-gray-50">
                  <p className="text-xs font-medium">Valuation</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Expensive</span>
                    <span className="text-sm font-bold">{memo.valuationScore}</span>
                    <span className="text-xs text-gray-500">Attractive</span>
                  </div>
                  <Progress value={memo.valuationScore * 10} className="h-1 mt-1" />
                </div>
              )}
              
              {memo.competitiveAdvantageScore && (
                <div className="p-2 border rounded-md bg-gray-50">
                  <p className="text-xs font-medium">Competitive Advantage</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Weak</span>
                    <span className="text-sm font-bold">{memo.competitiveAdvantageScore}</span>
                    <span className="text-xs text-gray-500">Strong</span>
                  </div>
                  <Progress value={memo.competitiveAdvantageScore * 10} className="h-1 mt-1" />
                </div>
              )}
            </div>
            
            <Separator className="my-2" />
            
            <div className="p-2 border rounded-md bg-blue-50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Overall Assessment</p>
                <span className="text-sm font-bold">{memo.score}/10</span>
              </div>
              <Progress value={memo.score * 10} className="h-2 mt-1" />
            </div>
          </TabsContent>
          
          <TabsContent value="diligence" className="space-y-3 mt-3" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border rounded-md bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs sm:text-sm font-medium">Due Diligence Progress</h4>
                <Badge variant="secondary" className={`text-xs ${dueDiligenceStats.percent >= 70 ? "bg-green-100 text-green-800" : ""}`}>
                  {dueDiligenceStats.completed}/{dueDiligenceStats.total} ({dueDiligenceStats.percent}%)
                </Badge>
              </div>
              <Progress value={dueDiligenceStats.percent} className="h-2 mb-3" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {memo.dueDiligenceChecklist && Object.entries(DUE_DILIGENCE_CHECKLIST).map(([key, label]) => {
                  const isChecked = memo.dueDiligenceChecklist?.[key] || false;
                  return (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox id={`readonly-${key}`} checked={isChecked} disabled />
                      <Label 
                        htmlFor={`readonly-${key}`} 
                        className={`text-xs ${isChecked ? 'font-medium' : 'text-gray-500'}`}
                      >
                        {label as string}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
          
          {hasAlignment && (
            <TabsContent value="alignment" className="space-y-3 mt-3" onClick={(e) => e.stopPropagation()}>
              <div className="p-3 border rounded-md bg-blue-50">
                <h4 className="text-xs sm:text-sm font-medium text-blue-900 mb-3">GP-LP Alignment Tracking</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {memo.raiseAmount && (
                    <div>
                      <Label className="text-xs font-medium text-blue-800">Total Raise Amount</Label>
                      <p className="text-sm text-blue-900">${memo.raiseAmount.toLocaleString()}</p>
                    </div>
                  )}
                  {memo.gpCommitment && (
                    <div>
                      <Label className="text-xs font-medium text-blue-800">GP Commitment</Label>
                      <p className="text-sm text-blue-900">${memo.gpCommitment.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {memo.gpAlignmentPercentage && (
                    <div>
                      <Label className="text-xs font-medium text-blue-800">Alignment Percentage</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={memo.gpAlignmentPercentage} className="flex-1 h-2" />
                        <span className="text-sm font-medium text-blue-900">{memo.gpAlignmentPercentage.toFixed(2)}%</span>
                      </div>
                    </div>
                  )}
                  
                  {memo.alignmentScore && (
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-blue-800">Alignment Score</Label>
                      <Badge variant="outline" className={`
                        ${memo.alignmentScore >= 8 ? 'bg-green-100 text-green-800' : 
                          memo.alignmentScore >= 6 ? 'bg-blue-100 text-blue-800' :
                          memo.alignmentScore >= 4 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}
                      `}>
                        {memo.alignmentScore}/10
                        {memo.alignmentScore >= 8 ? ' (Excellent)' : 
                         memo.alignmentScore >= 6 ? ' (Good)' :
                         memo.alignmentScore >= 4 ? ' (Moderate)' : ' (Low)'}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <div className="space-y-3">
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-neutral-700">Investment Thesis</h4>
            <p className="text-xs sm:text-sm text-neutral-600 mt-1 whitespace-pre-line">{memo.thesis}</p>
          </div>
          {memo.risksAndMitigations && (
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-neutral-700">Risks & Mitigations</h4>
              <p className="text-xs sm:text-sm text-neutral-600 mt-1 whitespace-pre-line">{memo.risksAndMitigations}</p>
            </div>
          )}
          {memo.pricingConsideration && (
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-neutral-700">Pricing Considerations</h4>
              <p className="text-xs sm:text-sm text-neutral-600 mt-1 whitespace-pre-line">{memo.pricingConsideration}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
