/**
 * TEAM STORE (Zustand)
 *
 * Tech Stack: Zustand, TypeScript
 * Purpose: Manage team state, selection, and member management
 *
 * State:
 *   - teams: Team[] - all teams in app
 *   - currentTeamId: string | null - selected team
 *
 * Methods & Arguments:
 *   - setCurrentTeam(teamId: string): sets active team
 *   - setTeams(teams: Team[]): replaces all teams
 *   - addTeam(team: Team): adds a new team
 *   - updateTeam(teamId: string, updates: Partial<Team>): updates team fields
 *   - addMember(teamId: string, member: TeamMember): adds member to team
 *   - removeMember(teamId: string, memberId: string): removes member from team
 *
 * Exports:
 *   - useTeamStore: Zustand hook for team state/methods
 *   - useCurrentTeam: Returns currently selected team (Team | null)
 */
import { create } from 'zustand'
import type { Team, TeamMember } from '../types'
import { useChatStore } from './chatStore'

interface TeamState {
  teams: Team[]
  currentTeamId: string | null
  setCurrentTeam: (teamId: string) => void
  setTeams: (teams: Team[]) => void
  addTeam: (team: Team) => void
  updateTeam: (teamId: string, updates: Partial<Team>) => void
  addMember: (teamId: string, member: TeamMember) => void
  removeMember: (teamId: string, memberId: string) => void
}

export const useTeamStore = create<TeamState>()((set) => ({
  teams: [
    {
      id: 'team1',
      name: 'Sample Team',
      description: 'A team for demo purposes',
      members: [
        { id: 'user1', name: 'Alice', role: 'admin' },
        { id: 'user2', name: 'Bob', role: 'member' },
        { id: 'agent', name: 'AI Agent', role: 'member' },
      ],
    },
    {
      id: 'team2',
      name: 'AI Research',
      description: 'Team for AI discussions',
      members: [
        { id: 'user1', name: 'Alice', role: 'member' },
        { id: 'user3', name: 'Charlie', role: 'admin' },
        { id: 'agent', name: 'AI Agent', role: 'member' },
      ],
    },
    {
      id: 'team3',
      name: 'Project Alpha',
      description: 'Frontend development team',
      members: [
        { id: 'user1', name: 'Alice', role: 'member' },
        { id: 'user4', name: 'David', role: 'admin' },
        { id: 'user5', name: 'Emma', role: 'member' },
        { id: 'agent', name: 'AI Agent', role: 'member' },
      ],
    },
    {
      id: 'team4',
      name: 'Design Sprint',
      description: 'UI/UX design collaboration',
      members: [
        { id: 'user1', name: 'Alice', role: 'admin' },
        { id: 'user6', name: 'Frank', role: 'member' },
        { id: 'agent', name: 'AI Agent', role: 'member' },
      ],
    },
    {
      id: 'team5',
      name: 'Backend Services',
      description: 'Backend API development',
      members: [
        { id: 'user1', name: 'Alice', role: 'member' },
        { id: 'user2', name: 'Bob', role: 'admin' },
        { id: 'user7', name: 'Grace', role: 'member' },
        { id: 'agent', name: 'AI Agent', role: 'member' },
      ],
    },
    {
      id: 'team6',
      name: 'Data Science Lab',
      description: 'ML and analytics team',
      members: [
        { id: 'user3', name: 'Charlie', role: 'admin' },
        { id: 'user8', name: 'Henry', role: 'member' },
        { id: 'agent', name: 'AI Agent', role: 'member' },
      ],
    },
  ],
  currentTeamId: 'team1',

  setCurrentTeam: (teamId: string) => {
    set({ currentTeamId: teamId });
    // Also update the chat store to show messages for this team
    const chatStore = useChatStore.getState();
    chatStore.setCurrentTeamMessages(chatStore.chat[teamId] || []);
  },

  setTeams: (teams: Team[]) => set({ teams }),

  addTeam: (team: Team) =>
    set((state) => ({ teams: [...state.teams, team] })),

  updateTeam: (teamId: string, updates: Partial<Team>) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId ? { ...t, ...updates } : t
      ),
    })),

  addMember: (teamId: string, member: TeamMember) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId
          ? { ...t, members: [...t.members, member] }
          : t
      ),
    })),

  removeMember: (teamId: string, memberId: string) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId
          ? { ...t, members: t.members.filter((m) => m.id !== memberId) }
          : t
      ),
    })),
}))

export const useCurrentTeam = () => {
  const { teams, currentTeamId } = useTeamStore()
  return teams.find((t) => t.id === currentTeamId) || null
}
