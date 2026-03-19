# Insight — GA4 Editorial Analytics Dashboard

Hệ thống phân tích traffic nhân sự và gợi ý nội dung dựa trên Google Analytics 4 và AI.

---

## Yêu cầu

| Phần mềm | Phiên bản |
|---|---|
| Node.js | ≥ 18 |
| PostgreSQL | ≥ 14 |
| Google Cloud Service Account | Quyền Viewer/Analyst trên GA4 |

---

## Cấu hình môi trường

Tạo file `.env` tại thư mục gốc:

```env
# ===== GA4 =====
# Danh sách site: label:propertyId, cách nhau bằng dấu phẩy
GA4_SITES=SiteA:123456789,SiteB:987654321

# Dimension liên kết nhân viên (dùng customUser hoặc customEvent)
GA4_EMPLOYEE_DIMENSION=customUser:employee_id

# Chế độ mặc định (alias = lọc theo đường dẫn URL)
DEFAULT_MODE=alias

# ===== Google Service Account (chọn 1 trong 2 cách) =====
# Cách A: đường dẫn file JSON
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Cách B: dán toàn bộ nội dung JSON vào một dòng
GA_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# ===== Database =====
DATABASE_URL="postgresql://user:password@localhost:5432/analysis_traffic?schema=public"

# ===== AI (tuỳ chọn) =====
# Dùng Gemini (khuyến nghị - miễn phí)
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash

# Hoặc dùng OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-3.5-turbo

# ===== Map alias → employeeId theo propertyId =====
# Định dạng JSON: { "propertyId": { "alias": "employeeId" } }
ALIAS_MAP='{"123456789": {"nguyenvana": "nv001", "tranthib": "nv002"}}'

# ===== OAuth (tuỳ chọn - đăng nhập Google) =====
# OAUTH_CLIENT_ID=...
# OAUTH_CLIENT_SECRET=...
# SESSION_SECRET=random-secret-string
```

---

## Cài đặt và chạy

### Lần đầu tiên

```bash
# 1. Cài dependencies (root + client)
npm install

# 2. Khởi tạo database và generate Prisma Client
npm run prisma:generate
npm run prisma:migrate

# 3. Build client React
npm run build:client

# 4. Chạy server
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`

### Từ lần sau

```bash
npm run dev
```

### Chạy riêng client (Hot Reload khi dev)

```bash
# Terminal 1
npm run dev          # Backend port 3000

# Terminal 2
npm run dev:client   # Frontend Vite port 5173
```

---

## Deploy lên Railway

1. Tạo project Railway, connect GitHub repo
2. Thêm PostgreSQL plugin trong Railway → copy `DATABASE_URL`
3. Cấu hình **Build Command**:
   ```
   npm run build:all
   ```
4. Cấu hình **Start Command**:
   ```
   npm start
   ```
5. Thêm các biến môi trường trong Railway dashboard (xem phần `.env` ở trên)
6. Deploy — Railway tự chạy install → build → start

---

## Cấu trúc dự án

```
analysis-traffic/
├── src/                   # Backend TypeScript
│   ├── server.ts          # Express server + API routes
│   ├── ga.ts              # Google Analytics 4 queries
│   ├── alias.ts           # Logic trích alias từ URL
│   └── ...
├── client/                # Frontend React + Vite
│   └── src/
│       ├── App.tsx
│       └── components/
├── prisma/
│   └── schema.prisma      # Database schema
├── docker-compose.yml     # PostgreSQL local nhanh
└── .env                   # Cấu hình môi trường
```

---

## Khởi động PostgreSQL nhanh (Docker)

```bash
docker-compose up -d
```

Sau đó chạy `npm run prisma:migrate` để tạo bảng.

---

## Khắc phục lỗi thường gặp

### PERMISSION_DENIED từ GA4
- Kiểm tra Property ID đúng chưa (dạng số, ví dụ `123456789`)
- Vào **GA4 Admin → Property Access Management** → thêm email service account với vai trò `Viewer`
- Đảm bảo đã bật **Analytics Data API** trong Google Cloud Console

### Không có dữ liệu alias
- Kiểm tra `ALIAS_MAP` đúng JSON và đúng `propertyId`
- Kiểm tra `DEFAULT_MODE=alias` đã được set
- URL bài viết phải chứa alias (ví dụ `/posts/bebe/` → alias `bebe`)
- Nếu pattern URL khác, chỉnh hàm `extractAliasFromPath` trong `src/alias.ts`

### Lỗi kết nối Database
- Kiểm tra PostgreSQL đang chạy: `docker-compose ps` hoặc `pg_isready`
- Kiểm tra `DATABASE_URL` đúng host, port, user, password
- Chạy lại `npm run prisma:migrate` nếu schema chưa được tạo
