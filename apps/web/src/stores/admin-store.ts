import { create } from 'zustand'

interface AdminState {
  // Matchday selection
  selectedMatchday: number
  setSelectedMatchday: (matchday: number) => void

  // Match detail
  selectedMatchId: string | null
  setSelectedMatchId: (id: string | null) => void

  // Expanded matches in list
  expandedMatchIds: Set<string>
  toggleExpandedMatch: (id: string) => void

  // Active assignment slot
  activeSlot: { matchId: string; role: 'arbitro' | 'anotador' } | null
  setActiveSlot: (slot: { matchId: string; role: 'arbitro' | 'anotador' } | null) => void

  // Match filters
  matchFilters: {
    day: string // '' = all, 'saturday', 'sunday'
    category: string // '' = all, competition category
    municipality: string // '' = all, municipality id
    coverage: string // '' = all, 'covered', 'partial', 'uncovered'
  }
  setMatchFilter: (key: string, value: string) => void
  resetMatchFilters: () => void

  // Personal filters
  personalFilters: {
    role: string // '' = all, 'arbitro', 'anotador'
    category: string
    municipality: string
    search: string
  }
  setPersonalFilter: (key: string, value: string) => void
  resetPersonalFilters: () => void

  // Person detail sheet
  selectedPersonId: string | null
  setSelectedPersonId: (id: string | null) => void
}

const defaultMatchFilters = {
  day: '',
  category: '',
  municipality: '',
  coverage: '',
}

const defaultPersonalFilters = {
  role: '',
  category: '',
  municipality: '',
  search: '',
}

export const useAdminStore = create<AdminState>((set) => ({
  selectedMatchday: 15,
  setSelectedMatchday: (matchday) => set({ selectedMatchday: matchday }),

  selectedMatchId: null,
  setSelectedMatchId: (id) => set({ selectedMatchId: id }),

  expandedMatchIds: new Set(),
  toggleExpandedMatch: (id) =>
    set((state) => {
      const next = new Set(state.expandedMatchIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { expandedMatchIds: next }
    }),

  activeSlot: null,
  setActiveSlot: (slot) => set({ activeSlot: slot }),

  matchFilters: { ...defaultMatchFilters },
  setMatchFilter: (key, value) =>
    set((state) => ({
      matchFilters: { ...state.matchFilters, [key]: value },
    })),
  resetMatchFilters: () => set({ matchFilters: { ...defaultMatchFilters } }),

  personalFilters: { ...defaultPersonalFilters },
  setPersonalFilter: (key, value) =>
    set((state) => ({
      personalFilters: { ...state.personalFilters, [key]: value },
    })),
  resetPersonalFilters: () => set({ personalFilters: { ...defaultPersonalFilters } }),

  selectedPersonId: null,
  setSelectedPersonId: (id) => set({ selectedPersonId: id }),
}))
