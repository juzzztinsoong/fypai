import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from './db.js'
import {
  DEFAULT_STUDY_TEMPLATE_ID,
  STUDY_SEED_TEMPLATES,
  StudyCondition,
  StudySeedTemplate,
  getRunOneCondition,
  getRunTwoCondition,
} from './study/studySeedTemplates.js'

interface CliOptions {
  templateId: string
  listTemplates: boolean
  dryRun: boolean
  noInstructions: boolean
}

interface SeededTeamSummary {
  id: string
  name: string
  participantIds: string[]
  runOrder: 'AB' | 'BA'
  scenarioVariant: 'A' | 'B'
  runOneCondition: StudyCondition
  runTwoCondition: StudyCondition
}

interface TeamInstructionMessageInput {
  teamName: string
  runOrder: 'AB' | 'BA'
  runOneCondition: StudyCondition
  runTwoCondition: StudyCondition
}

interface OnboardingInsightSeed {
  type: 'summary' | 'document' | 'action' | 'suggestion'
  title: string
  content: string
  markerLabel: string
  priority: 'low' | 'medium' | 'high'
}

const DEV_ACCESS_USERS = [
  { id: 'user1', name: 'Alice', role: 'admin' as const },
  { id: 'user2', name: 'Bob', role: 'member' as const },
  { id: 'user3', name: 'Charlie', role: 'member' as const },
]

const ONBOARDING_INSIGHTS: OnboardingInsightSeed[] = [
  {
    type: 'summary',
    title: 'Demo: Conversation Snapshot',
    content: [
      '## Snapshot',
      '- Use after a short discussion to confirm team alignment.',
      '- If details look wrong, correct them in chat.',
      '- Use **View marker in chat** to check source context.',
    ].join('\n'),
    markerLabel: 'Summary',
    priority: 'medium',
  },
  {
    type: 'document',
    title: 'Demo: Research',
    content: [
      '## Compare Options',
      '- Use when choices need evidence or trade-offs.',
      '- Pull only useful points into decisions and actions.',
      '- Verify assumptions in chat before committing.',
    ].join('\n'),
    markerLabel: 'Research',
    priority: 'medium',
  },
  {
    type: 'action',
    title: 'Demo: Action Item',
    content: [
      '## Next Step',
      '- **Owner**: assign one teammate',
      '- **Task**: define one concrete step',
      '- **Target date**: set a realistic deadline',
      '',
      'Lifecycle: accept or dismiss -> refine -> mark complete.',
    ].join('\n'),
    markerLabel: 'Action Item',
    priority: 'high',
  },
  {
    type: 'suggestion',
    title: 'Demo: Help Card',
    content: [
      '## Unblock',
      '- Use when discussion stalls or choices feel unclear.',
      '- Ask for 2-3 practical options.',
      '- Pick one next step and continue in chat.',
    ].join('\n'),
    markerLabel: 'Help',
    priority: 'low',
  },
]

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    templateId: DEFAULT_STUDY_TEMPLATE_ID,
    listTemplates: false,
    dryRun: false,
    noInstructions: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--template' && argv[index + 1]) {
      options.templateId = argv[index + 1]
      index += 1
      continue
    }

    if (token === '--list') {
      options.listTemplates = true
      continue
    }

    if (token === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (token === '--no-instructions') {
      options.noInstructions = true
      continue
    }
  }

  return options
}

