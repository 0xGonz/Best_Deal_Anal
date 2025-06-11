import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Star } from "lucide-react";
import { LeaderboardItem } from "@/lib/types";
import { getDealStageBadgeClass, formatPercentage } from "@/lib/utils/format";
import { FINANCIAL_CALCULATION } from "@/lib/constants/calculation-constants";

export default function LeaderboardWidget() {
  const [, navigate] = useLocation();
  
  const { data: leaderboardData = [], isLoading } = useQuery<LeaderboardItem[]>({
    queryKey: ['/api/leaderboard'],
  });

  // Only show the top 5 deals
  const topDeals = leaderboardData.slice(0, 5);

  return (
    <Card className="bg-white rounded-lg shadow h-full w-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle>Deal Leaderboard</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Deal</TableHead>
                <TableHead className="w-[20%]">Score</TableHead>
                <TableHead className="w-[20%]">Stars</TableHead>
                <TableHead className="w-[20%]">Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-neutral-500">
                    Loading leaderboard...
                  </TableCell>
                </TableRow>
              ) : topDeals?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-neutral-500">
                    No deals to display.
                  </TableCell>
                </TableRow>
              ) : (
                topDeals.map((deal: LeaderboardItem) => (
                  <TableRow 
                    key={deal.id} 
                    className="hover:bg-neutral-50 cursor-pointer"
                    onClick={() => navigate(`/deals/${deal.id}`)}
                  >
                    <TableCell className="py-3 text-sm text-neutral-800 font-medium">
                      {deal.name}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center">
                        <span className="text-lg font-semibold text-neutral-800">{typeof deal.score === 'number' ? formatPercentage(deal.score, FINANCIAL_CALCULATION.PRECISION.PERCENTAGE) : deal.score}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center text-accent">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="ml-1 text-sm">{deal.starCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className={`deal-stage-badge ${getDealStageBadgeClass(deal.stage)}`}>
                        {deal.stageLabel}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-4 text-center">
          <button 
            className="text-sm text-primary hover:text-primary-dark"
            onClick={() => navigate("/leaderboard")}
          >
            View Full Leaderboard
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
