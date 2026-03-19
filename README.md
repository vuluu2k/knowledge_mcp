# Knowledge MCP Server

MCP server biến GitHub repository thành **bộ não cá nhân** cho AI. Claude đọc/ghi trực tiếp vào các file markdown trên GitHub thông qua giao thức MCP.

```
Claude (LLM) ◄──stdio──► MCP Server ◄──HTTPS──► GitHub API ◄──► brain/ repo
```

**Nguyên tắc:** MCP server chỉ xử lý dữ liệu, không gọi LLM. Toàn bộ suy luận do Claude đảm nhận.

---

## Yêu cầu

- Node.js >= 18
- GitHub account + Personal Access Token
- Claude Desktop hoặc bất kỳ MCP client nào

---

## Cài đặt

### 1. Clone repo

```bash
git clone https://github.com/<your-username>/knowledge_mcp.git
cd knowledge_mcp
```

### 2. Cài dependencies

```bash
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Tạo file `.env`

```bash
cp .env.example .env
```

Mở `.env` và điền thông tin:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=yourusername
GITHUB_REPO=brain
GITHUB_BRANCH=main
BRAIN_BASE_PATH=brain
```

**Lấy GitHub Token:**
1. Vào https://github.com/settings/tokens
2. Tạo token mới (classic) với quyền **repo**
3. Copy token vào `GITHUB_TOKEN`

---

## Chuẩn bị Brain Repository

Tạo một repo trên GitHub (ví dụ: `brain`) với cấu trúc thư mục sau:

```
brain/
├── inbox/
│   └── capture.md
├── tasks/
│   ├── today.md
│   └── backlog.md
├── projects/
│   └── project-a.md
├── notes/
│   ├── ideas.md
│   └── learning.md
└── goals/
    ├── short-term.md
    └── long-term.md
```

Bạn có thể copy thư mục `example-brain/brain/` trong repo này làm mẫu:

```bash
# Tạo repo "brain" trên GitHub, sau đó:
cd example-brain
git init
git add .
git commit -m "init: brain repository"
git remote add origin https://github.com/<your-username>/brain.git
git push -u origin main
```

### Format markdown cho tasks

```markdown
- [ ] Task chưa làm
- [x] Task đã hoàn thành
- [ ] Task có tag #work #urgent
```

Các file khác (notes, goals, inbox) viết tự do, mỗi dòng là một item.

---

## Kết nối với Claude Desktop

Mở file cấu hình Claude Desktop:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Thêm vào:

```json
{
  "mcpServers": {
    "knowledge-brain": {
      "command": "node",
      "args": ["/đường-dẫn-tuyệt-đối/knowledge_mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "GITHUB_OWNER": "yourusername",
        "GITHUB_REPO": "brain",
        "GITHUB_BRANCH": "main",
        "BRAIN_BASE_PATH": "brain"
      }
    }
  }
}
```

> **Lưu ý:** Thay `/đường-dẫn-tuyệt-đối/` bằng đường dẫn thực tế trên máy bạn.

Khởi động lại Claude Desktop để load MCP server.

---

## Kết nối với Claude Code

Thêm vào file `.claude/settings.json` hoặc chạy lệnh:

```bash
claude mcp add knowledge-brain -- node /đường-dẫn-tuyệt-đối/knowledge_mcp/dist/index.js
```

Hoặc cấu hình thủ công trong `.claude/settings.json`:

```json
{
  "mcpServers": {
    "knowledge-brain": {
      "command": "node",
      "args": ["/đường-dẫn-tuyệt-đối/knowledge_mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "GITHUB_OWNER": "yourusername",
        "GITHUB_REPO": "brain"
      }
    }
  }
}
```

---

## Danh sách Tools

### Đọc dữ liệu

| Tool | Mô tả |
|------|--------|
| `getTasks` | Lấy tất cả tasks (today + backlog) |
| `getTodayTasks` | Lấy tasks hôm nay |
| `getBacklog` | Lấy tasks backlog |
| `getNotes` | Lấy notes (ideas / learning) |
| `getGoals` | Lấy goals (short-term / long-term) |
| `getInbox` | Lấy nội dung inbox |

### Ghi dữ liệu

| Tool | Input | Mô tả |
|------|-------|--------|
| `addTask` | `text`, `target` (today/backlog) | Thêm task mới |
| `markTaskDone` | `taskId` hoặc `text`, `section` | Đánh dấu task hoàn thành |
| `addNote` | `content`, `file` (ideas/learning) | Thêm ghi chú |
| `saveToInbox` | `content` | Lưu nhanh vào inbox |

---

## Cách sử dụng

Sau khi kết nối, hỏi Claude bất kỳ câu nào:

```
"Hôm nay tôi cần làm gì?"
→ Claude gọi getTodayTasks, phân tích và trả lời

"Thêm task: thiết kế landing page"
→ Claude gọi addTask với text "thiết kế landing page"

"Đánh dấu task review PR là xong"
→ Claude gọi markTaskDone với text "review PR"

"Tóm tắt goals của tôi"
→ Claude gọi getGoals cho cả short-term và long-term

"Ghi lại ý tưởng: xây dựng AI chatbot cho team"
→ Claude gọi saveToInbox hoặc addNote

"Tôi đang làm dự án gì?"
→ Claude gọi getTasks và phân tích context
```

---

## Cấu trúc source code

```
src/
├── index.ts          # Entry point — khởi tạo server + stdio transport
├── mcp.ts            # Đăng ký tất cả MCP tools
├── config.ts         # Load biến môi trường
├── core/
│   ├── brain.ts      # Facade chính — đọc/ghi brain qua GitHub
│   ├── parser.ts     # Parse markdown ↔ structured data
│   └── aggregator.ts # Truy vấn cross-file (tổng hợp tasks)
├── github/
│   ├── client.ts     # Octokit wrapper (getFile, updateFile)
│   └── sync.ts       # Map brain section → GitHub file path
├── tools/
│   ├── tasks.ts      # Tools: getTasks, addTask, markTaskDone...
│   ├── notes.ts      # Tools: getNotes, addNote, getGoals
│   └── inbox.ts      # Tools: getInbox, saveToInbox
└── types/
    ├── brain.ts      # Types: FileContent, BrainSection, Note, Goal
    └── task.ts       # Types: Task, TaskStatus
```

---

## Scripts

```bash
npm run build    # Compile TypeScript → dist/
npm run start    # Chạy server (production)
npm run dev      # Chạy trực tiếp bằng tsx (development)
```

---

## Lưu ý kỹ thuật

- **Không cache SHA:** Mỗi lần ghi đều đọc file mới nhất từ GitHub để lấy SHA, tránh conflict khi file bị sửa từ nơi khác.
- **Format-preserving:** Khi sửa task (mark done, thêm task), server chỉ sửa đúng dòng cần thiết, không rewrite toàn bộ file.
- **Auto-create:** Nếu file chưa tồn tại khi ghi lần đầu, server tự tạo file với header phù hợp.
- **Task ID ổn định:** ID được tạo từ SHA-256 hash của nội dung task, không phụ thuộc vào vị trí dòng.

---

## License

MIT
