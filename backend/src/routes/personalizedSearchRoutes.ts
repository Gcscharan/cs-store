/**
 * Personalized Search Routes
 * 
 * Phase 5: Personalization Engine
 */

import { Router } from 'express';
import { personalizedSearch } from '../controllers/personalizedSearchController';

const router = Router();

/**
 * POST /api/search/personalized
 * 
 * Personalized search with user preferences
 */
router.post('/personalized', personalizedSearch);

export default router;
