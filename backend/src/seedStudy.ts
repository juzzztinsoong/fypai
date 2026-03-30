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
  onboardingMode: 'solo' | 'team-ai-on' | 'team-ai-light'
}

interface SoloHelpInsightSeed {
  type: 'suggestion'
  title: string
  content: string
  priority: 'low'
}

const DEV_ACCESS_USERS = [
  { id: 'user1', name: 'Alice', role: 'admin' as const },
  { id: 'user2', name: 'Bob', role: 'member' as const },
  { id: 'user3', name: 'Charlie', role: 'member' as const },
]

const SOLO_HELP_INSIGHT: SoloHelpInsightSeed = {
  type: 'suggestion',
  title: 'Quick Start Help',
  content: [
    'If you are not sure where to begin:',
    '- Use center chat to explore ideas and ask questions.',
    '- Use Summary for a clear recap.',
    '- Use Research to compare options.',
    '- Use Actions to turn decisions into next steps.',
    '- Use Help when you want guidance on what to do next.',
    '',
    'Pick one direction, then continue from there.',
  ].join('\n'),
  priority: 'low',
}

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

  if (input.onboardingMode === 'solo') {
    lines.push('Welcome, great to have you here.')
    lines.push('')
    lines.push('First step: go to the Edit Context board on the top right and set your goals.')
    lines.push('')
    lines.push('Quick orientation:')
    lines.push('- Center chat is where you talk things through.')
    lines.push('- Right panel is where generated outputs appear.')
    lines.push('')
    lines.push('Above the chat box, you can choose:')
    lines.push('- Summary')
    lines.push('- Research')
    lines.push('- Actions')
    lines.push('- Help')
    lines.push('')
    lines.push('You will see a companion marker on this message. Click it to open your quick-start help card.')
    return lines.join('\n')
  }

  if (input.onboardingMode === 'team-ai-light') {
    lines.push('Welcome team.')
    lines.push('')
    lines.push('This room uses a lighter support mode.')
    lines.push('')
    lines.push('Quick orientation:')
    lines.push('- Center chat is for your discussion.')
    lines.push('- Nothing will be produced in the right panel.')
    return lines.join('\n')
  }

  lines.push('Welcome team.')
  lines.push('')
  lines.push('You already completed the solo intro, so this space is for working together.')
  lines.push('')
  lines.push('Quick orientation:')
  lines.push('- Center chat is for discussion and decisions.')
  lines.push('- Right panel is where generated outputs appear.')
  lines.push('')
  lines.push('Above the chat box, choose as needed:')
  lines.push('- Summary')
  lines.push('- Research')
  lines.push('- Actions')
  lines.push('- Help')

  return lines.join('\n')
}

function resolveParticipantIds(teamIndex: number, participantCount: number, configuredIds?: string[]): string[] {
  if (Array.isArray(configuredIds) && configuredIds.length > 0) {
    return configuredIds
  }

  const participantIds: string[] = []
  for (let memberIndex = 0; memberIndex < participantCount; memberIndex += 1) {
    participantIds.push(
      `study-user-${String(teamIndex + 1).padStart(2, '0')}-${String(memberIndex + 1).padStart(2, '0')}`
    )
  }
  return participantIds
}

async function seedSoloHelpInsight(teamId: string, templateId: string) {
  return prisma.aIInsight.create({
    data: {
      teamId,
      type: SOLO_HELP_INSIGHT.type,
      title: SOLO_HELP_INSIGHT.title,
      content: SOLO_HELP_INSIGHT.content,
      priority: SOLO_HELP_INSIGHT.priority,
      tags: JSON.stringify(['onboarding', 'help', 'solo']),
      metadata: JSON.stringify({
        onboardingDemo: true,
        seedTemplateId: templateId,
        provenanceSource: 'seed-onboarding',
        provenanceTrigger: 'seed-bootstrap',
        provenanceCreatedBy: 'system',
        provenanceDetail: 'solo-help-card',
      }),
    },
  })
}

async function seedTemplate(template: StudySeedTemplate): Promise<SeededTeamSummary[]> {
  const created: SeededTeamSummary[] = []
  const createdParticipantIds = new Set<string>()

  for (let teamIndex = 0; teamIndex < template.teams.length; teamIndex += 1) {
    const teamTemplate = template.teams[teamIndex]
    const runOneCondition = getRunOneCondition(teamTemplate.runOrder)
    const runTwoCondition = getRunTwoCondition(teamTemplate.runOrder)
    const runOneProfile = template.profiles[runOneCondition]

    const participantIds = resolveParticipantIds(teamIndex, teamTemplate.participantCount, teamTemplate.participantIds)

    for (let memberIndex = 0; memberIndex < participantIds.length; memberIndex += 1) {
      const participantId = participantIds[memberIndex]
      if (createdParticipantIds.has(participantId)) continue
      const participantLabel = participantId.replace('study-user-', '')
      const participantEmailToken = participantLabel.replace(/-/g, '.')

      await prisma.user.create({
        data: {
          id: participantId,
          name: `Study Participant ${participantLabel}`,
          email: `study.${participantEmailToken}@fypai.local`,
          role: createdParticipantIds.size === 0 ? 'admin' : 'member',
        },
      })

      createdParticipantIds.add(participantId)
    }

    const onboardingMode: TeamInstructionMessageInput['onboardingMode'] =
      participantIds.length === 1
        ? 'solo'
        : runOneCondition === 'AI_LIGHT'
        ? 'team-ai-light'
        : 'team-ai-on'

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

    const soloHelpInsight =
      onboardingMode === 'solo' ? await seedSoloHelpInsight(teamTemplate.id, template.id) : null

    await prisma.message.create({
      data: {
        teamId: teamTemplate.id,
        authorId: 'agent',
        content: buildTeamInstructionMessage({
          teamName: teamTemplate.name,
          runOrder: teamTemplate.runOrder,
          runOneCondition,
          runTwoCondition,
          onboardingMode,
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
          linkedInsightId: soloHelpInsight?.id,
          linkedInsightType: soloHelpInsight ? 'suggestion' : undefined,
          sourceActionTitle: soloHelpInsight?.title,
          markerPreview: soloHelpInsight ? 'Quick start help for this chat.' : undefined,
          markerCompanionText: soloHelpInsight
            ? 'Click the companion marker to open your quick-start help card.'
            : undefined,
        }),
      },
    })

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
