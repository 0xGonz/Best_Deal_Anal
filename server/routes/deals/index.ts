import { Router } from 'express';
import dealsCrudRoutes from './deals-crud';
import dealsAssignmentsRoutes from './deals-assignments';
import dealsTimelineRoutes from './deals-timeline';
import dealsStarsRoutes from './deals-stars';
import dealsMemosRoutes from './deals-memos';

const router = Router();

// Mount all deal-related route modules
router.use('/', dealsCrudRoutes);
router.use('/', dealsAssignmentsRoutes);
router.use('/', dealsTimelineRoutes);
router.use('/', dealsStarsRoutes);
router.use('/', dealsMemosRoutes);

export default router; 