import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { AlertCircle, Database, HardDrive, Clock, Server } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type HybridStatus = {
  pendingWrites: number;
  hybridInfo: {
    usingDatabase: boolean;
    pendingWriteTypes: string[];
    pendingWrites: number;
    recoveryInProgress: boolean;
  } | null;
};

type SystemHealthResponse = {
  status: string;
  timestamp: string;
  storage: 'database' | 'memory' | 'hybrid' | 'pg' | 'unknown';
  databaseConnected: boolean;
  environment: string;
  hybridStatus: HybridStatus | null;
};

export function DatabaseStatusAlert() {
  const { data: healthData } = useQuery<SystemHealthResponse>({
    queryKey: ['/api/system/health'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });

  // No alert if no data or if we're using database and it's connected
  if (!healthData) {
    return null;
  }
  
  // No alert in development environment when using memory storage intentionally
  if (healthData.environment === 'development' && 
      healthData.storage === 'memory' && 
      healthData.databaseConnected) {
    return null;
  }
  
  // Using hybrid storage with database mode - no alert needed
  if (healthData.storage === 'hybrid' && 
      healthData.hybridStatus?.hybridInfo?.usingDatabase && 
      healthData.databaseConnected) {
    return null;
  }
  
  // Using regular database mode or pg mode and it's connected - no alert needed
  if ((healthData.storage === 'database' || healthData.storage === 'pg') && 
       healthData.databaseConnected) {
    return null;
  }

  // Determine alert variant based on storage type
  const variant = 
    healthData.storage === 'memory' ? 'destructive' : 
    healthData.storage === 'hybrid' && !healthData.hybridStatus?.hybridInfo?.usingDatabase ? 'warning' : 
    !healthData.databaseConnected ? 'warning' : 
    'default';
  
  // Determine icon
  const Icon = 
    healthData.storage === 'memory' ? HardDrive : 
    healthData.storage === 'hybrid' ? Server :
    Database;

  return (
    <Alert variant={variant} className="mb-4 fixed bottom-4 right-4 z-50 max-w-md shadow-lg">
      <Icon className="h-4 w-4" />
      <AlertTitle>
        {healthData.storage === 'memory' ? "Database Disconnected" : 
         healthData.storage === 'hybrid' && !healthData.hybridStatus?.hybridInfo?.usingDatabase ? "Operating in Hybrid Fallback Mode" :
         (healthData.storage === 'database' || healthData.storage === 'pg') ? "Database Status Warning" :
         "Database Status Warning"}
      </AlertTitle>
      <AlertDescription>
        {healthData.storage === 'memory' ? (
          <>
            <p>
              The application is currently operating in memory-only mode. Your data is being stored temporarily 
              and may not persist if you close the application. We're attempting to reconnect to the database.
            </p>
          </>
        ) : healthData.storage === 'hybrid' ? (
          <>
            {!healthData.databaseConnected ? (
              <>
                <p>
                  Database connection issues detected. Don't worry - your data is being stored safely using our hybrid storage system.
                </p>
                {healthData.hybridStatus?.pendingWrites ? (
                  <div className="mt-1 text-sm flex items-center">
                    <Clock className="inline h-3 w-3 mr-1" />
                    <span>
                      {healthData.hybridStatus.pendingWrites} operations waiting to sync
                    </span>
                  </div>
                ) : null}
                {healthData.hybridStatus?.hybridInfo?.recoveryInProgress ? (
                  <div className="mt-1 text-sm flex items-center">
                    <Server className="inline h-3 w-3 mr-1" />
                    <span>
                      Database recovery in progress...
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p>
                  Your data is being stored using our hybrid storage system for improved reliability.
                </p>
                {healthData.hybridStatus?.pendingWrites ? (
                  <div className="mt-1 text-sm flex items-center">
                    <Clock className="inline h-3 w-3 mr-1" />
                    <span>
                      Syncing {healthData.hybridStatus.pendingWrites} operations to database
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : healthData.storage === 'database' || healthData.storage === 'pg' ? (
          <>
            <p>
              Database connection issues detected. Some features may be temporarily unavailable.
            </p>
          </>
        ) : (
          <>
            <p>
              Database connection issues detected. Some features may be temporarily unavailable.
            </p>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}