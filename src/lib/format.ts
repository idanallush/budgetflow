/**
 * Format number as NIS currency: ₪48,000
 */
export const formatCurrency = (amount: number): string => {
  return `₪${amount.toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

/**
 * Format date as DD.MM.YY
 */
export const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  return `${day}.${month}.${year}`
}

/**
 * Format date as DD.MM.YYYY
 */
export const formatDateFull = (dateStr: string): string => {
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

/**
 * Format ISO timestamp to readable Hebrew date + time
 */
export const formatDateTime = (dateStr: string): string => {
  const d = new Date(dateStr)
  return `${formatDate(dateStr)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Get days in a specific month
 */
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Get today as YYYY-MM-DD
 */
export const todayISO = (): string => {
  return new Date().toISOString().split('T')[0]
}

/**
 * Generate a URL-friendly slug from text.
 * Supports Hebrew by keeping Unicode letters (\p{L}) alongside ASCII.
 * Falls back to a short random ID if the result is empty.
 */
export const slugify = (text: string): string => {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || `client-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Generate a random share token
 */
export const generateShareToken = (): string => {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}
