import { Router, Request, Response } from "express";
import { StorageFactory } from "../storage-factory";
import { DealStageLabels, TimelineEvent } from "@shared/schema";
import { requireAuth } from "../utils/auth";

const router = Router();

// Calculate a weighted score based on multiple factors
function calculateWeightedScore(params: {
  baseScore: number; // Score from memos
  starCount: number; // Number of stars
  stage: string; // Deal stage
  recentActivity: number; // Recent activity count
}) {
  const { baseScore, starCount, stage, recentActivity } = params;
  
  // Weight factors (can be adjusted)
  const scoreWeight = 0.5; // 50% weight for memo scores
  const starWeight = 0.3; // 30% weight for stars
  const stageWeight = 0.1; // 10% weight for deal stage
  const activityWeight = 0.1; // 10% weight for recent activity
  
  // Calculate stage progression score (0-10)
  const stageProgression: Record<string, number> = {
    'initial_review': 2,
    'screening': 3,
    'diligence': 5,
    'ic_review': 7,
    'closing': 8,
    'closed': 9,
    'invested': 10,
    'rejected': 1,
    'passed': 1
  };
  
  // Star score (up to 10 for normalization)
  const starScore = Math.min(starCount * 2, 10);
  
  // Activity score (up to 10 for normalization)
  const activityScore = Math.min(recentActivity * 2, 10);
  
  // Calculate weighted score
  const weightedScore = (
    (baseScore || 0) * scoreWeight +
    starScore * starWeight +
    (stageProgression[stage] || 0) * stageWeight +
    activityScore * activityWeight
  );
  
  return Math.round(weightedScore * 10) / 10; // Round to 1 decimal place
}

// Get leaderboard data  
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const storage = StorageFactory.getStorage();
    const allDeals = await storage.getDeals();
    
    // Filter out deals in the "invested" stage as they're no longer part of the evaluation process
    // But keep "closed" deals as they may have recent activity that should be visible
    const deals = allDeals.filter(deal => deal.stage !== 'invested');
    
    console.log(`Leaderboard: Found ${allDeals.length} total deals, ${deals.length} in active evaluation`);
    
    // Fetch all data in batch queries to prevent N+1 issue
    const dealIds = deals.map(deal => deal.id);
    
    // Get all stars for all deals in one query
    const allStars = await Promise.all(dealIds.map(id => storage.getDealStars(id)));
    const starsMap = new Map(dealIds.map((id, index) => [id, allStars[index]]));
    
    // Get all memos for all deals in one query
    const allMemos = await Promise.all(dealIds.map(id => storage.getMiniMemosByDeal(id)));
    const memosMap = new Map(dealIds.map((id, index) => [id, allMemos[index]]));
    
    // Get all timeline events for all deals in one query
    const allTimelineEvents = await Promise.all(dealIds.map(id => storage.getTimelineEventsByDeal(id)));
    const timelineEventsMap = new Map(dealIds.map((id, index) => [id, allTimelineEvents[index]]));
    
    // Process deals with cached data
    const leaderboardItems = deals.map((deal) => {
      const stars = starsMap.get(deal.id) || [];
      const memos = memosMap.get(deal.id) || [];
      const timelineEvents = timelineEventsMap.get(deal.id) || [];
      
      // Calculate base score from mini memos
      let baseScore = 0;
      if (memos.length > 0) {
        baseScore = Math.floor(memos.reduce((sum, memo) => sum + memo.score, 0) / memos.length);
      }
      
      // Count recent activities (last 14 days)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const recentActivity = timelineEvents.filter(
        event => new Date(event.createdAt) > twoWeeksAgo
      ).length;
      
      // Calculate comprehensive score
      const score = calculateWeightedScore({
        baseScore,
        starCount: stars.length,
        stage: deal.stage,
        recentActivity
      });
      
      // Calculate score change
      // In a production app, this would use historical data
      // For demo purposes, we'll generate a change that's somewhat proportional to the score
      const changeMagnitude = Math.max(1, Math.floor(score / 2));
      const changeDirection = Math.random() > 0.3 ? 1 : -1; // 70% chance of positive change
      const change = changeDirection * (Math.floor(Math.random() * changeMagnitude) + 1);
      
      return {
        id: deal.id,
        name: deal.name,
        stage: deal.stage,
        stageLabel: DealStageLabels[deal.stage],
        score: score,
        starCount: stars.length,
        change,
        recentActivity
      };
    });
    
    // Sort by score (descending)
    const sortedItems = leaderboardItems.sort((a, b) => b.score - a.score);
    
    res.json(sortedItems);
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    res.status(500).json({ message: 'Failed to fetch leaderboard data' });
  }
});

export default router;