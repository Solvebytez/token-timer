import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { TokenEntry, TokenSummary, ActiveTab } from "./types"

interface TokenState {
  // State
  entries: TokenEntry[]
  activeTab: ActiveTab

  // Actions
  addEntry: (number: number, quantity: number) => void
  addEntries: (entries: Array<{ number: number; quantity: number }>) => void
  setActiveTab: (tab: ActiveTab) => void
  getTokenSummary: () => TokenSummary[]
  getRecentEntries: (minutes?: number) => TokenEntry[]
  getCounts: () => Record<number, number>
  clearEntries: () => void
}

const FIFTEEN_MINUTES = 15 * 60 * 1000

// Helper function to calculate counts from entries
function calculateCounts(entries: TokenEntry[]): Record<number, number> {
  const now = Date.now()
  const fifteenMinutesAgo = now - FIFTEEN_MINUTES

  const recentEntries = entries.filter((entry) => entry.timestamp > fifteenMinutesAgo)

  const newCounts: Record<number, number> = {}
  for (let i = 0; i < 10; i++) {
    newCounts[i] = 0
  }

  recentEntries.forEach((entry) => {
    newCounts[entry.number] += entry.quantity
  })

  return newCounts
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      // Initial state
      entries: [],
      activeTab: "history",

      // Add new entry
      addEntry: (number: number, quantity: number) => {
        const newEntry: TokenEntry = {
          number,
          quantity,
          timestamp: Date.now(),
        }

        set((state) => ({
          entries: [...state.entries, newEntry],
        }))
      },

      // Add multiple entries with the same timestamp (for batch submissions)
      addEntries: (entriesToAdd: Array<{ number: number; quantity: number }>) => {
        const timestamp = Date.now()
        const newEntries: TokenEntry[] = entriesToAdd.map(({ number, quantity }) => ({
          number,
          quantity,
          timestamp,
        }))

        console.log('💾 Adding entries to store:', {
          count: newEntries.length,
          entries: newEntries.map(e => `#${e.number} (qty: ${e.quantity})`),
          timestamp
        })

        set((state) => ({
          entries: [...state.entries, ...newEntries],
        }))
      },

      // Set active tab
      setActiveTab: (tab: ActiveTab) => {
        set({ activeTab: tab })
      },

      // Get counts (computed from entries based on 15-minute window)
      getCounts: () => {
        const { entries } = get()
        return calculateCounts(entries)
      },

      // Get token summary grouped by number
      getTokenSummary: () => {
        const { entries } = get()
        const summary: Record<number, { count: number; quantity: number; lastTimestamp: number }> = {}

        entries.forEach((entry) => {
          if (!summary[entry.number]) {
            summary[entry.number] = {
              count: 0,
              quantity: 0,
              lastTimestamp: entry.timestamp,
            }
          }
          summary[entry.number].count += 1
          summary[entry.number].quantity += entry.quantity
          summary[entry.number].lastTimestamp = Math.max(
            summary[entry.number].lastTimestamp,
            entry.timestamp
          )
        })

        return Object.entries(summary)
          .map(([num, data]) => ({ number: Number(num), ...data }))
          .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
      },

      // Get entries from last N minutes
      getRecentEntries: (minutes: number = 15) => {
        const { entries } = get()
        const now = Date.now()
        const timeWindow = minutes * 60 * 1000
        const cutoffTime = now - timeWindow

        return entries.filter((entry) => entry.timestamp > cutoffTime)
      },

      // Clear all entries
      clearEntries: () => {
        set({ entries: [] })
      },
    }),
    {
      name: "token-storage", // localStorage key
      partialize: (state) => ({
        entries: state.entries,
        activeTab: state.activeTab,
      }),
    }
  )
)

