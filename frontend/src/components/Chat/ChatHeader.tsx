import { useCurrentTeam } from '../../stores/teamStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { getAvatarBackgroundColor, getUserInitials } from '../../utils/avatarUtils';

/**
 * ChatHeader Component
 *
 * Tech Stack: React (Vite), Zustand for state, Tailwind CSS for styling
 * Purpose: Display team name, member count, and online user count
 *
 * Features:
 *   - Shows current team name
 *   - Displays total member count
 *   - Shows online user count with green indicator
 *   - Calculates online members from the current team only
 *
 * Usage:
 *   - Used at the top of ChatWindow component
 */

export const ChatHeader = () => {
  const currentTeam = useCurrentTeam();
  const { onlineUsers } = usePresenceStore();

  if (!currentTeam) {
    return (
      <header className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">No Team Selected</h1>
            <p className="text-sm text-gray-500">Select a team from the sidebar</p>
          </div>
        </div>
      </header>
    );
  }

  // Count online members from current team
  const onlineMembers = currentTeam.members.filter((member) =>
    onlineUsers.has(member.id)
  );
  const onlineCount = onlineMembers.length;
  const totalMembers = currentTeam.members.length;

  return (
    <header className="px-6 py-4 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">{currentTeam.name}</h1>
          <div className="flex items-center space-x-4 mt-1">
            <div className="flex items-center space-x-1.5 text-sm text-gray-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              <span>{totalMembers} {totalMembers === 1 ? 'member' : 'members'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-sm text-gray-600">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-green-600 font-medium">
                {onlineCount} online
              </span>
            </div>
          </div>
        </div>
        
        {/* Optional: Show online member avatars */}
        <div className="flex items-center -space-x-2">
          {onlineMembers.slice(0, 5).map((member) => {
            // Special styling for AI agent
            if (member.id === 'agent') {
              return (
                <div
                  key={member.id}
                  className="relative w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-semibold border-2 border-white animate-pulse"
                  title={`${member.name} (online)`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#fff">AI</text>
                  </svg>
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
                </div>
              );
            }
            
            // Regular user avatars with consistent colors
            const bgColor = getAvatarBackgroundColor(member.id, currentTeam.members);
            return (
              <div
                key={member.id}
                className={`relative w-8 h-8 rounded-full ${bgColor} flex items-center justify-center text-white text-xs font-semibold border-2 border-white`}
                title={`${member.name} (online)`}
              >
                {getUserInitials(member.name)}
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
              </div>
            );
          })}
          {onlineCount > 5 && (
            <div className="relative w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-semibold border-2 border-white">
              +{onlineCount - 5}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
