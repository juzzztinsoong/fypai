import { type ReactNode, useEffect, useRef } from 'react';
import { uiTokens } from '@/styles/uiTokens';

interface RightPanelHeaderProps {
  isContextVisible: boolean;
  hasProjectContext: boolean;
  projectContextPreview: string;
  onEditContext: () => void;
  onCloseContext: () => void;
  children?: ReactNode;
}

export const RightPanelHeader = ({
  isContextVisible,
  hasProjectContext,
  projectContextPreview,
  onEditContext,
  onCloseContext,
  children,
}: RightPanelHeaderProps) => {
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isContextVisible) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (headerRef.current && !headerRef.current.contains(target)) {
        onCloseContext();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseContext();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isContextVisible, onCloseContext]);

  return (
    <div
      ref={headerRef}
      className={`relative ${uiTokens.layout.railHeader} border-b border-slate-200 bg-white z-10`}
    >
      <div className="h-full px-5 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Project Context
            </p>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                hasProjectContext
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {hasProjectContext ? 'Context Set' : 'Context Missing'}
            </span>
          </div>

          <p className="mt-1 text-xs leading-5 text-slate-700 truncate">
            {hasProjectContext
              ? projectContextPreview
              : 'No project context yet. Set this before the team starts planning so AI responses align with goals, constraints, and scope.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onEditContext}
          title="Edit project context"
          aria-label="Edit project context"
          aria-expanded={isContextVisible}
          className={`inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-xs font-semibold transition-colors ${
            isContextVisible
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          Edit Context
        </button>
      </div>

      {isContextVisible && children && (
        <div className="absolute right-5 top-full z-20 mt-1 w-[min(34rem,calc(100%_-_2.5rem))]">
          {children}
        </div>
      )}
    </div>
  );
};
