import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Edit, Tag } from "lucide-react";
import EditDealModal from "@/components/deals/EditDealModal";
import AllocateFundModal from "@/components/deals/AllocateFundModal";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Deal } from "@/lib/types";
import { getDealStageBadgeClass } from "@/lib/utils/format";
import { usePermissions } from "@/hooks/use-permissions";
import { enrichDealWithComputedProps } from "@/lib/utils";

export default function RecentDeals() {
  const [, navigate] = useLocation();
  const [stageFilter, setStageFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("7days");
  const [editDealId, setEditDealId] = useState<number | null>(null);
  const [allocateDealId, setAllocateDealId] = useState<number | null>(null);
  const { canEdit } = usePermissions();

  const { data: deals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  // Filter deals based on current filters and limit to most recent 5 - with null safety
  const filteredDeals = (deals || [])
    .filter((deal: Deal) => {
      // Stage filter
      if (stageFilter !== "all" && deal.stage !== stageFilter) {
        return false;
      }
      
      // Date filter by createdAt timestamp
      const dealDate = new Date(deal.createdAt).getTime();
      const currentDate = new Date().getTime();
      const dayInMs = 24 * 60 * 60 * 1000;
      
      if (dateFilter === "7days") {
        return currentDate - dealDate <= 7 * dayInMs;
      } else if (dateFilter === "30days") {
        return currentDate - dealDate <= 30 * dayInMs;
      }
      
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6); // Show the most recent 6 deals

  // Find selected deal name for allocate modal
  const selectedDealName = allocateDealId ? 
    (deals || []).find(d => d.id === allocateDealId)?.name || "Selected Deal" : "";

  return (
    <div className="w-full">
      <Card className="h-full flex flex-col w-full">
        <CardHeader className="pb-2 px-5 pt-5">
          <CardTitle>Recent Deals</CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 p-5 pt-2 w-full">
          <div className="flex flex-col justify-between items-stretch gap-3 mb-4">
            <div className="flex flex-wrap gap-2 w-full space-y-2 sm:space-y-0">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm w-full xs:w-[48%] sm:w-[120px] md:w-[150px]">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="initial_review">Initial Review</SelectItem>
                  <SelectItem value="screening">Screening</SelectItem>
                  <SelectItem value="diligence">Diligence</SelectItem>
                  <SelectItem value="ic_review">IC Review</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm w-full xs:w-[48%] sm:w-[120px] md:w-[150px]">
                  <SelectValue placeholder="Last Week" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last Week</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              
              <button 
                className="flex items-center justify-center h-8 sm:h-9 px-3 py-1 text-xs sm:text-sm text-primary hover:text-primary-dark ml-auto xs:ml-0 sm:ml-auto mt-2 xs:mt-0"
                onClick={() => navigate("/pipeline")}
              >
                View All
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Deals Grid */}
          {isLoading ? (
            <div className="flex flex-col justify-center items-center py-8 sm:py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
              <p className="text-sm sm:text-base text-neutral-500">Loading deals...</p>
            </div>
          ) : filteredDeals?.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-8 sm:py-12">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-neutral-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm sm:text-base text-neutral-500">No deals found matching your filters.</p>
            </div>
          ) : (
            <div className="rounded-md overflow-hidden border border-neutral-200 w-full mx-0">
              <ul className="divide-y divide-neutral-200 w-full border-t-0 border-r-0 border-l-0 p-0">
                {(filteredDeals || []).map(rawDeal => {
                  // Use only authentic database data
                  const deal = rawDeal;
                  const stageBadgeClass = getDealStageBadgeClass(deal.stage);
                  return (
                    <li 
                      key={deal.id} 
                      className="px-4 py-1.5 hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/deals/${deal.id}`)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <h3 className="font-medium text-neutral-800 truncate max-w-[60%] text-sm">{deal.name}</h3>
                          <span className={`deal-stage-badge text-xs px-1.5 py-0.5 leading-none whitespace-nowrap ${stageBadgeClass}`}>
                            {deal.stageLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {canEdit('deal') && (
                            <button 
                              className="text-neutral-500 hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditDealId(deal.id);
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1 w-full">
                        <div className="flex items-center gap-1 min-w-0 flex-shrink-0 w-24">
                          <Tag className="h-3 w-3 text-primary-600 flex-shrink-0" />
                          <span className="text-xs text-primary-700 truncate">{deal.sector}</span>
                        </div>
                        <span className="text-xs text-neutral-500 text-right flex-shrink-0">
                          {new Date(deal.updatedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
                            ? `Updated ${formatDistanceToNow(new Date(deal.updatedAt), { addSuffix: true })}` 
                            : `Last week`}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {editDealId !== null && (
        <EditDealModal 
          isOpen={true} 
          onClose={() => setEditDealId(null)} 
          dealId={editDealId} 
        />
      )}
      
      {allocateDealId !== null && (
        <AllocateFundModal 
          isOpen={true} 
          onClose={() => setAllocateDealId(null)} 
          dealId={allocateDealId} 
          dealName={selectedDealName} 
        />
      )}
    </div>
  );
}