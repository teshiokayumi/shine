// CSVデータを取得してデータベースに挿入するスクリプト
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase環境変数が設定されていません")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function importCourseData() {
  try {
    console.log("コースデータのインポートを開始します...")

    // spots データの取得
    console.log("spots データを取得中...")
    const spotsResponse = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/shrines%20-%20spot-f1YwPxEbFHsLAyI3T1rupbNUM6pr3I.csv",
    )
    const spotsText = await spotsResponse.text()

    // courses データの取得
    console.log("courses データを取得中...")
    const coursesResponse = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/shrines%20-%20courses-h2iZmLoTHDWZ8VBu3O7IxHKhboDin6.csv",
    )
    const coursesText = await coursesResponse.text()

    // course_spots データの取得
    console.log("course_spots データを取得中...")
    const courseSpotsResponse = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/shrines%20-%20course_spots-8opDgc9DP48nrsaWyGukc7HGQmNPL8.csv",
    )
    const courseSpotsText = await courseSpotsResponse.text()

    // CSV解析関数
    function parseCSV(text) {
      const lines = text.trim().split("\n")
      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
      return lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))
        const obj = {}
        headers.forEach((header, index) => {
          obj[header] = values[index] || null
        })
        return obj
      })
    }

    // データ解析
    const spotsData = parseCSV(spotsText)
    const coursesData = parseCSV(coursesText)
    const courseSpotsData = parseCSV(courseSpotsText)

    console.log(
      `spots: ${spotsData.length}件, courses: ${coursesData.length}件, course_spots: ${courseSpotsData.length}件`,
    )

    // spots テーブルの作成・更新
    console.log("spots テーブルを更新中...")
    for (const spot of spotsData) {
      const { error } = await supabase.from("spots").upsert(
        {
          spotid: spot.spotid || spot.spotID, // 両方拾えるように
          shrine_name: spot.shrine_name,
          address: spot.address,
          benefit_tag_1: spot.benefit_tag_1,
          benefit_tag_2: spot.benefit_tag_2,
          tag_attribute: spot.tag_attribute,
          other_benefits: spot.other_benefits,
          latitude: Number.parseFloat(spot.latitude) || null,
          longitude: Number.parseFloat(spot.longitude) || null,
          category: spot.category,
        },
        { onConflict: "spotid" },
      )

      if (error) {
        console.error("spots挿入エラー:", error)
      }
    }

    // courses テーブルの作成・更新
    console.log("courses テーブルを更新中...")
    for (const course of coursesData) {
      const { error } = await supabase.from("courses").upsert(
        {
          course_id: Number.parseInt(course.courseId),
          name: course.name,
          description: course.description,
          theme: course.theme,
        },
        { onConflict: "course_id" },
      )

      if (error) {
        console.error("courses挿入エラー:", error)
      }
    }

    // course_spots テーブルの作成・更新
    console.log("course_spots テーブルを更新中...")
    for (const courseSpot of courseSpotsData) {
      const { error } = await supabase.from("course_spots").upsert(
        {
          course_id: Number.parseInt(courseSpot.courseId),
          spot_id: courseSpot.spotid,
          order: Number.parseInt(courseSpot.order),
        },
        { onConflict: "course_id,spot_id" },
      )

      if (error) {
        console.error("course_spots挿入エラー:", error)
      }
    }

    console.log("コースデータのインポートが完了しました！")
  } catch (error) {
    console.error("インポート中にエラーが発生しました:", error)
  }
}

importCourseData()
