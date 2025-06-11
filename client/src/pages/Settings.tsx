import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Database, Bell, Building } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { PADDING, MARGIN, GAP } from "@/lib/constants/spacing-constants";

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");

  return (
    <AppLayout>
      <div className={`${PADDING.LAYOUT.PAGE} pb-20 w-full overflow-hidden`}>
        <div className={`${MARGIN.LAYOUT.SECTION}`}>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your application settings.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 max-w-md mb-2">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Database</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Company</span>
            </TabsTrigger>
          </TabsList>
        
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure general application settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Application Name</h3>
                  <div className="flex flex-col space-y-2 max-w-md">
                    <Input
                      placeholder="Investment Tracker"
                      defaultValue="Doliver Investment Tracker"
                    />
                    <p className="text-sm text-muted-foreground">
                      This name will appear in the browser tab and throughout the application.
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Theme Settings</h3>
                  <div className="flex items-center justify-between max-w-md">
                    <div>
                      <Label htmlFor="dark-mode" className="font-medium">
                        Dark Mode
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Enable dark mode for the application.
                      </p>
                    </div>
                    <Switch id="dark-mode" />
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">System Language</h3>
                  <div className="flex flex-col space-y-2 max-w-md">
                    <select className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </select>
                    <p className="text-sm text-muted-foreground">
                      This setting will change the language across the application.
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      toast({
                        title: "Settings updated",
                        description: "Your general settings have been updated.",
                      });
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="database">
            <Card>
              <CardHeader>
                <CardTitle>Database Settings</CardTitle>
                <CardDescription>
                  Configure database connection and maintenance settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Database Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="db-host" className="text-sm font-medium">
                        Host
                      </Label>
                      <Input
                        id="db-host"
                        placeholder="Database host"
                        disabled
                        value="PostgreSQL (Managed)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="db-name" className="text-sm font-medium">
                        Database Name
                      </Label>
                      <Input
                        id="db-name"
                        placeholder="Database name"
                        disabled
                        value="investment_tracker"
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Database Maintenance</h3>
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Auto Backup</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically backup the database daily.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Button variant="outline">
                        Backup Now
                      </Button>
                      <Button variant="outline">
                        View Backups
                      </Button>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Data Migration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline">
                      Export Data
                    </Button>
                    <Button variant="outline">
                      Import Data
                    </Button>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      toast({
                        title: "Database settings updated",
                        description: "Your database settings have been updated.",
                      });
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>
                  Configure how and when you receive notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Email Notifications</h3>
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="new-deal" className="font-medium">
                          New Deal Added
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Receive an email when a new deal is added.
                        </p>
                      </div>
                      <Switch id="new-deal" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="deal-update" className="font-medium">
                          Deal Updates
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Receive an email when a deal is updated.
                        </p>
                      </div>
                      <Switch id="deal-update" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="capital-call" className="font-medium">
                          Capital Calls
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Receive an email when a capital call is issued.
                        </p>
                      </div>
                      <Switch id="capital-call" defaultChecked />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">In-App Notifications</h3>
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="app-new-deal" className="font-medium">
                          New Deal Added
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Show a notification in the app when a new deal is added.
                        </p>
                      </div>
                      <Switch id="app-new-deal" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="app-deal-update" className="font-medium">
                          Deal Updates
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Show a notification in the app when a deal is updated.
                        </p>
                      </div>
                      <Switch id="app-deal-update" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="app-mentions" className="font-medium">
                          Mentions
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Show a notification in the app when you are mentioned in a comment.
                        </p>
                      </div>
                      <Switch id="app-mentions" defaultChecked />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      toast({
                        title: "Notification settings updated",
                        description: "Your notification preferences have been saved.",
                      });
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>
                  Manage company information and branding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Company Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                    <div>
                      <Label htmlFor="company-name" className="text-sm font-medium">
                        Company Name
                      </Label>
                      <Input
                        id="company-name"
                        placeholder="Company name"
                        defaultValue="Doliver Capital"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-website" className="text-sm font-medium">
                        Website
                      </Label>
                      <Input
                        id="company-website"
                        placeholder="https://example.com"
                        defaultValue="https://dolicap.com"
                        type="url"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="company-address" className="text-sm font-medium">
                        Address
                      </Label>
                      <Input
                        id="company-address"
                        placeholder="Company address"
                        defaultValue="123 Main Street, Suite 100, Houston, TX 77056"
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Branding</h3>
                  <div className="flex flex-col space-y-4 max-w-md">
                    <div>
                      <Label htmlFor="logo-upload" className="text-sm font-medium">
                        Company Logo
                      </Label>
                      <div className="mt-2 flex items-center gap-4">
                        <div className="h-16 w-16 rounded-md bg-neutral-100 flex items-center justify-center">
                          <Building className="h-8 w-8 text-neutral-400" />
                        </div>
                        <Button variant="outline" size="sm">
                          Upload New Logo
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Recommended size: 512x512px. Max file size: 2MB.
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="primary-color" className="text-sm font-medium">
                        Primary Color
                      </Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          id="primary-color"
                          type="color"
                          defaultValue="#0284c7"
                          className="w-12 h-8 p-1"
                        />
                        <Input 
                          value="#0284c7" 
                          className="w-28"
                          onChange={() => {}}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      toast({
                        title: "Company settings updated",
                        description: "Your company information and branding have been updated.",
                      });
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
