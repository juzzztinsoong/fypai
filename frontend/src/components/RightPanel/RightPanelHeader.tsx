import { type ReactNode, useEffect, useRef } from 'react';
import { uiTokens } from '@/styles/uiTokens';

interface RightPanelHeaderProps {
  isContextVisible: boolean;
  onToggleContext: () => void;
  children?: ReactNode;
}

export const RightPanelHeader = ({ isContextVisible, onToggleContext, children }: RightPanelHeaderProps) => {
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isContextVisible) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (headerRef.current && !headerRef.current.contains(target)) {
        onToggleContext();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onToggleContext();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isContextVisible, onToggleContext]);

  return (
    <div ref={headerRef} className={`relative ${uiTokens.layout.railHeader} border-b border-gray-200 bg-white`}>
      <div className="h-full px-5 flex items-center justify-end">
        <button
          type="button"
          onClick={onToggleContext}
          title={isContextVisible ? 'Hide project context' : 'Show project context'}
          aria-label={isContextVisible ? 'Hide project context' : 'Show project context'}
          aria-expanded={isContextVisible}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
            isContextVisible
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3h6" />
            <path d="M10 8h4" />
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <path d={isContextVisible ? 'M9 14l3 3 3-3' : 'M9 17l3-3 3 3'} />
          </svg>
        </button>
      </div>

      {isContextVisible && children && (
        <div className="absolute right-5 top-full z-20 mt-1 w-[min(28rem,calc(100%_-_2.5rem))]">
          {children}
        </div>
      )}
    </div>
  );
};
