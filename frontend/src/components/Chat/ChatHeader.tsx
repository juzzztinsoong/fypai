/**
 * ChatHeader Component
 *
 * Per Refactoring Guide Section 1.3:
 * - Uses UIStore for current team context
 * - Uses EntityStore for team data
 * - Uses SessionStore for online users presence
 * - No teamStore, no presenceStore
 *
 * Tech Stack: React (Vite), EntityStore, UIStore, SessionStore, Tailwind CSS
 */
import { useUIStore } from '@/stores/uiStore';
import { useEntityStore } from '@/stores/entityStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getAvatarBackgroundColor, getUserInitials } from '../../utils/avatarUtils';
import { uiTokens } from '@/styles/uiTokens';

export const ChatHeader = () => {
  const currentTeamId = useUIStore((state) => state.currentTeamId);
  const currentTeam = useEntityStore((state) => 
    currentTeamId ? state.getTeam(currentTeamId) : null
  );
  const onlineUsers = useSessionStore((state) => state.presence.onlineUsers);

  if (!currentTeam) {
    return (
      <header className={`px-5 ${uiTokens.layout.railHeader} border-b border-slate-200 bg-white flex items-center z-10`}>
        <div className="w-full flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800 leading-6">No Team Selected</h1>
            <p className="text-xs text-gray-500 mt-0.5">Select a team from the sidebar</p>
          </div>
        </div>
      </header>
    );
  }

  // Count online members from current team
  // AI agent is always considered online when any user is connected
  const onlineMembers = currentTeam.members.filter((member) => {
    // AI agent is always online
    if (member.userId === 'agent') return true;
    // Regular users must be in onlineUsers list
    return onlineUsers.includes(member.userId);
  });
  const onlineCount = onlineMembers.length;
  const totalMembers = currentTeam.members.length;

  return (
    <header className={`px-5 ${uiTokens.layout.railHeader} border-b border-slate-200 bg-white flex items-center z-10`}>
      <div className="w-full flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 leading-6">{currentTeam.name}</h1>
          <div className="flex items-center space-x-4 mt-0.5">
            <div className="flex items-center space-x-1.5 text-xs text-gray-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              <span>{totalMembers} {totalMembers === 1 ? 'member' : 'members'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-gray-600">
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
        <div className="flex items-center -space-x-2 ml-3">
          {onlineMembers.slice(0, 5).map((member) => {
            // Special styling for AI agent
            if (member.userId === 'agent') {
              return (
                <div
                  key={member.id}
                  className="relative w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-semibold border-2 border-white animate-pulse"
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
            const bgColor = getAvatarBackgroundColor(member.userId, currentTeam.members);
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
