interface CoverageIndicatorProps {
  assigned: number
  needed: number
  label: string
}

export function CoverageIndicator({ assigned, needed, label }: CoverageIndicatorProps) {
  const isFull = assigned >= needed
  const isEmpty = assigned === 0

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: needed }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              i < assigned ? (isFull ? 'bg-green-500' : 'bg-orange-400') : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <span
        className={`text-xs font-medium ${
          isFull ? 'text-green-600' : isEmpty ? 'text-red-500' : 'text-orange-500'
        }`}
      >
        {assigned}/{needed}
      </span>
    </div>
  )
}
