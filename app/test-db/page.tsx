"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Shrine {
  id: number
  name: string
  name_kana: string
  description: string
  address: string
  main_deity: string
  benefits: string[]
}

export default function TestDBPage() {
  const [shrines, setShrines] = useState<Shrine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchShrines() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("shrines").select("*").limit(3)

        if (error) {
          console.error("Supabase error:", error)
          setError(error.message)
        } else {
          setShrines(data || [])
        }
      } catch (err) {
        console.error("Connection error:", err)
        setError("データベース接続エラー")
      } finally {
        setLoading(false)
      }
    }

    fetchShrines()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <p>データベース接続テスト中...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-500">エラー: {error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Supabaseデータベース接続テスト</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">接続成功！神社データ取得結果:</p>
          <div className="space-y-4">
            {shrines.map((shrine) => (
              <div key={shrine.id} className="border p-4 rounded">
                <h3 className="font-bold">{shrine.name}</h3>
                <p className="text-sm text-gray-600">{shrine.name_kana}</p>
                <p className="mt-2">{shrine.description}</p>
                <p className="text-sm mt-1">住所: {shrine.address}</p>
                <p className="text-sm">御祭神: {shrine.main_deity}</p>
                <p className="text-sm">御利益: {shrine.benefits?.join(", ")}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
