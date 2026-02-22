import { create } from 'zustand'
import { DEMO_PERSON_ID } from '@/lib/mock-data'

interface PortalState {
  currentPersonId: string
  selectedWeekStart: string | null
  setCurrentPersonId: (id: string) => void
  setSelectedWeekStart: (weekStart: string) => void
}

function getNextMondayStr(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 7
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export const usePortalStore = create<PortalState>((set) => ({
  currentPersonId: DEMO_PERSON_ID,
  selectedWeekStart: getNextMondayStr(),
  setCurrentPersonId: (id) => set({ currentPersonId: id }),
  setSelectedWeekStart: (weekStart) => set({ selectedWeekStart: weekStart }),
}))
