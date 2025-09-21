-- spots テーブル（緯度経度含む詳細スポット情報）
CREATE TABLE IF NOT EXISTS spots (
  spotid TEXT PRIMARY KEY,
  shrine_name TEXT,
  address TEXT,
  benefit_tag_1 TEXT,
  benefit_tag_2 TEXT,
  tag_attribute TEXT,
  other_benefits TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- courses テーブル（おすすめプラン）
CREATE TABLE IF NOT EXISTS courses (
  course_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  theme TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- course_spots テーブル（コースとスポットの関連）
CREATE TABLE IF NOT EXISTS course_spots (
  course_id INTEGER,
  spot_id TEXT,
  "order" INTEGER,
  PRIMARY KEY (course_id, spot_id),
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  FOREIGN KEY (spot_id) REFERENCES spots(spotid)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_spots_category ON spots(category);
CREATE INDEX IF NOT EXISTS idx_spots_location ON spots(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_course_spots_order ON course_spots("order");
