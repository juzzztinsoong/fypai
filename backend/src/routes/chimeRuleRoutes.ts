/**
 * Chime Rule Routes
 * 
 * API endpoints for managing chime rules
 */

import { Router } from 'express';
import { ChimeRuleController } from '../controllers/chimeRuleController.js';

const router = Router();

// Get all rules for a team
router.get('/teams/:teamId/rules', ChimeRuleController.getRules);

// Get a specific rule by ID
router.get('/rules/:ruleId', ChimeRuleController.getRuleById);

// Create a new rule
router.post('/rules', ChimeRuleController.createRule);

// Update a rule
router.patch('/rules/:ruleId', ChimeRuleController.updateRule);

// Delete a rule
router.delete('/rules/:ruleId', ChimeRuleController.deleteRule);

// Toggle a rule on/off
router.patch('/rules/:ruleId/toggle', ChimeRuleController.toggleRule);

// Seed default rules for a team
router.post('/rules/seed', ChimeRuleController.seedDefaultRules);

// Get chime execution logs for a team
router.get('/teams/:teamId/chime-logs', ChimeRuleController.getChimeLogs);

export default router;
