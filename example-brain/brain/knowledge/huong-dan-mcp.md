---
name: Hướng dẫn sử dụng Knowledge Brain MCP
description: Cách cài đặt, sử dụng và làm việc hiệu quả với MCP server — quản lý task, kiến thức, phân tích năng suất
tags: mcp, hướng dẫn, brain, knowledge, task, setup, workflow
---

## Bắt đầu nhanh

Sau khi cài MCP và kết nối với AI (Claude, Cursor, Windsurf...), chỉ cần nói:

```
"Khởi tạo brain cho tôi"
```

AI sẽ tự động:
- Tạo GitHub repo (private) nếu chưa có
- Tạo toàn bộ cấu trúc brain trong 1 commit
- Sẵn sàng dùng ngay

Không cần tạo repo tay. Không cần config gì thêm.

## Cấu trúc Brain

```
brain/
├── inbox/capture.md           — Ghi nhanh, chưa phân loại
├── tasks/
│   ├── today.md               — Việc cần làm hôm nay
│   └── backlog.md             — Việc để dành, chưa gấp
├── notes/
│   ├── ideas.md               — Ý tưởng
│   └── learning.md            — Kiến thức học được
├── goals/
│   ├── short-term.md          — Mục tiêu ngắn hạn
│   └── long-term.md           — Mục tiêu dài hạn
└── knowledge/
    └── *.md                   — Knowledge base theo topic
```

Mỗi hành động tạo 1 git commit — có thể xem lịch sử, rollback bất kỳ lúc nào.

## Quản lý công việc

### Thêm task

```
"Thêm task: thiết kế landing page"              → thêm vào today
"Thêm vào backlog: refactor module auth"         → thêm vào backlog
"Nhắc tôi review PR của Minh"                    → thêm vào today
```

Task hỗ trợ metadata inline:

```
"Thêm task: !!! Fix API bug #backend @due(2025-04-01) @est(2h)"
```

- `!` / `!!` / `!!!` — priority: low / medium / high
- `#tag` — phân loại
- `@due(YYYY-MM-DD)` — deadline
- `@est(Xh)` hoặc `@est(30m)` — ước lượng thời gian

### Xem task

```
"Hôm nay tôi cần làm gì?"                       → xem today tasks
"Cho tôi xem backlog"                             → xem backlog
"Tôi có bao nhiêu task chưa làm?"                → xem tất cả
```

### Hoàn thành task

```
"Xong task review PR rồi"                        → tìm và đánh dấu done
"Done task đầu tiên"                              → fuzzy match
"Đánh dấu hoàn thành thiết kế landing page"      → match theo text
```

## Ghi chú và Mục tiêu

### Ghi chú

```
"Ghi lại ý tưởng: xây dựng AI chatbot cho support"    → ideas.md
"Note vào learning: cách dùng Docker multi-stage"       → learning.md
```

### Inbox — ghi nhanh chưa phân loại

```
"Nhớ giùm tôi: gọi khách lúc 3h chiều"
"Capture: xem lại pricing Vercel"
"Lưu nhanh: link bài viết system design hay"
```

Inbox tự thêm timestamp. Xử lý sau bằng cách nói "Xem inbox" rồi phân loại.

### Mục tiêu

```
"Tóm tắt goals của tôi"
"Cho tôi xem mục tiêu ngắn hạn"
```

## Knowledge Base — Trí nhớ dài hạn

Đây là tính năng mạnh nhất. Lưu bất kỳ kiến thức nào, AI nhớ mãi.

### Lưu kiến thức

```
"Lưu kiến thức Docker: dùng alpine image để giảm size"
"Ghi nhớ: chính sách đổi trả 7 ngày, sản phẩm nguyên tem"
"Nhớ rằng: API tạo order là POST /api/v1/orders"
```

