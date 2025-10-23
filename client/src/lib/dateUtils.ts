/**
 * Utility functions for date handling to avoid timezone issues
 */

/**
 * Formats a Date object for API submission as YYYY-MM-DD
 * Ensures the date is normalized to local midnight to avoid timezone shifts
 * 
 * Example: User selects Oct 23, 2025 → Always sends "2025-10-23" regardless of timezone
 */
export function formatDateForAPI(date: Date | null | undefined): string | null {
  if (!date) return null;
  
  // Create a new date at local midnight to avoid timezone shifts
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  
  // Extract components in local timezone
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Parses a date string from the API (YYYY-MM-DD) to a Date object
 * Ensures the date is at local midnight
 */
export function parseDateFromAPI(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  
  // Parse as local date (not UTC)
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Gets today's date at local midnight
 */
export function getTodayAtMidnight(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Checks if two dates are the same day (ignoring time)
 */
export function isSameDay(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false;
  
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
