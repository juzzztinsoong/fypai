export type StudyCondition = 'AI_ON' | 'AI_LIGHT'
export type StudyRunOrder = 'AB' | 'BA'
export type RulePresetId = 'conservative' | 'balanced' | 'proactive'

export interface StudyTeamTemplate {
  id: string
  name: string
  participantCount: number
  participantIds?: string[]
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
      taskContext: `${variantContext}`,
    }
  })
}

const SOFTWARE_CONTEXTS: ScenarioContextPair = {
  A: 'Facilitator will provide Scenario A verbally at run start. Keep app-seeded context neutral before briefing.',
  B: 'Facilitator will provide Scenario B verbally at run start. Keep app-seeded context neutral before briefing.',
}

const CAMPUS_SERVICES_CONTEXTS: ScenarioContextPair = {
  A: 'Facilitator will provide Scenario A verbally at run start. Keep app-seeded context neutral before briefing.',
  B: 'Facilitator will provide Scenario B verbally at run start. Keep app-seeded context neutral before briefing.',
}

const COMMUNITY_IMPACT_CONTEXTS: ScenarioContextPair = {
  A: 'Facilitator will provide Scenario A verbally at run start. Keep app-seeded context neutral before briefing.',
  B: 'Facilitator will provide Scenario B verbally at run start. Keep app-seeded context neutral before briefing.',
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
  'cohort-3-solo3-team2': {
    id: 'cohort-3-solo3-team2',
    title: '3 participants, 3 solo chats + 2 team chats',
    description:
      'Primary study seed for onboarding-first flow: three participant solo chats, one shared AI-on team chat, and one shared AI-light team chat.',
    teams: [
      {
        id: 'study-team-01',
        name: 'Solo - Participant 1',
        participantCount: 1,
        participantIds: ['study-user-01'],
        scenarioVariant: 'A',
        runOrder: 'AB',
        taskContext: SOFTWARE_CONTEXTS.A,
      },
      {
        id: 'study-team-02',
        name: 'Solo - Participant 2',
        participantCount: 1,
        participantIds: ['study-user-02'],
        scenarioVariant: 'A',
        runOrder: 'AB',
        taskContext: SOFTWARE_CONTEXTS.A,
      },
      {
        id: 'study-team-03',
        name: 'Solo - Participant 3',
        participantCount: 1,
        participantIds: ['study-user-03'],
        scenarioVariant: 'A',
        runOrder: 'AB',
        taskContext: SOFTWARE_CONTEXTS.A,
      },
      {
        id: 'study-team-04',
        name: 'Team - AI On',
        participantCount: 3,
        participantIds: ['study-user-01', 'study-user-02', 'study-user-03'],
        scenarioVariant: 'B',
        runOrder: 'AB',
        taskContext: SOFTWARE_CONTEXTS.B,
      },
      {
        id: 'study-team-05',
        name: 'Team - AI Light',
        participantCount: 3,
        participantIds: ['study-user-01', 'study-user-02', 'study-user-03'],
        scenarioVariant: 'B',
        runOrder: 'BA',
        taskContext: SOFTWARE_CONTEXTS.B,
      },
    ],
    profiles: SHARED_PROFILES,
    instructions: [
      'Run onboarding in each solo chat first, then continue in the two shared team chats.',
      'Use Team - AI On for full-support condition and Team - AI Light for reduced-side-output condition.',
      'Collect Full JSON, Timeline JSON, and Metrics CSV after each condition.',
    ],
  },
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

export const DEFAULT_STUDY_TEMPLATE_ID = 'cohort-3-solo3-team2'

export function getRunOneCondition(order: StudyRunOrder): StudyCondition {
  return order === 'AB' ? 'AI_ON' : 'AI_LIGHT'
}

export function getRunTwoCondition(order: StudyRunOrder): StudyCondition {
  return order === 'AB' ? 'AI_LIGHT' : 'AI_ON'
}
