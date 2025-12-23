import express, { Request, Response } from "express"
import cors from "cors"
import fs from "fs/promises"
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
fs.mkdir(STORAGE_DIR, { recursive: true }).catch(() => {})

// Hàm tính tổng dung lượng storage (bytes)
async function getStorageSize(): Promise<number> {
  let totalSize = 0
  const files = await fs.readdir(STORAGE_DIR)
  for (const file of files) {
    const filePath = path.join(STORAGE_DIR, file)
    const stats = await fs.stat(filePath)
    totalSize += stats.size
  }
  return totalSize
}

// Hàm kiểm tra dung lượng trống (bytes)
async function getFreeSpace(): Promise<number> {
  const totalSize = await getStorageSize()
  // Giả sử giới hạn storage là 1000MB (có thể config sau)
  const MAX_STORAGE = 500 * 1024 * 1024 // 500MB in bytes
  return MAX_STORAGE - totalSize
}

// Route để lấy thông tin storage
app.get("/api/storage", async (req: Request, res: Response) => {
  try {
    const freeSpace = await getFreeSpace()
    const totalSize = await getStorageSize()
    const freeSpaceMB = (freeSpace / (1024 * 1024)).toFixed(2)
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)

    res.status(200).json({
      success: true,
      freeSpace: parseFloat(freeSpaceMB),
      totalSize: parseFloat(totalSizeMB),
      unit: "MB",
    })
  } catch (error) {
    console.error("Error getting storage info:", error)
    res.status(500).json({ success: false, message: "Failed to get storage info" })
  }
})

// Route để lấy danh sách logs
app.get("/api/logs", async (req: Request, res: Response) => {
  try {
    const files = await fs.readdir(STORAGE_DIR)
    const logFilesPromises = files
      .filter((file) => file.endsWith(".txt"))
      .map(async (file) => {
        const filePath = path.join(STORAGE_DIR, file)
        const stats = await fs.stat(filePath)
        return {
          filename: file,
          created: stats.birthtime,
          size: stats.size,
        }
      })

    const logs = (await Promise.all(logFilesPromises)).sort(
      (a, b) => b.created.getTime() - a.created.getTime()
    )

    res.status(200).json({ success: true, logs })
  } catch (error) {
    console.error("Error reading logs:", error)
    res.status(500).json({ success: false, message: "Failed to read logs" })
  }
})

// Route để đọc nội dung log cụ thể
app.get("/api/logs/:filename", async (req: Request, res: Response) => {
  try {
    const { filename } = req.params
    const filePath = path.join(STORAGE_DIR, filename)

    // Kiểm tra file có tồn tại không
    try {
      await fs.access(filePath)
    } catch {
      return res.status(404).json({ success: false, message: "Log file not found" })
    }

    const content = await fs.readFile(filePath, "utf-8")
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

    // Kiểm tra dung lượng trống
    const freeSpace = await getFreeSpace()
    const MIN_FREE_SPACE = 10 * 1024 * 1024 // 10MB in bytes

    if (freeSpace < MIN_FREE_SPACE) {
      return res.status(400).json({
        success: false,
        message: "Storage is full. Cannot save more logs.",
        freeSpaceMB: (freeSpace / (1024 * 1024)).toFixed(2),
      })
    }

    // Lấy version từ logData
    const version = logData.loggerVersion || "unknown"

    // Tạo tên file với version và timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `log-v${version}-${timestamp}.txt`
    const filePath = path.join(STORAGE_DIR, fileName)

    // Chuyển đổi data thành string để lưu
    const logContent = JSON.stringify(logData, null, 2)

    // Lưu vào file
    await fs.writeFile(filePath, logContent, "utf-8")

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

// Route để xóa một số lượng logs (từ cũ nhất)
app.delete("/api/logs", async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string)

    if (!count || count <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid count parameter",
      })
    }

    const files = await fs.readdir(STORAGE_DIR)
    const logFilesPromises = files
      .filter((file) => file.endsWith(".txt"))
      .map(async (file) => {
        const filePath = path.join(STORAGE_DIR, file)
        const stats = await fs.stat(filePath)
        return {
          filename: file,
          created: stats.birthtime,
          path: filePath,
        }
      })

    const logFiles = (await Promise.all(logFilesPromises)).sort(
      (a, b) => a.created.getTime() - b.created.getTime()
    ) // Sắp xếp từ cũ đến mới

    const filesToDelete = logFiles.slice(0, count)

    await Promise.all(filesToDelete.map((file) => fs.unlink(file.path)))
    const deletedCount = filesToDelete.length

    console.log(`✓ Deleted ${deletedCount} log files`)

    res.status(200).json({
      success: true,
      message: `Deleted ${deletedCount} log files`,
      deletedCount,
    })
  } catch (error) {
    console.error("Error deleting logs:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete logs",
    })
  }
})

// Route để xóa tất cả logs
app.delete("/api/logs/all", async (req: Request, res: Response) => {
  try {
    const files = await fs.readdir(STORAGE_DIR)
    const logFiles = files.filter((file) => file.endsWith(".txt"))

    await Promise.all(
      logFiles.map((file) => {
        const filePath = path.join(STORAGE_DIR, file)
        return fs.unlink(filePath)
      })
    )

    const deletedCount = logFiles.length

    console.log(`✓ Deleted all logs (${deletedCount} files)`)

    res.status(200).json({
      success: true,
      message: `Deleted all logs (${deletedCount} files)`,
      deletedCount,
    })
  } catch (error) {
    console.error("Error deleting all logs:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete all logs",
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
