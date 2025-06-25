/**
 * API Version 1 router configuration
 * This file organizes all v1 routes and exports them as a single router
 */

import { Router } from 'express';
import dealsRoutes from '../deals';
import fundsRoutes from '../funds';
import usersRoutes from '../users';
import authRoutes from '../auth';
import allocationsRoutes from '../allocations';
import activityRoutes from '../activity';
import dashboardRoutes from '../dashboard';
import leaderboardRoutes from '../leaderboard';
import notificationsRoutes from '../notifications';
import documentsRoutes from '../documents-database';
import aiAnalysisRoutes from './ai-analysis';
import documentAnalysisRoutes from './document-analysis';
import settingsRoutes from '../settings';
const v1Router = Router();

// Register all route modules under the v1 router
v1Router.use('/deals', dealsRoutes);
v1Router.use('/funds', fundsRoutes);
v1Router.use('/users', usersRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/allocations', allocationsRoutes);
v1Router.use('/activity', activityRoutes);
v1Router.use('/dashboard', dashboardRoutes);
v1Router.use('/leaderboard', leaderboardRoutes);
v1Router.use('/notifications', notificationsRoutes);
v1Router.use('/documents', documentsRoutes);
v1Router.use('/ai-analysis', aiAnalysisRoutes);
v1Router.use('/document-analysis', documentAnalysisRoutes);
v1Router.use('/settings', settingsRoutes);

export default v1Router;