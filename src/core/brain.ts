import type { BrainSync } from "../github/sync.js";
import type { GitHubClient } from "../github/client.js";
import type { Task } from "../types/task.js";
import type { Note, Goal, InboxItem, BrainSection } from "../types/brain.js";
import { isNotFound } from "../errors.js";
import { getLogger } from "../logger.js";
import {
  parseTasks,
  appendTask,
  toggleTaskDone,
  markTaskDoneByText,
  parseNotes,
  appendNote,
  parseGoals,
  parseInbox,
  appendInboxItem,
} from "./parser.js";

// ─── Built-in knowledge: Hướng dẫn sử dụng MCP ─────────────

const GUIDE_KNOWLEDGE = `---
name: Hướng dẫn sử dụng Knowledge Brain MCP
description: Cách sử dụng và làm việc hiệu quả với MCP server — quản lý task, kiến thức, phân tích năng suất
tags: mcp, hướng dẫn, brain, knowledge, task, setup, workflow
---

## Bắt đầu nhanh

Sau khi cài MCP và kết nối với AI (Claude, Cursor, Windsurf...), chỉ cần nói:

\`\`\`
"Khởi tạo brain cho tôi"
\`\`\`

AI sẽ tự động:
- Tạo GitHub repo (private) nếu chưa có
- Tạo toàn bộ cấu trúc brain trong 1 commit
- Sẵn sàng dùng ngay

## Cấu trúc Brain

- inbox/capture.md — Ghi nhanh, chưa phân loại
- tasks/today.md — Việc cần làm hôm nay
- tasks/backlog.md — Việc để dành, chưa gấp
- notes/ideas.md — Ý tưởng
- notes/learning.md — Kiến thức học được
- goals/short-term.md — Mục tiêu ngắn hạn
- goals/long-term.md — Mục tiêu dài hạn
- knowledge/*.md — Knowledge base theo topic

Mỗi hành động tạo 1 git commit — có thể xem lịch sử, rollback bất kỳ lúc nào.

## Quản lý công việc

Thêm task:
- "Thêm task: thiết kế landing page" → thêm vào today
- "Thêm vào backlog: refactor module auth" → thêm vào backlog

Task hỗ trợ metadata inline:
- ! / !! / !!! — priority: low / medium / high
- #tag — phân loại
- @due(YYYY-MM-DD) — deadline
- @est(Xh) hoặc @est(30m) — ước lượng thời gian

Ví dụ: "Thêm task: !!! Fix API bug #backend @due(2025-04-01) @est(2h)"

Xem task:
- "Hôm nay tôi cần làm gì?" → today tasks
- "Cho tôi xem backlog" → backlog

Hoàn thành:
- "Xong task review PR rồi" → fuzzy match và đánh dấu done

## Ghi chú, Inbox, Mục tiêu

Ghi chú:
- "Ghi lại ý tưởng: xây dựng AI chatbot" → ideas.md
- "Note vào learning: cách dùng Docker multi-stage" → learning.md

Inbox (ghi nhanh):
- "Nhớ giùm tôi: gọi khách lúc 3h chiều"
- "Lưu nhanh: link bài viết hay"

Mục tiêu:
- "Tóm tắt goals của tôi"
- "Cho tôi xem mục tiêu ngắn hạn"

## Knowledge Base — Trí nhớ dài hạn

Lưu kiến thức:
- "Lưu kiến thức Docker: dùng alpine image để giảm size"
- "Ghi nhớ: chính sách đổi trả 7 ngày, sản phẩm nguyên tem"

Tra cứu:
- "Chính sách bảo hành thế nào?" → tìm và trả lời từ dữ liệu đã lưu
- "Liệt kê các chủ đề kiến thức" → danh sách topics

AI tự động tìm trong knowledge base TRƯỚC khi trả lời. Nếu có dữ liệu → dùng. Nếu không → trả lời từ AI và đề nghị lưu.

Search ranking: Tag match > Title match > Content match.

## Phân tích năng suất

- "Hôm nay tôi nên focus gì?" → top 3 tasks gợi ý, overdue, goals
- "Thống kê năng suất" → completion rate, giờ peak, stale tasks
- "Phân tích workflow" → 5 detectors: productivity, procrastination, task-structure, goal-alignment, workload → healthScore 0-100

## Tự động tối ưu

- "Tối ưu tasks cho tôi" → preview (dry run)
- "OK, áp dụng đi" → commit thay đổi

5 hành động: autoReschedule (chuyển overdue → today), autoSplitTask (chia task >4h), autoPrioritize (đẩy top backlog lên), autoCleanup (xóa trùng/bỏ hoang), autoInjectTask (tạo task cho goals bị bỏ quên).

Luôn preview trước, xác nhận rồi mới áp dụng. 1 commit duy nhất.

## Mẹo dùng hiệu quả

- Nói ngắn gọn, đi thẳng vấn đề
- Cho context khi lưu knowledge (đừng chỉ nói "nhớ cái này: 7 ngày")
- Dùng tags và priority cho tasks
- Flow hàng ngày: sáng xem focus → trong ngày thêm/done tasks → cuối ngày review → cuối tuần phân tích

## Lưu ý quan trọng

- Không cần nhớ tên tool — nói tự nhiên, AI tự chọn
- Knowledge base vĩnh viễn — lưu 1 lần, dùng mãi
- Mọi thay đổi có git history — revert bất kỳ lúc nào
- Không giới hạn ngôn ngữ — tiếng Việt, Anh, mix đều được
`;

