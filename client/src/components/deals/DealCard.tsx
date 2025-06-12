import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDistanceToNow } from "date-fns";
import { 
  Edit, 
  Share2, 
  DollarSign,
  Tag
} from "lucide-react";
import { Deal, User, DealStar as DealStarType } from "@/lib/types";
import { getDealStageBadgeClass } from "@/lib/utils/format";
import { enrichDealWithComputedProps } from "@/lib/utils";
import DealStar from "./DealStar";
import { UserAvatar } from "@/components/common/UserAvatar";

interface DealCardProps {
  deal: Deal;
  compact?: boolean;
  onEdit?: () => void;
  onAllocate?: () => void;
}

export default function DealCard({ deal: rawDeal, compact = false, onEdit, onAllocate }: DealCardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { canEdit, canCreate } = usePermissions();

  // Enrich deal with computed properties
  const deal = rawDeal;

  // Get users to show avatars
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Get assigned user details for display
  const assignedUsers = deal.assignedUsers || [];

  // Get current user to check if the user has already starred this deal
  const { data: currentUser } = useAuth();
  
  // Check if the current user has already starred this deal
  const { data: stars = [] } = useQuery<DealStarType[]>({
    queryKey: [`/api/deals/${deal.id}/stars`],
    enabled: !!deal.id
  });
  
  // Determine if the current user has starred this deal
  const hasUserStarred = !!currentUser && stars.some(star => star.userId === currentUser.id);
  
  // Function to handle toggling star on a deal
  const handleStarDeal = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click navigation
    
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to star deals.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await apiRequest("POST", `/api/deals/${deal.id}/star`, {});
      const result = await response.json();
      
      toast({
        title: result.action === 'starred' ? "Deal starred" : "Star removed",
        description: result.action === 'starred' 
          ? "This deal has been added to your starred deals."
          : "This deal has been removed from your starred deals."
      });
      
      // Refresh deals data and leaderboard
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}/stars`] });
      queryClient.invalidateQueries({ queryKey: ['/api/leaderboard'] });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update deal star. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card 
      className="bg-white rounded-lg shadow pipeline-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-200 h-full flex flex-col"
      onClick={() => navigate(`/deals/${deal.id}`)}
    >
      <CardContent className="p-3 sm:p-4 flex-1">
        <div className="flex flex-col h-full">
          <div className="flex flex-wrap sm:flex-nowrap justify-between items-start mb-2 sm:mb-3 gap-1">
            <h3 className="font-semibold text-sm sm:text-base md:text-lg truncate mr-2 max-w-full sm:max-w-[70%]">{deal.name}</h3>
            <span className={`deal-stage-badge text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 leading-none whitespace-nowrap flex-shrink-0 ${getDealStageBadgeClass(deal.stage)}`}>
              {deal.stageLabel}
            </span>
          </div>
          
          <p className="text-xs sm:text-sm text-neutral-600 mb-3 line-clamp-2">
            {deal.description}
          </p>
          
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center text-xs sm:text-sm">
              <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 text-primary" />
              <span className="text-primary-dark font-medium truncate">
                {deal.sector}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-auto">
            <div className="flex -space-x-1.5 sm:-space-x-2">
              {Array.isArray(assignedUsers) && assignedUsers.slice(0, 3).map((user, index) => {
                // Ensure we're dealing with a proper user object
                if (!user || typeof user !== 'object') return null;
                
                return (
                  <div 
                    key={`user-${user.id || `unknown-${index}`}-${deal.id}`}
                    className="w-6 h-6 sm:w-7 sm:h-7 border-2 border-white rounded-full overflow-hidden"
                  >
                    <UserAvatar 
                      user={user} 
                      size="xs"
                    />
                  </div>
                );
              })}
              {Array.isArray(assignedUsers) && assignedUsers.length > 3 && (
                <div 
                  key={`more-users-${deal.id}`} 
                  className="w-6 h-6 sm:w-7 sm:h-7 border-2 border-white rounded-full overflow-hidden flex items-center justify-center bg-neutral-300 text-neutral-700 text-[10px] sm:text-xs"
                >
                  +{assignedUsers.length - 3}
                </div>
              )}
            </div>
            
            {!compact && (
              <div className="flex items-center">
                <span className="text-[10px] sm:text-xs text-neutral-500 max-w-[120px] sm:max-w-none truncate">
                  Updated {formatDistanceToNow(new Date(deal.updatedAt), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="border-t border-neutral-200 p-2 sm:p-3 flex flex-wrap gap-1 sm:gap-2 w-full">
        {canEdit('deal') && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-neutral-600 hover:text-primary text-xs sm:text-sm flex-1 min-w-0 px-1 sm:px-3 h-7 sm:h-8"
            onClick={(e) => {
              e.stopPropagation();
              if (onEdit) onEdit();
            }}
          >
            <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1 flex-shrink-0" />
            <span className="truncate">Edit</span>
          </Button>
        )}
        
        <Button 
          variant="ghost" 
          size="sm" 
          className={`text-xs sm:text-sm flex-1 min-w-0 px-1 sm:px-3 h-7 sm:h-8 ${hasUserStarred ? 'text-accent' : 'text-neutral-600 hover:text-primary'}`}
          onClick={handleStarDeal}
        >
          <DealStar 
            count={deal.starCount || 0} 
            filled={hasUserStarred}
            size="sm"
            showCount={false}
            className="mr-1.5"
          />
          <span className="truncate">{hasUserStarred ? 'Starred' : 'Star'} {deal.starCount ? `(${deal.starCount})` : ''}</span>
        </Button>
        
        {deal.stage === 'invested' && onAllocate && canEdit('fund') ? (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-neutral-600 hover:text-primary text-xs sm:text-sm flex-1 min-w-0 px-1 sm:px-3 h-7 sm:h-8"
            onClick={(e) => {
              e.stopPropagation();
              onAllocate();
            }}
          >
            <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1 flex-shrink-0" />
            <span className="truncate">Allocate</span>
          </Button>
        ) : (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-neutral-600 hover:text-primary text-xs sm:text-sm flex-1 min-w-0 px-1 sm:px-3 h-7 sm:h-8"
            onClick={(e) => e.stopPropagation()}
          >
            <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1 flex-shrink-0" />
            <span className="truncate">Share</span>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
