-- 観光地テーブルの作成
CREATE TABLE IF NOT EXISTS tourist_spots (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RLSポリシーの設定
ALTER TABLE tourist_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tourist_spots_select_policy" ON tourist_spots
FOR SELECT USING (true);
