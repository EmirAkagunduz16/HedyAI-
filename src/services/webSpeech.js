// Simple wrapper around the Web Speech API for continuous dictation

export default class WebSpeechService {
  constructor() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    this.isSupported = !!SpeechRecognition
    this.recognition = this.isSupported ? new SpeechRecognition() : null
    this.onResult = null // ({ text, isFinal }) => void
    this.onError = null
    this.onStart = null
    this.onEnd = null

    if (this.recognition) {
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = 'en-US'

      this.recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i]
          if (result.isFinal) finalTranscript += result[0].transcript
          else interimTranscript += result[0].transcript
        }
        if (finalTranscript && this.onResult) {
          this.onResult({ text: finalTranscript.trim(), isFinal: true })
        } else if (interimTranscript && this.onResult) {
          this.onResult({ text: interimTranscript.trim(), isFinal: false })
        }
      }

      this.recognition.onerror = (e) => {
        this.onError?.(e)
      }
      this.recognition.onstart = () => this.onStart?.()
      this.recognition.onend = () => this.onEnd?.()
    }
  }

  start(lang = 'en-US') {
    if (!this.isSupported) return false
    this.recognition.lang = lang
    try {
      this.recognition.start()
      return true
    } catch {
      return false
    }
  }

  stop() {
    if (!this.isSupported) return
    try {
      this.recognition.stop()
    } catch {}
  }
}


