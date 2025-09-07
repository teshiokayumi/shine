import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  "https://idhxfowbqbazjrabyums.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkaHhmb3dicWJhempyYWJ5dW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTY1NzUsImV4cCI6MjA3MjQ5MjU3NX0.PwNtRSJz_mVoqlRIBl-s0yqjA93ZmQ5ovcv83ii7C7o",
)

const GOOGLE_MAPS_API_KEY = "AIzaSyAIyoXf_vH8EcMYwVFSJA1AtRGr6QdDAFg"

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000,
    toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1),
    dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a)) // meters
}

function minDistanceToRoute(point: { lat: number; lng: number }, route: Array<{ lat: number; lng: number }>) {
  let best = Number.POSITIVE_INFINITY
  for (const p of route) best = Math.min(best, haversine(point.lat, point.lng, p.lat, p.lng))
  return best
}

async function getCoordinates(address: string) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`,
    )
    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location
      return { lat: location.lat, lng: location.lng }
    }
  } catch (error) {
    console.error("Geocoding error:", error)
  }
  return null
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  return haversine(lat1, lng1, lat2, lng2) / 1000 // convert meters to kilometers
}

async function optimizeThreeShrineRoute(shrines: any[], userLocation?: string) {
  if (!userLocation) {
    return shrines.slice(0, 3)
  }

  const userCoords = await getCoordinates(userLocation)
  if (!userCoords) {
    return shrines.slice(0, 3)
  }

  // 各神社の座標を取得
  const shrinesWithCoords = await Promise.all(
    shrines.map(async (shrine) => {
      const coords = await getCoordinates(shrine.address || "")
      if (coords) {
        const distance = haversine(userCoords.lat, userCoords.lng, coords.lat, coords.lng) / 1000
        return { ...shrine, distance, coordinates: coords }
      }
      return { ...shrine, distance: Number.POSITIVE_INFINITY }
    }),
  )

  // 有効な座標を持つ神社のみをフィルタ
  const validShrines = shrinesWithCoords.filter(
    (shrine) => shrine.coordinates && shrine.distance !== Number.POSITIVE_INFINITY,
  )

  if (validShrines.length < 3) {
    return validShrines.concat(shrinesWithCoords.filter((s) => !s.coordinates).slice(0, 3 - validShrines.length))
  }

  // 最適な3神社ルートを計算（総移動距離を最小化）
  let bestRoute = validShrines.slice(0, 3)
  let bestTotalDistance = Number.POSITIVE_INFINITY

  // 上位6つの神社から最適な3つの組み合わせを選択
  const candidates = validShrines.slice(0, Math.min(6, validShrines.length))

  for (let i = 0; i < candidates.length - 2; i++) {
    for (let j = i + 1; j < candidates.length - 1; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const route = [candidates[i], candidates[j], candidates[k]]

        // ユーザー位置から最初の神社 + 神社間の距離 + 最後の神社からユーザー位置
        const totalDistance =
          route[0].distance +
          haversine(
            route[0].coordinates.lat,
            route[0].coordinates.lng,
            route[1].coordinates.lat,
            route[1].coordinates.lng,
          ) /
            1000 +
          haversine(
            route[1].coordinates.lat,
            route[1].coordinates.lng,
            route[2].coordinates.lat,
            route[2].coordinates.lng,
          ) /
            1000

        if (totalDistance < bestTotalDistance) {
          bestTotalDistance = totalDistance
          bestRoute = route
        }
      }
    }
  }

  return bestRoute
}

async function selectNearbyShines(shrines: any[], userLocation?: string) {
  return await optimizeThreeShrineRoute(shrines, userLocation)
}

function formatShrineInfo(shrine: any) {
  const info = {
    name: shrine.name || "",
    address: shrine.address || "",
    deity: shrine.deity || "",
    benefits: shrine.benefits || "",
    description: shrine.description || "",
    hours: shrine.hours || "",
    phone: shrine.phone || "",
  }

  // null値や空文字列を除外
  return Object.fromEntries(Object.entries(info).filter(([_, value]) => value && value.trim() !== ""))
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()
    const userMessage = messages[messages.length - 1].content

    const locationKeywords = ["博多", "天神", "中央区", "博多区", "早良区", "東区", "西区", "南区", "城南区"]
    const userLocation = locationKeywords.find((keyword) => userMessage.includes(keyword))

    const { data: csvData, error } = await supabase
      .from("shrines") // テーブル名を入力
      .select("shrine_name, address, benefit_tag_1, benefit_tag_2, tag_attribute, other_benefits")

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "データベースエラーが発生しました" }, { status: 500 })
    }

    const allowedShrines = ["櫛田神社", "警固神社", "光雲神社", "住吉神社"]
    const filteredShrines = (csvData || []).filter((shrine) =>
      allowedShrines.some((allowed) => shrine.shrine_name?.includes(allowed)),
    )

    const shrines = filteredShrines

    const { data: spotsData } = await supabase.from("tourist_spots").select("spot_name, address, description")

    const touristSpots = spotsData || []

    try {
      const nearbyShines = await selectNearbyShines(shrines, userLocation)

      const shrineJsonData = nearbyShines.map((shrine) => ({
        name: shrine.shrine_name || "名称不明",
        address: shrine.address || "",
        benefit_tag_1: shrine.benefit_tag_1 || "",
        benefit_tag_2: shrine.benefit_tag_2 || "",
        tag_attribute: shrine.tag_attribute || "",
        other_benefits: shrine.other_benefits || "",
        distance:
          shrine.distance && shrine.distance !== Number.POSITIVE_INFINITY ? `${shrine.distance.toFixed(1)}km` : "",
      }))

      const touristSpotJsonData = touristSpots.map((spot) => ({
        name: spot.spot_name || "名称不明",
        address: spot.address || "",
        description: spot.description || "",
      }))

      if (!process.env.GEMINI_API_KEY) {
        console.log("[v0] GEMINI_API_KEY not found, using fallback")
        throw new Error("Gemini API key not configured")
      }

      console.log("[v0] Calling Gemini API with JSON data")

      const geminiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" +
          process.env.GEMINI_API_KEY,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `以下のJSONに福岡市内の神社データがあります。このJSONに含まれる神社だけを、人間向けにわかりやすく紹介してください。追加の神社は絶対に出さないでください。

