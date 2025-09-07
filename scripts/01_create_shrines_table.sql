-- 神社マスタテーブル
CREATE TABLE IF NOT EXISTS shrines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_kana VARCHAR(100),
  description TEXT,
  address VARCHAR(200) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  phone VARCHAR(20),
  website VARCHAR(200),
  opening_hours VARCHAR(100),
  access_info TEXT,
  main_deity VARCHAR(100),
  benefits TEXT[], -- 御利益（配列）
  image_url VARCHAR(300),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 願い事カテゴリテーブル
CREATE TABLE IF NOT EXISTS wish_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  keywords TEXT[], -- NLP検索用キーワード
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 神社と願い事カテゴリの関連テーブル
CREATE TABLE IF NOT EXISTS shrine_wish_categories (
  id SERIAL PRIMARY KEY,
  shrine_id INTEGER REFERENCES shrines(id) ON DELETE CASCADE,
  wish_category_id INTEGER REFERENCES wish_categories(id) ON DELETE CASCADE,
  relevance_score DECIMAL(3, 2) DEFAULT 1.0, -- 関連度スコア
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shrine_id, wish_category_id)
);

-- 三社詣りコーステーブル
CREATE TABLE IF NOT EXISTS sansha_courses (
  id SERIAL PRIMARY KEY,
  user_wish TEXT NOT NULL,
  shrine1_id INTEGER REFERENCES shrines(id),
  shrine2_id INTEGER REFERENCES shrines(id),
  shrine3_id INTEGER REFERENCES shrines(id),
  total_distance DECIMAL(8, 2), -- 総距離（km）
  estimated_time INTEGER, -- 推定時間（分）
  transportation_mode VARCHAR(20) DEFAULT 'walking', -- walking, driving, transit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_shrines_location ON shrines(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_shrines_benefits ON shrines USING GIN(benefits);
CREATE INDEX IF NOT EXISTS idx_wish_categories_keywords ON wish_categories USING GIN(keywords);
