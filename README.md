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

### Cách 1: Tự động (khuyên dùng)

Chỉ cần **tạo repo rỗng** trên GitHub (ví dụ: `brain`), rồi kết nối MCP server. Sau đó nói với Claude:

> "Khởi tạo brain cho tôi"

Claude sẽ gọi tool `initBrain` và tự động tạo toàn bộ cấu trúc thư mục trong **1 commit**:

```
brain/
├── inbox/capture.md
├── tasks/today.md
├── tasks/backlog.md
├── notes/ideas.md
├── notes/learning.md
├── goals/short-term.md
├── goals/long-term.md
└── knowledge/general.md    ← knowledge base
```

### Cách 2: Thủ công

Nếu muốn tự tạo, copy thư mục `example-brain/brain/` trong repo này lên GitHub:

```bash
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
- [ ] !!! Task ưu tiên cao #work @due(2026-03-20)
- [ ] !! Task ưu tiên trung bình #personal
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

### Khởi tạo

| Tool | Mô tả |
|------|--------|
| `initBrain` | Tạo toàn bộ cấu trúc brain trên repo rỗng (1 commit) |

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

### Knowledge Base

| Tool | Input | Mô tả |
|------|-------|--------|
| `listTopics` | — | Xem danh sách topics (chỉ tên, không đọc nội dung) |
| `getKnowledge` | `topic` | Đọc toàn bộ entries trong 1 topic |
| `addKnowledge` | `topic`, `title`, `content` | Thêm kiến thức, tự tạo topic nếu chưa có |
| `searchKnowledge` | `query` | Tìm kiếm keyword across tất cả topics |

---

## Bắt đầu sử dụng

**Lần đầu tiên** — tạo repo rỗng trên GitHub, cấu hình MCP, rồi nói:

```
"Khởi tạo brain cho tôi"
→ Claude gọi initBrain, tạo toàn bộ cấu trúc
```

**Sau đó** — hỏi Claude bất kỳ câu nào:

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

## Knowledge Base — Hệ thống kiến thức

Knowledge base cho phép lưu trữ kiến thức theo topic và tìm kiếm lại khi cần. Kiến thức được tổ chức trong folder `knowledge/`, mỗi topic là 1 file markdown.

### Cấu trúc

```
brain/knowledge/
├── javascript.md     ← topic về JS
├── git.md            ← topic về Git
├── docker.md         ← topic về Docker
└── cooking.md        ← không chỉ code — lưu gì cũng được
```

### Format mỗi topic file

Mỗi entry là 1 heading `##` với nội dung bên dưới:

```markdown
# JavaScript

## var vs let vs const

- `var`: function-scoped, hoisted → tránh dùng
- `let`: block-scoped, có thể reassign
- `const`: block-scoped, không thể reassign

## Promise vs async/await

Promise là cách xử lý bất đồng bộ trong JS.
async/await là syntax sugar cho Promise...
```

### Ví dụ sử dụng

#### Hỏi kiến thức đã lưu

```
User: "Nhắc lại cách undo commit trong git?"

Claude:
  1. searchKnowledge("undo commit")
  2. Tìm thấy entry "Undo last commit" trong topic "git"
  3. Trả lời: git reset --soft HEAD~1
```

#### Lưu kiến thức mới

```
User: "Lưu lại cách tối ưu Dockerfile cho Node.js"

Claude:
  1. addKnowledge("docker", "Dockerfile tối ưu cho Node.js", "FROM node:20-alpine...")
  2. Trả lời: Đã lưu vào topic docker
```

#### Tạo topic mới tự động

```
User: "Ghi nhớ: trứng luộc lòng đào cần đúng 6 phút 30 giây"

Claude:
  1. addKnowledge("cooking", "Trứng luộc lòng đào", "Nước sôi → thả trứng → 6:30 → ngâm đá")
  2. File cooking.md được tạo tự động nếu chưa có
```

#### Xem có những topic gì

```
User: "Tôi đã lưu những kiến thức gì?"

Claude:
  1. listTopics()
  2. Trả về: javascript, git, docker, cooking
  → Chỉ 1 API call, không đọc nội dung file nào
```

#### Đọc chi tiết 1 topic

```
User: "Cho tôi xem hết kiến thức về Docker"

Claude:
  1. getKnowledge("docker")
  2. Trả về tất cả entries: Các lệnh cơ bản, Dockerfile tối ưu, Docker Compose...
```

#### Tìm kiếm cross-topic