function formatTimestamp(now: Date): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${min}`
}

async function ensureAgentUser(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { id: 'agent' },
    select: { id: true },
  })

  if (existing) return

  await prisma.user.create({
    data: {
      id: 'agent',
      name: 'AI Agent',
      role: 'agent',
    },
  })
}

async function ensureDevAccessUsers(): Promise<void> {
  for (const user of DEV_ACCESS_USERS) {
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    })

    if (existing) continue

    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: `${user.id}@fypai.local`,
        role: user.role,
      },
    })
  }
}

async function cleanupExistingStudyData(): Promise<void> {
  await prisma.chimeLog.deleteMany({
    where: { teamId: { startsWith: 'study-team-' } },
  })

  await prisma.chimeRule.deleteMany({
    where: { teamId: { startsWith: 'study-team-' } },
  })

  const existingTeams = await prisma.team.findMany({
    where: {
      id: { startsWith: 'study-team-' },
    },
    select: { id: true },
  })

  if (existingTeams.length > 0) {
    await prisma.team.deleteMany({
      where: { id: { startsWith: 'study-team-' } },
    })
  }

  await prisma.user.deleteMany({
    where: { id: { startsWith: 'study-user-' } },
  })
}

function buildTeamInstructionMessage(input: TeamInstructionMessageInput): string {
  const lines: string[] = []
  lines.push('# Team Workspace')
  lines.push('')
  lines.push('Use this quick start to begin.')
  lines.push('')
  lines.push('## Start')
  lines.push('1. (Optional) Open **Edit Context** and set goal, constraints, timeline, and success criteria.')
  lines.push('2. Use center chat to align on direction and decisions.')
  lines.push('3. Use composer modes or slash commands as needed: `/summary`, `/research`, `/actions`, `/help`.')
  lines.push('')
  lines.push('## Workspace')
  lines.push('- Insights are shown in the right panel.')
  lines.push('- Marker links connect each insight back to source chat context.')
  lines.push('')
  lines.push('Begin with a short team intro in chat.')

  return lines.join('\n')
}

async function seedOnboardingInsightMarkers(teamId: string, templateId: string) {
  for (const demo of ONBOARDING_INSIGHTS) {
    const insight = await prisma.aIInsight.create({
      data: {
        teamId,
        type: demo.type,
        title: demo.title,
        content: demo.content,
        priority: demo.priority,
        tags: JSON.stringify(['onboarding', 'demo', demo.type]),
        metadata: JSON.stringify({
          onboardingDemo: true,
          seedTemplateId: templateId,
          provenanceSource: 'seed-onboarding',
          provenanceTrigger: 'seed-bootstrap',
          provenanceCreatedBy: 'system',
          provenanceDetail: 'study-template',
        }),
      },
    })

    await prisma.message.create({
      data: {
        teamId,
        authorId: 'agent',
        content: `📌 ${demo.markerLabel} available: ${demo.title}`,
        contentType: 'text',
        metadata: JSON.stringify({
          markerType: demo.type === 'action' ? 'action-insight-link' : 'insight-link',
          linkedInsightId: insight.id,
          linkedActionId: demo.type === 'action' ? insight.id : undefined,
          linkedInsightType: demo.type,
          sourceActionTitle: insight.title,
          markerLabel: demo.markerLabel,
          onboardingDemo: true,
          seedTemplateId: templateId,
          markerSource: 'seed-onboarding',
          markerTrigger: 'seed-bootstrap',
          markerCreatedBy: 'system',
          markerTriggerDetail: 'study-template',
        }),
      },
    })
  }
}

async function seedTemplate(template: StudySeedTemplate): Promise<SeededTeamSummary[]> {
  const created: SeededTeamSummary[] = []

  for (let teamIndex = 0; teamIndex < template.teams.length; teamIndex += 1) {
    const teamTemplate = template.teams[teamIndex]
    const runOneCondition = getRunOneCondition(teamTemplate.runOrder)
    const runTwoCondition = getRunTwoCondition(teamTemplate.runOrder)
    const runOneProfile = template.profiles[runOneCondition]

    const participantIds: string[] = []
    for (let memberIndex = 0; memberIndex < teamTemplate.participantCount; memberIndex += 1) {
      const participantId = `study-user-${String(teamIndex + 1).padStart(2, '0')}-${String(memberIndex + 1).padStart(2, '0')}`
      participantIds.push(participantId)

      await prisma.user.create({
        data: {
          id: participantId,
          name: `Study T${teamIndex + 1} Participant ${memberIndex + 1}`,
          email: `study.t${teamIndex + 1}.p${memberIndex + 1}@fypai.local`,
          role: memberIndex === 0 ? 'admin' : 'member',
        },
      })
    }

    await prisma.team.create({
      data: {
        id: teamTemplate.id,
        name: teamTemplate.name,
        isChimeEnabled: runOneProfile.isChimeEnabled,
      },
    })

    await prisma.teamMember.createMany({
      data: [
        ...participantIds.map((participantId, index) => ({
          teamId: teamTemplate.id,
          userId: participantId,
          teamRole: index === 0 ? 'owner' : 'member',
        })),
        ...DEV_ACCESS_USERS.map((user) => ({
          teamId: teamTemplate.id,
          userId: user.id,
          teamRole: user.id === 'user1' ? 'admin' : 'member',
        })),
        {
          teamId: teamTemplate.id,
          userId: 'agent',
          teamRole: null,
        },
      ],
    })

    await prisma.teamAgentPreference.upsert({
      where: { teamId: teamTemplate.id },
      create: {
        teamId: teamTemplate.id,
        personality: runOneProfile.preferences.personality,
        proactivity: runOneProfile.preferences.proactivity,
        responseLength: runOneProfile.preferences.responseLength,
        modelTierOverride: runOneProfile.preferences.modelTierOverride,
      },
      update: {
        personality: runOneProfile.preferences.personality,
        proactivity: runOneProfile.preferences.proactivity,
        responseLength: runOneProfile.preferences.responseLength,
        modelTierOverride: runOneProfile.preferences.modelTierOverride,
      },
    })

    await prisma.message.create({
      data: {
        teamId: teamTemplate.id,
        authorId: 'agent',
        content: buildTeamInstructionMessage({
          teamName: teamTemplate.name,
          runOrder: teamTemplate.runOrder,
          runOneCondition,
          runTwoCondition,
        }),
        contentType: 'text',
        metadata: JSON.stringify({
          markerType: 'system-link',
          markerLabel: 'participant-onboarding',
          seedTemplateId: template.id,
          onboardingDemo: true,
          runOrder: teamTemplate.runOrder,
          runOneCondition,
          runTwoCondition,
          markerSource: 'seed-onboarding',
          markerTrigger: 'seed-bootstrap',
          markerCreatedBy: 'system',
          markerTriggerDetail: 'participant-onboarding',
        }),
      },
    })

    await seedOnboardingInsightMarkers(teamTemplate.id, template.id)

    created.push({
      id: teamTemplate.id,
      name: teamTemplate.name,
      participantIds,
      runOrder: teamTemplate.runOrder,
      scenarioVariant: teamTemplate.scenarioVariant,
      runOneCondition,
      runTwoCondition,
    })
  }

  return created
}

function buildInstructionMarkdown(template: StudySeedTemplate, teams: SeededTeamSummary[]): string {
  const lines: string[] = []
  lines.push('# Study Seed Output')
  lines.push('')
  lines.push(`Template: ${template.id}`)
  lines.push(`Title: ${template.title}`)
  lines.push(`Description: ${template.description}`)
  lines.push('')
  lines.push('## Condition Profiles')
  lines.push('')
  lines.push(`- AI-on: ${template.profiles.AI_ON.facilitatorNote}`)
  lines.push(
    `- AI-on settings: chime=${template.profiles.AI_ON.isChimeEnabled}, preset=${template.profiles.AI_ON.presetId}, proactivity=${template.profiles.AI_ON.preferences.proactivity}, length=${template.profiles.AI_ON.preferences.responseLength}`
  )
  lines.push(`- AI-light: ${template.profiles.AI_LIGHT.facilitatorNote}`)
  lines.push(
    `- AI-light settings: chime=${template.profiles.AI_LIGHT.isChimeEnabled}, preset=${template.profiles.AI_LIGHT.presetId}, proactivity=${template.profiles.AI_LIGHT.preferences.proactivity}, length=${template.profiles.AI_LIGHT.preferences.responseLength}`
  )
  lines.push('')
  lines.push('## Team Assignments')
  lines.push('')
  lines.push('| Team ID | Team Name | Participants | Run Order | Run 1 | Run 2 |')
  lines.push('|---|---|---:|---|---|---|')

  for (const team of teams) {
    lines.push(
      `| ${team.id} | ${team.name} | ${team.participantIds.length} | ${team.runOrder} | ${team.runOneCondition} | ${team.runTwoCondition} |`
    )
  }

  lines.push('')
  lines.push('## Participant IDs')
  lines.push('')

  for (const team of teams) {
    lines.push(`- ${team.id}: ${team.participantIds.join(', ')}`)
  }

  lines.push('')
  lines.push('## App Access Users (for immediate UI login/testing)')
  lines.push('')
  lines.push(`- ${DEV_ACCESS_USERS.map((user) => user.id).join(', ')}`)
  lines.push('- These users are auto-added to each seeded study team to make teams visible in the current UI.')

  lines.push('')
  lines.push('## Study Instructions')
  lines.push('')

  for (const instruction of template.instructions) {
    lines.push(`- ${instruction}`)
  }

  lines.push('')
  lines.push('## Suggested Next Steps')
  lines.push('')
  lines.push('- Open docs/thesis-study/facilitator-runbook.md and run one pilot group.')
  lines.push('- After each condition, export Full JSON, Timeline JSON, and Metrics CSV.')
  lines.push('- Administer docs/thesis-study/post-task-survey.md after each condition.')

  return `${lines.join('\n')}\n`
}

async function writeInstructionFiles(template: StudySeedTemplate, teams: SeededTeamSummary[]): Promise<void> {
  const now = new Date()
  const stamp = formatTimestamp(now)
  const generatedDir = path.resolve(process.cwd(), '..', 'docs', 'thesis-study', 'generated')

  await mkdir(generatedDir, { recursive: true })

  const markdown = buildInstructionMarkdown(template, teams)
  const snapshot = {
    templateId: template.id,
    generatedAt: now.toISOString(),
    teams,
    profiles: template.profiles,
    instructions: template.instructions,
  }

  await writeFile(path.join(generatedDir, `study-seed-${template.id}-${stamp}.md`), markdown, 'utf8')
  await writeFile(path.join(generatedDir, 'study-seed-latest.md'), markdown, 'utf8')
  await writeFile(path.join(generatedDir, 'study-seed-latest.json'), JSON.stringify(snapshot, null, 2), 'utf8')
}

function printTemplateList(): void {
  console.log('Available study templates:')
  for (const template of Object.values(STUDY_SEED_TEMPLATES)) {
    console.log(`- ${template.id}: ${template.title}`)
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.listTemplates) {
    printTemplateList()
    return
  }

  const template = STUDY_SEED_TEMPLATES[options.templateId]
  if (!template) {
    console.error(`Unknown template: ${options.templateId}`)
    printTemplateList()
    process.exitCode = 1
    return
  }

  console.log(`[StudySeed] Using template: ${template.id}`)
  console.log(`[StudySeed] ${template.description}`)

  if (options.dryRun) {
    console.log('[StudySeed] Dry run only. No database writes were performed.')
    for (const team of template.teams) {
      console.log(
        `- ${team.id}: participants=${team.participantCount}, order=${team.runOrder}, run1=${getRunOneCondition(
          team.runOrder
        )}`
      )
    }
    return
  }

  await ensureAgentUser()
  await ensureDevAccessUsers()
  await cleanupExistingStudyData()
  const createdTeams = await seedTemplate(template)

  if (!options.noInstructions) {
    await writeInstructionFiles(template, createdTeams)
  }

  console.log(`[StudySeed] Seeded ${createdTeams.length} study teams.`)
  const participantTotal = createdTeams.reduce((sum, team) => sum + team.participantIds.length, 0)
  console.log(`[StudySeed] Seeded ${participantTotal} study participants.`)

  if (!options.noInstructions) {
    console.log('[StudySeed] Wrote instruction files to docs/thesis-study/generated')
  }

  console.log('[StudySeed] Done.')
}

main().catch((error) => {
  console.error('[StudySeed] Failed:', error)
  process.exitCode = 1
})
