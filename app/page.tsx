"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, ArrowDown, MoreVertical, LogOut, Download } from "lucide-react";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { authApi } from "@/lib/api-services";

// Flip-clock digit component with slide animation
function FlipDigit({ digit, prevDigit }: { digit: number; prevDigit: number }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayDigit, setDisplayDigit] = useState(digit);

  useEffect(() => {
    if (digit !== prevDigit && prevDigit !== undefined) {
      setIsAnimating(true);
      // Wait for animation to start, then update digit
      setTimeout(() => {
        setDisplayDigit(digit);
      }, 150); // Half of animation duration
      // Reset animation after it completes
      setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    } else if (prevDigit === undefined) {
      // Initial render
      setDisplayDigit(digit);
    }
  }, [digit, prevDigit]);

  return (
    <div className="relative w-12 h-16 bg-retro-dark rounded overflow-hidden border-2 border-retro-accent shadow-lg">
      {/* Top half with current digit */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className={`w-full h-full flex items-center justify-center text-2xl font-bold text-retro-accent font-mono transition-transform duration-300 ease-in-out ${
            isAnimating ? 'transform -translate-y-full' : 'transform translate-y-0'
          }`}
        >
          {displayDigit}
        </div>
      </div>
      {/* Bottom half with new digit (only visible during animation) */}
      {isAnimating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-retro-accent font-mono transform translate-y-full transition-transform duration-300 ease-in-out">
            {digit}
          </div>
        </div>
      )}
      {/* Middle divider line */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-retro-accent/30 transform -translate-y-1/2 z-10"></div>
    </div>
  );
}

