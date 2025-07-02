import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  DollarSign,
  TrendingUp,
  AlertCircle,
  Target,
  Calendar,
  Users
} from 'lucide-react';

interface WorkflowNode {
  id: string;
  title: string;
  status: 'completed' | 'in_progress' | 'pending' | 'blocked';
  value?: number;
  description?: string;
  metadata?: Record<string, any>;
}

interface WorkflowConnection {
  from: string;
  to: string;
  label?: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

interface DistributionWorkflowData {
  fundId: number;
  fundName: string;
  totalCommitted: number;
  totalCalled: number;
  totalDistributed: number;
  distributionCount: number;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

interface DistributionWorkflowVisualizationProps {
  data: DistributionWorkflowData;
  className?: string;
}

const formatCurrency = (amount: number | null | undefined): string => {
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
};

const getStatusIcon = (status: WorkflowNode['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'in_progress':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'blocked':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Target className="h-4 w-4 text-gray-400" />;
  }
};

const getStatusColor = (status: WorkflowNode['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 border-green-300 text-green-800';
    case 'in_progress':
      return 'bg-blue-100 border-blue-300 text-blue-800';
    case 'blocked':
      return 'bg-red-100 border-red-300 text-red-800';
    default:
      return 'bg-gray-100 border-gray-300 text-gray-600';
  }
};

const getConnectionColor = (type: WorkflowConnection['type']) => {
  switch (type) {
    case 'success':
      return 'border-green-400';
    case 'warning':
      return 'border-yellow-400';
    case 'error':
      return 'border-red-400';
    default:
      return 'border-blue-400';
  }
};

export const DistributionWorkflowVisualization: React.FC<DistributionWorkflowVisualizationProps> = ({
  data,
  className = ''
}) => {
  const workflowMetrics = useMemo(() => {
    const distributionRate = data.totalCommitted > 0 ? (data.totalDistributed / data.totalCommitted) * 100 : 0;
    const callRate = data.totalCommitted > 0 ? (data.totalCalled / data.totalCommitted) * 100 : 0;
    
    const completedNodes = data.nodes.filter(node => node.status === 'completed').length;
    const totalNodes = data.nodes.length;
    const completionRate = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;

    return {
      distributionRate: Math.round(distributionRate),
      callRate: Math.round(callRate),
      completionRate: Math.round(completionRate),
      avgDistribution: data.distributionCount > 0 ? data.totalDistributed / data.distributionCount : 0
    };
  }, [data]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Distributed</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(data.totalDistributed)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Distribution Rate</p>
                <p className="text-lg font-bold text-blue-600">{workflowMetrics.distributionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Distributions</p>
                <p className="text-lg font-bold text-purple-600">{data.distributionCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Distribution</p>
                <p className="text-lg font-bold text-orange-600">{formatCurrency(workflowMetrics.avgDistribution)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Distribution Workflow Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Workflow Completion</span>
                <span>{workflowMetrics.completionRate}%</span>
              </div>
              <Progress value={workflowMetrics.completionRate} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Capital Called</span>
                <span>{workflowMetrics.callRate}%</span>
              </div>
              <Progress value={workflowMetrics.callRate} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Nodes Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution Process Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.nodes.map((node, index) => {
              const connection = data.connections.find(conn => conn.from === node.id);
              const isLast = index === data.nodes.length - 1;
              
              return (
                <div key={node.id} className="relative">
                  {/* Node */}
                  <div className={`p-4 rounded-lg border-2 ${getStatusColor(node.status)} flex items-center justify-between`}>
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(node.status)}
                      <div>
                        <h4 className="font-medium">{node.title}</h4>
                        {node.description && (
                          <p className="text-sm opacity-75">{node.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {node.value !== undefined && (
                        <Badge variant="secondary">
                          {formatCurrency(node.value)}
                        </Badge>
                      )}
                      <Badge variant={node.status === 'completed' ? 'default' : 'secondary'}>
                        {node.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Connection Arrow */}
                  {!isLast && connection && (
                    <div className="flex justify-center my-2">
                      <div className={`border-l-2 ${getConnectionColor(connection.type)} h-4`}></div>
                    </div>
                  )}
                  
                  {!isLast && connection && connection.label && (
                    <div className="flex justify-center">
                      <div className="flex items-center space-x-2 bg-white px-2 py-1 border rounded text-xs">
                        <ArrowRight className="h-3 w-3" />
                        <span>{connection.label}</span>
                      </div>
                    </div>
                  )}
                  
                  {!isLast && (
                    <div className="flex justify-center my-2">
                      <div className={`border-l-2 ${getConnectionColor(connection?.type || 'info')} h-4`}></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-green-600">Completed</h4>
              <div className="space-y-1">
                {data.nodes.filter(n => n.status === 'completed').map(node => (
                  <div key={node.id} className="flex items-center space-x-2 text-sm">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>{node.title}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-blue-600">In Progress</h4>
              <div className="space-y-1">
                {data.nodes.filter(n => n.status === 'in_progress').map(node => (
                  <div key={node.id} className="flex items-center space-x-2 text-sm">
                    <Clock className="h-3 w-3 text-blue-500" />
                    <span>{node.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistributionWorkflowVisualization;