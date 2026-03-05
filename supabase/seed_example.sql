-- ============================================
-- SEED DATA: Contoh menambah Categories dan Vocab
-- ============================================

-- ============================================
-- STEP 1: Insert Categories
-- ============================================
INSERT INTO public.categories (name, image_url) VALUES
  ('Daily Life', 'https://example.com/images/daily-life.png'),
  ('Family', 'https://example.com/images/family.png'),
  ('Food & Drink', 'https://example.com/images/food.png'),
  ('Animals', 'https://example.com/images/animals.png')
ON CONFLICT (name) DO NOTHING;  -- Jika sudah ada, skip

-- ============================================
-- STEP 2: Insert Vocab Words
-- ============================================
INSERT INTO public.vocab_master (indo, english_primary, synonyms, class) VALUES
  -- Daily Life
  ('Rumah', 'house', ARRAY['home', 'residence', 'dwelling'], 'noun'),
  ('Pintu', 'door', ARRAY['entrance', 'gate'], 'noun'),
  ('Jendela', 'window', ARRAY['pane'], 'noun'),
  ('Meja', 'table', ARRAY['desk'], 'noun'),
  ('Kursi', 'chair', ARRAY['seat'], 'noun'),
  ('Lampu', 'lamp', ARRAY['light'], 'noun'),
  
  -- Family
  ('Ayah', 'father', ARRAY['dad', 'papa'], 'noun'),
  ('Ibu', 'mother', ARRAY['mom', 'mama'], 'noun'),
  ('Anak', 'child', ARRAY['kid', 'son', 'daughter'], 'noun'),
  ('Nenek', 'grandmother', ARRAY['grandma', 'granny'], 'noun'),
  ('Kakak', 'older sibling', ARRAY['brother', 'sister'], 'noun'),
  ('Adik', 'younger sibling', ARRAY['brother', 'sister'], 'noun'),
  
  -- Food & Drink
  ('Nasi', 'rice', ARRAY['grain'], 'noun'),
  ('Air', 'water', ARRAY['drink'], 'noun'),
  ('Apel', 'apple', ARRAY['fruit'], 'noun'),
  ('Daging', 'meat', ARRAY['beef'], 'noun'),
  ('Susu', 'milk', ARRAY['dairy'], 'noun'),
  ('Roti', 'bread', ARRAY['loaf'], 'noun'),
  
  -- Animals
  ('Kucing', 'cat', ARRAY['feline', 'puss'], 'noun'),
  ('Anjing', 'dog', ARRAY['canine', 'puppy'], 'noun'),
  ('Burung', 'bird', ARRAY['fowl'], 'noun'),
  ('Ikan', 'fish', ARRAY['aquatic'], 'noun'),
  ('Harimau', 'tiger', ARRAY['big cat'], 'noun'),
  ('Gajah', 'elephant', ARRAY['pachyderm'], 'noun')
ON CONFLICT (indo) DO NOTHING;

-- ============================================
-- STEP 3: Link Vocabs to Categories using Junction Table
-- Perlu get category_id dulu dari tabel categories
-- ============================================

-- Daily Life Vocabs
INSERT INTO public.vocab_category_mapping (vocab_id, category_id, subcategory_name, order_priority) 
SELECT v.id, c.id, 'Home Items', ROW_NUMBER() OVER (ORDER BY v.id)
FROM public.vocab_master v
JOIN public.categories c ON c.name = 'Daily Life'
WHERE v.indo IN ('Rumah', 'Pintu', 'Jendela', 'Meja', 'Kursi', 'Lampu')
ON CONFLICT (vocab_id, category_id, subcategory_name) DO NOTHING;

-- Family Vocabs
INSERT INTO public.vocab_category_mapping (vocab_id, category_id, subcategory_name, order_priority) 
SELECT v.id, c.id, 'Family Members', ROW_NUMBER() OVER (ORDER BY v.id)
FROM public.vocab_master v
JOIN public.categories c ON c.name = 'Family'
WHERE v.indo IN ('Ayah', 'Ibu', 'Anak', 'Nenek', 'Kakak', 'Adik')
ON CONFLICT (vocab_id, category_id, subcategory_name) DO NOTHING;

-- Food & Drink Vocabs
INSERT INTO public.vocab_category_mapping (vocab_id, category_id, subcategory_name, order_priority) 
SELECT v.id, c.id, 'Foods', ROW_NUMBER() OVER (ORDER BY v.id)
FROM public.vocab_master v
JOIN public.categories c ON c.name = 'Food & Drink'
WHERE v.indo IN ('Nasi', 'Air', 'Apel', 'Daging', 'Susu', 'Roti')
ON CONFLICT (vocab_id, category_id, subcategory_name) DO NOTHING;

-- Animals Vocabs
INSERT INTO public.vocab_category_mapping (vocab_id, category_id, subcategory_name, order_priority) 
SELECT v.id, c.id, 'Domestic & Wild', ROW_NUMBER() OVER (ORDER BY v.id)
FROM public.vocab_master v
JOIN public.categories c ON c.name = 'Animals'
WHERE v.indo IN ('Kucing', 'Anjing', 'Burung', 'Ikan', 'Harimau', 'Gajah')
ON CONFLICT (vocab_id, category_id, subcategory_name) DO NOTHING;

-- ============================================
-- VERIFIKASI: Lihat data yang telah ditambahkan
-- ============================================
-- SELECT * FROM public.categories;
-- SELECT * FROM public.vocab_master LIMIT 10;
-- SELECT v.indo, v.english_primary, c.name, m.subcategory_name 
--   FROM public.vocab_category_mapping m
--   JOIN public.vocab_master v ON m.vocab_id = v.id
--   JOIN public.categories c ON m.category_id = c.id;
