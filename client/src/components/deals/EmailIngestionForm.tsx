import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mail, Upload, FileDown } from "lucide-react";

// Form schema for email ingestion
const emailFormSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  sender: z.string().email("Valid email is required"),
  body: z.string().optional(),
  date: z.string().optional()
});

type EmailFormValues = z.infer<typeof emailFormSchema>;

interface EmailIngestionFormProps {
  onClose: () => void;
}

export default function EmailIngestionForm({ onClose }: EmailIngestionFormProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'manual' | 'forward'>('manual');

  // Initialize form with default values
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      subject: "",
      sender: "",
      body: "",
      date: new Date().toISOString()
    }
  });

  const ingestEmailMutation = useMutation({
    mutationFn: async (values: EmailFormValues) => {
      return apiRequest("POST", "/api/email/ingest", values);
    },
    onSuccess: () => {
      toast({
        title: "Email processed",
        description: "Deal has been created from email successfully.",
        variant: "success"
      });
      form.reset(); // Reset form
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] }); // Refresh deals data
      onClose(); // Close modal
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process email. Please try again.",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (values: EmailFormValues) => {
    ingestEmailMutation.mutate(values);
  };

  return (
    <div className="space-y-6">
      <div className="flex mb-4">
        <button
          className={`w-1/2 py-2 border-b-2 ${activeTab === 'manual' ? 'border-primary text-primary font-semibold' : 'border-neutral-300 text-neutral-600'}`}
          onClick={() => setActiveTab('manual')}
        >
          Manual Email Entry
        </button>
        <button
          className={`w-1/2 py-2 border-b-2 ${activeTab === 'forward' ? 'border-primary text-primary font-semibold' : 'border-neutral-300 text-neutral-600'}`}
          onClick={() => setActiveTab('forward')}
        >
          Forward Instructions
        </button>
      </div>

      {activeTab === 'manual' ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Subject (Deal Name) *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter the email subject" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sender Email *</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="contact@company.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Body</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Email content" 
                      rows={5} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-center space-x-2 py-4">
              <div className="h-px flex-1 bg-neutral-200"></div>
              <span className="text-xs text-neutral-500">OR</span>
              <div className="h-px flex-1 bg-neutral-200"></div>
            </div>

            <div className="border-2 border-dashed border-neutral-300 rounded-md p-6 text-center">
              <div className="flex flex-col items-center justify-center">
                <Upload className="h-10 w-10 text-neutral-400 mb-2" />
                <p className="text-sm text-neutral-600 mb-1">Drag and drop email (.eml) file here, or click to select</p>
                <p className="text-xs text-neutral-500 mb-2">(Will be parsed into the form above)</p>
                <Button variant="outline" size="sm">
                  <FileDown className="h-4 w-4 mr-2" />
                  Select Email File
                </Button>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={ingestEmailMutation.isPending}
              >
                {ingestEmailMutation.isPending ? "Processing..." : "Create Deal from Email"}
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        <div className="p-4 border border-neutral-200 rounded-lg">
          <div className="flex items-center mb-4">
            <Mail className="h-6 w-6 text-primary mr-2" />
            <h3 className="text-lg font-medium">Forward Emails to Create Deals</h3>
          </div>
          
          <p className="mb-4 text-neutral-700">
            Forward investment opportunity emails directly to our system to automatically create new deals.
          </p>
          
          <div className="bg-neutral-50 p-3 rounded-md mb-4">
            <p className="font-medium mb-1">Forward emails to:</p>
            <p className="text-primary font-mono text-sm">deals@doliver.com</p>
          </div>
          
          <div className="space-y-3 text-sm text-neutral-600">
            <p><span className="font-semibold">Subject:</span> The email subject will become the deal name</p>
            <p><span className="font-semibold">Sender:</span> The original sender email will be captured as the contact</p>
            <p><span className="font-semibold">Attachments:</span> All attachments will be saved with the deal</p>
            <p><span className="font-semibold">Body:</span> Email content will be saved as the initial description</p>
          </div>
          
          <Button className="mt-6">
            <Mail className="h-4 w-4 mr-2" />
            Open Email Client
          </Button>
        </div>
      )}
    </div>
  );
}
