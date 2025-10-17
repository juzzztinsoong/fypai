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

// Avatar background colors (for user initials circles)
const avatarBackgroundColors = [
  'bg-blue-500',      // User 0
  'bg-green-500',     // User 1
  'bg-yellow-500',    // User 2
  'bg-pink-500',      // User 3
  'bg-orange-500',    // User 4
  'bg-teal-500',      // User 5
  'bg-red-500',       // User 6
];

// Border colors for message bubbles
const messageBorderColors = [
  'border-blue-500',
  'border-green-500',
  'border-yellow-500',
  'border-pink-500',
  'border-orange-500',
  'border-teal-500',
  'border-red-500',
];

/**
 * Get avatar background color for a user
 * @param userId - User ID
 * @param members - Array of team members
 * @returns Tailwind CSS class for background color (e.g., 'bg-blue-500')
 */
export function getAvatarBackgroundColor(userId: string, members: any[]): string {
  const idx = members.findIndex((m) => m.userId === userId);
  return avatarBackgroundColors[idx % avatarBackgroundColors.length];
}

/**
 * Get message border color for a user
 * @param userId - User ID
 * @param members - Array of team members
 * @returns Tailwind CSS class for border color (e.g., 'border-blue-500')
 */
export function getMessageBorderColor(userId: string, members: any[]): string {
  const idx = members.findIndex((m) => m.userId === userId);
  return messageBorderColors[idx % messageBorderColors.length];
}

/**
 * Get user initials from name
 * @param name - User's full name
 * @returns First letter uppercased (e.g., 'A' from 'Alice')
 */
export function getUserInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}
