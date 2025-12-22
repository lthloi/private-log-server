import express, { Request, Response } from "express"
import cors from "cors"
import fs from "fs"
import path from "path"

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors()) // Cho phép tất cả origins
app.use(express.json()) // Parse JSON body
// Serve static files (HTML viewer)
app.use(express.static(path.join(__dirname, "..", "public")))

// Tạo thư mục storage nếu chưa có
const STORAGE_DIR = path.join(__dirname, "storage", "client-logs")
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

// Route để lấy danh sách logs
app.get("/api/logs", (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(STORAGE_DIR)
    const logs = files
      .filter((file) => file.endsWith(".txt"))
      .map((file) => {
        const filePath = path.join(STORAGE_DIR, file)
        const stats = fs.statSync(filePath)
        return {
          filename: file,
          created: stats.birthtime,
          size: stats.size,
        }
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime())

    res.status(200).json({ success: true, logs })
  } catch (error) {
    console.error("Error reading logs:", error)
    res.status(500).json({ success: false, message: "Failed to read logs" })
  }
})

// Route để đọc nội dung log cụ thể
app.get("/api/logs/:filename", (req: Request, res: Response) => {
  try {
    const { filename } = req.params
    const filePath = path.join(STORAGE_DIR, filename)

    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Log file not found" })
    }

    const content = fs.readFileSync(filePath, "utf-8")
    res.status(200).json({ success: true, content, filename })
  } catch (error) {
    console.error("Error reading log file:", error)
    res.status(500).json({ success: false, message: "Failed to read log file" })
  }
})

// Route để nhận logs từ client
app.post("/api/logs", async (req: Request, res: Response) => {
  try {
    const logData = req.body

    // Tạo tên file với timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `log-${timestamp}.txt`
    const filePath = path.join(STORAGE_DIR, fileName)

    // Chuyển đổi data thành string để lưu
    const logContent = JSON.stringify(logData, null, 2)

    // Lưu vào file
    fs.writeFileSync(filePath, logContent, "utf-8")

    console.log(`✓ Log saved: ${fileName}`)

    res.status(200).json({
      success: true,
      message: "Log saved successfully",
      fileName,
    })
  } catch (error) {
    console.error("Error saving log:", error)
    res.status(500).json({
      success: false,
      message: "Failed to save log",
    })
  }
})

// Health check route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, () => {
  console.log(`>>> Server is running on http://localhost:${PORT}`)
  console.log(`>>> Logs will be saved to: ${STORAGE_DIR}`)
})
