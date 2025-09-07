"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface Shrine {
  id: number
  name: string
  name_kana: string
  description: string
  address: string
  main_deity: string
  benefits: string[]
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "こんにちは！福岡三社詣りコンシェルジュです。あなたの願い事や神社に関するご質問をお聞かせください。最適な神社をご提案いたします。",
      timestamp: new Date(),
    },
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [shrines, setShrines] = useState<Shrine[]>([])

  useEffect(() => {
    // 神社データを取得
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
    // メッセージが追加されたら最下部にスクロール
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const generateAIResponse = async (userMessage: string): Promise<string> => {
    try {
      // 神社データベースから関連する神社を検索
      const relevantShrines = findRelevantShrines(userMessage)

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

      if (!response.ok) {
        throw new Error("AI応答の生成に失敗しました")
      }

      const data = await response.json()
      return data.content || "すみません、応答の生成に失敗しました。もう一度お試しください。"
    } catch (error) {
      console.error("AI応答生成エラー:", error)
      return "すみません、現在AIサービスに接続できません。しばらく経ってからもう一度お試しください。"
    }
  }

  const findRelevantShrines = (message: string): Shrine[] => {
    const keywords = message.toLowerCase()
    return shrines.filter((shrine) => {
      const searchText = `${shrine.name} ${shrine.description} ${shrine.benefits?.join(" ")}`.toLowerCase()
      return keywords.split(" ").some((keyword) => searchText.includes(keyword))
    })
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputMessage("")
    setIsLoading(true)

    try {
      const aiResponse = await generateAIResponse(userMessage.content)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("メッセージ送信エラー:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "すみません、エラーが発生しました。もう一度お試しください。",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <img
            src="https://idhxfowbqbazjrabyums.supabase.co/storage/v1/object/public/images/_con.png"
            alt="執事アイコン"
            className="w-[80px] h-[80px] object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground mb-2">AIコンシェルジュチャット</h1>
          <p className="text-muted-foreground">神社や願い事について何でもお聞きください</p>
        </div>

        {/* チャットエリア */}
        <Card className="shadow-lg border-border/50 h-[600px] flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-foreground flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              福岡三社詣りコンシェルジュ
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            {/* メッセージ表示エリア */}
            <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
              <div className="space-y-4 pb-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-3 ${
                      message.role === "user" ? "flex-row-reverse space-x-reverse" : ""
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`flex-1 max-w-[80%] ${message.role === "user" ? "text-right" : "text-left"}`}>
                      <div
                        className={`inline-block p-3 rounded-lg ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {message.timestamp.toLocaleTimeString("ja-JP", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="inline-block p-3 rounded-lg bg-muted text-muted-foreground">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">考え中...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* 入力エリア */}
            <div className="border-t border-border/50 p-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="願い事や神社について質問してください..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || isLoading} size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
