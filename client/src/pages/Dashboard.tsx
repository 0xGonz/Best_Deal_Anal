import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import StatsCard from "@/components/dashboard/StatsCard";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentDeals from "@/components/dashboard/RecentDeals";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import LeaderboardWidget from "@/components/dashboard/LeaderboardWidget";
import SectorDistributionChart from "@/components/dashboard/SectorDistributionChart";
import { formatCurrency } from "@/lib/utils/format";
import { PADDING, MARGIN, GAP } from "@/lib/constants/spacing-constants";
import { 
  Activity, 
  TrendingUp, 
  Users, 
  DollarSign,
  LineChart,
  BarChart
} from "lucide-react";

interface DashboardStats {
  totalDeals: number;
  totalDealsTrend: number;
  activeDeals: number;
  activePipelinePercent: number;
  activePipelineTrend: number;
  newDeals: number;
  newDealsPercent: number;
  newDealsTrend: number;
  inIcReview: number;
  icReviewPercent: number;
  icReviewTrend: number;
  investedDeals: number;
  investmentRate: number;
  investmentRateTrend: number;
  totalAum: number;
  aumTrend?: number;
}

export default function Dashboard() {
  const { data: stats = {} as DashboardStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  return (
    <AppLayout>
      <div className={`${PADDING.LAYOUT.PAGE} pb-20 w-full overflow-hidden`}>
        {/* Dashboard Overview */}
        <div className={`grid grid-cols-1 md:grid-cols-12 ${GAP.LG} ${MARGIN.LAYOUT.SECTION}`}>
          {/* Quick Stats */}
          <div className={`md:col-span-12 lg:col-span-12 grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 ${GAP.MD}`}>
            {/* Define stats cards configuration - completely data-driven approach */}
            {[
              {
                title: "Total Deals",
                value: stats?.totalDeals !== undefined ? stats.totalDeals.toString() : "0",
                icon: <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />,
                trend: stats?.totalDealsTrend || 0,
                trendLabel: `${stats?.activeDeals || 0} active deals`,
                trendDirection: "auto" as const
              },
              {
                title: "Active Pipeline",
                value: stats?.activePipelinePercent !== undefined ? `${stats.activePipelinePercent}%` : "0%",
                icon: <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />,
                trend: stats?.activePipelineTrend || 0,
                trendLabel: `${stats?.activeDeals || 0} of ${stats?.totalDeals || 0} deals`,
                trendDirection: "auto" as const
              },
              {
                title: "New Deals",
                value: stats?.newDealsPercent !== undefined ? `${stats.newDealsPercent}%` : "0%",
                icon: <LineChart className="h-5 w-5 sm:h-6 sm:w-6 text-info" />,
                trend: stats?.newDealsTrend || 0,
                trendLabel: `${stats?.newDeals || 0} of ${stats?.totalDeals || 0} deals`,
                trendDirection: "auto" as const
              },
              {
                title: "In IC Review",
                value: stats?.icReviewPercent !== undefined ? `${stats.icReviewPercent}%` : "0%",
                icon: <Users className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />,
                trend: stats?.icReviewTrend || 0,
                trendLabel: `${stats?.inIcReview || 0} of ${stats?.totalDeals || 0} deals`,
                trendDirection: "auto" as const
              },
              {
                title: "Investment Rate",
                value: stats?.investmentRate !== undefined ? `${stats.investmentRate}%` : "0%",
                icon: <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-success" />,
                trend: stats?.investmentRateTrend || 0,
                trendLabel: `${stats?.investedDeals || 0} of ${stats?.totalDeals || 0} deals`,
                trendDirection: "auto" as const
              }
            ].map((card, index) => (
              <StatsCard
                key={index}
                title={card.title}
                value={statsLoading ? "Loading..." : card.value}
                icon={card.icon}
                trend={statsLoading ? 0 : card.trend}
                trendLabel={statsLoading ? "" : card.trendLabel}
                trendDirection={card.trendDirection}
                isLoading={statsLoading}
              />
            ))}
          </div>
          
          {/* Quick Actions removed as requested */}
        </div>
        
        {/* Sector Distribution and Recent Deals */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 ${GAP.LG} ${MARGIN.LAYOUT.COMPONENT}`}>
          <div className="lg:col-span-5 flex w-full">
            <SectorDistributionChart />
          </div>
          
          <div className="lg:col-span-7 flex w-full">
            <RecentDeals />
          </div>
        </div>
        
        {/* Activity Feed and Leaderboard */}
        <div className={`grid grid-cols-1 md:grid-cols-12 ${GAP.LG} ${MARGIN.LAYOUT.COMPONENT}`}>
          <div className="md:col-span-7 flex w-full">
            <ActivityFeed />
          </div>
          
          <div className="md:col-span-5 flex w-full">
            <LeaderboardWidget />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
