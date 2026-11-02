const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function formatNum(value: number | string, usePersianDigits = true): string {
  const str = String(value);
  if (!usePersianDigits) return str;
  return str.replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

export function formatSignedNum(value: number, usePersianDigits = true): string {
  const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${formatNum(Math.abs(value), usePersianDigits)}`;
}

export function formatClock(totalSeconds: number, usePersianDigits = true): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  const padded = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return formatNum(padded, usePersianDigits);
}

export function formatJalaliDate(timestamp: number, usePersianDigits = true): string {
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const formatted = formatter.format(new Date(timestamp));
    return formatNum(formatted, usePersianDigits);
  } catch {
    const iso = new Date(timestamp).toLocaleDateString();
    return formatNum(iso, usePersianDigits);
  }
}

/**
 * Normalizes Persian text for duplicate detection, search, and alternative matching:
 * - Unifies Arabic Yeh/Kaf to Persian Yeh/Kaf
 * - Removes Tatweel/kashida and diacritics
 * - Converts ZWNJ (نیم‌فاصله) and punctuation to single spaces for canonical comparison
 */
export function normalizePersianText(input: string): string {
  return input
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ى/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/إ|أ|آ/g, 'ا')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u200C\u200B\u00A0\-_،,.;:؟?!«»()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function difficultyLabel(diff: 'easy' | 'medium' | 'hard'): string {
  switch (diff) {
    case 'easy':
      return 'آسان';
    case 'medium':
      return 'متوسط';
    case 'hard':
      return 'سخت';
  }
}

export const DEFAULT_TEAM_NAMES = [
  'تیم اول',
  'تیم دوم',
  'تیم سوم',
  'تیم چهارم',
  'تیم پنجم',
  'تیم ششم',
  'تیم هفتم',
  'تیم هشتم',
];

export const TEAM_COLOR_PALETTE = [
  { id: 'emerald', label: 'زمردی', hex: '#059669' },
  { id: 'amber', label: 'کهربایی', hex: '#D97706' },
  { id: 'blue', label: 'لاجوردی', hex: '#2563EB' },
  { id: 'rose', label: 'سرخابی', hex: '#E11D48' },
  { id: 'teal', label: 'فیروزه‌ای', hex: '#0D9488' },
  { id: 'indigo', label: 'نیلی', hex: '#4F46E5' },
  { id: 'orange', label: 'نارنجی', hex: '#EA580C' },
  { id: 'cyan', label: 'آبی آسمانی', hex: '#0284C7' },
];

export const TEAM_ICONS = [
  'Flame',
  'Crown',
  'Zap',
  'Shield',
  'Star',
  'Rocket',
  'Compass',
  'Trophy',
];
