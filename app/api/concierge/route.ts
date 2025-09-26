import { type NextRequest, NextResponse } from "next/server"

// ★ CSV読み取り（最小動作用：外部CSVでもpublic配下でもOK）
async function fetchCSV(url: string) {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`CSV fetch failed: ${url} ${res.status}`)
  const text = await res.text()
  const [header, ...rows] = text.trim().split("\n")
  const keys = header.split(",").map((h) => h.trim().replace(/(^"|"$)/g, ""))
  return rows.map((r) => {
    const vals = r.split(",").map((v) => v.trim().replace(/(^"|"$)/g, ""))
    const obj: Record<string, string> = {}
    keys.forEach((k, i) => (obj[k] = vals[i] ?? ""))
    return obj
  })
}

type Spot = {
  spotid?: string
  spotID?: string
  shrine_name?: string
  address?: string
  latitude?: string
  longitude?: string
  category?: string
  benefit_tag_1?: string
  benefit_tag_2?: string
  tag_attribute?: string
  other_benefits?: string
}
type Course = { course_id?: string; courseId?: string; name?: string; description?: string; theme?: string }
type CourseSpot = { course_id?: string; courseId?: string; spot_id?: string; spotid?: string; order?: string }

async function refineWithGemini(apiKey: string, message: string, userQuery: string): Promise<string> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `あなたは福岡市の神社めぐりと観光案内の専門コンシェルジュです。以下の基本情報を、より親しみやすく魅力的な表現に整えてください。

ユーザーの質問: "${userQuery}"
基本応答: "${message}"

【指針】
- 福岡の歴史や文化的背景を織り交ぜる
- 親しみやすく丁寧な敬語を使用
- 神社の魅力や観光の楽しさを伝える
- 実用的な情報（移動手段、所要時間など）も含める
- 温かみのあるコンシェルジュらしい表現にする

整えた応答:`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.9,
            maxOutputTokens: 512,
          },
        }),
      },
    )

    if (response.ok) {
      const data = await response.json()
      return data.candidates[0].content.parts[0].text
    }
  } catch (error) {
    console.error("Gemini refinement error:", error)
  }
  return message // フォールバック
}

export async function POST(req: NextRequest) {
  // 1) 入力取得
  let body: any = {}
  try {
    body = await req.json()
  } catch {}
  const userQuery: string = body?.query ?? body?.messages?.[body.messages.length - 1]?.content ?? ""
  const preferShrine: string = body?.shrine_name ?? "" // ★必ずshrine_nameフィールドを優先

  // 2) データ読込（実際のCSV URLを使用）
  try {
    const [spots, courses, courseSpots] = await Promise.all([
      fetchCSV(
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/shrines%20-%20spot-f1YwPxEbFHsLAyI3T1rupbNUM6pr3I.csv",
      ) as Promise<Spot[]>,
      fetchCSV(
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/shrines%20-%20courses-h2iZmLoTHDWZ8VBu3O7IxHKhboDin6.csv",
      ) as Promise<Course[]>,
      fetchCSV(
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/shrines%20-%20course_spots-8opDgc9DP48nrsaWyGukc7HGQmNPL8.csv",
      ) as Promise<CourseSpot[]>,
    ])

    const allowedShrines = ["櫛田神社", "警固神社", "光雲神社", "住吉神社"]
    const filteredSpots = spots.filter((spot) => allowedShrines.some((allowed) => spot.shrine_name?.includes(allowed)))

    // 3) shrine_nameでスポット同定（大小文字ゆるマッチ）
    const norm = (s: string) => s?.toLowerCase().trim()
    const targetShrine = preferShrine || userQuery // 質問に神社名が含まれるケースも拾う
    const spot =
      filteredSpots.find((s) => norm(s.shrine_name || "") === norm(targetShrine)) ??
      // ゆる包含（例：「住吉神社」「住吉」）
      filteredSpots.find((s) => norm(s.shrine_name || "").includes(norm(targetShrine)))

    if (!spot && targetShrine.length > 1) {
      const message =
        "この近くにはございませんので、他のところはいかがでしょう？本日は博多区の櫛田神社、中央区の警固神社、中央区の光雲神社、博多区の住吉神社をご案内できます。"

      let finalMessage = message
      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (apiKey) {
          finalMessage = await refineWithGemini(apiKey, message, userQuery)
        }
      } catch {
        /* LLM失敗は無視して素のmessageを返す */
      }

      return NextResponse.json({
        ok: true,
        message: finalMessage,
        shrine_name: null,
        plans: [],
      })
    }

    const shrine_name = spot?.shrine_name || "" // ★必ずshrine_nameで出す
    const spotKey = (spot?.spotid || spot?.spotID || "").toString()

    // 4) コース候補の抽出（course_spots→courses）
    const relCourseIds = courseSpots
      .filter((cs) => (cs.spot_id || cs.spotid || "") === spotKey)
      .map((cs) => (cs.course_id || cs.courseId || "").toString())

    const plans = courses
      .filter((c) => relCourseIds.includes((c.course_id || c.courseId || "").toString()))
      .map((c) => ({
        course_id: c.course_id || c.courseId || "",
        name: c.name || "",
        description: c.description || "",
        theme: c.theme || "",
        shrine_name, // ★返答は統一してこのキーを持たせる
      }))

    // 5) 応答メッセージ生成（LLMなしでも人間語で返す）
    let message: string
    if (spot && plans.length === 0) {
      message = `「${shrine_name}」に対応するコースは未登録です。近隣スポット名で再検索してみてください。`
    } else if (plans.length === 1) {
      const p = plans[0]
      message = `「${shrine_name}」に近いおすすめコースは『${p.name}』です。${p.description || ""}`
    } else if (plans.length > 1) {
      message =
        `「${shrine_name}」の近くには、いくつかプランがございます。\n` +
        plans.map((p) => `・『${p.name}』— ${p.description || "説明準備中"}`).join("\n")
    } else {
      const generalMessage = `福岡市で神社めぐりをしながら観光地へとご案内するコンシェルジュです！

本日は以下の4つの神社をご案内できます：
・博多区の櫛田神社 - 博多の総鎮守として親しまれる歴史ある神社
・中央区の警固神社 - 天神の中心部にある縁結びで有名な神社  
・中央区の光雲神社 - 学問の神様として知られる菅原道真公を祀る神社
・博多区の住吉神社 - 全国住吉神社の中でも最古の歴史を持つ神社

どちらの神社にご興味がおありでしょうか？詳しいコースをご案内いたします。`

      message = generalMessage
    }

    // 6) 可能ならLLMで言い回しを整える（失敗しても握りつぶす）
    let finalMessage = message
    try {
      const apiKey = process.env.GEMINI_API_KEY
      if (apiKey) {
        finalMessage = await refineWithGemini(apiKey, message, userQuery)
      }
    } catch {
      /* LLM失敗は無視して素のmessageを返す */
    }

    return NextResponse.json({
      ok: true,
      message: finalMessage,
      shrine_name: shrine_name || null,
      plans,
    })
  } catch (err: any) {
    // 7) どんな例外でも"沈黙させない"
    console.error("[concierge] fatal:", err?.message || err)
    return NextResponse.json({
      ok: false,
      message: "AIコンシェルジュが応答していません。しばらくしてからもう一度お試しください。",
      shrine_name: null,
      plans: [],
      error: "server-failed",
    })
  }
}
