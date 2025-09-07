// CSVファイルからデータを取得してSupabaseに挿入するスクリプト
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  "https://idhxfowbqbazjrabyums.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkaHhmb3dicWJhempyYWJ5dW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTY1NzUsImV4cCI6MjA3MjQ5MjU3NX0.PwNtRSJz_mVoqlRIBl-s0yqjA93ZmQ5ovcv83ii7C7o",
)

async function parseCSV(url) {
  try {
    const response = await fetch(url)
    const text = await response.text()
    const lines = text.split("\n")
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))

    return lines
      .slice(1)
      .filter((line) => line.trim())
      .map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))
        const obj = {}
        headers.forEach((header, index) => {
          obj[header] = values[index] || null
        })
        return obj
      })
  } catch (error) {
    console.error("CSV parsing error:", error)
    return []
  }
}

async function importData() {
  console.log("CSVデータの取得を開始します...")

  // 神社データの取得
  const shrinesData = await parseCSV(
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/shrines-mrkZ2YsA8abthnmhZ8VvQtnYa09jDa.csv",
  )
  console.log(`神社データ: ${shrinesData.length}件取得`)

  // 観光地データの取得
  const touristSpotsData = await parseCSV(
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/tourist_spots-Auh1lcOyTpkbp3P0YrYqG06SWfLMCH.csv",
  )
  console.log(`観光地データ: ${touristSpotsData.length}件取得`)

  // 既存データを削除
  await supabase.from("shrines").delete().neq("id", 0)
  await supabase.from("tourist_spots").delete().neq("id", 0)

  // 神社データの挿入
  if (shrinesData.length > 0) {
    const shrineInserts = shrinesData.map((shrine) => ({
      name: shrine.shrine_name,
      address: shrine.address,
      benefits: [shrine.benefit_tag_1, shrine.benefit_tag_2].filter(Boolean).join(", "),
      tag_attribute: shrine.tag_attribute,
      deity: shrine.other_benefits, // 御祭神情報として使用
      description: `${shrine.tag_attribute || ""}神社として親しまれています`,
      hours: "6:00-18:00", // デフォルト時間
      phone: null,
    }))

    const { error: shrineError } = await supabase.from("shrines").insert(shrineInserts)
    if (shrineError) {
      console.error("神社データ挿入エラー:", shrineError)
    } else {
      console.log(`神社データ ${shrineInserts.length}件を挿入しました`)
    }
  }

  // 観光地データの挿入
  if (touristSpotsData.length > 0) {
    const spotInserts = touristSpotsData.map((spot) => ({
      name: spot.spot_name,
      address: spot.address,
      description: spot.description,
    }))

    const { error: spotError } = await supabase.from("tourist_spots").insert(spotInserts)
    if (spotError) {
      console.error("観光地データ挿入エラー:", spotError)
    } else {
      console.log(`観光地データ ${spotInserts.length}件を挿入しました`)
    }
  }

  console.log("データ取得・挿入が完了しました")
}

importData()
