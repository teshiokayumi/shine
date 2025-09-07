"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MapPin, Phone, Clock, ExternalLink, Navigation } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface Shrine {
  id: number
  name: string
  name_kana: string
  description: string
  address: string
  latitude: number
  longitude: number
  phone: string
  website: string
  opening_hours: string
  access_info: string
  main_deity: string
  benefits: string[]
  image_url: string
}

interface WishCategory {
  id: number
  name: string
  description: string
}

export default function ShrinePage() {
  const params = useParams()
  const router = useRouter()
  const [shrine, setShrine] = useState<Shrine | null>(null)
  const [relatedCategories, setRelatedCategories] = useState<WishCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchShrineData() {
      if (!params.id) return

      const supabase = createClient()

      try {
        // 神社の詳細情報を取得
        const { data: shrineData, error: shrineError } = await supabase
          .from("shrines")
          .select("*")
          .eq("id", params.id)
          .single()

        if (shrineError) {
          setError("神社情報の取得に失敗しました")
          return
        }

        setShrine(shrineData)

        // 関連する願い事カテゴリを取得
        const { data: categoryData, error: categoryError } = await supabase
          .from("shrine_wish_categories")
          .select(`
            wish_categories (
              id,
              name,
              description
            )
          `)
          .eq("shrine_id", params.id)

        if (categoryData && !categoryError) {
          const categories = categoryData.map((item) => item.wish_categories).filter(Boolean) as WishCategory[]
          setRelatedCategories(categories)
        }
      } catch (err) {
        console.error("データ取得エラー:", err)
        setError("データの取得中にエラーが発生しました")
      } finally {
        setLoading(false)
      }
    }

    fetchShrineData()
  }, [params.id])

  const openGoogleMaps = () => {
    if (shrine) {
      const url = `https://www.google.com/maps/search/?api=1&query=${shrine.latitude},${shrine.longitude}`
      window.open(url, "_blank")
    }
  }

  const openDirections = () => {
    if (shrine) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${shrine.latitude},${shrine.longitude}`
      window.open(url, "_blank")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-lg border-border/50">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">読み込み中...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !shrine) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-lg border-border/50">
            <CardContent className="p-8 text-center">
              <p className="text-red-500 mb-4">{error || "神社が見つかりませんでした"}</p>
              <Button onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                戻る
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted p-4">
      <div className="max-w-4xl mx-auto">
        {/* 戻るボタン */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
        </div>

        {/* メイン情報カード */}
        <Card className="shadow-lg border-border/50 mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:space-x-6">
              <div className="flex-1">
                <CardTitle className="text-2xl text-foreground mb-2">{shrine.name}</CardTitle>
                <CardDescription className="text-lg text-muted-foreground mb-4">{shrine.name_kana}</CardDescription>
                <p className="text-foreground">{shrine.description}</p>
              </div>
              {shrine.image_url && (
                <div className="mt-4 md:mt-0">
                  <img
                    src={shrine.image_url || "/placeholder.svg"}
                    alt={shrine.name}
                    className="w-full md:w-48 h-48 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 基本情報 */}
          <Card className="shadow-lg border-border/50">
            <CardHeader>
              <CardTitle className="text-xl text-foreground">基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">住所</p>
                  <p className="text-sm text-muted-foreground">{shrine.address}</p>
                </div>
              </div>

              {shrine.phone && (
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">電話番号</p>
                    <p className="text-sm text-muted-foreground">{shrine.phone}</p>
                  </div>
                </div>
              )}

              {shrine.opening_hours && (
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">参拝時間</p>
                    <p className="text-sm text-muted-foreground">{shrine.opening_hours}</p>
                  </div>
                </div>
              )}

              {shrine.website && (
                <div className="flex items-start space-x-3">
                  <ExternalLink className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">公式サイト</p>
                    <a
                      href={shrine.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {shrine.website}
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 御祭神・御利益 */}
          <Card className="shadow-lg border-border/50">
            <CardHeader>
              <CardTitle className="text-xl text-foreground">御祭神・御利益</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium text-foreground mb-2">御祭神</p>
                <p className="text-sm text-muted-foreground">{shrine.main_deity}</p>
              </div>

              <div>
                <p className="font-medium text-foreground mb-2">御利益</p>
                <div className="flex flex-wrap gap-2">
                  {shrine.benefits?.map((benefit, index) => (
                    <Badge key={index} variant="secondary">
                      {benefit}
                    </Badge>
                  ))}
                </div>
              </div>

              {relatedCategories.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-2">関連する願い事</p>
                  <div className="flex flex-wrap gap-2">
                    {relatedCategories.map((category) => (
                      <Badge key={category.id} variant="outline">
                        {category.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 地図・アクセス */}
        <Card className="shadow-lg border-border/50 mt-6">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">地図・アクセス</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Google Maps埋め込み */}
            <div className="mb-4">
              <iframe
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dO_BcqCGAOtEtE&q=${shrine.latitude},${shrine.longitude}&zoom=15`}
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="rounded-lg"
              />
            </div>

            {shrine.access_info && (
              <div className="mb-4">
                <p className="font-medium text-foreground mb-2">アクセス情報</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{shrine.access_info}</p>
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={openGoogleMaps} className="flex-1">
                <MapPin className="w-4 h-4 mr-2" />
                Google Mapsで開く
              </Button>
              <Button onClick={openDirections} variant="outline" className="flex-1 bg-transparent">
                <Navigation className="w-4 h-4 mr-2" />
                ルート検索
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
