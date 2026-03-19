# Knowledge MCP Server

**Biến AI thành trợ lý cá nhân có trí nhớ vĩnh viễn.**

Quản lý công việc, ghi chú, mục tiêu và kiến thức — tất cả bằng ngôn ngữ tự nhiên. Mọi thứ được lưu trên GitHub, có version control, truy cập từ bất kỳ đâu.

```
Bạn nói                              AI làm
─────────────────────────────────────────────────────────
"Hôm nay tôi cần làm gì?"           → Xem tasks hôm nay
"Thêm task: thiết kế landing page"   → Tạo task mới
"Xong task review PR rồi"            → Đánh dấu hoàn thành
"Lưu kiến thức Docker: dùng alpine"  → Lưu vào knowledge base
"Chính sách bảo hành thế nào?"       → Tìm và trả lời từ dữ liệu đã lưu
"Phân tích năng suất của tôi"        → Báo cáo insights + gợi ý cải thiện
```

> Không cần nhớ tên lệnh. Nói tự nhiên. AI tự hiểu.

---

## Tại sao dùng Knowledge MCP?

**AI thông thường quên sau mỗi cuộc hội thoại.** Knowledge MCP cho AI bộ nhớ dài hạn — lưu một lần, dùng mãi mãi.

- **Trí nhớ vĩnh viễn** — Kiến thức lưu trên GitHub, không bao giờ mất. AI trả lời dựa trên dữ liệu bạn đã lưu, không phịa.
- **Quản lý công việc bằng giọng nói tự nhiên** — Thêm task, đánh dấu xong, xem backlog — không cần mở app nào khác.
- **Knowledge base cá nhân** — Lưu quy trình, chính sách, ghi chú kỹ thuật, bất kỳ thứ gì. AI tìm và trả lời chính xác khi bạn hỏi lại.
- **Phân tích năng suất** — AI phân tích thói quen làm việc, phát hiện vấn đề, gợi ý cải thiện cụ thể.
- **Version control** — Mỗi hành động là một git commit. Xem lịch sử, rollback bất kỳ lúc nào.
- **Hoạt động trên mọi AI platform** — Claude Desktop, Cursor, VS Code, Windsurf, Claude Code CLI, và bất kỳ MCP client nào.

---

## Demo nhanh

### Quản lý công việc
```
Bạn: Hôm nay tôi cần làm gì?
AI:  Bạn có 3 tasks hôm nay:
     1. !! Review PR của Minh #dev @due(2025-03-20)
     2. Thiết kế landing page #design
     3. Fix bug login page #dev

Bạn: Xong task review PR rồi
AI:  Đã đánh dấu hoàn thành "Review PR của Minh" ✓
```

### Knowledge base
```
Bạn: Ghi nhớ: chính sách đổi trả là 7 ngày, sản phẩm còn nguyên tem
AI:  Đã lưu vào knowledge base, topic "chinh-sach" với tags: đổi trả, chính sách

Bạn: Khách hỏi chính sách đổi trả thế nào?
AI:  Theo dữ liệu đã lưu: Chính sách đổi trả là 7 ngày, sản phẩm còn nguyên tem.
```

### Phân tích năng suất
```
Bạn: Phân tích năng suất của tôi tuần này
AI:  ## Insights
     - Bạn hoạt động nhiều nhất lúc 9-11h sáng (65% commits)
     - Completion rate: 72% — khá tốt

     ## Vấn đề
     - 3 tasks quá hạn, task "Refactor auth module" trễ 5 ngày
     - 4 tasks không có deadline — dễ bị trì hoãn
     - Backlog đang phình (12 items), có vẻ chưa được review

     ## Gợi ý
     - Đặt deadline cho 4 tasks đang thiếu
     - Review và dọn backlog — bỏ hoặc lên lịch cụ thể
     - Chia nhỏ "Refactor auth module" — task quá lớn
```

---

## Cài đặt (2 phút)

### Yêu cầu

