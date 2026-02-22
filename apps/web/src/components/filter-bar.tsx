'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FilterOption {
  value: string
  label: string
}

interface FilterDef {
  key: string
  label: string
  options: FilterOption[]
}

interface FilterBarProps {
  filters: FilterDef[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onReset?: () => void
}

export function FilterBar({ filters, values, onChange, onReset }: FilterBarProps) {
  const hasActiveFilters = Object.values(values).some((v) => v !== '')

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={values[filter.key] || 'all'}
          onValueChange={(v) => onChange(filter.key, v === 'all' ? '' : v)}
        >
          <SelectTrigger className="h-9 w-36 text-xs">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filter.label}: Todos</SelectItem>
            {filter.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {hasActiveFilters && onReset && (
        <button onClick={onReset} className="text-xs font-medium text-gray-500 hover:text-gray-700">
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
