"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface Message {
  id: number
  text: string
  isUser: boolean
  timestamp: Date
}

interface Shrine {
  id: number
  name: string
  name_kana: string
  description: string
  address: string
  latitude: number
  longitude: number
  main_deity: string
  benefits: string[]
}

export default function ConciergePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [loading, setLoading] = useState(false)
  const [audioPlayed, setAudioPlayed] = useState(false)
  const [shrines, setShrines] = useState<Shrine[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchShrines() {
      const supabase = createClient()
      const { data, error } = await supabase.from("shrines").select("*")

      if (data && !error) {
        setShrines(data)
      }
    }
    fetchShrines()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!audioPlayed) {
      const playAudio = async () => {
        try {
          const audio = new Audio("https://idhxfowbqbazjrabyums.supabase.co/storage/v1/object/public/audio/sansha.wav")
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
    setInputText("")
    setLoading(true)

    try {
      const response = await generateAIResponse(inputText)

      const botMessage: Message = {
        id: Date.now() + 1,
        text: response,
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

  const generateAIResponse = async (userMessage: string): Promise<string> => {
    try {
      console.log("[v0] AI応答生成開始:", userMessage)

      // 神社データベースから関連する神社を検索
      const relevantShrines = findRelevantShrines(userMessage)
      console.log("[v0] 関連神社数:", relevantShrines.length)

      // AIプロンプトを構築
      const systemPrompt = `
あなたは福岡三社詣りの専門コンシェルジュです。以下の神社データベースを参考に、ユーザーの願い事や質問に対して適切な神社を推薦してください。

神社データベース:
${shrines
  .map(
    (shrine) => `
- ${shrine.name}（${shrine.name_kana}）
  住所: ${shrine.address}
  御祭神: ${shrine.main_deity}
  御利益: ${shrine.benefits?.join(", ")}
  説明: ${shrine.description}
`,
  )
  .join("\n")}

回答の際は以下を心がけてください：
- 親しみやすく丁寧な口調で回答する
- 具体的な神社名と御利益を含める
- 三社詣りの場合は3つの神社を推薦する
- 各神社の特徴や歴史も簡潔に説明する
- 福岡市内の神社のみを推薦する（太宰府は含めない）
`

      console.log("[v0] API呼び出し開始")
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      })

      console.log("[v0] API応答ステータス:", response.status)
      console.log("[v0] API応答OK:", response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.log("[v0] API応答エラー:", errorText)
        console.log("[v0] フォールバック機能に切り替え")
        return await generateKeywordResponse(userMessage)
      }

      const data = await response.json()
      console.log("[v0] API応答データ:", data)

      const aiResponse = data.content || data.message || data.response || data.text

      if (aiResponse) {
        console.log("[v0] AI応答成功:", aiResponse.substring(0, 100) + "...")
        return aiResponse
      } else {
        console.log("[v0] AI応答が空、フォールバックに切り替え")
        return await generateKeywordResponse(userMessage)
      }
    } catch (error) {
      console.error("[v0] AI応答生成エラー:", error)
      console.log("[v0] フォールバック機能に切り替え")
      return await generateKeywordResponse(userMessage)
    }
  }

  const findRelevantShrines = (message: string): Shrine[] => {
    const keywords = message.toLowerCase()
    return shrines.filter((shrine) => {
      const searchText = `${shrine.name} ${shrine.description} ${shrine.benefits?.join(" ")}`.toLowerCase()
      return keywords.split(" ").some((keyword) => searchText.includes(keyword))
    })
  }

  const generateKeywordResponse = async (userInput: string): Promise<string> => {
    const supabase = createClient()
    const keywords = userInput.toLowerCase()

    // 恋愛・縁結び関連
    if (
      keywords.includes("恋愛") ||
      keywords.includes("縁結び") ||
      keywords.includes("結婚") ||
      keywords.includes("出会い")
    ) {
      const { data } = await supabase.from("shrines").select("*").or("benefits.cs.{縁結び,恋愛成就}").limit(3)

      if (data && data.length > 0) {
        const shrineList = data.map((shrine) => `・${shrine.name}（${shrine.benefits?.join("、")}）`).join("\n")
        return `恋愛・縁結びのご利益がある神社をご紹介いたします。\n\n${shrineList}\n\nこれらの神社での三社詣りはいかがでしょうか？詳しい情報やルートをお知りになりたい場合は、お申し付けください。`
      }
    }

    // 仕事・商売関連
    if (
      keywords.includes("仕事") ||
      keywords.includes("商売") ||
      keywords.includes("成功") ||
      keywords.includes("昇進")
    ) {
      const { data } = await supabase.from("shrines").select("*").or("benefits.cs.{商売繁盛,仕事運向上}").limit(3)

      if (data && data.length > 0) {
        const shrineList = data.map((shrine) => `・${shrine.name}（${shrine.benefits?.join("、")}）`).join("\n")
        return `仕事運・商売繁盛のご利益がある神社をご紹介いたします。\n\n${shrineList}\n\nこれらの神社での三社詣りで、お仕事の成功をお祈りしてはいかがでしょうか？`
      }
    }

    // 学業・合格関連
    if (
      keywords.includes("学業") ||
      keywords.includes("合格") ||
      keywords.includes("試験") ||
      keywords.includes("勉強")
    ) {
      const { data } = await supabase.from("shrines").select("*").or("benefits.cs.{学業成就,合格祈願}").limit(3)

      if (data && data.length > 0) {
        const shrineList = data.map((shrine) => `・${shrine.name}（${shrine.benefits?.join("、")}）`).join("\n")
        return `学業成就・合格祈願のご利益がある神社をご紹介いたします。\n\n${shrineList}\n\n受験や資格試験の成功をお祈りする三社詣りコースをご提案いたします。`
      }
    }

    // 健康関連
    if (keywords.includes("健康") || keywords.includes("病気") || keywords.includes("回復")) {
      const { data } = await supabase.from("shrines").select("*").or("benefits.cs.{健康祈願,病気平癒}").limit(3)

      if (data && data.length > 0) {
        const shrineList = data.map((shrine) => `・${shrine.name}（${shrine.benefits?.join("、")}）`).join("\n")
        return `健康祈願のご利益がある神社をご紹介いたします。\n\n${shrineList}\n\nご健康をお祈りする三社詣りコースはいかがでしょうか？`
      }
    }

    // エリア指定
    if (keywords.includes("天神") || keywords.includes("博多") || keywords.includes("中洲")) {
      const { data } = await supabase
        .from("shrines")
        .select("*")
        .ilike("address", `%${keywords.includes("天神") ? "天神" : keywords.includes("博多") ? "博多" : "中洲"}%`)
        .limit(3)

      if (data && data.length > 0) {
        const shrineList = data.map((shrine) => `・${shrine.name}（${shrine.address}）`).join("\n")
        const area = keywords.includes("天神") ? "天神" : keywords.includes("博多") ? "博多" : "中洲"
        return `${area}エリアの神社をご紹介いたします。\n\n${shrineList}\n\nこのエリアでの三社詣りコースをご提案いたします。観光と合わせてお楽しみいただけます。`
      }
    }

    // 一般的な回答
    const { data } = await supabase.from("shrines").select("*").limit(3)

    if (data && data.length > 0) {
      const shrineList = data.map((shrine) => `・${shrine.name}（${shrine.benefits?.join("、")}）`).join("\n")
      return `福岡市内の人気の神社をご紹介いたします。\n\n${shrineList}\n\nご希望に合わせて、より詳しい三社詣りコースをご提案いたします。どのようなご利益をお求めでしょうか？`
    }

    return "申し訳ございません。現在、神社の情報を取得できません。しばらく経ってから再度お試しください。"
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
            src="https://idhxfowbqbazjrabyums.supabase.co/storage/v1/object/public/images/_con.png"
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
