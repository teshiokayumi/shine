"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"

interface Message {
  id: number
  text: string
  isUser: boolean
  timestamp: Date
}

async function askConcierge(input: { query?: string; shrine_name?: string }) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000) // 15秒でタイムアウト
  try {
    const res = await fetch("/api/concierge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data) throw new Error("bad response")
    // 必ず message を画面に出す（沈黙回避）
    return data as {
      ok: boolean
      message: string
      shrine_name: string | null
      plans: Array<{ name: string; description: string; course_id: string; theme?: string }>
    }
  } catch (e) {
    clearTimeout(t)
    return {
      ok: false,
      message: "AIコンシェルジュが応答していません。ネットワーク状況をご確認ください。",
      shrine_name: null,
      plans: [],
    }
  }
}

export default function ConciergePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [loading, setLoading] = useState(false)
  const [audioPlayed, setAudioPlayed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!audioPlayed) {
      const playAudio = async () => {
        try {
          const audio = new Audio("https://www.asahi-net.or.jp/~mi7k-hmd/sansha.wav")
          audio.volume = 0.7 // 音量を少し下げる
          await audio.play()
          console.log("[v0] 音声再生成功")
        } catch (error) {
          console.log("[v0] 音声再生エラー:", error)
        }
      }

      // 少し遅延してから音声を再生
      const timer = setTimeout(() => {
        playAudio()
        setAudioPlayed(true)

        // ウェルカムメッセージを追加
        const welcomeMessage: Message = {
          id: 1,
          text: "福岡は櫛田神社を起点に菅原道真公をご祭神とした神社や縁安命と言う古い神様を祀る神社、海運、学問の神様など、実に豊かな神社が街の中に祀られています。\n\nあなたの行きたいエリアの神社、観光地近くの神社など、どんな神社をめぐりたいか、お伝えください。",
          isUser: false,
          timestamp: new Date(),
        }
        setMessages([welcomeMessage])
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [audioPlayed])

  const handleSendMessage = async () => {
    if (!inputText.trim() || loading) return

    const userMessage: Message = {
      id: Date.now(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentInput = inputText
    setInputText("")
    setLoading(true)

    try {
      const response = await askConcierge({ query: currentInput })

      // プランがある場合は詳細情報も含める
      let responseText = response.message
      if (response.plans && response.plans.length > 0) {
        responseText += "\n\n【おすすめプラン】\n"
        response.plans.forEach((plan, index) => {
          responseText += `${index + 1}. ${plan.name}\n${plan.description}\n\n`
        })
      }

      const botMessage: Message = {
        id: Date.now() + 1,
        text: responseText,
        isUser: false,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      console.error("メッセージ送信エラー:", error)
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "申し訳ございません。エラーが発生しました。もう一度お試しください。",
        isUser: false,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-pink-100 to-pink-200 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <img
            src="https://www.asahi-net.or.jp/~mi7k-hmd/_con.png"
            alt="執事アイコン"
            className="w-[100px] h-[100px] object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800">福岡三社詣りコンシェルジュ</h1>
        </div>

        <div className="space-y-4 mb-6 max-h-96 overflow-y-auto bg-white/30 rounded-lg p-4 backdrop-blur-sm">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  message.isUser ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
                }`}
              >
                <p className="text-sm whitespace-pre-line">{message.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-800 px-4 py-3 rounded-2xl">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <Card className="shadow-lg border-gray-300">
          <CardContent className="p-4">
            <div className="flex space-x-2">
              <Input
                placeholder="願い事やご希望をお聞かせください..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 text-base p-4 border-gray-300 focus:ring-pink-400 focus:border-pink-400"
                disabled={loading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || loading}
                className="px-6 py-4 bg-pink-500 hover:bg-pink-600 text-white"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
