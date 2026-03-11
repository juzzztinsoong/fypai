export type StudyCondition = 'AI_ON' | 'AI_LIGHT'
export type StudyRunOrder = 'AB' | 'BA'
export type RulePresetId = 'conservative' | 'balanced' | 'proactive'

export interface StudyTeamTemplate {
  id: string
  name: string
  participantCount: number
  scenarioVariant: 'A' | 'B'
  runOrder: StudyRunOrder
  taskContext: string
}

export interface ConditionProfile {
  label: string
  isChimeEnabled: boolean
  presetId: RulePresetId
  preferences: {
    personality: 'formal' | 'balanced' | 'casual'
    proactivity: 'silent' | 'helpful' | 'proactive'
    responseLength: 'concise' | 'balanced' | 'detailed'
    modelTierOverride: 'auto' | 'tier1' | 'tier2'
  }
  facilitatorNote: string
}

export interface StudySeedTemplate {
  id: string
  title: string
  description: string
  teams: StudyTeamTemplate[]
  profiles: Record<StudyCondition, ConditionProfile>
  instructions: string[]
}

interface ScenarioContextPair {
  A: string
  B: string
}

function buildTeams(
  config: Array<{ count: number; order: StudyRunOrder; variant: 'A' | 'B' }>,
  contextByVariant: ScenarioContextPair
): StudyTeamTemplate[] {
  return config.map((entry, index) => {
    const number = index + 1
    const id = `study-team-${String(number).padStart(2, '0')}`
    const name = `Study Team ${String(number).padStart(2, '0')}`

    const variantContext = entry.variant === 'A' ? contextByVariant.A : contextByVariant.B

    return {
      id,
      name,
      participantCount: entry.count,
      scenarioVariant: entry.variant,
      runOrder: entry.order,
      taskContext: `${variantContext} Include at least one source-verifiable decision and keep scope realistic for a student team.`,
    }
  })
}

const SOFTWARE_CONTEXTS: ScenarioContextPair = {
  A: 'Hackathon launch planning. Produce a clear plan, ownership map, and validation checklist for demo readiness.',
  B: 'Assignment workflow redesign. Produce prioritized workflow improvements, ownership map, and evaluation criteria.',
}

const CAMPUS_SERVICES_CONTEXTS: ScenarioContextPair = {
  A: 'Campus wellness fair operations planning. Produce an execution plan for booths, volunteers, and disruption handling.',
  B: 'Peer tutoring program coordination. Produce a scheduling and assignment workflow with clear handoffs and demand coverage.',
}

const COMMUNITY_IMPACT_CONTEXTS: ScenarioContextPair = {
  A: 'Student food pantry distribution planning. Produce a fair allocation workflow with volunteer handoffs and shortage contingencies.',
  B: 'Campus e-waste collection campaign. Produce outreach and collection logistics with clear routing and ownership decisions.',
}

const SHARED_PROFILES: Record<StudyCondition, ConditionProfile> = {
  AI_ON: {
    label: 'AI-on',
    isChimeEnabled: true,
    presetId: 'balanced',
    preferences: {
      personality: 'balanced',
      proactivity: 'helpful',
      responseLength: 'balanced',
      modelTierOverride: 'auto',
    },
    facilitatorNote: 'Autonomous support enabled; use as full-assist condition.',
  },
  AI_LIGHT: {
    label: 'AI-light',
    isChimeEnabled: false,
    presetId: 'conservative',
    preferences: {
      personality: 'balanced',
      proactivity: 'silent',
      responseLength: 'concise',
      modelTierOverride: 'tier1',
    },
    facilitatorNote: 'Reduced autonomy and concise responses; use as baseline condition.',
  },
}

