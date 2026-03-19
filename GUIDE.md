# Hướng dẫn chat với AI Agent hiệu quả

Sau khi cài đặt MCP server và kết nối với Claude, bạn chỉ cần **nói chuyện tự nhiên**. Claude sẽ tự gọi đúng tool.

---

## Lần đầu tiên — Khởi tạo Brain

Bạn chỉ cần tạo 1 repo rỗng trên GitHub, cấu hình xong, rồi nói:

```
Khởi tạo brain cho tôi
```

Claude sẽ gọi `initBrain` → tạo toàn bộ cấu trúc trong 1 commit. Xong. Bắt đầu dùng luôn.

---

## Quản lý công việc

### Xem việc cần làm

```
Hôm nay tôi cần làm gì?
```
```
Cho tôi xem backlog
```
```
Tôi có bao nhiêu task chưa làm?
```

### Thêm task

```
Thêm task: thiết kế landing page
```
```
Thêm vào backlog: refactor module auth
```
```
Nhắc tôi review PR của Minh
```

### Hoàn thành task

```
Đánh dấu task review PR là xong
```
```
Xong task thiết kế landing page rồi
```
```
Done task đầu tiên trong today
```

---

## Ghi chú nhanh

### Lưu ý tưởng

```
Ghi lại ý tưởng: xây dựng AI chatbot cho team support
```
```
Note lại: dùng Tailwind thay vì CSS modules cho dự án mới
```

### Lưu vào inbox (chưa phân loại)

```
Capture: xem lại pricing của Vercel
```
```
Nhớ giùm tôi: gọi điện cho khách lúc 3h chiều
```
```
Lưu nhanh: link bài viết hay về system design
```

### Ghi goals

```
Tóm tắt goals của tôi
```
```
Cho tôi xem mục tiêu ngắn hạn
```

---

## Knowledge Base — Lưu và tra cứu kiến thức

Đây là phần mạnh nhất. Bạn có thể dạy AI nhớ bất kỳ thứ gì.

### Lưu kiến thức mới

```
Lưu kiến thức: trong Docker, dùng alpine image để giảm size xuống dưới 100MB
```
```
Ghi nhớ: chính sách đổi trả của shop là 7 ngày, sản phẩm còn nguyên tem
```
```
Nhớ giùm: API endpoint tạo order là POST /api/v1/orders, cần header Authorization
```

### Lưu kiến thức có chủ đề rõ ràng

```
Thêm vào kiến thức Docker: cách tối ưu Dockerfile cho Node.js
- Dùng multi-stage build
- Copy package.json trước để tận dụng layer cache
- Dùng npm ci thay vì npm install
```

### Tra cứu kiến thức

```
Tôi có ghi gì về Docker không?
```
```
Tìm kiến thức về bảo hành
```
```
Nhắc lại cách undo commit trong git?
```
```
Chính sách đổi trả của shop là gì?
```

### Xem tổng quan

```
Tôi đã lưu những kiến thức gì?
```
```
Liệt kê các chủ đề trong knowledge base
```

### Ví dụ thực tế cho shop bán hàng

```
User: Khách hỏi bảo hành bao lâu?

Claude:
  → searchKnowledge("bảo hành")
  → Tìm thấy trong "Chính sách bán hàng"
  → Trả lời: Sản phẩm điện tử bảo hành 12 tháng,
    quần áo/giày dép bảo hành lỗi sản xuất 30 ngày,
    phụ kiện không bảo hành.
```

```
User: Quy trình đổi trả thế nào?

Claude:
  → searchKnowledge("đổi trả")
  → Match tag "đổi trả" → rank cao nhất
  → Trả lời đầy đủ 5 bước quy trình
```

---

## Hỏi tổng hợp

Claude có thể gọi nhiều tools cùng lúc để trả lời câu hỏi phức tạp:

```
Tóm tắt tình hình của tôi hôm nay
```
→ Claude gọi `getTodayTasks` + `getInbox` + `getGoals` → tổng hợp lại

```
Tôi đang focus vào cái gì?
```
→ Claude gọi `getTasks` + `getGoals` → phân tích context

```
So sánh rebase và merge trong git giúp tôi
```
→ Claude gọi `searchKnowledge("rebase")` → nếu có trong knowledge thì dùng, nếu không thì trả lời từ kiến thức AI

---

## Mẹo chat hiệu quả

### 1. Nói ngắn gọn, đi thẳng vấn đề

```
✅ Thêm task: deploy v2 lên staging
❌ Tôi muốn nhờ bạn thêm giúp tôi một task mới, task đó là deploy version 2 lên staging environment
```

### 2. Nói rõ target khi cần

```
✅ Thêm vào backlog: viết unit test cho auth module
✅ Thêm task hôm nay: fix bug login page
```

### 3. Dùng từ khóa tự nhiên

Claude hiểu nhiều cách diễn đạt:

| Bạn nói | Claude hiểu → Tool |
|---------|---------------------|
| "thêm task", "nhắc tôi", "cần làm" | `addTask` |
| "xong rồi", "done", "hoàn thành" | `markTaskDone` |
| "ghi lại", "note", "ý tưởng" | `addNote` |
| "nhớ giùm", "capture", "lưu nhanh" | `saveToInbox` |
| "lưu kiến thức", "ghi nhớ", "nhớ rằng" | `addKnowledge` |
| "tìm", "nhắc lại", "có ghi gì về" | `searchKnowledge` |
| "xem task", "hôm nay làm gì" | `getTodayTasks` |
| "xem kiến thức", "liệt kê topics" | `listTopics` |

### 4. Cho context khi lưu knowledge

```
✅ Lưu vào topic docker: cách dọn dẹp image cũ — dùng docker system prune -a
✅ Ghi nhớ chính sách shop: đổi trả trong 7 ngày, cần còn nguyên tem
```

```
❌ Nhớ cái này: 7 ngày
→ Không đủ context, AI không biết 7 ngày là gì
```

### 5. Tìm trước, hỏi sau

Khi cần thông tin, hãy hỏi tự nhiên. Claude sẽ tự biết tìm trong knowledge trước rồi mới trả lời:

```
Chính sách hoàn tiền của shop thế nào?
→ Claude tìm trong knowledge → trả lời chính xác theo data đã lưu

Cách setup Docker Compose?
→ Claude tìm trong knowledge → nếu có thì dùng, không thì trả lời từ AI
```

---

## Flow sử dụng hàng ngày

### Buổi sáng
```
Hôm nay tôi cần làm gì?
```

### Trong ngày
```
Thêm task: họp với team design lúc 2h
Done task review PR
Lưu nhanh: ý tưởng cải thiện checkout flow
```

### Cuối ngày
```
Tôi đã xong những gì hôm nay?
Chuyển task chưa xong sang backlog
```

### Khi học được gì mới
```
Ghi nhớ: trong PostgreSQL, dùng EXPLAIN ANALYZE để debug slow query
```

### Khi cần tra cứu
```
Nhắc lại cách deploy Docker lên AWS?
Chính sách bảo hành của shop?
```

---

## Lưu ý

- **Không cần nhớ tên tool** — cứ nói tự nhiên, Claude tự chọn tool phù hợp
- **Knowledge base là vĩnh viễn** — lưu 1 lần, dùng mãi mãi (trừ khi bạn xoá)
- **Mọi thay đổi đều có git history** — mỗi hành động là 1 commit trên GitHub, có thể revert
- **Không giới hạn ngôn ngữ** — viết tiếng Việt, tiếng Anh, mix đều được
