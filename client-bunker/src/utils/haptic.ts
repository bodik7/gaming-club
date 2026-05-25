type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error'

const PATTERNS: Record<HapticType, number | number[]> = {
  light:   30,
  medium:  60,
  heavy:   100,
  success: [40, 30, 60],
  error:   [80, 50, 80],
}

export function haptic(type: HapticType) {
  try {
    if (navigator.vibrate) navigator.vibrate(PATTERNS[type])
  } catch {}
}