export const STUDY_SEED_TEMPLATES: Record<string, StudySeedTemplate> = {
  'trio-abba-6': {
    id: 'trio-abba-6',
    title: '6 teams, 3 participants each, AB/BA counterbalance',
    description:
      'Primary recommendation for thesis runs. Balanced counter-order with equal scenario variant distribution.',
    teams: buildTeams([
      { count: 3, order: 'AB', variant: 'A' },
      { count: 3, order: 'BA', variant: 'B' },
      { count: 3, order: 'AB', variant: 'B' },
      { count: 3, order: 'BA', variant: 'A' },
      { count: 3, order: 'AB', variant: 'A' },
      { count: 3, order: 'BA', variant: 'B' },
    ], SOFTWARE_CONTEXTS),
    profiles: SHARED_PROFILES,
    instructions: [
      'Run 2 conditions per team using assigned AB/BA order.',
      'Collect Full JSON, Timeline JSON, and Metrics CSV after each condition.',
      'Administer post-task survey immediately after each condition.',
    ],
  },
  'duo-pilot-4': {
    id: 'duo-pilot-4',
    title: '4 teams, 2 participants each, pilot mode',
    description:
      'Fast pilot template for early rehearsal of protocol and data integrity checks before larger studies.',
    teams: buildTeams([
      { count: 2, order: 'AB', variant: 'A' },
      { count: 2, order: 'BA', variant: 'B' },
      { count: 2, order: 'AB', variant: 'B' },
      { count: 2, order: 'BA', variant: 'A' },
    ], SOFTWARE_CONTEXTS),
    profiles: SHARED_PROFILES,
    instructions: [
      'Use this template for rehearsal and facilitator training.',
      'Expect lower coordination density due to 2-person teams.',
    ],
  },
  'mixed-2to4-6': {
    id: 'mixed-2to4-6',
    title: '6 teams with mixed participant counts (2-4)',
    description:
      'Stress-tests user-flow interaction metrics against small team-size variation while preserving AB/BA order.',
    teams: buildTeams([
      { count: 2, order: 'AB', variant: 'A' },
      { count: 3, order: 'BA', variant: 'B' },
      { count: 4, order: 'AB', variant: 'B' },
      { count: 2, order: 'BA', variant: 'A' },
      { count: 3, order: 'AB', variant: 'A' },
      { count: 4, order: 'BA', variant: 'B' },
    ], SOFTWARE_CONTEXTS),
    profiles: SHARED_PROFILES,
    instructions: [
      'Use only if you explicitly want team-size effects in exploratory analysis.',
      'Keep role assignment strict to reduce confounding from team-size variance.',
    ],
  },
  'trio-campus-services-6': {
    id: 'trio-campus-services-6',
    title: '6 teams, 3 participants each, campus services domain',
    description:
      'Counterbalanced study template using non-software campus services operations scenarios.',
    teams: buildTeams([
      { count: 3, order: 'AB', variant: 'A' },
      { count: 3, order: 'BA', variant: 'B' },
      { count: 3, order: 'AB', variant: 'B' },
      { count: 3, order: 'BA', variant: 'A' },
      { count: 3, order: 'AB', variant: 'A' },
      { count: 3, order: 'BA', variant: 'B' },
    ], CAMPUS_SERVICES_CONTEXTS),
    profiles: SHARED_PROFILES,
    instructions: [
      'Run 2 conditions per team using assigned AB/BA order.',
      'Use campus services handouts from Domain Pack 2 in scenario-handouts.md.',
      'Collect Full JSON, Timeline JSON, and Metrics CSV after each condition.',
    ],
  },
  'trio-community-impact-6': {
    id: 'trio-community-impact-6',
    title: '6 teams, 3 participants each, community impact domain',
    description:
      'Counterbalanced study template using community operations and social impact scenarios.',
    teams: buildTeams([
      { count: 3, order: 'AB', variant: 'A' },
      { count: 3, order: 'BA', variant: 'B' },
      { count: 3, order: 'AB', variant: 'B' },
      { count: 3, order: 'BA', variant: 'A' },
      { count: 3, order: 'AB', variant: 'A' },
      { count: 3, order: 'BA', variant: 'B' },
    ], COMMUNITY_IMPACT_CONTEXTS),
    profiles: SHARED_PROFILES,
    instructions: [
      'Run 2 conditions per team using assigned AB/BA order.',
      'Use community impact handouts from Domain Pack 3 in scenario-handouts.md.',
      'Collect Full JSON, Timeline JSON, and Metrics CSV after each condition.',
    ],
  },
}

export const DEFAULT_STUDY_TEMPLATE_ID = 'trio-abba-6'

export function getRunOneCondition(order: StudyRunOrder): StudyCondition {
  return order === 'AB' ? 'AI_ON' : 'AI_LIGHT'
}

export function getRunTwoCondition(order: StudyRunOrder): StudyCondition {
  return order === 'AB' ? 'AI_LIGHT' : 'AI_ON'
}
