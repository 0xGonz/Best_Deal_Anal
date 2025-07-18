import { apiRequest } from '@/lib/queryClient';
import { DealStageLabels } from '@shared/schema';

interface CreateNotificationParams {
  userId: number;
  title: string;
  message: string;
  type: 'deal' | 'memo' | 'assignment' | 'system';
  relatedId?: number;
}

/**
 * Helper function to create a notification
 * This can be called from anywhere in the application to create a notification
 */
export async function createNotification({
  userId,
  title,
  message,
  type,
  relatedId
}: CreateNotificationParams): Promise<void> {
  try {
    await apiRequest('POST', '/api/notifications', {
      userId,
      title,
      message,
      type,
      relatedId,
      isRead: false
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

/**
 * Generate notifications for common actions
 */
export const generateDealNotification = async (
  userId: number,
  dealName: string,
  action: 'created' | 'updated' | 'moved' | 'commented' | 'assigned',
  dealId: number,
  newStage?: string
): Promise<void> => {
  let title = '';
  let message = '';
  
  switch (action) {
    case 'created':
      title = 'New deal added';
      message = `${dealName} was added to the pipeline`;
      break;
    case 'updated':
      title = 'Deal updated';
      message = `${dealName} deal was updated`;
      break;
    case 'moved':
      title = 'Deal stage changed';
      // If new stage is provided, include it in the message
      if (newStage) {
        // Import the DealStageLabels to use the predefined labels
        const stageLabel = DealStageLabels[newStage as keyof typeof DealStageLabels] || newStage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        message = `${dealName} deal moved to ${stageLabel} stage`;
      } else {
        message = `${dealName} deal moved to a new stage`;
      }
      break;
    case 'commented':
      title = 'New comment added';
      message = `A new comment was added to ${dealName} deal`;
      break;
    case 'assigned':
      title = 'You were assigned to a deal';
      message = `You were assigned to the ${dealName} deal`;
      break;
  }
  
  await createNotification({
    userId,
    title,
    message,
    type: action === 'assigned' ? 'assignment' : 'deal',
    relatedId: dealId
  });
};

export const generateMemoNotification = async (
  userId: number,
  dealName: string,
  dealId: number
): Promise<void> => {
  await createNotification({
    userId,
    title: 'New memo added',
    message: `A new memo was added to ${dealName} deal`,
    type: 'memo',
    relatedId: dealId
  });
};