// Default templates for brain files
const BRAIN_TEMPLATES: Array<{ section: string; content: string }> = [
  {
    section: "inbox/capture.md",
    content: "# Inbox\n\nCapture quick thoughts here.\n",
  },
  {
    section: "tasks/today.md",
    content: "# Today\n\n- [ ] Get started with your AI brain\n",
  },
  {
    section: "tasks/backlog.md",
    content: "# Backlog\n\n",
  },
  {
    section: "notes/ideas.md",
    content: "# Ideas\n\n",
  },
  {
    section: "notes/learning.md",
    content: "# Learning\n\n",
  },
  {
    section: "goals/short-term.md",
    content: "# Short-Term Goals\n\n",
  },
  {
    section: "goals/long-term.md",
    content: "# Long-Term Goals\n\n",
  },
  {
    section: "tasks/archive/.gitkeep",
    content: "",
  },
  {
    section: "knowledge/general.md",
    content:
      "---\nname: General\ndescription: General knowledge and notes\ntags: general\n---\n\n## Welcome\n\nThis is your knowledge base. Add entries with the addKnowledge tool.\n",
  },
  {
    section: "knowledge/huong-dan-mcp.md",
    content: GUIDE_KNOWLEDGE,
  },
];

export class Brain {
  constructor(
    private sync: BrainSync,
    private client?: GitHubClient
  ) {}

  // ─── Init ───────────────────────────────────────────────

  async initBrain(): Promise<{ created: string[]; repoCreated: boolean }> {
    const log = getLogger();

    // Step 1: Create GitHub repo if it doesn't exist, bootstrap if empty
    let repoCreated = false;
    if (this.client) {
      repoCreated = await this.client.ensureRepoExists();
      if (repoCreated) {
        log.info("initBrain: created new GitHub repo");
      }
      // Handle edge case: repo exists but has 0 commits (user created empty repo)
      await this.client.bootstrapIfEmpty();
    }

    // Step 2: Check if brain already exists
    if (!repoCreated) {
      try {
        await this.sync.readSection("inbox");
        throw new Error(
          "Brain already initialized — inbox/capture.md exists. Use the other tools to manage your brain."
        );
      } catch (err) {
        if (!isNotFound(err)) throw err;
        // Not found = good, proceed with init
      }
    }

    // Step 3: Create all brain files in one commit
    await this.sync.createFiles(
      BRAIN_TEMPLATES,
      "feat(ai): initialize brain structure"
    );

    const created = BRAIN_TEMPLATES.map((t) => t.section);
    log.info("initBrain", { created, repoCreated });
    return { created, repoCreated };
  }

  // ─── Read Operations ────────────────────────────────────

