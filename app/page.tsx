"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useTokenStore } from "@/stores/token-store";
import { tokenDataApi } from "@/lib/api-services";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Home() {
  const [tno, setTno] = useState("");
  const [quantity, setQuantity] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastSavedTimeSlot, setLastSavedTimeSlot] = useState<string | null>(null);
  const [showCloseWarning, setShowCloseWarning] = useState(false);

  // Zustand store - using direct store access for actions to ensure reactivity
  const entries = useTokenStore((state) => state.entries);
  const activeTab = useTokenStore((state) => state.activeTab);
  const addEntry = useTokenStore((state) => state.addEntry);
  const setActiveTab = useTokenStore((state) => state.setActiveTab);
  const getTokenSummary = useTokenStore((state) => state.getTokenSummary);
  const getCounts = useTokenStore((state) => state.getCounts);
  const clearEntries = useTokenStore((state) => state.clearEntries);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate time slots: 9:00-11:00 AM (15min) and 11:00 AM-9:40 PM (20min)
  const generateTimeSlots = (): string[] => {
    const slots: string[] = [];
    
    // 9:00 AM to 11:00 AM - 15 minute intervals
    for (let hour = 9; hour < 11; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    // 11:00 AM
    slots.push("11:00");
    
    // 11:00 AM to 9:40 PM - 20 minute intervals
    for (let hour = 11; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 20) {
        // Stop at 9:40 PM (21:40)
        if (hour === 21 && minute > 40) break;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
        // Break after 21:40
        if (hour === 21 && minute === 40) break;
      }
      // Break outer loop after 21:40
      if (hour === 21) break;
    }
    
    return slots;
  };

  // Check if current time matches a time slot
  const checkTimeSlot = (time: Date): string | null => {
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();
    
    // Only check at the start of the minute (when seconds = 0)
    if (seconds !== 0) return null;
    
    const currentTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const slots = generateTimeSlots();
    
    if (slots.includes(currentTimeStr)) {
      return currentTimeStr;
    }
    
    return null;
  };

  // Determine which time slot an entry belongs to based on its timestamp
  const getTimeSlotForEntry = (entryTimestamp: number): string | null => {
    const entryDate = new Date(entryTimestamp);
    const entryHours = entryDate.getHours();
    const entryMinutes = entryDate.getMinutes();
    const entryTime = entryHours * 60 + entryMinutes;
    
    const slots = generateTimeSlots();
    
    // Find the smallest time slot that is >= entry time
    // Entry belongs to the next slot that comes after or at its time
    for (let i = 0; i < slots.length; i++) {
      const [slotHour, slotMinute] = slots[i].split(':').map(Number);
      const slotTime = slotHour * 60 + slotMinute;
      
      // If this is the first slot and entry is before or at it
      if (i === 0 && entryTime <= slotTime) {
        return slots[0];
      }
      
      // If entry is after previous slot and <= current slot, it belongs to current slot
      if (i > 0) {
        const [prevHour, prevMinute] = slots[i - 1].split(':').map(Number);
        const prevSlotTime = prevHour * 60 + prevMinute;
        
        if (entryTime > prevSlotTime && entryTime <= slotTime) {
          return slots[i];
        }
      }
    }
    
    // If entry is after all slots, it belongs to the last slot
    if (slots.length > 0 && entryTime > (() => {
      const [lastHour, lastMinute] = slots[slots.length - 1].split(':').map(Number);
      return lastHour * 60 + lastMinute;
    })()) {
      return slots[slots.length - 1];
    }
    
    return slots[0] || null; // Fallback to first slot
  };

  // Check if a time slot has passed
  const hasTimeSlotPassed = (timeSlot: string, entryDate: Date): boolean => {
    const now = new Date();
    const [slotHour, slotMinute] = timeSlot.split(':').map(Number);
    
    // Create date object for the time slot on the entry's date
    const slotDateTime = new Date(entryDate);
    slotDateTime.setHours(slotHour, slotMinute, 0, 0);
    
    // Time slot has passed if current time is after the slot time
    return now > slotDateTime;
  };

  // Prepare data with date + time slot identifier
  const prepareDataForBackend = (timeSlot: string, entriesToSave: typeof entries, entryDate: Date) => {
    const dateStr = entryDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeSlotId = `${dateStr}_${timeSlot}`;
    
    // Calculate counts for these specific entries
    const counts: Record<number, number> = {};
    for (let i = 0; i < 10; i++) {
      counts[i] = 0;
    }
    entriesToSave.forEach((entry) => {
      counts[entry.number] = (counts[entry.number] || 0) + entry.quantity;
    });
    
    return {
      timeSlotId,
      date: dateStr,
      timeSlot,
      entries: entriesToSave,
      counts,
      timestamp: new Date().toISOString(),
    };
  };

  // Save data to backend
  const saveToBackend = async (data: ReturnType<typeof prepareDataForBackend>, entriesToRemove: typeof entries) => {
    try {
      console.log("📤 Auto-saving data to backend:", data);
      
      const response = await tokenDataApi.save(data);
      
      if (response.success) {
        console.log("✅ Data saved successfully for time slot:", data.timeSlot);
        // Remove only the saved entries from store
        const remainingEntries = useTokenStore.getState().entries.filter(
          (entry) => !entriesToRemove.some((e) => e.timestamp === entry.timestamp)
        );
        useTokenStore.setState({ entries: remainingEntries });
        console.log("🗑️ Saved entries removed from local storage");
        return true;
      } else {
        console.error("❌ Failed to save data:", response.message);
        return false;
      }
    } catch (error: any) {
      console.error("❌ Error saving data:", error);
      // Keep data if save fails
      return false;
    }
  };

  // Check and save passed time slots on component mount (browser reopen)
  useEffect(() => {
    const checkAndSavePassedSlots = async () => {
      const currentEntries = useTokenStore.getState().entries;
      
      if (currentEntries.length === 0) {
        return; // No entries to save
      }

      // Group entries by their time slot
      const entriesBySlot: Record<string, typeof entries> = {};
      const slotDates: Record<string, Date> = {};
      
      currentEntries.forEach((entry) => {
        const entryDate = new Date(entry.timestamp);
        const timeSlot = getTimeSlotForEntry(entry.timestamp);
        
        if (timeSlot) {
          const slotKey = `${entryDate.toISOString().split('T')[0]}_${timeSlot}`;
          if (!entriesBySlot[slotKey]) {
            entriesBySlot[slotKey] = [];
            slotDates[slotKey] = entryDate;
          }
          entriesBySlot[slotKey].push(entry);
        }
      });

      // Check each slot and save if it has passed
      const now = new Date();
      const slotsToSave: Array<{ slot: string; entries: typeof entries; date: Date }> = [];
      
      Object.keys(entriesBySlot).forEach((slotKey) => {
        const [dateStr, timeSlot] = slotKey.split('_');
        const slotDate = slotDates[slotKey];
        
        if (hasTimeSlotPassed(timeSlot, slotDate)) {
          slotsToSave.push({
            slot: timeSlot,
            entries: entriesBySlot[slotKey],
            date: slotDate,
          });
        }
      });

      // Save each passed slot
      if (slotsToSave.length > 0) {
        console.log(`🔄 Found ${slotsToSave.length} passed time slot(s) to save`);
        
        for (const { slot, entries: slotEntries, date } of slotsToSave) {
          const data = prepareDataForBackend(slot, slotEntries, date);
          await saveToBackend(data, slotEntries);
        }
      }
    };

    // Run check on mount (browser reopen)
    checkAndSavePassedSlots();
  }, []); // Only run on mount

  // Handle browser close/tab close with warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show warning if there are unsaved entries
      if (entries.length > 0) {
        // Trigger browser default dialog
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [entries.length]);

  // Monitor clock and detect when time slot is reached
  useEffect(() => {
    const checkSlot = () => {
      const matchedSlot = checkTimeSlot(currentTime);
      
      if (matchedSlot) {
        const dateStr = currentTime.toISOString().split('T')[0];
        const timeSlotId = `${dateStr}_${matchedSlot}`;
        
        // Prevent duplicate saves for the same time slot
        if (lastSavedTimeSlot !== timeSlotId) {
          // Only save if there are entries
          if (entries.length > 0) {
            const entryDate = entries.length > 0 ? new Date(entries[0].timestamp) : new Date();
            const data = prepareDataForBackend(matchedSlot, entries, entryDate);
            saveToBackend(data, entries);
            setLastSavedTimeSlot(timeSlotId);
          }
        }
      }
    };
    
    checkSlot();
  }, [currentTime, entries.length, lastSavedTimeSlot]);

  // Handle tab change
  const handleSetActiveTab = (tab: "history" | "myTokens") => {
    setActiveTab(tab);
  };

  // Get counts (recalculated on every render to reflect current 15-min window)
  const counts = getCounts();

  const handleRefresh = () => {
    if (tno === "" || quantity === "") return;

    const num = Number.parseInt(tno);
    const qty = Number.parseInt(quantity);

    if (num >= 0 && num <= 9 && qty > 0) {
      addEntry(num, qty);
      setTno("");
      setQuantity("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRefresh();
    }
  };

  const tokenSummary = getTokenSummary();

  return (
    <>
      {/* Close Warning Modal */}
      <AlertDialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <AlertDialogContent className="bg-retro-cream border-4 border-retro-dark">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-retro-dark">
              Unsaved Entries
            </AlertDialogTitle>
            <AlertDialogDescription className="text-retro-dark/80 text-lg">
              You have {entries.length} unsaved {entries.length === 1 ? 'entry' : 'entries'}. 
              Your data will be automatically saved when you return, but you can save now if you prefer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel
              onClick={() => {
                setShowCloseWarning(false);
              }}
              className="bg-retro-accent border-2 border-retro-dark text-retro-dark font-bold hover:bg-opacity-90"
            >
              Stay on Page
            </AlertDialogCancel>
            <button
              onClick={handleManualSave}
              className="bg-retro-green border-2 border-retro-dark text-white font-bold px-4 py-2 rounded-lg hover:bg-opacity-90 transition-all"
            >
              Save Now
            </button>
            <AlertDialogAction
              onClick={() => {
                setShowCloseWarning(false);
                // User chose to leave - browser dialog will also appear from beforeunload
                // Data will be auto-saved when they return
              }}
              className="bg-red-500 border-2 border-retro-dark text-white font-bold hover:bg-red-600"
            >
              Leave Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-retro-beige p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-retro-dark mb-2">
              Token Tracker
            </h1>
            <p className="text-retro-dark/70">
              Track token frequency over 15 minutes
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-retro-dark font-mono">
              {currentTime.toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Input and Counter */}
          <div className="lg:col-span-2">
            {/* Input Section */}
            <div className="bg-retro-cream border-4 border-retro-dark p-6 mb-8 rounded-lg">
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* TNO Input */}
                <div>
                  <label className="block text-sm font-bold text-retro-dark mb-2">
                    TNO
                  </label>
                  <input
                    type="text"
                    value={tno}
                    onChange={(e) => setTno(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="0-9"
                    maxLength={1}
                    className="w-full px-4 py-3 bg-white border-3 border-retro-dark text-retro-dark font-bold text-2xl text-center rounded"
                  />
                </div>

                {/* Quantity Input */}
                <div>
                  <label className="block text-sm font-bold text-retro-dark mb-2">
                    QUANTITY
                  </label>
                  <input
                    type="text"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-white border-3 border-retro-dark text-retro-dark font-bold text-2xl text-center rounded"
                  />
                </div>
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                className="w-full bg-retro-accent border-4 border-retro-dark text-retro-dark font-bold text-lg py-3 rounded-lg hover:bg-opacity-90 transition-all active:scale-95"
              >
                REFRESH
              </button>
            </div>

            {/* Counter Display */}
            <div className="bg-retro-dark border-4 border-retro-accent p-6 rounded-lg">
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 bg-retro-green border-3 border-retro-accent px-3 sm:px-6 py-4 rounded-lg"
                  >
                    <div className="text-2xl font-bold text-white">{i}</div>
                    <div className="bg-white text-retro-dark font-bold text-xl sm:text-2xl px-2 sm:px-4 py-2 rounded min-h-12 flex items-center justify-center w-full">
                      {counts[i] || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-retro-cream border-4 border-retro-dark rounded-lg h-full flex flex-col overflow-hidden">
              <div className="flex border-b-4 border-retro-dark">
                <button
                  type="button"
                  onClick={() => handleSetActiveTab("history")}
                  className={`flex-1 font-bold text-center py-3 border-r-2 border-retro-dark transition-all ${
                    activeTab === "history"
                      ? "bg-retro-accent text-retro-dark"
                      : "bg-retro-cream text-retro-dark hover:bg-opacity-80"
                  }`}
                >
                  HISTORY
                </button>
                <button
                  type="button"
                  onClick={() => handleSetActiveTab("myTokens")}
                  className={`flex-1 font-bold text-center py-3 transition-all ${
                    activeTab === "myTokens"
                      ? "bg-retro-accent text-retro-dark"
                      : "bg-retro-cream text-retro-dark hover:bg-opacity-80"
                  }`}
                >
                  MY TOKENS
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* History Tab */}
                {activeTab === "history" && (
                  <div className="space-y-2">
                    {entries.length === 0 ? (
                      <p className="text-center text-retro-dark/60 py-8">
                        No entries yet
                      </p>
                    ) : (
                      [...entries].reverse().map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-1 bg-white border-2 border-retro-dark px-3 py-2 rounded"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-retro-dark text-lg">
                              #{entry.number}
                            </span>
                            <span className="text-retro-accent font-bold text-lg">
                              ×{entry.quantity}
                            </span>
                          </div>
                          <span className="text-xs text-retro-dark/60">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* My Tokens Tab */}
                {activeTab === "myTokens" && (
                  <div className="space-y-2">
                    {tokenSummary.length === 0 ? (
                      <p className="text-center text-retro-dark/60 py-8">
                        No tokens recorded yet
                      </p>
                    ) : (
                      tokenSummary.map((token) => (
                        <div
                          key={token.number}
                          className="flex flex-col gap-1 bg-retro-green border-3 border-retro-dark px-3 py-2 rounded"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white text-lg">
                              Token #{token.number}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm text-white">
                            <span>Entries: {token.count}</span>
                            <span>Total Qty: {token.quantity}</span>
                          </div>
                          <span className="text-xs text-white/70">
                            {new Date(token.lastTimestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
