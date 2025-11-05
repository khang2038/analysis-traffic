GA4 Employee Traffic Dashboard (API + Simple UI)

1) Yêu cầu chuẩn bị
- Tạo Service Account trên Google Cloud, cấp quyền đọc GA4 (Viewer hoặc Analyst) cho 3 property của bạn.
- Lấy GA4 property IDs cho 3 website.
- Xác định dimension để gắn nhân viên (khuyến nghị custom user property: `employee_id`). Trong GA4 Data API, tên dimension sẽ là `customUser:employee_id` (hoặc nếu gửi theo event thì `customEvent:employee_id`).

2) Cấu hình môi trường (.env)
Mặc định hệ thống chạy theo ALIAS (alias trong URL). Tạo file `.env` cạnh `package.json`:

```
GA4_SITES=SiteA:123456789,SiteB:987654321,SiteC:555555555
GA4_EMPLOYEE_DIMENSION=customUser:employee_id
# Một trong hai cách auth:
# Cách A: dùng đường dẫn chuẩn GOOGLE_APPLICATION_CREDENTIALS
# export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json

# Cách B: JSON string trực tiếp (copy toàn bộ nội dung file sa.json vào một dòng)
# GA_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
# Lưu ý: GA_SERVICE_ACCOUNT_JSON phải là JSON string hợp lệ, không phải file path

PORT=3000

# Map alias URL -> employeeId theo từng property (site)
# Định dạng JSON: { "<propertyId>": { "<alias>": "<employeeId>" } }
# Ví dụ:
ALIAS_MAP='{
  "123456789": { "bebe": "linh", "sieunhando": "beo" },
  "987654321": { "sieunhanhong": "beo" }
}'

# Mặc định chọn alias cho cả API và UI
DEFAULT_MODE=alias
```

3) Cài đặt & chạy

```
npm install
npm run build:client
npm run dev
# Mở http://localhost:3000 (client dev: npm run dev:client)
```

4) API
- GET `/api/sites`: trả về danh sách 3 site (label, propertyId)
- GET `/api/report?propertyId=...&employeeId=...&startDate=30daysAgo&endDate=today`
  - Lọc theo dimension nhân viên (`GA4_EMPLOYEE_DIMENSION`)
  - Trả về totals (activeUsers, sessions, screenPageViews)
  - Bảng theo "Trang và màn hình": `pagePathPlusQueryString`, `unifiedScreenClass`
  - Xếp hạng (rank) của nhân viên theo `screenPageViews` trong khoảng thời gian đã chọn

- GET `/api/report?propertyId=...&alias=...&startDate=...&endDate=...`
  - Chế độ alias: lọc các trang có `pagePathPlusQueryString` chứa alias (ví dụ cuối URL là `.../bebe/`) và tổng hợp theo alias đó. Nếu `ALIAS_MAP` có map alias -> employeeId, kết quả sẽ hiển thị employeeId.

- GET `/api/leaderboard?propertyId=...&startDate=...&endDate=...&orderMetric=screenPageViews|activeUsers|sessions&limit=50`
  - Mặc định theo dimension nhân viên (`mode=employee`).
  - Thêm `&mode=alias` để xếp hạng theo alias trong URL (có sử dụng `ALIAS_MAP` nếu có).

5) Gắn dữ liệu nhân viên vào GA4
- Web cần gửi kèm ID nhân viên theo cách thống nhất:
  - Tốt nhất: set user property `employee_id` thông qua gtag/gtm, ví dụ:

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXX');
  gtag('set', 'user_properties', { employee_id: 'nv001' });
</script>
```

- Nếu đang dùng event parameter thay vì user property, hãy đổi env `GA4_EMPLOYEE_DIMENSION=customEvent:employee_id`.

6) Tuỳ biến xếp hạng
- Mặc định xếp hạng theo `screenPageViews`. Bạn có thể đổi trong `src/ga.ts` (biến `metricForRank`) sang `activeUsers` hoặc `sessions`.

7) Chế độ alias hoạt động như thế nào?
- Report theo alias: lọc GA4 theo `pagePathPlusQueryString CONTAINS <alias>`, tổng hợp totals và bảng "Trang và màn hình" cho alias đó; rank được tính dựa trên leaderboard alias.
- Leaderboard theo alias: lấy danh sách `pagePathPlusQueryString`, trích alias là segment cuối của đường dẫn (ví dụ `/posts/.../bebe/` -> `bebe`), gom nhóm theo alias (hoặc employeeId nếu `ALIAS_MAP` có map), cộng dồn chỉ số và xếp hạng theo metric.
- Nếu pattern URL của bạn khác (alias không nằm ở segment cuối), hãy mô tả pattern để chỉnh hàm `extractAliasFromPath` trong `src/alias.ts`.

8) Sửa lỗi 7 PERMISSION_DENIED (không đủ quyền truy cập property)
- Kiểm tra Property ID đúng chưa (GA4 Admin > Property > Property details). Dạng số, ví dụ `123456789`.
- Cấp quyền cho Service Account vào GA4 property: vào GA4 Admin > Property Access Management > Add users > dán email service account (…@…gserviceaccount.com) > cấp vai trò `Viewer` hoặc `Analyst`.
- Bật API: trong Google Cloud project chứa service account, đảm bảo đã bật `Analytics Data API`.
- Xác nhận sử dụng đúng credentials trên server: dùng `GOOGLE_APPLICATION_CREDENTIALS` (trỏ tới file JSON) hoặc `GA_SERVICE_ACCOUNT_JSON` với JSON string hợp lệ (copy toàn bộ nội dung file sa.json).
- Đảm bảo service account có quyền ở đúng Property (không phải chỉ Organization/Account nếu Property bị hạn chế riêng).

9) Deploy lên Railway
- Tạo project mới trên Railway và connect GitHub repo (hoặc deploy từ local).
- **Cấu hình Build Command**: Trong Railway project settings, set Build Command là:
  ```
  npm run build:all
  ```
- **Cấu hình Start Command**: Set Start Command là:
  ```
  npm start
  ```
- Thêm các biến môi trường trong Railway dashboard:
  - `GA4_SITES`: Danh sách sites (ví dụ: `sportvictoryarena:properties/504898571,NFLInsight360:properties/504752018`)
  - `GA_SERVICE_ACCOUNT_JSON`: JSON string đầy đủ của service account (copy toàn bộ nội dung file JSON, **không phải file path**)
  - `PORT`: Railway tự động set, không cần config
  - `ALIAS_MAP`: JSON string map alias -> employee (ví dụ: `{"504898571": {"bebe": "linh", "sieunhando": "beo"}}`)
  - `DEFAULT_MODE`: `alias`
- Railway sẽ tự động:
  - Chạy `npm install` (bao gồm cả client dependencies qua `postinstall`)
  - Chạy Build Command (`npm run build:all`) để build server TypeScript và client React
  - Chạy Start Command (`npm start`) để start server
- **Lưu ý**: 
  - Đảm bảo `GA_SERVICE_ACCOUNT_JSON` là JSON string hợp lệ (copy toàn bộ nội dung file JSON vào một dòng)
  - Server sẽ tự động kiểm tra và serve static files từ `client/dist` nếu có
  - Nếu không có OAuth config, session sẽ không được sử dụng (không có warning về MemoryStore)


