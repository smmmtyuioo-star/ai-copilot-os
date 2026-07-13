'use client'
import { useState, useRef, useCallback } from 'react'
import { Mic, Square, Volume2, Play, Pause, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui'

export default function VoicePage() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<any>(null)
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

  const startListening = useCallback(() => {
    setError('')
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      const current = event.resultIndex
      const transcript = event.results[current][0].transcript
      setTranscript(transcript)
    }

    recognition.onend = () => {
      setListening(false)
      if (transcript.trim()) processVoiceInput(transcript)
    }

    recognition.onerror = (event: any) => {
      setListening(false)
      setError(`Error: ${event.error}. Try again.`)
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [transcript])

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
    }
  }

  async function processVoiceInput(text: string) {
    setProcessing(true)
    setError('')

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a voice assistant. Respond concisely and clearly since your answer will be read aloud.' },
          { role: 'user', content: text },
        ],
      }),
    })

    if (response.ok) {
      const reader = response.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let result = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          const lines = text.split('\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              result += parsed.choices?.[0]?.delta?.content || ''
            } catch {}
          }
        }
        setResponse(result)
        speakText(result)
      }
    } else {
      setError('Failed to get AI response.')
    }
    setProcessing(false)
  }

  function speakText(text: string) {
    if (!synth) return
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    const voices = synth.getVoices()
    if (voices.length > 0) utterance.voice = voices.find(v => v.lang.startsWith('en')) || voices[0]
    synth.speak(utterance)
  }

  function stopSpeaking() {
    synth?.cancel()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Voice Assistant</h1>
        <p className="text-sm text-gray-500">Speak naturally and get AI-powered responses</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <div className="mb-6">
            <button
              onClick={listening ? stopListening : startListening}
              className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full transition-all ${
                listening ? 'bg-red-100 text-red-600 scale-110 dark:bg-red-900/50' : 'bg-blue-100 text-blue-600 hover:scale-105 dark:bg-blue-900/50'
              }`}
            >
              {listening ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </button>
          </div>

          {listening && (
            <div className="flex items-center justify-center gap-2 text-red-600 mb-4">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
              Listening... click square to stop
            </div>
          )}

          {error && (
            <div className="mx-auto mb-4 flex max-w-md items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {processing && <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />}

          {transcript && (
            <div className="mx-auto max-w-lg rounded-lg bg-gray-50 p-4 text-left dark:bg-gray-900">
              <p className="text-xs text-gray-500 mb-1">You said:</p>
              <p className="text-gray-900 dark:text-gray-100">{transcript}</p>
            </div>
          )}

          {response && (
            <div className="mx-auto mt-4 max-w-lg rounded-lg bg-blue-50 p-4 text-left dark:bg-blue-900/30">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">Response:</p>
                <button onClick={speakText.bind(null, response)} className="text-blue-600 hover:text-blue-700">
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-gray-900 dark:text-gray-100">{response}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
