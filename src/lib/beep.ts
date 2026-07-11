/** Short beep (WebAudio). The context is unlocked by the user's first gesture. */
let ctx: AudioContext | null = null

export function beep(): void {
  try {
    ctx ??= new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    // audio unavailable: the toast and vibration already notify
  }
}
