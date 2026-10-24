import { useCallback, useEffect, useRef, useState } from 'react'

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const preferred = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Karen', 'Moira']
  for (const name of preferred) {
    const v = voices.find((x) => x.name.includes(name))
    if (v) return v
  }
  return voices.find((v) => v.lang?.startsWith('en')) ?? null
}

export function useSpeech({ onFinal }) {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const recRef = useRef(null)
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const canListen = Boolean(Recognition)
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    if (canSpeak) window.speechSynthesis.getVoices()
    return () => {
      recRef.current?.abort()
      if (canSpeak) window.speechSynthesis.cancel()
    }
  }, [canSpeak])

  const stopListening = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const startListening = useCallback(() => {
    if (!Recognition) return
    recRef.current?.abort()
    const rec = new Recognition()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    rec.onstart = () => { setListening(true); setError(null) }
    rec.onresult = (e) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      setInterim(interimText)
      if (finalText.trim()) {
        setInterim('')
        onFinalRef.current?.(finalText.trim())
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Microphone access was blocked. Allow the mic in your browser, or type instead.')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError(`Speech recognition error: ${e.error}`)
    }
    rec.onend = () => { setListening(false); setInterim('') }
    recRef.current = rec
    try { rec.start() } catch {}
  }, [])

  const speak = useCallback((text, onEnd) => {
    if (!canSpeak) { onEnd?.(); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) u.voice = voice
    u.rate = 1.03
    u.onstart = () => setSpeaking(true)
    const done = () => { setSpeaking(false); onEnd?.() }
    u.onend = done
    u.onerror = done
    window.speechSynthesis.speak(u)
  }, [canSpeak])

  const stopSpeaking = useCallback(() => {
    if (canSpeak) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [canSpeak])

  return { canListen, canSpeak, listening, speaking, interim, error, startListening, stopListening, speak, stopSpeaking }
}