```
User: "Tôi có ghi gì về async không?"

Claude:
  1. searchKnowledge("async")
  2. Tìm thấy entry "Promise vs async/await" trong topic "javascript"
  3. Trả về nội dung match
```

### Flow tiết kiệm token

| Bước | API calls | Token |
|------|-----------|-------|
| `listTopics()` | 1 | Chỉ tên file, ~50 bytes |
| `getKnowledge("git")` | 1 (cached 30s) | Chỉ 1 file |
| `searchKnowledge("x")` | 1 + N (cached) | Lần đầu load, các lần sau free |
| `addKnowledge(...)` | 2 (read + write) | Chỉ 1 file |

So với lưu hết vào 1 file: knowledge tách topic nên khi đọc chỉ load đúng cái cần, không phải load toàn bộ.

---

## Cấu trúc source code

```
src/
├── index.ts            # Entry point — khởi tạo server + stdio transport
├── mcp.ts              # Đăng ký tất cả MCP tools
├── config.ts           # Load biến môi trường
├── logger.ts           # Structured JSON logger (ghi ra stderr)
├── errors.ts           # Error hierarchy (NotFoundError, ConflictError...)
├── core/
│   ├── brain.ts        # Facade chính — đọc/ghi/init brain qua GitHub
│   ├── parser.ts       # Parse markdown ↔ structured data
│   ├── knowledge.ts    # Knowledge base — lưu/tìm kiến thức theo topic
│   └── aggregator.ts   # Truy vấn cross-file (tổng hợp tasks)
├── github/
│   ├── client.ts       # Octokit wrapper (getFile, updateFile, listDirectory...)
│   └── sync.ts         # Map brain section → GitHub file path + retry
├── tools/
│   ├── helpers.ts      # toolHandler wrapper (error handling + logging)
│   ├── brain.ts        # Tool: initBrain
│   ├── tasks.ts        # Tools: getTasks, addTask, markTaskDone...
│   ├── notes.ts        # Tools: getNotes, addNote, getGoals
│   ├── inbox.ts        # Tools: getInbox, saveToInbox
│   └── knowledge.ts    # Tools: listTopics, getKnowledge, addKnowledge, searchKnowledge
└── types/
    ├── brain.ts        # Types: FileContent, BrainSection, Note, Goal
    └── task.ts         # Types: Task, TaskStatus, TaskPriority
```

---

## Biến môi trường

| Biến | Bắt buộc | Mặc định | Mô tả |
|------|----------|----------|--------|
| `GITHUB_TOKEN` | Yes | — | GitHub Personal Access Token (quyền repo) |
| `GITHUB_OWNER` | Yes | — | Username hoặc org trên GitHub |
| `GITHUB_REPO` | Yes | — | Tên repo chứa brain |
| `GITHUB_BRANCH` | No | `main` | Branch sử dụng |
| `BRAIN_BASE_PATH` | No | `brain` | Thư mục gốc trong repo |
| `LOG_LEVEL` | No | `info` | `debug` / `info` / `warn` / `error` |
| `CACHE_TTL_MS` | No | `30000` | Thời gian cache file reads (ms) |
| `WRITE_RETRIES` | No | `3` | Số lần retry khi gặp SHA conflict |

---

## Scripts

```bash
npm run build    # Compile TypeScript → dist/
npm run start    # Chạy server (production)
npm run dev      # Chạy trực tiếp bằng tsx (development)
```

---

## Lưu ý kỹ thuật

- **initBrain dùng Git Tree API:** Tạo tất cả file trong 1 commit duy nhất, hoạt động cả trên repo hoàn toàn rỗng (chưa có commit nào).
- **TTL Cache:** File reads được cache trong bộ nhớ (mặc định 30s) để giảm API calls. Writes tự động invalidate cache.
- **Retry on conflict:** Khi ghi file gặp SHA conflict (409), server tự đọc lại file mới nhất và thử lại (mặc định 3 lần).
- **Format-preserving:** Khi sửa task (mark done, thêm task), server chỉ sửa đúng dòng cần thiết, không rewrite toàn bộ file.
- **CRLF safe:** Parser tự normalize `\r\n` → `\n`, hỗ trợ frontmatter, numbered lists, priority markers (`!`/`!!`/`!!!`), due dates (`@due(YYYY-MM-DD)`).
- **Structured logging:** Tất cả logs ghi ra stderr dạng JSON, không ảnh hưởng MCP protocol trên stdout.

---

## License

MIT