Kiến thức được tổ chức theo topic (file .md riêng), mỗi topic có:
- **name** — tên hiển thị
- **description** — mô tả ngắn
- **tags** — từ khóa để tìm nhanh
- **entries** — các mục kiến thức (heading ##)

### Tra cứu kiến thức

```
"Chính sách bảo hành thế nào?"       → tìm trong knowledge, trả lời từ dữ liệu
"Nhắc lại cách undo commit git?"     → tìm topic git
"Tôi đã lưu gì về Docker?"          → xem topic docker
"Liệt kê các chủ đề kiến thức"      → danh sách tất cả topics
```

AI tự động tìm trong knowledge base TRƯỚC khi trả lời. Nếu có dữ liệu → dùng dữ liệu. Nếu không → trả lời từ AI và đề nghị lưu lại.

### Search ranking

1. **Tag match** — nhanh nhất, ưu tiên cao nhất
2. **Title match** — match heading ##
3. **Content match** — tìm trong nội dung

## Phân tích năng suất

### Xem context hôm nay

```
"Hôm nay tôi nên focus gì?"
```

Trả về: tasks pending, overdue, top 3 gợi ý focus (tính theo priority + deadline + estimate), goals ngắn hạn.

### Xem thống kê

```
"Thống kê năng suất của tôi"
```

Trả về: completion rate, tasks/ngày, giờ hoạt động nhiều nhất, ngày trong tuần, stale tasks, phân bố tags.

### Phân tích hành vi

```
"Phân tích workflow của tôi"
"Tôi làm việc hiệu quả không?"
```

AI chạy 5 bộ phát hiện:
1. **Productivity** — chronotype (early bird / night owl), xu hướng tăng/giảm, weekend work
2. **Procrastination** — priority inversion, task quá hạn, thiếu estimate
3. **Task structure** — task mơ hồ, quá lớn (>4h), thiếu priority/tags
4. **Goal alignment** — tasks có khớp mục tiêu không
5. **Workload** — overcommit (>8h/ngày), inbox tràn, backlog phình

Kết quả: healthScore (0-100), insights với severity + evidence + suggestion.

## Tự động tối ưu

```
"Tối ưu tasks cho tôi"                           → preview (dry run)
"OK, áp dụng đi"                                  → commit thay đổi
```

5 hành động tự động:
- **autoReschedule** — chuyển tasks quá hạn từ backlog → today
- **autoSplitTask** — chia task >4h thành Plan → Execute → Verify
- **autoPrioritize** — đẩy top backlog lên today khi backlog >10 items
- **autoCleanup** — xóa task trùng lặp và task bỏ hoang
- **autoInjectTask** — tạo task cho goals chưa được động tới

Luôn chạy preview trước (dryRun=true), xác nhận rồi mới áp dụng. Tất cả thay đổi trong 1 commit duy nhất.

## Mẹo dùng hiệu quả

### Nói ngắn gọn

```
✅ "Thêm task: deploy v2 lên staging"
❌ "Tôi muốn nhờ bạn thêm giúp tôi một task mới, task đó là deploy v2 lên staging"
```

### Cho context khi lưu knowledge

```
✅ "Ghi nhớ chính sách shop: đổi trả 7 ngày, cần nguyên tem"
❌ "Nhớ cái này: 7 ngày"
```

### Dùng tags và priority

```
✅ "!!! Fix login bug #backend @due(2025-04-01) @est(2h)"
❌ "Fix bug"
```

Tasks có đủ metadata giúp AI phân tích chính xác hơn, gợi ý focus đúng hơn.

### Flow hàng ngày

**Buổi sáng:**
```
"Hôm nay tôi nên focus gì?"
```

**Trong ngày:**
```
"Thêm task: họp team design 2h chiều"
"Done task review PR"
"Lưu nhanh: ý tưởng cải thiện checkout flow"
```

**Cuối ngày:**
```
"Tôi đã xong gì hôm nay?"
"Tối ưu tasks cho tôi"
```

**Khi học được gì mới:**
```
"Ghi nhớ: trong PostgreSQL dùng EXPLAIN ANALYZE để debug slow query"
```

**Cuối tuần:**
```
"Phân tích năng suất tuần này"
```

## Cài đặt

### Một lệnh duy nhất

```bash
curl -fsSL https://raw.githubusercontent.com/vuluu2k/knowledge_mcp/main/install.sh | bash
```

Script tự động: kiểm tra Node.js (cài nếu thiếu) → clone → build → cấu hình .env → cấu hình IDE.

### Cập nhật

```bash
curl -fsSL https://raw.githubusercontent.com/vuluu2k/knowledge_mcp/main/update.sh | bash
```

Hoặc nếu đã clone:

```bash
./update.sh
```

### Gỡ cài đặt

```bash
./install.sh --uninstall
```

### Cấu hình .env

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| GITHUB_TOKEN | Có | Personal Access Token (quyền repo) |
| GITHUB_OWNER | Có | Username GitHub |
| GITHUB_REPO | Có | Tên repo (mặc định: brain) |
| GITHUB_BRANCH | Không | Branch (mặc định: main) |
| LOG_LEVEL | Không | debug / info / warn / error |

## Lưu ý quan trọng

- **Không cần nhớ tên tool** — nói tự nhiên, AI tự chọn tool phù hợp
- **Knowledge base là vĩnh viễn** — lưu 1 lần, dùng mãi mãi
- **Mọi thay đổi có git history** — mỗi hành động là 1 commit, có thể revert
- **Không giới hạn ngôn ngữ** — tiếng Việt, tiếng Anh, mix đều được
- **AI tìm knowledge trước khi trả lời** — nếu đã lưu, AI dùng dữ liệu đó, không phịa
- **Luôn preview trước khi auto-optimize** — dryRun=true mặc định, xác nhận rồi mới áp dụng