- Node.js >= 18
- GitHub account + Personal Access Token ([tạo tại đây](https://github.com/settings/tokens) — cần quyền **repo**)
- Một repo rỗng trên GitHub (ví dụ: `brain`)

### Cách 1: Một lệnh duy nhất

```bash
curl -fsSL https://raw.githubusercontent.com/vuluu2k/knowledge_mcp/main/install.sh -o install.sh && bash install.sh
```

Clone, install, build, cấu hình `.env` interactive, in ra config sẵn cho AI platform của bạn.

### Cách 2: Clone + script

```bash
git clone https://github.com/vuluu2k/knowledge_mcp.git
cd knowledge_mcp
./install.sh
```

### Cách 3: Thủ công

```bash
git clone https://github.com/vuluu2k/knowledge_mcp.git
cd knowledge_mcp
npm install && npm run build
cp .env.example .env
# Sửa .env với token + repo info
```

---

## Kết nối với AI Platform

MCP server chạy qua stdio — tương thích mọi platform hỗ trợ MCP.

> Thay `/path/to/knowledge_mcp` bằng đường dẫn thực tế. Script `install.sh` sẽ in ra config copy-paste sẵn.

<details>
<summary><b>Claude Desktop</b></summary>

File: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) hoặc `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "knowledge-brain": {
      "command": "node",
      "args": ["/path/to/knowledge_mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "GITHUB_OWNER": "yourusername",
        "GITHUB_REPO": "brain"
      }
    }
  }
}
```
</details>

<details>
<summary><b>Claude Code (CLI)</b></summary>

```bash
claude mcp add knowledge-brain -- node /path/to/knowledge_mcp/dist/index.js
```
</details>

<details>
<summary><b>Cursor</b></summary>

Settings > MCP Servers > Add new:

```json
{
  "mcpServers": {
    "knowledge-brain": {
      "command": "node",
      "args": ["/path/to/knowledge_mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "GITHUB_OWNER": "yourusername",
        "GITHUB_REPO": "brain"
      }
    }
  }
}
```
</details>

<details>
<summary><b>VS Code (Copilot / Roo Code / Continue)</b></summary>

File `.vscode/mcp.json` trong project hoặc global settings:

```json
{
  "servers": {
    "knowledge-brain": {
      "command": "node",
      "args": ["/path/to/knowledge_mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "GITHUB_OWNER": "yourusername",
        "GITHUB_REPO": "brain"
      }
    }
  }
}
```
</details>

<details>
<summary><b>Windsurf</b></summary>

File `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "knowledge-brain": {
      "command": "node",
      "args": ["/path/to/knowledge_mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "GITHUB_OWNER": "yourusername",
        "GITHUB_REPO": "brain"
      }
    }
  }
}
```
</details>

<details>
<summary><b>OpenAI Codex CLI</b></summary>

File `~/.codex/config.json`:

```json
{
  "mcpServers": {
    "knowledge-brain": {
      "command": "node",
      "args": ["/path/to/knowledge_mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "GITHUB_OWNER": "yourusername",
        "GITHUB_REPO": "brain"
      }
    }
  }
}
```
</details>

<details>
<summary><b>Antigravity</b></summary>

Project settings > Integrations > MCP > Add server:

```json
{
  "mcpServers": {
    "knowledge-brain": {
      "command": "node",
      "args": ["/path/to/knowledge_mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "GITHUB_OWNER": "yourusername",
        "GITHUB_REPO": "brain"
      }
    }
  }
}
```
</details>

<details>
<summary><b>Bất kỳ MCP Client nào</b></summary>

| Field | Value |
|-------|-------|
| Command | `node` |
| Args | `/path/to/knowledge_mcp/dist/index.js` |
| Env | `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` |

Transport: **stdio** (mặc định).
</details>

---

## Bắt đầu sử dụng

### Bước 1 — Khởi tạo (chỉ 1 lần)

Tạo một repo rỗng trên GitHub, cấu hình xong, rồi nói:

```
Khởi tạo brain cho tôi
```

AI tạo toàn bộ cấu trúc trong 1 commit:

```
brain/
├── inbox/capture.md           ← Ghi nhanh
├── tasks/
│   ├── today.md               ← Việc hôm nay
│   └── backlog.md             ← Việc để dành
├── notes/
│   ├── ideas.md               ← Ý tưởng
│   └── learning.md            ← Kiến thức học được
├── goals/
│   ├── short-term.md          ← Mục tiêu ngắn hạn
│   └── long-term.md           ← Mục tiêu dài hạn
└── knowledge/
    └── general.md             ← Knowledge base
```

### Bước 2 — Dùng hàng ngày

Nói chuyện tự nhiên. AI tự chọn tool phù hợp.

| Bạn nói | AI hiểu |
|---------|---------|
| "thêm task", "nhắc tôi", "cần làm" | Tạo task mới |
| "xong rồi", "done", "hoàn thành" | Đánh dấu task xong |
| "ghi lại", "note", "ý tưởng" | Thêm ghi chú |
| "nhớ giùm", "capture", "lưu nhanh" | Lưu vào inbox |
| "lưu kiến thức", "ghi nhớ rằng" | Lưu vào knowledge base |
| "tìm", "nhắc lại", "có ghi gì về" | Tìm trong knowledge |
| "phân tích năng suất", "review" | Báo cáo insights |

> Chi tiết hơn: [GUIDE.md](./GUIDE.md) — hướng dẫn chat với AI agent hiệu quả.

---

## Danh sách Tools (16)

### Khởi tạo

| Tool | Mô tả |
|------|--------|
| `initBrain` | Tạo toàn bộ cấu trúc brain trên repo rỗng (1 commit) |

### Tasks (5 tools)

| Tool | Input | Mô tả |
|------|-------|--------|
| `getTasks` | `section` (today/backlog/all) | Lấy tasks theo section |
| `getTodayTasks` | — | Tasks hôm nay |
| `getBacklog` | — | Tasks backlog |
| `addTask` | `text`, `target` | Thêm task mới |
| `markTaskDone` | `taskId` hoặc `text` | Đánh dấu hoàn thành |

### Notes / Goals / Inbox (5 tools)

| Tool | Input | Mô tả |
|------|-------|--------|
| `getNotes` | `section` (ideas/learning) | Lấy ghi chú |
| `addNote` | `content`, `file` | Thêm ghi chú |
| `getGoals` | `section` (short-term/long-term) | Lấy mục tiêu |
| `getInbox` | — | Lấy inbox |
| `saveToInbox` | `content` | Lưu nhanh vào inbox |

### Knowledge Base (4 tools)

| Tool | Input | Mô tả |
|------|-------|--------|
| `listTopics` | — | Danh sách topics (name + description + tags) |
| `getKnowledge` | `topic` | Đọc toàn bộ 1 topic |
| `addKnowledge` | `topic`, `title`, `content`, `description?`, `tags?` | Thêm kiến thức |
| `searchKnowledge` | `query` | Tìm kiếm cross-topic (tag > title > content) |

### Insights & Analytics (1 tool)

| Tool | Input | Mô tả |
|------|-------|--------|
| `getInsights` | — | Phân tích năng suất, phát hiện vấn đề, gợi ý cải thiện |

`getInsights` phân tích:
- **Completion rate** — tỷ lệ hoàn thành tasks
- **Overdue tasks** — tasks quá hạn và số ngày trễ
- **Task quality** — phát hiện tasks thiếu priority, deadline, hoặc mô tả quá mơ hồ
- **Activity patterns** — giờ nào và ngày nào bạn hoạt động nhiều nhất (từ commit history)
- **Goal alignment** — tasks hôm nay có khớp với mục tiêu không
- **Inbox health** — bao nhiêu items chưa xử lý

---

## Knowledge Base

Lưu trữ kiến thức theo topic. Mỗi file có frontmatter + entries:

```markdown
---
name: Chính sách bán hàng
description: Quy định đổi trả, bảo hành, hoàn tiền
tags: chính sách, đổi trả, bảo hành
---

## Chính sách đổi trả
- Đổi trả trong vòng 7 ngày, sản phẩm còn nguyên tem

## Bảo hành
- Sản phẩm điện tử: 12 tháng
```

### Search ranking

1. **Tag match** — "bảo hành" match tag > trả về tất cả entries của topic
2. **Title match** — match heading `##`
3. **Content match** — match nội dung

AI tự động tìm trong knowledge base trước khi trả lời. Nếu có dữ liệu đã lưu, AI dùng dữ liệu đó — không phịa.

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

## Cập nhật

```bash
# Nếu cài bằng curl (mặc định ~/.knowledge-brain-mcp)
curl -fsSL https://raw.githubusercontent.com/vuluu2k/knowledge_mcp/main/update.sh | bash

# Hoặc chạy trực tiếp trong thư mục đã clone
./update.sh
```

Script tự động xử lý toàn bộ:

1. **Phát hiện thay đổi local** — nếu bạn đã sửa code, script hỏi:
   - Lưu tạm (stash) rồi cập nhật
   - Ghi đè thay đổi local
   - Hủy cập nhật
2. **Pull bản mới nhất** từ GitHub
3. **Hiển thị changelog** — những gì đã thay đổi
4. **Cài lại dependencies** nếu có package mới
5. **Rebuild TypeScript** — `dist/` được build lại hoàn toàn
6. **Kiểm tra .env** — báo nếu có biến môi trường mới cần thêm

```
[INFO] Phiên bản hiện tại: a1b2c3d
[INFO] Đang tải bản mới nhất...
[OK] Đã cập nhật: a1b2c3d → e4f5g6h

[INFO] Thay đổi:
  e4f5g6h feat: add auto-action engine
  d3c2b1a fix: knowledge search ranking

[OK] Đã cập nhật dependencies
[OK] Build hoàn tất
[OK] .env đầy đủ

═══════════════════════════════════════════════════
  Cập nhật hoàn tất!
═══════════════════════════════════════════════════
  Khởi động lại IDE để sử dụng bản mới.
```

Nếu cài ở thư mục khác (không phải mặc định), truyền đường dẫn:

```bash
./update.sh ~/my-custom-path
```

## Gỡ cài đặt

```bash
./install.sh --uninstall
```

Xóa thư mục server + tự động gỡ config khỏi tất cả IDE (Claude Desktop, Claude Code, Cursor, Windsurf...).

---

## Scripts

| Lệnh | Mô tả |
|-------|--------|
| `curl ... \| bash` | Cài từ xa — clone, build, cấu hình IDE tự động |
| `./install.sh` | Cài đặt (hoạt động cả local lẫn curl pipe) |
| `./install.sh --uninstall` | Gỡ cài đặt + xóa config IDE |
| `./update.sh` | Cập nhật — pull, rebuild, check .env |
| `npm run build` | Build TypeScript |
| `npm run start` | Chạy server |
| `npm run dev` | Dev mode (tsx) |

---

## Kiến trúc

```
Claude/AI ◄──stdio──► MCP Server ◄──HTTPS──► GitHub API ◄──► brain/ repo
```

**Nguyên tắc:** MCP server chỉ xử lý dữ liệu. Toàn bộ suy luận do AI đảm nhận.

```
src/
├── index.ts              # Entry point
├── mcp.ts                # Đăng ký tools + server instructions
├── config.ts             # Env vars
├── logger.ts             # JSON logger → stderr
├── errors.ts             # Error types
├── core/
│   ├── brain.ts          # Brain facade (tasks, notes, goals, inbox)
│   ├── parser.ts         # Markdown ↔ structured data
│   ├── knowledge.ts      # Knowledge base (frontmatter + search)
│   ├── insights.ts       # Insight engine (analytics + patterns)
│   └── aggregator.ts     # Cross-file queries
├── github/
│   ├── client.ts         # GitHub API (cache + retry)
│   └── sync.ts           # Section → file path mapping
└── tools/
    ├── helpers.ts        # Tool wrapper
    ├── brain.ts          # initBrain
    ├── tasks.ts          # Task tools (5)
    ├── notes.ts          # Note + goal tools (3)
    ├── inbox.ts          # Inbox tools (2)
    ├── knowledge.ts      # Knowledge tools (4)
    └── insights.ts       # Insight tool (1)
```

### Kỹ thuật

- **Git Tree API** — initBrain tạo tất cả file trong 1 commit, hoạt động trên repo rỗng
- **TTL Cache** — reads cached 30s, writes tự invalidate
- **Atomic writes** — SHA conflict (409) tự retry 3 lần
- **Format-preserving** — sửa task chỉ thay đúng dòng, không rewrite file
- **CRLF safe** — normalize line endings, hỗ trợ frontmatter, priority (`!`/`!!`/`!!!`), due dates (`@due()`)
- **Tag-first search** — knowledge search ưu tiên tag match, không cần đọc content
- **Commit history analysis** — phân tích patterns từ lịch sử commit cho insights
- **Server instructions** — AI agent nhận instructions khi kết nối, hiểu ngay cách dùng

---

## Use Cases

### Cho cá nhân
- Quản lý tasks hàng ngày bằng ngôn ngữ tự nhiên
- Lưu kiến thức kỹ thuật (Docker, Git, API endpoints...)
- Theo dõi mục tiêu và tiến độ
- Phân tích thói quen làm việc

### Cho team / doanh nghiệp
- Knowledge base chính sách (đổi trả, bảo hành, quy trình)
- AI customer support trả lời dựa trên dữ liệu thực
- Onboarding — nhân viên mới hỏi AI về quy trình nội bộ
- Lưu và tra cứu tài liệu kỹ thuật

---

## License

MIT
