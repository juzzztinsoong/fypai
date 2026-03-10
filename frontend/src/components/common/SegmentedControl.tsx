import { getSegmentedActiveClass, type SegmentedAccent, uiTokens } from '@/styles/uiTokens'

export interface SegmentedControlItem<TKey extends string> {
  key: TKey
  label: string
  emoji?: string
  count?: number
  accent?: SegmentedAccent
}

interface SegmentedControlProps<TKey extends string> {
  items: SegmentedControlItem<TKey>[]
  activeKey: TKey
  onChange: (key: TKey) => void
  wrap?: boolean
  className?: string
}

export function SegmentedControl<TKey extends string>({
  items,
  activeKey,
  onChange,
  wrap = false,
  className,
}: SegmentedControlProps<TKey>) {
  const rowClassName = [
    wrap ? uiTokens.segmented.rowWrap : uiTokens.segmented.row,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rowClassName}>
      {items.map((item) => {
        const isActive = item.key === activeKey
        const stateClassName = isActive
          ? getSegmentedActiveClass(item.accent)
          : uiTokens.segmented.buttonInactive

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={isActive}
            className={`${uiTokens.segmented.buttonBase} ${stateClassName}`}
          >
            {item.emoji && <span className="mr-1">{item.emoji}</span>}
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span className={`ml-1 ${uiTokens.segmented.count}`}>({item.count})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
