import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined) return 'N/A'
  return Number(value).toLocaleString('en-IE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined) return 'N/A'
  return `${formatNumber(value, decimals)}%`
}

export function formatCurrency(value, currency = 'EUR') {
  if (value === null || value === undefined) return 'N/A'
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}
