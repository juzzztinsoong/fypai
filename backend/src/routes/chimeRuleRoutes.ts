/**
 * Chime Rule Routes
 * 
 * API endpoints for managing chime rules
 */

import { Router } from 'express';
import { ChimeRuleController } from '../controllers/chimeRuleController.js';
import { NextFunction, Request, Response } from 'express';

const router = Router();
const chimeRuleMutationsEnabled = process.env.ENABLE_CHIME_RULE_MUTATIONS === 'true';

function requireChimeRuleMutationsEnabled(req: Request, res: Response, next: NextFunction): void {
	if (chimeRuleMutationsEnabled) {
		next();
		return;
	}

	res.status(403).json({
		error: 'Chime rule mutations are disabled by server policy.',
		code: 'CHIME_RULE_MUTATIONS_DISABLED',
	});
}

// Phase 4: Rule presets
router.get('/presets', ChimeRuleController.getRulePresets);
router.post('/teams/:teamId/presets/preview', requireChimeRuleMutationsEnabled, ChimeRuleController.previewPreset);
router.post('/teams/:teamId/presets/apply', requireChimeRuleMutationsEnabled, ChimeRuleController.applyPreset);
router.post('/teams/:teamId/presets/reset', requireChimeRuleMutationsEnabled, ChimeRuleController.resetPreset);

// Get all rules for a team
router.get('/teams/:teamId/rules', ChimeRuleController.getRules);

// Get a specific rule by ID
router.get('/rules/:ruleId', ChimeRuleController.getRuleById);

// Create a new rule
router.post('/rules', requireChimeRuleMutationsEnabled, ChimeRuleController.createRule);

// Update a rule
router.patch('/rules/:ruleId', requireChimeRuleMutationsEnabled, ChimeRuleController.updateRule);

// Delete a rule
router.delete('/rules/:ruleId', requireChimeRuleMutationsEnabled, ChimeRuleController.deleteRule);

// Toggle a rule on/off
router.patch('/rules/:ruleId/toggle', requireChimeRuleMutationsEnabled, ChimeRuleController.toggleRule);

// Seed default rules for a team
router.post('/rules/seed', requireChimeRuleMutationsEnabled, ChimeRuleController.seedDefaultRules);

// Migrate async rules to use execution: 'async' (Phase 6.2)
router.post('/rules/migrate-async', requireChimeRuleMutationsEnabled, ChimeRuleController.migrateAsyncRules);

// Get chime execution logs for a team
router.get('/teams/:teamId/chime-logs', ChimeRuleController.getChimeLogs);

export default router;
