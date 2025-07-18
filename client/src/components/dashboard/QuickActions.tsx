import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Upload,
  FileText,
  PlusCircle,
  SendHorizontal,
  FileUp
} from "lucide-react";
import NewDealModal from "../../components/deals/NewDealModal";
import { MiniMemoForm } from "../../components/memos/MiniMemoForm";
import BulkImportModal from "../../components/deals/BulkImportModal";
import EmailForwardModal from "../../components/deals/EmailForwardModal";
import ReportModal from "../../components/reports/ReportModal";

export default function QuickActions() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Modal states
  const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);
  const [isMiniMemoFormOpen, setIsMiniMemoFormOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isEmailForwardOpen, setIsEmailForwardOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const handleAction = (action: string) => {
    switch (action) {
      case "forward-email":
        // For now, show a toast until we implement EmailForwardModal
        toast({
          title: "Email Forwarding",
          description: "Email forwarding is coming soon!"
        });
        setIsEmailForwardOpen(true);
        break;
      
      case "manual-entry":
        setIsNewDealModalOpen(true);
        break;
      
      case "bulk-import":
        // For now, show a toast until we implement BulkImportModal
        toast({
          title: "Bulk Import",
          description: "Bulk import functionality is coming soon!"
        });
        setIsBulkImportOpen(true);
        break;
      
      case "generate-report":
        // For now, show a toast until we implement ReportModal
        toast({
          title: "Reports",
          description: "Report generation is coming soon!"
        });
        setIsReportModalOpen(true);
        break;
      
      case "compose-memo":
        setIsMiniMemoFormOpen(true);
        break;

      case "upload-document":
        navigate("/pipeline"); // Navigate to pipeline for now
        toast({
          title: "Document Upload",
          description: "Please select a deal from the pipeline to upload documents."
        });
        break;
      
      default:
        toast({
          title: "Action triggered",
          description: `${action} action was clicked`
        });
    }
  };

  const actions = [
    {
      icon: <SendHorizontal className="h-5 w-5 mr-2 text-primary" />,
      label: "Forward Email to Deal Inbox",
      action: "forward-email"
    },
    {
      icon: <PlusCircle className="h-5 w-5 mr-2 text-primary" />,
      label: "Manual Deal Entry",
      action: "manual-entry"
    },
    {
      icon: <Upload className="h-5 w-5 mr-2 text-primary" />,
      label: "Bulk Import Deals",
      action: "bulk-import"
    },
    {
      icon: <FileText className="h-5 w-5 mr-2 text-primary" />,
      label: "Generate Portfolio Report",
      action: "generate-report"
    },
    {
      icon: <Copy className="h-5 w-5 mr-2 text-primary" />,
      label: "Compose Mini-Memo",
      action: "compose-memo"
    },
    {
      icon: <FileUp className="h-5 w-5 mr-2 text-primary" />,
      label: "Upload Document",
      action: "upload-document"
    }
  ];

  return (
    <>
      <Card className="bg-white p-4 rounded-lg shadow h-full">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-2">
            {actions.map((item) => (
              <button
                key={item.action}
                className="block w-full p-2 rounded hover:bg-neutral-100 text-sm flex items-center text-left"
                onClick={() => handleAction(item.action)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal components */}
      <NewDealModal
        isOpen={isNewDealModalOpen}
        onClose={() => setIsNewDealModalOpen(false)}
      />

      <MiniMemoForm
        isOpen={isMiniMemoFormOpen}
        onOpenChange={setIsMiniMemoFormOpen}
      />

      {/* Additional modals */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
      />
      <EmailForwardModal
        isOpen={isEmailForwardOpen}
        onClose={() => setIsEmailForwardOpen(false)}
      />
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </>
  );
}
