"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MessageCircle, Bot, Cloud, Sun, CloudRain, Snowflake } from "lucide-react"
import Link from "next/link"

interface WeatherData {
  temperature: number
  weatherCode: number
  windSpeed: number
  humidity: number
}

export default function HomePage() {
  const [randomBanner, setRandomBanner] = useState<string>("")
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(true)

  useEffect(() => {
    const bannerImages = [
      "https://www.asahi-net.or.jp/~mi7k-hmd/miko1.png",
      "https://www.asahi-net.or.jp/~mi7k-hmd/miko3.png",
    ]
    const selectedBanner = bannerImages[Math.floor(Math.random() * bannerImages.length)]
    setRandomBanner(selectedBanner)

    const fetchWeather = async () => {
      try {
        const response = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=33.5904&longitude=130.4017&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=Asia%2FTokyo",
        )
        const data = await response.json()
        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          weatherCode: data.current.weather_code,
          windSpeed: data.current.wind_speed_10m,
          humidity: data.current.relative_humidity_2m,
        })
      } catch (error) {
        console.error("天気データの取得に失敗しました:", error)
      } finally {
        setWeatherLoading(false)
      }
    }

    fetchWeather()
  }, [])

  const getWeatherInfo = (code: number) => {
    if (code === 0) return { icon: Sun, text: "晴れ", color: "text-yellow-500" }
    if (code <= 3) return { icon: Cloud, text: "曇り", color: "text-gray-500" }
    if (code <= 67) return { icon: CloudRain, text: "雨", color: "text-blue-500" }
    if (code <= 77) return { icon: Snowflake, text: "雪", color: "text-blue-300" }
    return { icon: Cloud, text: "曇り", color: "text-gray-500" }
  }

  const getWeatherAdvice = (code: number, temp: number) => {
    if (code === 0) return "晴天に恵まれた参拝日和です！"
    if (code <= 3) return "曇り空ですが、参拝には適した天気です。"
    if (code <= 67) return "雨の日の参拝も神聖な体験です。傘をお忘れなく。"
    if (temp < 10) return "寒い日です。暖かい服装でお参りください。"
    if (temp > 30) return "暑い日です。水分補給を忘れずに。"
    return "今日も良い参拝日です。"
  }

  const openConcierge = () => {
    window.open("/concierge", "concierge", "width=800,height=600,scrollbars=yes,resizable=yes")
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">福</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">福岡三社詣り</h1>
                <p className="text-sm text-gray-600">AI参拝ガイド</p>
              </div>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/chat">
                <Button variant="outline" size="sm" className="border-pink-200 hover:bg-pink-50 bg-transparent">
                  <Bot className="w-4 h-4 mr-2" />
                  AIチャット
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 巫女イラストバナー */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <img
              src={randomBanner || "/placeholder.svg?height=200&width=400&query=巫女さんイラスト"}
              alt="巫女さんイラスト"
              className="w-96 h-48 object-cover rounded-2xl shadow-lg border-4 border-pink-200"
            />
          </div>
        </div>

        {/* タイトルと説明文 */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-8">福岡三社参拝</h2>
          <div className="space-y-4 text-gray-700 text-lg leading-relaxed max-w-3xl mx-auto">
            <p>福岡市で神社めぐりをしながら観光地へとご案内するコンシェルジュです。</p>
          </div>
        </div>

        {/* コンシェルジュカード */}
        <div className="flex justify-center mb-12">
          <Card
            className="w-full max-w-2xl shadow-lg border-2 border-pink-200 cursor-pointer hover:shadow-xl transition-all duration-300 hover:border-pink-300"
            onClick={openConcierge}
          >
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <img
                    src="https://www.asahi-net.or.jp/~mi7k-hmd/_con.png"
                    alt="執事アイコン"
                    className="w-16 h-16 object-contain"
                  />
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">コンシェルジュに相談する</h3>
                    <p className="text-gray-600">あなたの願いに最適な三社詣りルートをAIがご提案いたします</p>
                  </div>
                </div>
                <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 天気表示セクション */}
        <div className="flex justify-center">
          <Card className="w-full max-w-2xl shadow-lg border-2 border-blue-200">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">福岡市天神 現在の天気</h3>
              {weatherLoading ? (
                <div className="text-center text-gray-600">天気情報を取得中...</div>
              ) : weather ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-4">
                    {(() => {
                      const { icon: WeatherIcon, text, color } = getWeatherInfo(weather.weatherCode)
                      return (
                        <>
                          <WeatherIcon className={`w-8 h-8 ${color}`} />
                          <span className="text-2xl font-bold text-gray-900">{weather.temperature}°C</span>
                          <span className="text-lg text-gray-700">{text}</span>
                        </>
                      )
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div className="text-center">
                      <div className="font-semibold">風速</div>
                      <div>{weather.windSpeed} km/h</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">湿度</div>
                      <div>{weather.humidity}%</div>
                    </div>
                  </div>
                  <div className="text-center text-pink-600 font-medium">
                    {getWeatherAdvice(weather.weatherCode, weather.temperature)}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-600">天気情報の取得に失敗しました</div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-600">
            <p className="mb-2">© 2024 福岡三社詣り - AI参拝ガイド</p>
            <p className="text-sm">※ 参拝時間や交通情報は推定値です。実際の状況をご確認ください。</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
