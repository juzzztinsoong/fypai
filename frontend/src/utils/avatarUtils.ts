/**
 * Avatar Utilities
 *
 * Tech Stack: TypeScript
 * Purpose: Provide consistent avatar colors and styles across components
 *
 * Features:
 *   - Assigns consistent colors to users based on their position in team
 *   - Provides background colors for avatar circles
 *   - Provides border colors for message bubbles
 */

interface UserPalette {
  avatarBg: string
  bubbleBg: string
  bubbleBorder: string
  bubbleText: string
  bubbleMutedText: string
}

const userPalettes: UserPalette[] = [
  {
    avatarBg: 'bg-indigo-600',
    bubbleBg: 'bg-indigo-50',
    bubbleBorder: 'border-indigo-200',
    bubbleText: 'text-slate-900',
    bubbleMutedText: 'text-indigo-700',
  },
  {
    avatarBg: 'bg-neutral-600',
    bubbleBg: 'bg-neutral-50',
    bubbleBorder: 'border-neutral-200',
    bubbleText: 'text-slate-900',
    bubbleMutedText: 'text-neutral-700',
  },
  {
    avatarBg: 'bg-rose-600',
    bubbleBg: 'bg-rose-50',
    bubbleBorder: 'border-rose-200',
    bubbleText: 'text-slate-900',
    bubbleMutedText: 'text-rose-700',
  },
  {
    avatarBg: 'bg-lime-600',
    bubbleBg: 'bg-lime-50',
    bubbleBorder: 'border-lime-200',
    bubbleText: 'text-slate-900',
    bubbleMutedText: 'text-lime-700',
  },
  {
    avatarBg: 'bg-red-600',
    bubbleBg: 'bg-red-50',
    bubbleBorder: 'border-red-200',
    bubbleText: 'text-slate-900',
    bubbleMutedText: 'text-red-700',
  },
  {
    avatarBg: 'bg-purple-600',
    bubbleBg: 'bg-purple-50',
    bubbleBorder: 'border-purple-200',
    bubbleText: 'text-slate-900',
    bubbleMutedText: 'text-purple-700',
  },
  {
    avatarBg: 'bg-zinc-600',
    bubbleBg: 'bg-zinc-50',
    bubbleBorder: 'border-zinc-200',
    bubbleText: 'text-slate-900',
    bubbleMutedText: 'text-zinc-700',
  },
]

function resolveColorIndex(userId: string, members: any[], paletteSize: number): number {
  const memberIndex = members.findIndex((m) => m.userId === userId)
  if (memberIndex >= 0) {
    return memberIndex % paletteSize
  }

  // Deterministic fallback for users not present in current member list.
  let hash = 0
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return hash % paletteSize
}

/**
 * Get avatar background color for a user
 * @param userId - User ID
 * @param members - Array of team members
 * @returns Tailwind CSS class for background color (e.g., 'bg-blue-500')
 */
export function getAvatarBackgroundColor(userId: string, members: any[]): string {
  const idx = resolveColorIndex(userId, members, userPalettes.length)
  return userPalettes[idx].avatarBg
}

/**
 * Get message border color for a user
 * @param userId - User ID
 * @param members - Array of team members
 * @returns Tailwind CSS class for border color (e.g., 'border-blue-500')
 */
export function getMessageBorderColor(userId: string, members: any[]): string {
  const idx = resolveColorIndex(userId, members, userPalettes.length)
  return userPalettes[idx].bubbleBorder
}

export function getMessageSurfaceTheme(userId: string, members: any[]): UserPalette {
  const idx = resolveColorIndex(userId, members, userPalettes.length)
  return userPalettes[idx]
}

/**
 * Get user initials from name
 * @param name - User's full name
 * @returns First letter uppercased (e.g., 'A' from 'Alice')
 */
export function getUserInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}