export default function Home() {
  const [tno, setTno] = useState("");
  const [quantity, setQuantity] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [countdown, setCountdown] = useState({ minutes: 0, seconds: 0 });
  const [prevCountdown, setPrevCountdown] = useState({ minutes: 0, seconds: 0 });
  
  // Refs for auto-focus
  const tnoInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  
  // Toast hook
  const { toast } = useToast();
  
  // Router for navigation
  const router = useRouter();
  const [lastSavedTimeSlot, setLastSavedTimeSlot] = useState<string | null>(null);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [isSavingOnClose, setIsSavingOnClose] = useState(false);
  
  // Data table state
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tablePagination, setTablePagination] = useState({
    current_page: 1,
    per_page: 10,
    total: 0,
    last_page: 1,
  });
  const [tableFilters, setTableFilters] = useState({
    start_date: '',
    end_date: '',
    time_slot: '',
    page: 1,
  });
  const [tableSort, setTableSort] = useState<{
    column: string | null;
    direction: 'asc' | 'desc';
  }>({
    column: null,
    direction: 'asc',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  
  // Edit mode state - for inline table editing
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [editingCounts, setEditingCounts] = useState<Record<number, number>>({});
  
  // Show half quantity toggle - for table
  const [showHalfQuantity, setShowHalfQuantity] = useState(false);
  // Show half quantity toggle - for counter display
  const [showHalfQuantityCounter, setShowHalfQuantityCounter] = useState(false);

  // Zustand store - using direct store access for actions to ensure reactivity
  const entries = useTokenStore((state) => state.entries);
  const activeTab = useTokenStore((state) => state.activeTab);
  const addEntry = useTokenStore((state) => state.addEntry);
  const addEntries = useTokenStore((state) => state.addEntries);
  const setActiveTab = useTokenStore((state) => state.setActiveTab);
  const getTokenSummary = useTokenStore((state) => state.getTokenSummary);
  const getCounts = useTokenStore((state) => state.getCounts);
  const clearEntries = useTokenStore((state) => state.clearEntries);
  
  // Auth store
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

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
              const newAccessToken = typeof data.data.access_token === 'string' 
                ? data.data.access_token 
                : String(data.data.access_token);
              
              // Ensure refresh token is a string
              const newRefreshTokenRaw = data.data.refresh_token || refreshToken;
              const newRefreshToken = typeof newRefreshTokenRaw === 'string' 
                ? newRefreshTokenRaw 
                : String(newRefreshTokenRaw);
              
              // Validate tokens are not objects
              if (newAccessToken === '[object Object]' || newRefreshToken === '[object Object]') {
                console.error('❌ Invalid token format in refresh response:', data.data);
                useAuthStore.getState().clearAuth();
                return;
              }
              
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

  // Format time in IST timezone as "10:38:44 PM"
  const formatISTTime = (date: Date): string => {
    const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const seconds = istDate.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
  };

  // Get current active time slot and calculate countdown
  const getCurrentActiveSlot = (time: Date): { slot: string; endTime: Date; duration: number } | null => {
    const slots = generateTimeSlots();
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();
    const currentTimeMinutes = hours * 60 + minutes;
    
    // Find which slot we're currently in
    for (let i = 0; i < slots.length; i++) {
      const [slotHour, slotMinute] = slots[i].split(':').map(Number);
      const slotTimeMinutes = slotHour * 60 + slotMinute;
      
      // Check if we're at or past this slot
      if (currentTimeMinutes >= slotTimeMinutes) {
        // Check if there's a next slot
        if (i < slots.length - 1) {
          const [nextHour, nextMinute] = slots[i + 1].split(':').map(Number);
          const nextSlotTimeMinutes = nextHour * 60 + nextMinute;
          
          // If we're before the next slot, we're in the current slot
          if (currentTimeMinutes < nextSlotTimeMinutes) {
            // Calculate end time (start of next slot)
            const slotEndTime = new Date(time);
            slotEndTime.setHours(nextHour, nextMinute, 0, 0);
            // Duration is the difference between slots
            const duration = nextSlotTimeMinutes - slotTimeMinutes;
            return { slot: slots[i], endTime: slotEndTime, duration };
          }
        } else {
          // Last slot (21:40) - end at 22:00 (10:00 PM)
          if (currentTimeMinutes < 22 * 60) {
            const slotEndTime = new Date(time);
            slotEndTime.setHours(22, 0, 0, 0);
            const duration = 20; // Last slot is 20 minutes
            return { slot: slots[i], endTime: slotEndTime, duration };
          }
        }
      }
    }
    
    // If before first slot (before 9:00 AM), show countdown to first slot
    if (currentTimeMinutes < 9 * 60) {
      const firstSlotEndTime = new Date(time);
      firstSlotEndTime.setHours(9, 0, 0, 0);
      return { slot: slots[0] || '09:00', endTime: firstSlotEndTime, duration: 15 };
    }
    
    // If after last slot (after 22:00), show countdown to next day's first slot
    if (currentTimeMinutes >= 22 * 60) {
      const nextDayFirstSlot = new Date(time);
      nextDayFirstSlot.setDate(nextDayFirstSlot.getDate() + 1);
      nextDayFirstSlot.setHours(9, 0, 0, 0);
      return { slot: 'Next Day 09:00', endTime: nextDayFirstSlot, duration: 15 };
    }
    
    return null;
  };

  // Update clock and countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      // Calculate countdown
      const activeSlot = getCurrentActiveSlot(now);
      if (activeSlot) {
        const nowTime = now.getTime();
        const endTime = activeSlot.endTime.getTime();
        const remainingMs = endTime - nowTime;
        
        if (remainingMs > 0) {
          const remainingSeconds = Math.floor(remainingMs / 1000);
          const minutes = Math.floor(remainingSeconds / 60);
          const seconds = remainingSeconds % 60;
          
          // Update previous countdown before setting new one
          setCountdown(prev => {
            setPrevCountdown(prev);
            return { minutes, seconds };
          });
        } else {
          // Slot ended, will update on next interval
          setCountdown(prev => {
            setPrevCountdown(prev);
            return { minutes: 0, seconds: 0 };
          });
        }
      } else {
        setCountdown(prev => {
          setPrevCountdown(prev);
          return { minutes: 0, seconds: 0 };
        });
      }
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
    // 11:00 AM (only add once)
    slots.push("11:00");
    
    // 11:00 AM to 9:40 PM - 20 minute intervals (start from 11:20 to avoid duplicate 11:00)
    for (let hour = 11; hour < 22; hour++) {
      // For hour 11, start from minute 20 to avoid duplicate 11:00
      const startMinute = hour === 11 ? 20 : 0;
      for (let minute = startMinute; minute < 60; minute += 20) {
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

  // Save data to backend using TanStack Query mutation
  const saveMutation = useMutation({
    mutationFn: async ({ data, entriesToRemove, showToast }: { 
      data: ReturnType<typeof prepareDataForBackend>, 
      entriesToRemove: typeof entries, 
      showToast: boolean 
    }) => {
      console.log("📤 Auto-saving data to backend:", data);
      const response = await tokenDataApi.save(data);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to save data');
      }
      
      return { data, entriesToRemove, showToast, timeSlot: data.timeSlot };
    },
    onSuccess: ({ data, entriesToRemove, showToast, timeSlot }) => {
      console.log("✅ Data saved successfully for time slot:", timeSlot);
      
      // Remove only the saved entries from store
      const remainingEntries = useTokenStore.getState().entries.filter(
        (entry) => !entriesToRemove.some((e) => e.timestamp === entry.timestamp)
      );
      useTokenStore.setState({ entries: remainingEntries });
      console.log("🗑️ Saved entries removed from local storage");
      
      // Show success toast notification only for auto-save
      if (showToast) {
        toast({
          title: "✅ Auto-save Successful",
          description: `Data saved for time slot ${timeSlot}`,
          className: "bg-retro-green border-2 border-retro-dark text-white",
        });
      }
      
      // Invalidate and refetch table data - this will automatically refresh the table
      console.log('🔄 Invalidating queries with key:', ['tokenData']);
      console.log('📋 Current query cache:', queryClient.getQueryCache().getAll().map(q => q.queryKey));
      const invalidateResult = queryClient.invalidateQueries({ queryKey: ['tokenData'] });
      console.log('✅ Invalidation result:', invalidateResult);
      invalidateResult.then(() => {
        console.log('🔄 Query invalidation completed, checking if refetch will happen...');
        const queries = queryClient.getQueryCache().findAll({ queryKey: ['tokenData'] });
        console.log('📊 Found queries to invalidate:', queries.length, queries.map(q => ({ key: q.queryKey, state: q.state.status })));
      });
    },
    onError: (error: any) => {
      console.error("❌ Error saving data:", error);
      toast({
        title: "❌ Save Failed",
        description: error.message || "Failed to save data. Please try again.",
        className: "bg-red-500 border-2 border-retro-dark text-white",
      });
    },
  });

  // Wrapper function to maintain compatibility with existing code
  const saveToBackend = async (data: ReturnType<typeof prepareDataForBackend>, entriesToRemove: typeof entries, showToast: boolean = false) => {
    try {
      await saveMutation.mutateAsync({ data, entriesToRemove, showToast });
      return true;
    } catch (error) {
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
    let allSavesSuccessful = true;
    for (const [slotKey, slotEntries] of Object.entries(entriesBySlot)) {
      const [dateStr, timeSlot] = slotKey.split('_');
      const slotDate = slotDates[slotKey];
      const data = prepareDataForBackend(timeSlot, slotEntries, slotDate);
      const success = await saveToBackend(data, slotEntries);
      if (!success) {
        allSavesSuccessful = false;
      }
    }

    // Refresh table data after all saves complete
    if (allSavesSuccessful) {
      queryClient.invalidateQueries({ queryKey: ['tokenData'] });
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
        
        let allSavesSuccessful = true;
        for (const { slot, entries: slotEntries, date } of slotsToSave) {
          const data = prepareDataForBackend(slot, slotEntries, date);
          const success = await saveToBackend(data, slotEntries);
          if (!success) {
            allSavesSuccessful = false;
          }
        }
        
        // Refresh table data after all saves complete
        if (allSavesSuccessful) {
          fetchTableData();
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
        const performSave = (token: string) => {
          return fetch(`${API_BASE_URL}/token-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(data),
            keepalive: true, // Critical: allows request to complete after page closes
          });
        };

        performSave(tokenToUse).then(async (response) => {
          console.log(`✅ Fetch response for slot ${timeSlot}:`, response.status, response.statusText);
          
          // If 401 and we have refresh token, try to refresh and retry
          if (response.status === 401 && refreshToken && accessToken) {
            console.log(`🔄 Got 401, attempting to refresh token for slot ${timeSlot}...`);
            try {
              const refreshResponse = await fetch(`${API_BASE_URL}/refresh`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${refreshToken}`,
                },
                keepalive: true,
              });

              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                if (refreshData.success && refreshData.data?.access_token) {
                  // Ensure tokens are strings
                  const newAccessToken = typeof refreshData.data.access_token === 'string' 
                    ? refreshData.data.access_token 
                    : String(refreshData.data.access_token);
                  
                  const newRefreshTokenRaw = refreshData.data.refresh_token || refreshToken;
                  const newRefreshToken = typeof newRefreshTokenRaw === 'string' 
                    ? newRefreshTokenRaw 
                    : String(newRefreshTokenRaw);
                  
                  // Validate tokens are not objects
                  if (newAccessToken === '[object Object]' || newRefreshToken === '[object Object]') {
                    console.error(`❌ Invalid token format in refresh response for slot ${timeSlot}:`, refreshData.data);
                    return;
                  }
                  
                  // Update token in store
                  useAuthStore.getState().updateTokens(newAccessToken, newRefreshToken);
                  console.log(`✅ Token refreshed, retrying save for slot ${timeSlot}...`);
                  
                  // Retry with new token
                  const retryResponse = await performSave(newAccessToken);
                  if (retryResponse.ok) {
                    successCount++;
                    const action = retryResponse.status === 200 ? 'updated' : 'saved';
                    console.log(`✅ Successfully ${action} slot ${timeSlot} after token refresh`);
                  } else {
                    console.error(`❌ Retry failed for slot ${timeSlot}:`, retryResponse.status);
                  }
                } else {
                  console.error(`❌ Token refresh failed for slot ${timeSlot}: Invalid response`);
                }
              } else {
                console.error(`❌ Token refresh failed for slot ${timeSlot}:`, refreshResponse.status);
              }
            } catch (refreshError) {
              console.error(`❌ Token refresh error for slot ${timeSlot}:`, refreshError);
            }
          } else if (response.ok) {
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
              
              // Invalidate queries to refresh table data
              console.log('🔄 Invalidating queries after saveOnClose success');
              queryClient.invalidateQueries({ queryKey: ['tokenData'] });
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
            saveToBackend(data, entries, true); // true = show toast for auto-save
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

  // Get counts - use 15-min window for form display
  const counts = getCounts();

  // Handle Edit Click - Enable inline editing for table row
  const handleEditClick = (record: any) => {
    console.log("✏️ Edit clicked for record:", record);
    
    // Set editing record ID
    setEditingRecordId(record.id);
    
    // Initialize editing counts with current record counts
    const initialCounts: Record<number, number> = {};
    for (let i = 0; i < 10; i++) {
      initialCounts[i] = record.counts?.[i] || 0;
    }
    setEditingCounts(initialCounts);
  };

  // Handle Cancel Edit - Exit inline edit mode
  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditingCounts({});
    
    toast({
      title: "Edit Cancelled",
      description: "Changes discarded",
      className: "bg-retro-accent border-2 border-retro-dark text-retro-dark",
    });
  };

  // Handle count input change in inline edit mode
  const handleCountChange = (tokenNumber: number, value: string) => {
    // Only allow positive integers (empty string or digits)
    if (value === "" || /^\d+$/.test(value)) {
      setEditingCounts(prev => ({
        ...prev,
        [tokenNumber]: value === "" ? 0 : parseInt(value, 10),
      }));
    }
  };

  // Handle Update Record - Save edited counts
  const handleUpdateRecord = async (record: any) => {
    if (!editingRecordId || editingRecordId !== record.id) return;

    try {
      // Reconstruct entries from edited counts
      // Create entries that sum up to the counts (one entry per token number with quantity = count)
      const reconstructedEntries: Array<{ number: number; quantity: number; timestamp: number }> = [];
      const now = Date.now();
      
      for (let i = 0; i < 10; i++) {
        const count = editingCounts[i] || 0;
        if (count > 0) {
          // Create a single entry with quantity equal to the count
          reconstructedEntries.push({
            number: i,
            quantity: count,
            timestamp: now + i, // Slight offset to ensure unique timestamps
          });
        }
      }

      // If no entries (all counts are 0), still send empty array
      const response = await tokenDataApi.update(editingRecordId, {
        entries: reconstructedEntries,
      });
      
      if (response.success) {
        toast({
          title: "✅ Record Updated",
          description: `Record updated successfully`,
          className: "bg-retro-green border-2 border-retro-dark text-white",
        });
        
        // Exit edit mode
        setEditingRecordId(null);
        setEditingCounts({});
        
        // Refresh table data
        queryClient.invalidateQueries({ queryKey: ['tokenData'] });
      } else {
        toast({
          title: "❌ Update Failed",
          description: response.message || "Failed to update record",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("❌ Error updating record:", error);
      toast({
        title: "❌ Update Failed",
        description: error.message || "Failed to update record",
        variant: "destructive",
      });
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      const response = await authApi.logout();
      
      if (response.success) {
        // Clear auth state
        clearAuth();
        // Clear token entries
        clearEntries();
        // Redirect to login
        router.push('/login');
        
        toast({
          title: "Logged Out",
          description: "You have been successfully logged out",
          className: "bg-retro-green border-2 border-retro-dark text-white",
        });
      } else {
        toast({
          title: "Logout Failed",
          description: response.message || "Failed to logout",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("❌ Error logging out:", error);
      // Even if logout fails, clear local auth and redirect
      clearAuth();
      clearEntries();
      router.push('/login');
      
      toast({
        title: "Logged Out",
        description: "You have been logged out",
        className: "bg-retro-green border-2 border-retro-dark text-white",
      });
    }
  };

  // Get user initials (first 2 letters of name)
  const getUserInitials = (name: string): string => {
    if (!name) return "U";
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase().slice(0, 2);
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Handle TNO input - allow multiple digits 0-9, remove duplicates
  const handleTnoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow multiple digits (0-9) and spaces
    if (value === "" || /^[0-9\s]*$/.test(value)) {
      // Remove duplicate digits while preserving order (first occurrence kept)
      const digits = value.replace(/[^0-9]/g, '').split('');
      const uniqueDigits: string[] = [];
      const seen = new Set<number>();
      
      digits.forEach((digit) => {
        const num = Number.parseInt(digit);
        if (!seen.has(num)) {
          seen.add(num);
          uniqueDigits.push(digit);
        }
      });
      
      // Reconstruct value with unique digits (preserve spaces if they were there)
      const cleanedValue = uniqueDigits.join('');
      setTno(cleanedValue);
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

  const handleRefresh = async () => {
    if (tno === "" || quantity === "") return;

    const qty = Number.parseInt(quantity);
    if (qty <= 0) return;

    // Extract all digits from TNO string (ignore spaces and non-digits)
    const digits = tno.replace(/[^0-9]/g, '').split('');
    
    if (digits.length === 0) return;

    // Create entries array for batch submission (all entries will have same timestamp)
    const entriesToAdd = digits
      .map((digitStr) => {
        const digit = Number.parseInt(digitStr);
        if (digit >= 0 && digit <= 9) {
          return { number: digit, quantity: qty };
        }
        return null;
      })
      .filter((entry): entry is { number: number; quantity: number } => entry !== null);

    // Debug: Log what entries will be created
    console.log('📝 Creating entries:', {
      input: tno,
      digits: digits,
      entriesToAdd: entriesToAdd,
      quantity: qty
    });

    // Add all entries in one batch (same timestamp = same submission)
    if (entriesToAdd.length > 0) {
      addEntries(entriesToAdd);
    }

    // Clear inputs after submission
    setTno("");
    setQuantity("");
    // Reset focus to TNO input after submission
    if (tnoInputRef.current) {
      tnoInputRef.current.focus();
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
    // Allow space key for separating digits
    if (e.key === ' ') {
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

  // Handle paste for TNO - filter to only numbers 0-9 (allow multiple digits)
  const handleTnoPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const numericOnly = pastedText.replace(/[^0-9]/g, ''); // Keep all digits
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

  // Generate time slot options for filter
  const timeSlotOptions = generateTimeSlots();

  // Get query client for invalidating queries
  const queryClient = useQueryClient();
  
  // Fetch table data using TanStack Query
  const { data: tableQueryData, isLoading: tableQueryLoading, error: tableQueryError, refetch: refetchTableData } = useQuery({
    queryKey: ['tokenData', tableFilters.page, tableFilters.start_date, tableFilters.end_date, tableFilters.time_slot],
    queryFn: async () => {
      console.log('🔍 Query function executing - fetching table data with filters:', {
        page: tableFilters.page,
        start_date: tableFilters.start_date,
        end_date: tableFilters.end_date,
        time_slot: tableFilters.time_slot,
      });
      
      // Check if user is authenticated before fetching
      const authState = useAuthStore.getState();
      const { accessToken, refreshToken } = authState;
      
      // Only fetch if we have at least a refresh token
      if (!accessToken && !refreshToken) {
        console.log('⚠️ No auth tokens, skipping fetch');
        return null;
      }

      const params: any = {
        page: tableFilters.page,
        per_page: 10,
      };
      
      if (tableFilters.start_date) {
        params.start_date = tableFilters.start_date;
      }
      if (tableFilters.end_date) {
        params.end_date = tableFilters.end_date;
      }
      if (tableFilters.time_slot) {
        params.time_slot = tableFilters.time_slot;
      }

      console.log('📤 Making API call to fetch table data with params:', params);
      const response = await tokenDataApi.getAll(params);
      console.log('📥 API response received:', { success: response.success, dataLength: response.data?.length });
      
      if (response.success && response.data) {
        return {
          data: response.data,
          pagination: response.pagination,
        };
      }
      throw new Error(response.message || 'Failed to fetch table data');
    },
    enabled: (() => {
      const authState = useAuthStore.getState();
      return !!(authState.accessToken || authState.refreshToken);
    })(), // Note: This runs once, but query will refetch when filters change
    retry: 1,
    staleTime: 0, // Always refetch to get latest data
  });

  // Update table data and pagination when query data changes
  useEffect(() => {
    console.log('📊 Table query data changed:', { 
      hasData: !!tableQueryData, 
      dataLength: tableQueryData?.data?.length,
      isLoading: tableQueryLoading,
    });
    if (tableQueryData) {
      setTableData(tableQueryData.data || []);
      if (tableQueryData.pagination) {
        setTablePagination(tableQueryData.pagination);
      }
      console.log('✅ Table data updated with', tableQueryData.data?.length || 0, 'records');
    } else if (tableQueryData === null) {
      setTableData([]);
      console.log('🗑️ Table data cleared (null response)');
    }
  }, [tableQueryData, tableQueryLoading]);

  // Update loading state
  useEffect(() => {
    setTableLoading(tableQueryLoading);
  }, [tableQueryLoading]);

  // Handle query errors (401 redirect)
  useEffect(() => {
    if (tableQueryError) {
      const error = tableQueryError as any;
      if (error?.response?.status === 401) {
        const authState = useAuthStore.getState();
        if (!authState.accessToken && !authState.refreshToken) {
          console.log('🔄 No tokens available, redirecting to login...');
          router.push('/login');
        } else {
          setTableData([]);
        }
      }
    }
  }, [tableQueryError, router]);

  const handleFilterChange = (key: string, value: string) => {
    setTableFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page on filter change
    }));
  };

  const handlePageChange = (page: number) => {
    setTableFilters(prev => ({ ...prev, page }));
  };

  // Handle Excel Export
  const handleExportToExcel = async () => {
    try {
      setTableLoading(true);
      
      // Fetch all records matching current filters by paginating through all pages
      const allRecords: any[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const perPage = 100; // Max allowed by backend

      // Base params with filters
      const baseParams: any = {
        per_page: perPage,
      };
      
      if (tableFilters.start_date) {
        baseParams.start_date = tableFilters.start_date;
      }
      if (tableFilters.end_date) {
        baseParams.end_date = tableFilters.end_date;
      }
      if (tableFilters.time_slot) {
        baseParams.time_slot = tableFilters.time_slot;
      }

      // Fetch all pages
      while (hasMorePages) {
        const params = { ...baseParams, page: currentPage };
        const response = await tokenDataApi.getAll(params);
        
        if (!response.success || !response.data) {
          toast({
            title: "❌ Export Failed",
            description: response.message || "Failed to fetch data for export",
            variant: "destructive",
          });
          setTableLoading(false);
          return;
        }

        allRecords.push(...response.data);

        // Check if there are more pages
        if (response.pagination) {
          hasMorePages = currentPage < response.pagination.last_page;
          currentPage++;
        } else {
          // If no pagination info, assume no more pages if we got less than perPage
          hasMorePages = response.data.length === perPage;
          currentPage++;
        }
      }

      // Prepare data for Excel
      const excelData = allRecords.map((record: any) => {
        const counts = record.counts || {};
        const row: any = {
          'Date': new Date(record.date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }),
          'Time Slot': record.time_slot,
        };

        // Add token counts (0-9)
        for (let i = 0; i < 10; i++) {
          const count = counts[i] || 0;
          row[`Token ${i}`] = showHalfQuantity ? Math.floor(count / 2) : count;
        }

        // Add total entries
        row['Total Entries'] = Array.isArray(record.entries) ? record.entries.length : 0;

        return row;
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths (auto-width)
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 12 }, // Time Slot
        ...Array.from({ length: 10 }, () => ({ wch: 10 })), // Token 0-9
        { wch: 12 }, // Total Entries
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Token Data');

      // Generate filename with current date
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `token-data-${dateStr}.xlsx`;

      // Write and download
      XLSX.writeFile(wb, filename);

      toast({
        title: "✅ Export Successful",
        description: `Exported ${allRecords.length} records to ${filename}`,
        className: "bg-retro-green border-2 border-retro-dark text-white",
      });
    } catch (error: any) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "❌ Export Failed",
        description: error.message || "An error occurred while exporting",
        variant: "destructive",
      });
    } finally {
      setTableLoading(false);
    }
  };

  // Handle delete record
  const handleDeleteClick = (record: any) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;

    try {
      const response = await tokenDataApi.delete(recordToDelete.id);
      
      if (response.success) {
        toast({
          title: "✅ Deleted Successfully",
          description: `Record for ${recordToDelete.time_slot} on ${new Date(recordToDelete.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} has been deleted`,
          className: "bg-retro-green border-2 border-retro-dark text-white",
        });
        
        // Refresh table data using query invalidation
        queryClient.invalidateQueries({ queryKey: ['tokenData'] });
      } else {
        toast({
          title: "❌ Delete Failed",
          description: response.message || "Failed to delete record",
          className: "bg-red-500 border-2 border-retro-dark text-white",
        });
      }
    } catch (error: any) {
      console.error('Error deleting record:', error);
      toast({
        title: "❌ Delete Failed",
        description: error.response?.data?.message || "An error occurred while deleting",
        className: "bg-red-500 border-2 border-retro-dark text-white",
      });
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  // Handle column sorting
  const handleSort = (column: string) => {
    setTableSort(prev => {
      if (prev.column === column) {
        // Toggle direction if same column
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      } else {
        // New column, default to ascending
        return {
          column,
          direction: 'asc',
        };
      }
    });
  };

  // Sort table data
  const sortedTableData = [...tableData].sort((a: any, b: any) => {
    if (!tableSort.column) return 0;

    let aValue: any;
    let bValue: any;

    switch (tableSort.column) {
      case 'date':
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
        break;
      case 'time_slot':
        aValue = a.time_slot;
        bValue = b.time_slot;
        break;
      case 'total_entries':
        aValue = Array.isArray(a.entries) ? a.entries.length : 0;
        bValue = Array.isArray(b.entries) ? b.entries.length : 0;
        break;
      default:
        // For token number columns (0-9)
        if (tableSort.column.startsWith('token_')) {
          const tokenNum = parseInt(tableSort.column.replace('token_', ''));
          aValue = a.counts?.[tokenNum] || 0;
          bValue = b.counts?.[tokenNum] || 0;
        } else {
          return 0;
        }
    }

    if (aValue < bValue) return tableSort.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return tableSort.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Helper function to render sort icon
  const renderSortIcon = (column: string) => {
    if (tableSort.column !== column) {
      return (
        <span className="inline-flex flex-col ml-1 opacity-50">
          <ArrowUp className="h-3 w-3" />
          <ArrowDown className="h-3 w-3 -mt-1" />
        </span>
      );
    }
    return tableSort.direction === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-retro-cream border-4 border-retro-dark">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-retro-dark">
              Delete Record
            </AlertDialogTitle>
            <AlertDialogDescription className="text-retro-dark/80 text-lg">
              Are you sure you want to delete the record for{" "}
              <strong>{recordToDelete?.time_slot}</strong> on{" "}
              <strong>
                {recordToDelete
                  ? new Date(recordToDelete.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : ""}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false);
                setRecordToDelete(null);
              }}
              className="bg-retro-accent border-2 border-retro-dark text-retro-dark font-bold hover:bg-opacity-90"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 border-2 border-retro-dark text-white font-bold hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-retro-beige p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header - Responsive Grid: 1col (mobile) > 2col (sm) > 3col (md) > 4col (lg) */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-center">
          {/* Column 1: Site Logo - Always visible, centered on mobile */}
          <div className="flex flex-col items-center sm:items-start lg:justify-center text-center sm:text-left">
            <div className="mb-1 sm:mb-2">
              <Image
                src="/tt.svg"
                alt="Token Tracker"
                width={60}
                height={18}
                className="h-auto w-auto max-w-[60px] sm:max-w-[70px] lg:max-w-[80px]"
                priority
              />
            </div>
          </div>
          
          {/* Column 2: Countdown Timer - Always visible, centered */}
          <div className="flex flex-col items-center justify-center order-2 sm:order-2 md:order-2 lg:order-2 lg:justify-center">
            <div className="text-xs text-retro-dark/60 mb-2">Remaining time</div>
            <div className="flex items-center gap-1">
              {/* Minutes - Tens */}
              <FlipDigit 
                digit={Math.floor(countdown.minutes / 10)} 
                prevDigit={Math.floor(prevCountdown.minutes / 10)}
              />
              {/* Minutes - Ones */}
              <FlipDigit 
                digit={countdown.minutes % 10} 
                prevDigit={prevCountdown.minutes % 10}
              />
              {/* Colon */}
              <div className="text-2xl font-bold text-retro-accent font-mono mx-1">:</div>
              {/* Seconds - Tens */}
              <FlipDigit 
                digit={Math.floor(countdown.seconds / 10)} 
                prevDigit={Math.floor(prevCountdown.seconds / 10)}
              />
              {/* Seconds - Ones */}
              <FlipDigit 
                digit={countdown.seconds % 10} 
                prevDigit={prevCountdown.seconds % 10}
              />
            </div>
          </div>
          
          {/* Column 3: Clock Time - Visible from md, separate column on lg, closer to user on desktop */}
          <div className="hidden md:flex lg:flex items-center justify-end order-3 lg:justify-end lg:pr-2">
            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-retro-dark font-mono">
              {formatISTTime(currentTime)}
            </div>
          </div>
          
          {/* Column 4: User Profile - Always visible, centered on mobile, right-aligned on larger screens */}
          <div className="flex items-center justify-center sm:justify-end md:justify-end lg:justify-end gap-2 sm:gap-4 order-4">
            {/* Clock Time - Show on mobile/tablet (1-2col) when clock column is hidden */}
            <div className="flex md:hidden items-center text-lg sm:text-xl font-bold text-retro-dark font-mono">
              {formatISTTime(currentTime)}
            </div>
            
            {/* User Profile */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 hover:opacity-80 transition-all cursor-pointer">
                    <Avatar className="h-10 w-10 border-2 border-retro-dark">
                      <AvatarFallback className="bg-retro-accent text-retro-dark font-bold text-sm">
                        {getUserInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-retro-dark text-lg hidden sm:block">
                      {user.name}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end"
                  className="bg-retro-cream border-2 border-retro-dark w-56"
                >
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-retro-dark">{user.name}</p>
                    <p className="text-xs text-retro-dark/60 truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-retro-dark/20" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer hover:bg-red-500/20 text-red-600 font-bold focus:bg-red-500/20 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
                    ref={tnoInputRef}
                    type="text"
                    inputMode="numeric"
                    value={tno}
                    onChange={handleTnoChange}
                    onKeyDown={handleTnoKeyDown}
                    onKeyPress={handleKeyPress}
                    onPaste={handleTnoPaste}
                    placeholder="0-9 or multiple digits"
                    pattern="[0-9\s]*"
                    className="w-full px-4 py-3 bg-white border-3 border-retro-dark text-retro-dark font-bold text-2xl text-center rounded"
                  />
                </div>

                {/* Quantity Input */}
                <div>
                  <label className="block text-sm font-bold text-retro-dark mb-2">
                    QUANTITY
                  </label>
                  <input
                    ref={quantityInputRef}
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

              {/* Add Button */}
              <button
                onClick={handleRefresh}
                className="w-full bg-retro-accent border-4 border-retro-dark text-retro-dark font-bold text-lg py-3 rounded-lg hover:bg-opacity-90 transition-all active:scale-95"
              >
                Add
              </button>
            </div>

            {/* Show Half Quantity Toggle - For Counter Display */}
            <div className="mb-4 flex items-center gap-2">
              <Switch
                id="showHalfQuantityCounter"
                checked={showHalfQuantityCounter}
                onCheckedChange={setShowHalfQuantityCounter}
                className="data-[state=checked]:bg-retro-green data-[state=unchecked]:bg-retro-accent"
              />
              <label htmlFor="showHalfQuantityCounter" className="text-sm font-bold text-retro-dark cursor-pointer">
                Show Half Quantity
              </label>
            </div>

            {/* Counter Display */}
            <div className="bg-retro-dark border-4 border-retro-accent p-6 rounded-lg">
              {/* Stacked Columns: Number on top, Quantity below */}
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
                    <div key={i} className="flex flex-col gap-2">
                      {/* Green Number Box - Top */}
                      <div className="flex items-center justify-center bg-retro-green border-3 border-retro-accent px-3 sm:px-6 py-4 rounded-lg">
                        <div className="text-2xl font-bold text-white">{i}</div>
                      </div>
                      {/* Quantity Box - Bottom */}
                      <div className="bg-white font-bold text-xl sm:text-2xl px-2 sm:px-4 py-2 rounded min-h-12 flex items-center justify-center border-2 border-retro-dark">
                        <span className={colors[i]}>
                          {showHalfQuantityCounter ? Math.floor((counts[i] || 0) / 2) : (counts[i] || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-retro-cream border-4 border-retro-dark rounded-lg flex flex-col overflow-hidden" style={{ height: '450px' }}>
              <div className="flex border-b-4 border-retro-dark flex-shrink-0">
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
                {/* MY TOKENS Tab - Commented out */}
                {/* <button
                  type="button"
                  onClick={() => handleSetActiveTab("myTokens")}
                  className={`flex-1 font-bold text-center py-3 transition-all ${
                    activeTab === "myTokens"
                      ? "bg-retro-accent text-retro-dark"
                      : "bg-retro-cream text-retro-dark hover:bg-opacity-80"
                  }`}
                >
                  MY TOKENS
                </button> */}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0, height: '100%' }}>
                {/* History Tab */}
                {activeTab === "history" && (
                  <div className="space-y-2 h-full flex flex-col">
                    {entries.length === 0 ? (
                      <p className="text-center text-retro-dark/60 py-8 flex-1 flex items-center justify-center">
                        No entries yet
                      </p>
                    ) : (() => {
                      // Group entries by submission timestamp (entries with same timestamp = same submission)
                      const groupedEntries: Array<{ timestamp: number; tokens: number[]; quantity: number }> = [];
                      const sortedEntries = [...entries].sort((a, b) => b.timestamp - a.timestamp);
                      
                      sortedEntries.forEach((entry) => {
                        // Find if there's already a group with this exact timestamp
                        const existingGroup = groupedEntries.find(
                          (group) => group.timestamp === entry.timestamp
                        );
                        
                        if (existingGroup) {
                          // Add token number if not already present (unique tokens only)
                          if (!existingGroup.tokens.includes(entry.number)) {
                            existingGroup.tokens.push(entry.number);
                          }
                          // Quantity should be the same for all entries in a submission
                          existingGroup.quantity = entry.quantity;
                        } else {
                          // Create new group
                          groupedEntries.push({
                            timestamp: entry.timestamp,
                            tokens: [entry.number],
                            quantity: entry.quantity,
                          });
                        }
                      });
                      
                      return groupedEntries.map((group, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-1 bg-white border-2 border-retro-dark px-3 py-2 rounded"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-retro-dark text-lg">
                              {group.tokens.sort((a, b) => a - b).map(t => `#${t}`).join(', ')}
                            </span>
                            <span className="text-retro-accent font-bold text-lg">
                              ×{group.quantity}
                            </span>
                          </div>
                          <span className="text-xs text-retro-dark/60">
                            {new Date(group.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* My Tokens Tab - Commented out */}
                {/* {activeTab === "myTokens" && (
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
                )} */}
              </div>
            </div>
          </div>
        </div>

        {/* Data Table - Full Width */}
        <div className="mt-8">
          <div className="bg-retro-cream border-4 border-retro-dark p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-retro-dark">Saved Records</h2>
              <Button
                onClick={handleExportToExcel}
                disabled={tableLoading}
                className="bg-retro-green border-2 border-retro-dark text-white font-bold hover:bg-opacity-90 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export to Excel
              </Button>
            </div>
            
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-retro-dark mb-2">Start Date</label>
                <Input
                  type="date"
                  value={tableFilters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="bg-white border-3 border-retro-dark"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-retro-dark mb-2">End Date</label>
                <Input
                  type="date"
                  value={tableFilters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="bg-white border-3 border-retro-dark"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-retro-dark mb-2">Time Slot</label>
                <select
                  value={tableFilters.time_slot}
                  onChange={(e) => handleFilterChange('time_slot', e.target.value)}
                  className="w-full h-9 px-3 bg-white border-3 border-retro-dark rounded-md text-retro-dark font-bold"
                >
                  <option value="">All Time Slots</option>
                  {timeSlotOptions.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => setTableFilters({ start_date: '', end_date: '', time_slot: '', page: 1 })}
                  className="w-full bg-retro-accent border-2 border-retro-dark text-retro-dark font-bold hover:bg-opacity-90"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Show Half Quantity Toggle */}
            <div className="mb-4 flex items-center gap-2">
              <Switch
                id="showHalfQuantity"
                checked={showHalfQuantity}
                onCheckedChange={setShowHalfQuantity}
                className="data-[state=checked]:bg-retro-green data-[state=unchecked]:bg-retro-accent"
              />
              <label htmlFor="showHalfQuantity" className="text-sm font-bold text-retro-dark cursor-pointer">
                Show Half Quantity
              </label>
            </div>

            {/* Table */}
            <div className="bg-white border-3 border-retro-dark rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-retro-dark hover:bg-retro-dark">
                    <TableHead 
                      className="text-white font-bold cursor-pointer hover:bg-retro-dark/80 transition-colors select-none"
                      onClick={() => handleSort('date')}
                    >
                      <span className="flex items-center">
                        Date
                        {renderSortIcon('date')}
                      </span>
                    </TableHead>
                    <TableHead 
                      className="text-white font-bold cursor-pointer hover:bg-retro-dark/80 transition-colors select-none"
                      onClick={() => handleSort('time_slot')}
                    >
                      <span className="flex items-center">
                        Time Slot
                        {renderSortIcon('time_slot')}
                      </span>
                    </TableHead>
                    {Array.from({ length: 10 }, (_, i) => (
                      <TableHead 
                        key={i}
                        className="text-white font-bold text-center cursor-pointer hover:bg-retro-dark/80 transition-colors select-none"
                        onClick={() => handleSort(`token_${i}`)}
                      >
                        <span className="flex items-center justify-center">
                          {i}
                          {renderSortIcon(`token_${i}`)}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead 
                      className="text-white font-bold text-center cursor-pointer hover:bg-retro-dark/80 transition-colors select-none"
                      onClick={() => handleSort('total_entries')}
                    >
                      <span className="flex items-center justify-center">
                        Total Entries
                        {renderSortIcon('total_entries')}
                      </span>
                    </TableHead>
                    <TableHead className="text-white font-bold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableLoading ? (
                    // Skeleton loader - 10 rows to maintain height
                    Array.from({ length: 10 }, (_, index) => (
                      <TableRow key={`skeleton-${index}`} className="hover:bg-retro-cream/50">
                        <TableCell className="p-2">
                          <Skeleton className="h-5 w-20 bg-retro-dark/20" />
                        </TableCell>
                        <TableCell className="p-2">
                          <Skeleton className="h-5 w-16 bg-retro-dark/20" />
                        </TableCell>
                        {Array.from({ length: 10 }, (_, i) => (
                          <TableCell key={i} className="p-2 text-center">
                            <Skeleton className="h-5 w-8 mx-auto bg-retro-dark/20" />
                          </TableCell>
                        ))}
                        <TableCell className="p-2 text-center">
                          <Skeleton className="h-5 w-12 mx-auto bg-retro-dark/20" />
                        </TableCell>
                        <TableCell className="p-2 text-center">
                          <Skeleton className="h-8 w-16 mx-auto bg-retro-dark/20" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : tableData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-retro-dark/60">
                        No records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedTableData.map((record: any) => {
                      const isEditing = editingRecordId === record.id;
                      const counts = record.counts || {};
                      const totalEntries = Array.isArray(record.entries) ? record.entries.length : 0;
                      const colors = [
                        'text-blue-600', 'text-red-600', 'text-green-600', 'text-yellow-600',
                        'text-purple-600', 'text-pink-600', 'text-orange-600', 'text-indigo-600',
                        'text-teal-600', 'text-cyan-600',
                      ];
                      
                      return (
                        <TableRow key={record.id} className={`hover:bg-retro-cream/50 ${isEditing ? 'bg-retro-accent/20' : ''}`}>
                          <TableCell className="font-bold text-retro-dark text-base">
                            {new Date(record.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </TableCell>
                          <TableCell className="font-bold text-retro-dark text-base">{record.time_slot}</TableCell>
                          {Array.from({ length: 10 }, (_, i) => (
                            <TableCell key={i} className="text-center text-base">
                              {isEditing ? (
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={editingCounts[i] || 0}
                                  onChange={(e) => handleCountChange(i, e.target.value)}
                                  onKeyDown={(e) => {
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
                                  }}
                                  className="w-16 text-center font-bold border-2 border-retro-dark text-base"
                                  style={{ padding: '4px 8px' }}
                                />
                              ) : (
                                <span className={`${colors[i]} text-base`}>
                                  {showHalfQuantity ? Math.floor((counts[i] || 0) / 2) : (counts[i] || 0)}
                                </span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold text-retro-dark text-base">
                            {totalEntries}
                          </TableCell>
                          <TableCell className="text-center text-base">
                            {isEditing ? (
                              <div className="flex flex-col gap-2 items-center">
                                <Button
                                  onClick={() => handleUpdateRecord(record)}
                                  className="bg-retro-green border-2 border-retro-dark text-white font-bold hover:bg-opacity-90 h-8 px-3 w-full"
                                  size="sm"
                                >
                                  Update
                                </Button>
                                <Button
                                  onClick={handleCancelEdit}
                                  className="bg-retro-accent border-2 border-retro-dark text-retro-dark font-bold hover:bg-opacity-90 h-8 px-3 w-full"
                                  size="sm"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-retro-cream/50"
                                  >
                                    <MoreVertical className="h-4 w-4 text-retro-dark" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent 
                                  align="end"
                                  className="bg-retro-cream border-2 border-retro-dark"
                                >
                                  <DropdownMenuItem
                                    onClick={() => handleEditClick(record)}
                                    className="cursor-pointer hover:bg-retro-accent/50 text-retro-dark font-bold"
                                  >
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => handleDeleteClick(record)}
                                    className="cursor-pointer hover:bg-red-500/20 text-red-600 font-bold"
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {tablePagination.last_page > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (tablePagination.current_page > 1) {
                            handlePageChange(tablePagination.current_page - 1);
                          }
                        }}
                        className={tablePagination.current_page === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    {Array.from({ length: tablePagination.last_page }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(page);
                          }}
                          isActive={page === tablePagination.current_page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (tablePagination.current_page < tablePagination.last_page) {
                            handlePageChange(tablePagination.current_page + 1);
                          }
                        }}
                        className={tablePagination.current_page === tablePagination.last_page ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}

            {/* Pagination Info */}
            {tablePagination.total > 0 && (
              <div className="mt-4 text-center text-sm text-retro-dark/70">
                Showing {tablePagination.from} to {tablePagination.to} of {tablePagination.total} records
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
