interface AIToggleProps {
  isEnabled: boolean;
  onToggle: () => void;
}

export const AIToggle = ({ isEnabled, onToggle }: AIToggleProps) => {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">AI Assistant</span>
        <button
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 hover:bg-gray-400'
          }`}
          title={isEnabled ? 'AI Assistant is active' : 'AI Assistant is disabled'}
        >
          <span 
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} 
          />
        </button>
      </div>
      <p className="text-xs text-gray-500">
        {isEnabled ? 'AI insights generation is enabled' : 'AI insights generation is disabled'}
      </p>
    </div>
  );
};
