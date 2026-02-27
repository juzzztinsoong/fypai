/**
 * TaskContextCard Component
 * 
 * Sprint D - Part 5: Shared Task Context
 * Lives in the fixed header area of the right panel (between title and tabs).
 * Displays and edits the team's shared task context (markdown).
 * This context is injected into all AI LLM calls to ground responses.
 */

import { useState, useEffect, useCallback } from 'react';
import { useEntityStore } from '@/stores/entityStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getTaskContext, updateTaskContext } from '@/services/teamService';
import ReactMarkdown from 'react-markdown';

interface TaskContextCardProps {
  teamId: string;
}

export const TaskContextCard = ({ teamId }: TaskContextCardProps) => {
  const storedContext = useEntityStore((state) => state.taskContexts[teamId]);
  const currentUser = useSessionStore((state) => state.currentUser);
  const currentUserId = currentUser?.id || null;

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch task context on mount / team change
  useEffect(() => {
    if (!teamId) return;
    setIsLoading(true);
    getTaskContext(teamId)
      .then((ctx) => {
        useEntityStore.getState().setTaskContext(teamId, ctx);
      })
      .catch((err) => {
        console.error('[TaskContextCard] Failed to load context:', err);
      })
      .finally(() => setIsLoading(false));
  }, [teamId]);

  // Close edit mode when team changes
  useEffect(() => {
    setIsEditing(false);
    setIsExpanded(false);
  }, [teamId]);

  const content = storedContext?.content || null;
  const updatedAt = storedContext?.updatedAt;
  const updatedBy = storedContext?.updatedBy;

  const handleStartEdit = useCallback(() => {
    setDraft(content || '');
    setIsEditing(true);
    setIsExpanded(true);
  }, [content]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setDraft('');
  }, []);

  const handleSave = useCallback(async () => {
    if (!teamId || !currentUserId) return;
    setIsSaving(true);
    try {
      const updated = await updateTaskContext(teamId, draft, currentUserId);
      useEntityStore.getState().setTaskContext(teamId, updated);
      setIsEditing(false);
    } catch (err) {
      console.error('[TaskContextCard] Failed to save context:', err);
    } finally {
      setIsSaving(false);
    }
  }, [teamId, currentUserId, draft]);

  if (isLoading) {
    return (
      <div className="px-6 py-2 bg-indigo-50 border-b border-indigo-100">
        <div className="h-3 bg-indigo-200 rounded w-1/3 animate-pulse" />
      </div>
    );
  }

  // ── Compact bar (collapsed) ──
  if (!isExpanded && !isEditing) {
    return (
      <div className="px-6 py-2 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center space-x-2 min-w-0 flex-1 text-left group"
          type="button"
        >
          <span className="text-sm flex-shrink-0">📋</span>
          {content ? (
            <p className="text-xs text-indigo-700 truncate group-hover:text-indigo-900 transition-colors">
              {content.split('\n')[0].replace(/^#+\s*/, '')}
            </p>
          ) : (
            <p className="text-xs text-indigo-400 italic group-hover:text-indigo-600 transition-colors">
              Set project context to ground AI responses…
            </p>
          )}
          <span className="text-indigo-300 text-xs flex-shrink-0">▾</span>
        </button>
        <button
          type="button"
          onClick={handleStartEdit}
          className="ml-2 text-xs px-2 py-0.5 rounded text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors flex-shrink-0"
        >
          Edit
        </button>
      </div>
    );
  }

  // ── Expanded view ──
  return (
    <div className="bg-indigo-50/80 border-b border-indigo-100">
      {/* Expanded header */}
      <div className="px-6 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm">📋</span>
          <h3 className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
            Project Context
          </h3>
          <span className="text-xs text-indigo-400">(grounding AI)</span>
        </div>
        <div className="flex items-center space-x-1">
          {!isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="text-xs px-2 py-0.5 rounded text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
            >
              Edit
            </button>
          )}
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-xs px-1 py-0.5 rounded text-indigo-400 hover:text-indigo-600 transition-colors"
            >
              ▴
            </button>
          )}
        </div>
      </div>

      {/* Content / Editor */}
      <div className="px-6 pb-3">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Describe your project goals, current sprint tasks, tech stack, or anything the AI should know about your team's work..."
              className="w-full h-28 text-sm border border-indigo-300 rounded-md p-2.5 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 resize-y bg-white placeholder:text-indigo-300"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-indigo-400">
                Markdown supported
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-3 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : content ? (
          <div>
            <div className="prose prose-sm max-w-none text-gray-700 max-h-40 overflow-y-auto">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
            {updatedAt && (
              <p className="text-xs text-indigo-400 mt-1.5">
                Updated {new Date(updatedAt).toLocaleString()}
                {updatedBy && ` by ${updatedBy}`}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-indigo-400 italic">
            No context set yet. Click <strong>Edit</strong> to describe your project — the AI will use this to give more relevant responses.
          </p>
        )}
      </div>
    </div>
  );
};
