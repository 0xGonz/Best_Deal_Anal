import React from 'react';
import { Link } from 'wouter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, ChevronDown, User, FileText, Check, Edit, Trash2, FileSearch, DollarSign } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Deal } from "@/lib/types";
import { getDealStageBadgeClass, formatCurrency, formatDate, formatPercentage } from "@/lib/utils/format";
import { DealStageLabels } from "@shared/schema";
import { DEFAULT_DEAL_SECTOR, DEAL_STAGES } from "@/lib/constants/deal-constants";

type DealsTableProps = {
  deals: Deal[] | undefined;
  onEdit: (dealId: number) => void;
  onAllocate: (dealId: number, dealName: string) => void;
  onUpdateStatus?: (dealId: number, newStatus: string) => void;
  onViewDocuments?: (dealId: number) => void;
  onDelete?: (dealId: number, dealName: string) => void;
  isLoading: boolean;
};

export default function DealsTable({ deals, onEdit, onAllocate, onUpdateStatus, onViewDocuments, onDelete, isLoading }: DealsTableProps) {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-neutral-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading deals...</p>
      </div>
    );
  }

  if (!deals || deals.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-500">
        No deals found matching the criteria.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white w-full overflow-hidden">
      <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        <Table>
          <TableHeader>
            <TableRow className="bg-white border-b">
              <TableHead className="w-[35%] xs:w-[25%] sm:w-[20%] md:w-[18%] font-semibold text-[10px] xs:text-xs sm:text-sm">Deal Name</TableHead>
              <TableHead className="w-[12%] sm:w-[10%] hidden xs:table-cell font-semibold text-[10px] xs:text-xs sm:text-sm">Type</TableHead>
              <TableHead className="w-auto hidden sm:table-cell font-semibold text-[10px] xs:text-xs sm:text-sm">Description</TableHead>
              <TableHead className="w-[10%] hidden md:table-cell font-semibold text-right text-[10px] xs:text-xs sm:text-sm">Return</TableHead>
              <TableHead className="w-[40%] xs:w-[35%] sm:w-[25%] md:w-[20%] lg:w-[15%] font-semibold text-[10px] xs:text-xs sm:text-sm">Status</TableHead>
              <TableHead className="w-[25%] xs:w-[15%] md:w-[12%] lg:w-[10%] text-center font-semibold text-[10px] xs:text-xs sm:text-sm">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((deal) => {
              const stageBadgeClass = getDealStageBadgeClass(deal.stage);
              const dealStageLabel = DealStageLabels[deal.stage as keyof typeof DealStageLabels] || deal.stage;
              
              // Get initials for the deal name
              const initials = deal.name
                .split(' ')
                .map(word => word[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
                
              return (
                <TableRow key={deal.id} className="group hover:bg-blue-50 hover:shadow-sm transition-all cursor-pointer" onClick={() => { window.location.href = `/deals/${deal.id}`; }}>
                  <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4">
                    <div className="flex flex-col">
                      <div className="font-medium text-xs sm:text-sm md:text-base text-neutral-900 truncate group-hover:text-blue-700 transition-colors">{deal.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 sm:py-3 px-2 sm:px-4 hidden xs:table-cell">
                    <span className="text-2xs xs:text-xs sm:text-sm">{deal.sector || DEFAULT_DEAL_SECTOR}</span>
                  </TableCell>
                  <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-4 hidden sm:table-cell">
                    <p className="text-2xs xs:text-xs sm:text-sm line-clamp-1 sm:line-clamp-2">{deal.description}</p>
                  </TableCell>
                  <TableCell className="text-right py-2 sm:py-3 px-2 sm:px-4 hidden md:table-cell">
                    <span className="text-2xs xs:text-xs sm:text-sm font-medium text-emerald-700">
                      {deal.targetReturn 
                        ? `${deal.targetReturn}${!deal.targetReturn.includes('%') ? '%' : ''}` 
                        : 'N/A'}
                      {deal.projectedMultiple && 
                        <span className="ml-1 text-2xs xs:text-xs text-emerald-600">({deal.projectedMultiple}x)</span>}
                    </span>
                  </TableCell>
                  <TableCell className="py-1 sm:py-2 px-2 sm:px-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="focus:outline-none" asChild>
                        <div className="flex items-center gap-1 sm:gap-2 cursor-pointer max-w-full" onClick={(e) => e.stopPropagation()}>
                          <Badge variant="outline" className={`${stageBadgeClass} text-[9px] xs:text-xs sm:text-sm px-1.5 py-0.5 truncate max-w-[85%] sm:max-w-none`}>
                            {dealStageLabel}
                          </Badge>
                          <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 flex-shrink-0 text-neutral-400" />
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[220px]">
                        {Object.entries(DealStageLabels).map(([stage, label]) => (
                          <DropdownMenuItem 
                            key={stage} 
                            className="flex items-center justify-between text-xs sm:text-sm px-3 py-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateStatus ? onUpdateStatus(deal.id, stage) : console.log(`Changed status to ${stage}`);
                            }}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge className={`${getDealStageBadgeClass(stage)} text-xs px-1.5 py-0 whitespace-nowrap`}>
                                {label}
                              </Badge>
                              <span className="truncate">{label}</span>
                            </div>
                            {stage === deal.stage && <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary ml-2 flex-shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className="py-1 sm:py-2 px-2 sm:px-4">
                    <div className="flex justify-center gap-1 md:gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onEdit(deal.id); }}
                        className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0"
                        title="Edit deal"
                      >
                        <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-neutral-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onViewDocuments && onViewDocuments(deal.id); }}
                        className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0"
                        title="View documents"
                      >
                        <FileSearch className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-neutral-600" />
                      </Button>
                      {deal.stage === DEAL_STAGES.INVESTED && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); onAllocate(deal.id, deal.name); }}
                          className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0"
                          title="Allocate to fund"
                        >
                          <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-green-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onDelete && onDelete(deal.id, deal.name); }}
                        className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0"
                        title="Delete deal"
                      >
                        <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-red-600" />
                      </Button>

                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}