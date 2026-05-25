let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch { return null }
}

function beep(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.25) {
  const c = getCtx()
  if (!c) return
  try {
    const osc  = c.createOscillator()
    const vol  = c.createGain()
    osc.connect(vol)
    vol.connect(c.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, c.currentTime)
    vol.gain.setValueAtTime(gain, c.currentTime)
    vol.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + duration)
  } catch {}
}

function chord(freqs: number[], duration: number, type: OscillatorType = 'sine', gain = 0.18) {
  freqs.forEach(f => beep(f, duration, type, gain))
}

export const sounds = {
  reveal()    { beep(660, 0.12, 'sine', 0.22); setTimeout(() => beep(880, 0.1, 'sine', 0.15), 80) },
  vote()      { beep(440, 0.1, 'sine', 0.2) },
  phaseStart(){ chord([528, 660, 792], 0.28, 'sine', 0.15) },
  eliminated(){ beep(180, 0.5, 'sawtooth', 0.15); setTimeout(() => beep(140, 0.4, 'sawtooth', 0.1), 200) },
  win()       { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'sine', 0.2), i * 120)) },
  chat()      { beep(880, 0.06, 'sine', 0.08) },
  cardUsed()  { beep(350, 0.15, 'triangle', 0.2); setTimeout(() => beep(500, 0.12, 'triangle', 0.15), 100) },
}
