/**
 * MAKERS POS — Audio Feedback Service
 * Synthesizes POS chimes, scanner beeps, and error tones via native Web Audio API.
 * Configured dynamically through settingsStore and settingsHelper.
 */

import { getSettingBool, getSettingNumber } from '@/services/settings/settingsHelper'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

function playTone(freq: number, durationSec: number, type: OscillatorType = 'sine', volumeScale = 1): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)

    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.15 * volumeScale, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationSec)
  } catch (err) {
    console.debug('[soundService] Tone playback notice:', err)
  }
}

/**
 * Plays short beep when a barcode is scanned or product added
 */
export async function playScanSound(): Promise<void> {
  const enabled = await getSettingBool('sound_enabled', true)
  const onScan = await getSettingBool('sound_on_scan', true)
  if (!enabled || !onScan) return

  const vol = (await getSettingNumber('sound_volume', 70)) / 100
  playTone(1760, 0.08, 'sine', vol)
}

/**
 * Plays two-tone upward chime on successful sale checkout
 */
export async function playSaleSuccessSound(): Promise<void> {
  const enabled = await getSettingBool('sound_enabled', true)
  const onSale = await getSettingBool('sound_on_sale', true)
  if (!enabled || !onSale) return

  const vol = (await getSettingNumber('sound_volume', 70)) / 100
  const ctx = getAudioContext()
  if (!ctx) return

  playTone(1046.5, 0.12, 'triangle', vol)
  setTimeout(() => {
    playTone(1567.98, 0.22, 'triangle', vol)
  }, 110)
}

/**
 * Plays low error buzzer on failure/warning
 */
export async function playErrorSound(): Promise<void> {
  const enabled = await getSettingBool('sound_enabled', true)
  const onError = await getSettingBool('sound_on_error', true)
  if (!enabled || !onError) return

  const vol = (await getSettingNumber('sound_volume', 70)) / 100
  playTone(320, 0.25, 'sawtooth', vol * 0.7)
}
