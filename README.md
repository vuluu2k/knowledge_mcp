# Knowledge MCP Server

MCP server biến GitHub repository thành **bộ não cá nhân** cho AI. Claude đọc/ghi trực tiếp vào các file markdown trên GitHub thông qua giao thức MCP.

```
Claude (LLM) ◄──stdio──► MCP Server ◄──HTTPS──► GitHub API ◄──► brain/ repo
```

**Nguyên tắc:** MCP server chỉ xử lý dữ liệu, không gọi LLM. Toàn bộ suy luận do Claude đảm nhận.

> **Mới dùng?** Xem [GUIDE.md](./GUIDE.md) — hướng dẫn chat với AI agent hiệu quả.

---

## Cài đặt nhanh

### Yêu cầu

- Node.js >= 18
- GitHub account + Personal Access Token ([tạo tại đây](https://github.com/settings/tokens) — cần quyền **repo**)

### 1 lệnh cài đặt

```bash
git clone https://github.com/<your-username>/knowledge_mcp.git
cd knowledge_mcp
./install.sh
```

Script sẽ tự động:
- Kiểm tra Node.js version
- Cài dependencies + build TypeScript
- Tạo file `.env` và hướng dẫn điền thông tin
- In ra cấu hình cho Claude Desktop / Claude Code

### Cài thủ công

```bash
npm install
npm run build
cp .env.example .env
# Edit .env với token + repo info
```

---

## Cập nhật

```bash
./update.sh
```

Script sẽ tự động:
- Pull code mới nhất
- Cài lại dependencies nếu có thay đổi
- Rebuild TypeScript
- Kiểm tra có biến môi trường mới nào cần thêm vào `.env`

---

## Cấu hình `.env`

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx   # Bắt buộc
GITHUB_OWNER=yourusername               # Bắt buộc
GITHUB_REPO=brain                       # Bắt buộc
GITHUB_BRANCH=main                      # Mặc định: main
BRAIN_BASE_PATH=brain                   # Mặc định: brain
LOG_LEVEL=info                          # debug | info | warn | error
CACHE_TTL_MS=30000                      # Cache reads (ms)
WRITE_RETRIES=3                         # Retry khi conflict
```

---

## Kết nối với Claude

### Claude Desktop

Mở file cấu hình:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

Khởi động lại Claude Desktop.

### Claude Code

```bash
claude mcp add knowledge-brain -- node /đường-dẫn-tuyệt-đối/knowledge_mcp/dist/index.js
```

> Script `install.sh` sẽ in ra đường dẫn chính xác sau khi cài.

---

## Bắt đầu sử dụng

### Lần đầu — tạo repo rỗng trên GitHub, rồi nói:

```
Khởi tạo brain cho tôi
```

Claude tạo toàn bộ cấu trúc trong 1 commit:

```
brain/
├── inbox/capture.md
├── tasks/today.md, backlog.md
├── notes/ideas.md, learning.md
├── goals/short-term.md, long-term.md
└── knowledge/general.md
```

### Sau đó — nói chuyện tự nhiên:

```
"Hôm nay tôi cần làm gì?"          → getTodayTasks
"Thêm task: thiết kế landing page"  → addTask
"Xong task review PR rồi"           → markTaskDone
"Tóm tắt goals của tôi"            → getGoals
"Ghi lại ý tưởng: AI chatbot"      → addNote / saveToInbox
```

---

## Danh sách Tools (15)

### Khởi tạo

| Tool | Mô tả |
|------|--------|
| `initBrain` | Tạo toàn bộ cấu trúc brain trên repo rỗng (1 commit) |

### Tasks

| Tool | Input | Mô tả |
|------|-------|--------|
| `getTasks` | `section` (today/backlog/all) | Lấy tasks |
| `getTodayTasks` | — | Tasks hôm nay |
| `getBacklog` | — | Tasks backlog |
| `addTask` | `text`, `target` | Thêm task |
| `markTaskDone` | `taskId` hoặc `text` | Đánh dấu xong |

### Notes / Goals / Inbox

| Tool | Input | Mô tả |
|------|-------|--------|
| `getNotes` | `section` (ideas/learning) | Lấy ghi chú |
| `addNote` | `content`, `file` | Thêm ghi chú |
| `getGoals` | `section` (short-term/long-term) | Lấy mục tiêu |
| `getInbox` | — | Lấy inbox |
| `saveToInbox` | `content` | Lưu nhanh vào inbox |

### Knowledge Base

| Tool | Input | Mô tả |
|------|-------|--------|
| `listTopics` | — | Danh sách topics (name + description + tags) |
| `getKnowledge` | `topic` | Đọc toàn bộ 1 topic |
| `addKnowledge` | `topic`, `title`, `content`, `description?`, `tags?` | Thêm kiến thức |
| `searchKnowledge` | `query` | Tìm kiếm cross-topic (tag → title → content) |

---

## Knowledge Base

Lưu trữ kiến thức theo topic trong folder `knowledge/`. Mỗi file có frontmatter:

```markdown
---
name: Chính sách bán hàng
description: Quy định đổi trả, bảo hành, hoàn tiền
tags: chính sách, đổi trả, bảo hành
---

## Chính sách đổi trả

- Đổi trả trong vòng 7 ngày...

## Bảo hành

- Sản phẩm điện tử: 12 tháng...
```

### Ví dụ

```
"Lưu kiến thức Docker: cách tối ưu Dockerfile"  → addKnowledge
"Nhắc lại cách undo commit?"                    → searchKnowledge
"Tôi đã lưu những gì?"                          → listTopics
"Cho tôi xem hết về Docker"                     → getKnowledge
"Chính sách bảo hành thế nào?"                  → searchKnowledge (match tag)
```

### Search ranking

1. **Tag match** — "bảo hành" match tag → trả về tất cả entries của topic đó
2. **Title match** — match heading `##`
3. **Content match** — match nội dung

---

## Cấu trúc source code

```
src/
├── index.ts              # Entry point
├── mcp.ts                # Đăng ký tools
├── config.ts             # Env vars
├── logger.ts             # JSON logger → stderr
├── errors.ts             # Error types
├── core/
│   ├── brain.ts          # Brain facade (tasks, notes, goals, inbox)
│   ├── parser.ts         # Markdown ↔ structured data
│   ├── knowledge.ts      # Knowledge base (frontmatter + search)
│   └── aggregator.ts     # Cross-file queries
├── github/
│   ├── client.ts         # GitHub API (cache + retry)
│   └── sync.ts           # Section → file path mapping
└── tools/
    ├── helpers.ts         # Tool wrapper
    ├── brain.ts           # initBrain
    ├── tasks.ts           # Task tools
    ├── notes.ts           # Note + goal tools
    ├── inbox.ts           # Inbox tools
    └── knowledge.ts       # Knowledge tools
```

---

## Scripts

| Lệnh | Mô tả |
|-------|--------|
| `./install.sh` | Cài đặt lần đầu (deps + build + .env) |
| `./update.sh` | Cập nhật (pull + deps + rebuild) |
| `npm run build` | Build TypeScript → `dist/` |
| `npm run start` | Chạy server production |
| `npm run dev` | Chạy trực tiếp bằng tsx |

---

## Lưu ý kỹ thuật

- **initBrain** dùng Git Tree API — tạo tất cả file trong 1 commit, hoạt động trên repo rỗng
- **TTL Cache** — reads cached 30s, writes tự invalidate
- **Retry on conflict** — ghi file gặp SHA conflict (409) tự retry 3 lần
- **Format-preserving** — sửa task chỉ thay đúng dòng, không rewrite file
- **CRLF safe** — normalize `\r\n`, hỗ trợ frontmatter, numbered lists, priority (`!`/`!!`/`!!!`), due dates (`@due()`)
- **Frontmatter knowledge** — tags cho phép search nhanh không cần đọc content
- **Structured logging** — JSON logs ra stderr, không ảnh hưởng MCP stdout

---

## License

MIT
