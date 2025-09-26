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

async function optimizeRouteWithSpots(spots: any[], userLocation?: string) {
  if (!userLocation) {
    return spots.slice(0, 3)
  }

  const userCoords = await getCoordinates(userLocation)
  if (!userCoords) {
    return spots.slice(0, 3)
  }

  // 緯度経度が既にある場合はそれを使用、ない場合はジオコーディング
  const spotsWithCoords = await Promise.all(
    spots.map(async (spot) => {
      let coords = null
      let distance = Number.POSITIVE_INFINITY

      if (spot.latitude && spot.longitude) {
        coords = { lat: Number.parseFloat(spot.latitude), lng: Number.parseFloat(spot.longitude) }
        distance = haversine(userCoords.lat, userCoords.lng, coords.lat, coords.lng) / 1000
      } else if (spot.address) {
        coords = await getCoordinates(spot.address)
        if (coords) {
          distance = haversine(userCoords.lat, userCoords.lng, coords.lat, coords.lng) / 1000
        }
      }

      return { ...spot, distance, coordinates: coords }
    }),
  )

  // 有効な座標を持つスポットのみをフィルタ
  const validSpots = spotsWithCoords.filter((spot) => spot.coordinates && spot.distance !== Number.POSITIVE_INFINITY)

  if (validSpots.length < 3) {
    return validSpots.concat(spotsWithCoords.filter((s) => !s.coordinates).slice(0, 3 - validSpots.length))
  }

  // 最適な3スポットルートを計算（総移動距離を最小化）
  let bestRoute = validSpots.slice(0, 3)
  let bestTotalDistance = Number.POSITIVE_INFINITY

  const candidates = validSpots.slice(0, Math.min(6, validSpots.length))

  for (let i = 0; i < candidates.length - 2; i++) {
    for (let j = i + 1; j < candidates.length - 1; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const route = [candidates[i], candidates[j], candidates[k]]

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

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()
    const userMessage = messages[messages.length - 1].content

    const locationKeywords = ["博多", "天神", "中央区", "博多区", "早良区", "東区", "西区", "南区", "城南区"]
    const userLocation = locationKeywords.find((keyword) => userMessage.includes(keyword))

    const { data: spotsData, error: spotsError } = await supabase
      .from("spots")
      .select(
        "spotid, shrine_name, address, benefit_tag_1, benefit_tag_2, tag_attribute, other_benefits, latitude, longitude, category",
      )

    if (spotsError) {
      console.error("Spots database error:", spotsError)
      return NextResponse.json({ error: "データベースエラーが発生しました" }, { status: 500 })
    }

    const { data: coursesData } = await supabase.from("courses").select("course_id, name, description, theme")

    const { data: courseSpotsData } = await supabase.from("course_spots").select("course_id, spot_id, order")

    const mentionedSpots = (spotsData || []).filter(
      (spot) =>
        userMessage.includes(spot.shrine_name) ||
        userMessage.includes(spot.address?.split("区")[0] + "区") ||
        (spot.other_benefits && userMessage.includes(spot.other_benefits.substring(0, 10))),
    )

    let relevantCourses = []
    if (mentionedSpots.length > 0) {
      const mentionedSpotIds = mentionedSpots.map((spot) => spot.spotid)
      const relatedCourseIds = (courseSpotsData || [])
        .filter((cs) => mentionedSpotIds.includes(cs.spot_id))
        .map((cs) => cs.course_id)

      relevantCourses = (coursesData || []).filter((course) => relatedCourseIds.includes(course.course_id))
    } else {
      relevantCourses = (coursesData || []).filter(
        (course) =>
          userMessage.includes(course.theme) ||
          userMessage.includes(course.name) ||
          course.theme?.includes("神社") ||
          course.theme?.includes("観光"),
      )
    }

    const allowedShrines = [
      { name: "櫛田神社", district: "博多区" },
      { name: "警固神社", district: "中央区" },
      { name: "光雲神社", district: "中央区" },
      { name: "住吉神社", district: "博多区" },
    ]

    const shrineSpots = (spotsData || []).filter(
      (spot) =>
        spot.category === "神社" ||
        allowedShrines.some(
          (allowed) => spot.shrine_name?.includes(allowed.name) && spot.address?.includes(allowed.district),
        ),
    )

    const touristSpots = (spotsData || []).filter((spot) => spot.category && spot.category !== "神社")

    try {
      const nearbyShines = await optimizeRouteWithSpots(shrineSpots, userLocation)

      const shrineJsonData = nearbyShines.map((spot) => ({
        name: spot.shrine_name || "名称不明",
        address: spot.address || "",
        benefit_tag_1: spot.benefit_tag_1 || "",
        benefit_tag_2: spot.benefit_tag_2 || "",
        tag_attribute: spot.tag_attribute || "",
        other_benefits: spot.other_benefits || "",
        latitude: spot.latitude || "",
        longitude: spot.longitude || "",
        distance: spot.distance && spot.distance !== Number.POSITIVE_INFINITY ? `${spot.distance.toFixed(1)}km` : "",
      }))

      const touristSpotJsonData = touristSpots.slice(0, 10).map((spot) => ({
        name: spot.shrine_name || "名称不明",
        address: spot.address || "",
        description: spot.other_benefits || "",
        category: spot.category || "",
        latitude: spot.latitude || "",
        longitude: spot.longitude || "",
      }))

      const courseJsonData = relevantCourses.map((course) => ({
        id: course.course_id,
        name: course.name,
        description: course.description,
        theme: course.theme,
      }))

      if (!process.env.GEMINI_API_KEY) {
        console.log("[v0] GEMINI_API_KEY not found, using fallback")
        throw new Error("Gemini API key not configured")
      }

      console.log("[v0] Calling Gemini API with enhanced data structure")

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
                    text: `あなたは福岡市の神社めぐりと観光案内の専門コンシェルジュです。以下のデータを参考に、ユーザーの質問に対して魅力的で実用的な案内をしてください。

神社データ（本日案内可能な4社のみ）: ${JSON.stringify(shrineJsonData)}

観光地データ: ${JSON.stringify(touristSpotJsonData)}

おすすめコース: ${JSON.stringify(courseJsonData)}

ユーザーの質問: "${userMessage}"
${userLocation ? `ユーザーの希望エリア: ${userLocation}` : ""}

【重要な指針】
1. 本日は博多区櫛田神社、中央区警固神社、中央区光雲神社、博多区住吉神社の4社のみを案内する
2. これら以外の神社は絶対に紹介しない
3. 神社や観光スポットを問いかけられたら、そのスポット近くのツアー（おすすめコース）を参照して答える
4. 複数のコースがある場合は「いくつかプランがございます」と伝え、各コースのdescriptionを紹介する
5. 対応する神社がない場合は「この近くにはございませんので、他のところはいかがでしょう」と返答する
6. 返答では必ずshrine_nameフィールドの値を使用して神社名を表示する
7. 緯度経度データを活用して地理的に効率的なルートを提案する
8. 神社だけでなく、周辺の観光地も組み合わせた総合的な福岡観光プランを提案する
9. 移動手段（徒歩、地下鉄、バス）と所要時間も含める
10. 福岡の歴史や文化的背景を織り交ぜた親しみやすい表現を使う
11. データにない情報は推測せず、実際のデータのみを使用する

地理的に最適化されたルートで、神社めぐりと観光を組み合わせた特別な福岡体験を提案してください。`,
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

    console.log("[v0] Using enhanced fallback response")
    const userMessageLower = userMessage.toLowerCase()

    if (mentionedSpots.length > 0) {
      if (relevantCourses.length > 1) {
        const courseDescriptions = relevantCourses.map((course) => `・${course.name}: ${course.description}`).join("\n")

        const response = `いくつかプランがございます！\n\n${courseDescriptions}\n\nどちらのプランがお気に入りでしょうか？詳しくご案内いたします。`
        return NextResponse.json({ content: response })
      } else if (relevantCourses.length === 1) {
        const course = relevantCourses[0]
        const response = `${course.name}のプランをご案内いたします！\n\n${course.description}\n\nこちらのコースはいかがでしょうか？`
        return NextResponse.json({ content: response })
      } else {
        const response = `この近くにはございませんので、他のところはいかがでしょう？\n\n本日は博多区の櫛田神社、中央区の警固神社、中央区の光雲神社、博多区の住吉神社をご案内できます。`
        return NextResponse.json({ content: response })
      }
    }

    let recommendedSpots = []

    if (userMessageLower.includes("恋愛") || userMessageLower.includes("結婚") || userMessageLower.includes("縁結び")) {
      recommendedSpots = shrineSpots.filter(
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
      recommendedSpots = shrineSpots.filter(
        (s) =>
          s.benefit_tag_1?.includes("商売繁盛") ||
          s.benefit_tag_2?.includes("商売繁盛") ||
          s.benefit_tag_1?.includes("必勝") ||
          s.benefit_tag_2?.includes("必勝"),
      )
    } else {
      recommendedSpots = shrineSpots.slice(0, 3)
    }

    const selectedSpots = await optimizeRouteWithSpots(
      recommendedSpots.length > 0 ? recommendedSpots : shrineSpots,
      userLocation,
    )

    const spotDescriptions = selectedSpots
      .map((spot, index) => {
        const name = spot.shrine_name || "名称不明"
        const address = spot.address || ""
        const benefits = [spot.benefit_tag_1, spot.benefit_tag_2].filter(Boolean).join("、") || ""
        const orderWords = ["まず", "次に", "そして"]
        const distanceInfo =
          spot.distance && spot.distance !== Number.POSITIVE_INFINITY ? `（約${spot.distance.toFixed(1)}km）` : ""

        return `${orderWords[index] || "最後に"}、${name}${distanceInfo}へ足を向けてみませんか。${address ? `${address}にある` : ""}この神社は${benefits ? `${benefits}で知られ、` : ""}福岡の歴史を感じられる場所です。`
      })
      .join("\n\n")

    const response = `福岡市で神社めぐりをしながら観光地へとご案内いたします！\n\n${userMessage.includes("観光") ? "福岡市内の魅力的な神社と観光地を巡る" : "あなたのお願いにぴったりの"}特別なコースをご提案させていただきますね。\n\n${spotDescriptions}\n\nこのコースなら、福岡の歴史と文化を肌で感じながら、心願成就への道のりを歩むことができます。地下鉄やバスを使えば効率よく回れますし、各スポットの周辺には美味しいグルメや見どころもたくさんありますよ。\n\n他にも福岡の隠れた名所や、おすすめの観光ルートがございましたら、お気軽にお尋ねください！`

    return NextResponse.json({ content: response })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "申し訳ございません。エラーが発生しました。" }, { status: 500 })
  }
}
