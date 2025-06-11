import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
// Tabs no longer needed
// No arrows needed anymore
import DealStar from "@/components/deals/DealStar";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { LeaderboardItem } from "@/lib/types";
import { getDealStageBadgeClass, formatPercentage } from "@/lib/utils/format";
import { FINANCIAL_CALCULATION } from "@/lib/constants/calculation-constants";

export default function Leaderboard() {
  const [, navigate] = useLocation();
  
  const { data: leaderboardData = [], isLoading } = useQuery<LeaderboardItem[]>({
    queryKey: ['/api/leaderboard'],
  });

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20">
        <h1 className="text-xl sm:text-2xl font-semibold text-neutral-800 mb-4 sm:mb-6">Deal Leaderboard</h1>
        
        <Card>
          <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
            <CardTitle className="text-base sm:text-lg">Deal Rankings</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 py-3 sm:py-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] sm:w-[60px] text-xs sm:text-sm">Rank</TableHead>
                    <TableHead className="text-xs sm:text-sm">Deal</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm">Score</TableHead>
                    <TableHead className="text-center text-xs sm:text-sm">Stars</TableHead>
                    <TableHead className="text-xs sm:text-sm">Stage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 sm:py-10 text-neutral-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm">Loading leaderboard data...</p>
                      </TableCell>
                    </TableRow>
                  ) : leaderboardData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 sm:py-10 text-neutral-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-neutral-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        <p className="text-sm">No deals found for the leaderboard.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaderboardData.map((deal: LeaderboardItem, index: number) => (
                      <TableRow 
                        key={deal.id} 
                        className="cursor-pointer hover:bg-neutral-50"
                        onClick={() => navigate(`/deals/${deal.id}`)}
                      >
                        <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-3">{index + 1}</TableCell>
                        <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-3 max-w-[120px] sm:max-w-none">
                          <div className="truncate">{deal.name}</div>
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm py-2 sm:py-3">
                          <div className="flex items-center justify-end">
                            <span className="text-base sm:text-lg font-semibold">{typeof deal.score === 'number' ? formatPercentage(deal.score, FINANCIAL_CALCULATION.PRECISION.PERCENTAGE) : deal.score}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs sm:text-sm py-2 sm:py-3">
                          <div className="flex justify-center">
                            <DealStar count={deal.starCount} size="sm" className="justify-center" />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm py-2 sm:py-3">
                          <span className={`deal-stage-badge text-[10px] sm:text-xs py-1 px-1.5 sm:px-2 ${getDealStageBadgeClass(deal.stage)}`}>
                            {deal.stageLabel}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