神社データ: ${JSON.stringify(shrineJsonData)}

観光地データ: ${JSON.stringify(touristSpotJsonData)}

ユーザーの質問: "${userMessage}"
${userLocation ? `ユーザーの希望エリア: ${userLocation}` : ""}

以下の指針に従って回答してください：
1. JSONデータに含まれる神社のみを紹介する（追加の神社は絶対に出さない）
2. 「大濠公園から光雲神社へ行き、黒田家の繁栄を感じて警固公園へ行かれませんか？」のような自然で魅力的な提案をする
3. 距離情報を活用して効率的なルートを提案する
4. 福岡の歴史や文化を織り交ぜた親しみやすい表現を使う
5. 移動手段や所要時間も含める
6. データにない情報は推測せず、実際のデータのみを使用する

地理的に最適化されたルートで、実際に巡りやすい三社詣りを提案してください。`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.9,
              maxOutputTokens: 1024,
            },
          }),
        },
      )

      console.log("[v0] Gemini API response status:", geminiResponse.status)

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json()
        console.log(
          "[v0] Gemini API success, response length:",
          geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.length || 0,
        )
        const aiResponse = geminiData.candidates[0].content.parts[0].text
        return NextResponse.json({ content: aiResponse })
      } else {
        console.log("[v0] Gemini API failed with status:", geminiResponse.status)
        throw new Error("Gemini API request failed")
      }
    } catch (geminiError) {
      console.error("[v0] Gemini API error:", geminiError)
    }

    console.log("[v0] Using fallback response")
    const userMessageLower = userMessage.toLowerCase()
    let recommendedShrines = []

    if (userMessageLower.includes("恋愛") || userMessageLower.includes("結婚") || userMessageLower.includes("縁結び")) {
      recommendedShrines = shrines.filter(
        (s) =>
          s.benefit_tag_1?.includes("縁結び") ||
          s.benefit_tag_2?.includes("縁結び") ||
          s.benefit_tag_1?.includes("恋愛") ||
          s.benefit_tag_2?.includes("恋愛"),
      )
    } else if (
      userMessageLower.includes("仕事") ||
      userMessageLower.includes("就職") ||
      userMessageLower.includes("商売")
    ) {
      recommendedShrines = shrines.filter(
        (s) =>
          s.benefit_tag_1?.includes("商売繁盛") ||
          s.benefit_tag_2?.includes("商売繁盛") ||
          s.benefit_tag_1?.includes("必勝") ||
          s.benefit_tag_2?.includes("必勝"),
      )
    } else if (userMessageLower.includes("健康") || userMessageLower.includes("病気")) {
      recommendedShrines = shrines.filter(
        (s) =>
          s.benefit_tag_1?.includes("健康") ||
          s.benefit_tag_2?.includes("健康") ||
          s.benefit_tag_1?.includes("厄除け") ||
          s.benefit_tag_2?.includes("厄除け"),
      )
    } else if (
      userMessageLower.includes("学業") ||
      userMessageLower.includes("受験") ||
      userMessageLower.includes("合格")
    ) {
      recommendedShrines = shrines.filter(
        (s) =>
          s.benefit_tag_1?.includes("学問") ||
          s.benefit_tag_2?.includes("学問") ||
          s.benefit_tag_1?.includes("合格") ||
          s.benefit_tag_2?.includes("合格"),
      )
    } else {
      recommendedShrines = shrines.slice(0, 3)
    }

    const selectedShrines = await selectNearbyShines(
      recommendedShrines.length > 0 ? recommendedShrines : shrines,
      userLocation,
    )

    const shrineDescriptions = selectedShrines
      .map((shrine, index) => {
        const name = shrine.shrine_name || "名称不明"
        const address = shrine.address || ""
        const benefits = [shrine.benefit_tag_1, shrine.benefit_tag_2].filter(Boolean).join("、") || ""
        const orderWords = ["まず", "次に", "そして"]
        const distanceInfo =
          shrine.distance && shrine.distance !== Number.POSITIVE_INFINITY ? `（約${shrine.distance.toFixed(1)}km）` : ""

        return `${orderWords[index] || "最後に"}、${name}${distanceInfo}へ足を向けてみませんか。${address ? `${address}にある` : ""}この神社は${benefits ? `${benefits}で知られ、` : ""}福岡の歴史を感じられる場所です。心静かに参拝できます。`
      })
      .join("\n\n")

    const response = `福岡の神社巡りはいかがでしょうか？

${userMessage.includes("観光") ? "福岡市内の魅力的な神社を巡る" : "あなたのお願いにぴったりの"}特別なコースをご提案させていただきますね。

${shrineDescriptions}

このコースなら、福岡の歴史と文化を肌で感じながら、心願成就への道のりを歩むことができます。地下鉄やバスを使えば効率よく回れますし、各神社の周辺には美味しいグルメスポットもありますよ。

参拝の際は、手水舎でのお清めを忘れずに。そして、それぞれの神社の御朱印をいただくのも素敵な思い出になります。

他にも福岡の隠れた名所や、おすすめの参拝ルートがございましたら、お気軽にお尋ねください！`

    return NextResponse.json({ content: response })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "申し訳ございません。エラーが発生しました。" }, { status: 500 })
  }
}
