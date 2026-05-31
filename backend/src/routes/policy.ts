import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();

const POLICY_FILE = path.resolve(process.cwd(), 'policy-rules.json');

const PolicyRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  rule: z.string(),
});

const PolicyLimitsSchema = z.object({
  totalBudget: z.number().positive(),
  preauthThreshold: z.number().positive(),
  tipMaxServices: z.number().min(0).max(100),
  tipMaxMeals: z.number().min(0).max(100),
  splitChargeWindowHours: z.number().positive(),
});

const PolicyConfigSchema = z.object({
  rules: z.array(PolicyRuleSchema),
  limits: PolicyLimitsSchema,
});

export type PolicyRule = z.infer<typeof PolicyRuleSchema>;
export type PolicyLimits = z.infer<typeof PolicyLimitsSchema>;

const DEFAULT_LIMITS: PolicyLimits = {
  totalBudget: 3_000_000,
  preauthThreshold: 50,
  tipMaxServices: 15,
  tipMaxMeals: 20,
  splitChargeWindowHours: 48,
};

let cache: { rules: PolicyRule[]; limits: PolicyLimits } | null = null;

function loadConfig(): { rules: PolicyRule[]; limits: PolicyLimits } {
  if (cache !== null) return cache;
  try {
    const raw = fs.readFileSync(POLICY_FILE, 'utf-8');
    cache = PolicyConfigSchema.parse(JSON.parse(raw));
    return cache;
  } catch {
    return { rules: [], limits: DEFAULT_LIMITS };
  }
}

export function loadPolicyRules(): PolicyRule[] {
  return loadConfig().rules;
}

export function loadPolicyLimits(): PolicyLimits {
  return loadConfig().limits;
}

router.get('/', (_req, res) => {
  res.json(loadConfig());
});

router.put('/', (req, res) => {
  const parsed = PolicyConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid policy format', details: parsed.error.flatten() });
    return;
  }
  fs.writeFileSync(POLICY_FILE, JSON.stringify(parsed.data, null, 2), 'utf-8');
  cache = parsed.data;
  res.json(parsed.data);
});

export default router;
