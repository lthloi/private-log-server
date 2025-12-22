# Private Log Server

Simple Express TypeScript server để nhận và lưu trữ logs từ client.

## Cài đặt

```bash
npm install
```

## Chạy development

```bash
npm run dev
```

## Build production

```bash
npm run build
npm start
```

## API Endpoints

### POST /api/logs
Nhận logs từ client và lưu vào file txt.

**Request:**
```javascript
fetch('http://localhost:3000/api/logs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Your log message',
    level: 'info',
    timestamp: new Date().toISOString()
  })
})
```

**Response:**
```json
{
  "success": true,
  "message": "Log saved successfully",
  "fileName": "log-2025-12-22T10-30-45-123Z.txt"
}
```

### GET /health
Kiểm tra trạng thái server.

## Cấu trúc thư mục

```
private-log-server/
├── src/
│   ├── index.ts          # Main server file
│   └── storage/
│       └── client-logs/  # Logs được lưu ở đây
├── package.json
├── tsconfig.json
└── .gitignore
```

## Environment Variables

- `PORT` - Port để chạy server (default: 3000)
