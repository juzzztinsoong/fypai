import {
  getSegmentedActiveClass,
  getSegmentedBaseClass,
  getSegmentedInactiveClass,
  type SegmentedAccent,
  type SegmentedStyle,
  uiTokens,
} from '@/styles/uiTokens'

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
  styleVariant?: SegmentedStyle
  className?: string
}

export function SegmentedControl<TKey extends string>({
  items,
  activeKey,
  onChange,
  wrap = false,
  styleVariant = 'solid',
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
        const accent = item.accent || 'brand'
        const stateClassName = isActive
          ? getSegmentedActiveClass(accent, styleVariant)
          : getSegmentedInactiveClass(accent, styleVariant)

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={isActive}
            className={`${getSegmentedBaseClass(styleVariant)} ${stateClassName}`}
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
