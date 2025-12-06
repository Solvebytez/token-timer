"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useTokenStore } from "@/stores/token-store";
import { useAuthStore } from "@/stores/auth-store";
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
  const [isSavingOnClose, setIsSavingOnClose] = useState(false);

  // Zustand store - using direct store access for actions to ensure reactivity
  const entries = useTokenStore((state) => state.entries);
  const activeTab = useTokenStore((state) => state.activeTab);
  const addEntry = useTokenStore((state) => state.addEntry);
  const setActiveTab = useTokenStore((state) => state.setActiveTab);
  const getTokenSummary = useTokenStore((state) => state.getTokenSummary);
  const getCounts = useTokenStore((state) => state.getCounts);
  const clearEntries = useTokenStore((state) => state.clearEntries);

  // Check and refresh token on page load if access token is expired
  useEffect(() => {
    const checkAndRefreshToken = async () => {
      const authState = useAuthStore.getState();
      const { accessToken, refreshToken } = authState;
      
      // If access token is missing but refresh token exists, refresh it
      if (!accessToken && refreshToken) {
        console.log('🔄 Access token missing on page load, attempting to refresh...');
        try {
          const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
          const response = await fetch(`${API_BASE_URL}/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${refreshToken}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.access_token) {
              // Update both access and refresh tokens (backend now rotates refresh token)
              const newAccessToken = data.data.access_token;
              const newRefreshToken = data.data.refresh_token || refreshToken; // Use new if provided, fallback to old
              useAuthStore.getState().updateTokens(newAccessToken, newRefreshToken);
              console.log('✅ Token refreshed successfully on page load');
            }
          } else {
            console.error('❌ Token refresh failed on page load');
            // Refresh failed, clear auth
            useAuthStore.getState().clearAuth();
          }
        } catch (error) {
          console.error('❌ Error refreshing token on page load:', error);
          useAuthStore.getState().clearAuth();
        }
      }
    };
    
    checkAndRefreshToken();
  }, []);

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

  // Manual save function (for "Save Now" button)
  const handleManualSave = async () => {
    if (entries.length === 0) {
      setShowCloseWarning(false);
      return;
    }

    // Group entries by time slot and save each
    const entriesBySlot: Record<string, typeof entries> = {};
    const slotDates: Record<string, Date> = {};
    
    entries.forEach((entry) => {
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

    // Save each slot
    for (const [slotKey, slotEntries] of Object.entries(entriesBySlot)) {
      const [dateStr, timeSlot] = slotKey.split('_');
      const slotDate = slotDates[slotKey];
      const data = prepareDataForBackend(timeSlot, slotEntries, slotDate);
      await saveToBackend(data, slotEntries);
    }

    // Close the warning modal
    setShowCloseWarning(false);
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

  // Save data on browser close using navigator.sendBeacon (more reliable than fetch)
  const saveOnClose = () => {
    // Prevent duplicate saves if both beforeunload and visibilitychange fire
    if (isSavingOnClose) {
      console.log('⏸️ Save already in progress, skipping duplicate call');
      return;
    }
    
    console.log('🔄 saveOnClose called - attempting to save data on close');
    setIsSavingOnClose(true);
    
    // Get latest entries from store (not from closure)
    const currentEntries = useTokenStore.getState().entries;
    console.log('📊 Current entries count:', currentEntries.length);
    
    if (currentEntries.length === 0) {
      console.log('⚠️ No entries to save');
      setIsSavingOnClose(false);
      return;
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Get tokens from auth store
    const authState = useAuthStore.getState();
    let accessToken = authState.accessToken;
    const refreshToken = authState.refreshToken;
    
    console.log('🔑 Access token present:', accessToken ? 'Yes' : 'No');
    console.log('🔑 Refresh token present:', refreshToken ? 'Yes' : 'No');
    
    // If access token is missing, use refresh token as fallback
    // The backend should accept refresh tokens for save operations
    const tokenToUse = accessToken || refreshToken;
    
    if (!tokenToUse) {
      console.error('❌ No access token or refresh token available - cannot save');
      setIsSavingOnClose(false);
      return; // No token, can't save
    }
    
    if (!accessToken && refreshToken) {
      console.log('⚠️ Using refresh token as fallback (access token expired)');
    }

    try {
      // Group entries by time slot
      const entriesBySlot: Record<string, typeof currentEntries> = {};
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

      console.log('📦 Grouped entries into', Object.keys(entriesBySlot).length, 'time slots');

      // Collect all entries that we're attempting to save
      const allEntriesToSave: typeof currentEntries = [];
      Object.values(entriesBySlot).forEach(slotEntries => {
        slotEntries.forEach(entry => {
          if (!allEntriesToSave.some(e => e.timestamp === entry.timestamp)) {
            allEntriesToSave.push(entry);
          }
        });
      });

      // Save each slot using fetch with keepalive (required for Authorization header)
      let completedCount = 0;
      let successCount = 0;
      const totalSlots = Object.keys(entriesBySlot).length;
      
      Object.entries(entriesBySlot).forEach(([slotKey, slotEntries]) => {
        const [dateStr, timeSlot] = slotKey.split('_');
        const slotDate = slotDates[slotKey];
        const data = prepareDataForBackend(timeSlot, slotEntries, slotDate);
        
        console.log(`📤 Sending data for slot ${timeSlot} to backend...`);
        
        // Use fetch with keepalive - this is the only way to send Authorization header
        // Note: This must be synchronous (no await) for beforeunload
        fetch(`${API_BASE_URL}/token-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`,
          },
          body: JSON.stringify(data),
          keepalive: true, // Critical: allows request to complete after page closes
        }).then((response) => {
          console.log(`✅ Fetch response for slot ${timeSlot}:`, response.status, response.statusText);
          if (response.ok) {
            // 200 OK (updated) or 201 Created (new) = success
            successCount++;
            const action = response.status === 200 ? 'updated' : 'saved';
            console.log(`✅ Successfully ${action} slot ${timeSlot}`);
          } else {
            console.error(`❌ Failed to save slot ${timeSlot}:`, response.status);
          }
          
          completedCount++;
          // Remove ALL entries from store after all requests complete
          // Only remove if all saves succeeded (or were already saved - 409)
          // If any save failed, keep entries so they can be saved on reopen
          if (completedCount === totalSlots) {
            if (successCount === totalSlots) {
              // All saves succeeded - remove all entries
              const remainingEntries = useTokenStore.getState().entries.filter(
                (entry) => !allEntriesToSave.some((e) => e.timestamp === entry.timestamp)
              );
              useTokenStore.setState({ entries: remainingEntries });
              console.log(`🗑️ All entries saved successfully - removed ${allEntriesToSave.length} entries from local storage`);
            } else {
              // Some saves failed - keep entries for retry on reopen
              console.log(`⚠️ Some saves failed (${successCount}/${totalSlots} succeeded) - keeping entries for retry on reopen`);
            }
            setIsSavingOnClose(false);
          }
        }).catch((error) => {
          console.error(`❌ Fetch error for slot ${timeSlot}:`, error);
          completedCount++;
          // Keep entries if there's an error - they'll be saved on reopen
          if (completedCount === totalSlots) {
            console.log(`⚠️ Some saves had errors - keeping entries for retry on reopen`);
            setIsSavingOnClose(false);
          }
        });
      });
      
      console.log(`💾 Initiated save requests for ${totalSlots} time slots (${allEntriesToSave.length} total entries)`);
    } catch (error) {
      console.error('❌ Error in saveOnClose:', error);
    }
  };

  // Handle browser close/tab close with warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('🚪 beforeunload event triggered, entries count:', entries.length);
      
      // Only show warning if there are unsaved entries
      if (entries.length > 0) {
        console.log('💾 Attempting to save data before close...');
        // Attempt to save data before closing
        saveOnClose();
        
        // Trigger browser default dialog
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      } else {
        console.log('✅ No unsaved entries, no save needed');
      }
    };

    // Also handle visibility change (fires when page becomes hidden)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && entries.length > 0) {
        console.log('👁️ Page hidden - attempting to save data...');
        saveOnClose();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [entries]);

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

  // Handle TNO input - only allow numbers 0-9
  const handleTnoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow single digit numbers (0-9)
    if (value === "" || /^[0-9]$/.test(value)) {
      setTno(value);
    }
  };

  // Handle Quantity input - only allow positive numbers
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers (no decimals, no negative)
    if (value === "" || /^\d+$/.test(value)) {
      setQuantity(value);
    }
  };

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

  // Prevent non-numeric keys for TNO input
  const handleTnoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, and arrow keys
    if (
      ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
    ) {
      return;
    }
    // Allow Ctrl/Cmd + A, C, V, X
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
      return;
    }
    // Only allow numbers 0-9
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // Prevent non-numeric keys for Quantity input
  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, and arrow keys
    if (
      ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
    ) {
      return;
    }
    // Allow Ctrl/Cmd + A, C, V, X
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
      return;
    }
    // Only allow numbers 0-9
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // Handle paste for TNO - filter to only numbers 0-9
  const handleTnoPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const numericOnly = pastedText.replace(/[^0-9]/g, '').slice(0, 1); // Only first digit
    if (numericOnly) {
      setTno(numericOnly);
    }
  };

  // Handle paste for Quantity - filter to only numbers
  const handleQuantityPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const numericOnly = pastedText.replace(/[^0-9]/g, ''); // Remove all non-numeric
    if (numericOnly) {
      setQuantity(numericOnly);
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 0 }}>
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
                    inputMode="numeric"
                    value={tno}
                    onChange={handleTnoChange}
                    onKeyDown={handleTnoKeyDown}
                    onKeyPress={handleKeyPress}
                    onPaste={handleTnoPaste}
                    placeholder="0-9"
                    maxLength={1}
                    pattern="[0-9]"
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
                    inputMode="numeric"
                    value={quantity}
                    onChange={handleQuantityChange}
                    onKeyDown={handleQuantityKeyDown}
                    onKeyPress={handleKeyPress}
                    onPaste={handleQuantityPaste}
                    placeholder="0"
                    pattern="[0-9]*"
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
              {/* Green Number Row */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-2">
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center bg-retro-green border-3 border-retro-accent px-3 sm:px-6 py-4 rounded-lg"
                  >
                    <div className="text-2xl font-bold text-white">{i}</div>
                  </div>
                ))}
              </div>
              {/* Quantity Boxes Row - Outside green container */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {Array.from({ length: 10 }, (_, i) => {
                  // Different colors for each number
                  const colors = [
                    'text-blue-600',      // 0 - Blue
                    'text-red-600',       // 1 - Red
                    'text-green-600',     // 2 - Green
                    'text-yellow-600',     // 3 - Yellow
                    'text-purple-600',    // 4 - Purple
                    'text-pink-600',      // 5 - Pink
                    'text-orange-600',    // 6 - Orange
                    'text-indigo-600',    // 7 - Indigo
                    'text-teal-600',      // 8 - Teal
                    'text-cyan-600',      // 9 - Cyan
                  ];
                  
                  return (
                    <div
                      key={i}
                      className="bg-white font-bold text-xl sm:text-2xl px-2 sm:px-4 py-2 rounded min-h-12 flex items-center justify-center border-2 border-retro-dark"
                    >
                      <span className={colors[i]}>
                        {counts[i] || 0}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-retro-cream border-4 border-retro-dark rounded-lg flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 200px)', height: '100%' }}>
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
              <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '400px', minHeight: 0 }}>
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
