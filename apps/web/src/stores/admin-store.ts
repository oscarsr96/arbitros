import { create } from 'zustand'
import type { OptimizationState, Proposal, SolverParameters } from '@/lib/types'

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

  // Optimization state — multi-proposal
  optimizationState: OptimizationState
  solverParameters: SolverParameters
  proposals: Proposal[]
  activeProposalId: string | null
  showDiff: boolean

  setSolverParameters: (params: Partial<SolverParameters>) => void
  setProposals: (proposals: Proposal[]) => void
  setActiveProposalId: (id: string | null) => void
  deleteProposal: (id: string) => void
  setOptimizationState: (state: OptimizationState) => void
  setShowDiff: (show: boolean) => void
  clearAllProposals: () => void
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

const defaultSolverParameters: SolverParameters = {
  costWeight: 0.7,
  balanceWeight: 0.3,
  maxMatchesPerPerson: 3,
  forceExisting: true,
  numProposals: 3,
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

  // Optimization — multi-proposal
  optimizationState: 'idle',
  solverParameters: { ...defaultSolverParameters },
  proposals: [],
  activeProposalId: null,
  showDiff: true,

  setSolverParameters: (params) =>
    set((state) => ({
      solverParameters: { ...state.solverParameters, ...params },
    })),

  setProposals: (proposals) =>
    set({
      optimizationState: 'done',
      proposals,
      activeProposalId: proposals.length > 0 ? proposals[0].id : null,
      showDiff: true,
    }),

  setActiveProposalId: (id) => set({ activeProposalId: id }),

  deleteProposal: (id) =>
    set((state) => {
      const next = state.proposals.filter((p) => p.id !== id)
      const newActiveId =
        state.activeProposalId === id
          ? next.length > 0
            ? next[0].id
            : null
          : state.activeProposalId
      return {
        proposals: next,
        activeProposalId: newActiveId,
        // If no proposals left, reset to idle
        ...(next.length === 0
          ? { optimizationState: 'idle' as OptimizationState, showDiff: true }
          : {}),
      }
    }),

  setOptimizationState: (state) => set({ optimizationState: state }),

  setShowDiff: (show) => set({ showDiff: show }),

  clearAllProposals: () =>
    set({
      optimizationState: 'idle',
      proposals: [],
      activeProposalId: null,
      showDiff: true,
    }),
}))