  async getTasks(section: "today" | "backlog"): Promise<Task[]> {
    const log = getLogger();
    const brainSection: BrainSection = `tasks/${section}`;
    try {
      const file = await this.sync.readSection(brainSection);
      const tasks = parseTasks(file.content, brainSection);
      log.info("getTasks", { section, count: tasks.length });
      return tasks;
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  async getAllTasks(): Promise<{ today: Task[]; backlog: Task[] }> {
    const [today, backlog] = await Promise.all([
      this.getTasks("today"),
      this.getTasks("backlog"),
    ]);
    return { today, backlog };
  }

  async getNotes(section: "ideas" | "learning"): Promise<Note[]> {
    const brainSection: BrainSection = `notes/${section}`;
    try {
      const file = await this.sync.readSection(brainSection);
      return parseNotes(file.content, brainSection);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  async getGoals(section: "short-term" | "long-term"): Promise<Goal[]> {
    const brainSection: BrainSection = `goals/${section}`;
    try {
      const file = await this.sync.readSection(brainSection);
      return parseGoals(file.content, brainSection);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  async getInbox(): Promise<InboxItem[]> {
    try {
      const file = await this.sync.readSection("inbox");
      return parseInbox(file.content);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  // ─── Write Operations ───────────────────────────────────

  async addTask(text: string, target: "today" | "backlog"): Promise<Task> {
    const log = getLogger();
    const section: BrainSection = `tasks/${target}`;

    try {
      const result = await this.sync.atomicUpdate(
        section,
        (current) => appendTask(current, text),
        `feat(ai): add task to ${target}`
      );
      const tasks = parseTasks(result.content, section);
      log.info("addTask", { target, text });
      return tasks[tasks.length - 1];
    } catch (err) {
      if (isNotFound(err)) {
        const title = target === "today" ? "Today" : "Backlog";
        const content = `# ${title}\n\n- [ ] ${text}\n`;
        await this.sync.createSection(
          section,
          content,
          `feat(ai): create ${target} with new task`
        );
        log.info("addTask: created file", { target, text });
        const tasks = parseTasks(content, section);
        return tasks[tasks.length - 1];
      }
      throw err;
    }
  }

  async markTaskDone(
    section: "today" | "backlog",
    taskId: string
  ): Promise<void> {
    const log = getLogger();
    const brainSection: BrainSection = `tasks/${section}`;

    await this.sync.atomicUpdate(
      brainSection,
      (current) => toggleTaskDone(current, taskId, brainSection),
      `feat(ai): mark task done`
    );
    log.info("markTaskDone", { section, taskId });
  }

  async markTaskDoneByText(
    section: "today" | "backlog",
    searchText: string
  ): Promise<void> {
    const log = getLogger();
    const brainSection: BrainSection = `tasks/${section}`;

    await this.sync.atomicUpdate(
      brainSection,
      (current) => markTaskDoneByText(current, searchText),
      `feat(ai): mark task done`
    );
    log.info("markTaskDoneByText", { section, searchText });
  }

  async addNote(text: string, section: "ideas" | "learning"): Promise<void> {
    const log = getLogger();
    const brainSection: BrainSection = `notes/${section}`;

    try {
      await this.sync.atomicUpdate(
        brainSection,
        (current) => appendNote(current, text),
        `feat(ai): add note to ${section}`
      );
      log.info("addNote", { section, text });
    } catch (err) {
      if (isNotFound(err)) {
        const title = section === "ideas" ? "Ideas" : "Learning";
        const content = appendNote(`# ${title}\n\n`, text);
        await this.sync.createSection(
          brainSection,
          content,
          `feat(ai): create ${section} with new note`
        );
        log.info("addNote: created file", { section });
        return;
      }
      throw err;
    }
  }

  async saveToInbox(text: string): Promise<void> {
    const log = getLogger();

    try {
      await this.sync.atomicUpdate(
        "inbox",
        (current) => appendInboxItem(current, text),
        `feat(ai): save to inbox`
      );
      log.info("saveToInbox", { text });
    } catch (err) {
      if (isNotFound(err)) {
        const content = appendInboxItem(`# Inbox\n\n`, text);
        await this.sync.createSection(
          "inbox",
          content,
          `feat(ai): create inbox with new item`
        );
        log.info("saveToInbox: created file");
        return;
      }
      throw err;
    }
  }
}
