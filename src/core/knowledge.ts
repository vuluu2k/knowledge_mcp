import type { GitHubClient } from "../github/client.js";
import { isNotFound, ConflictError } from "../errors.js";
import { getLogger } from "../logger.js";

export interface KnowledgeEntry {
  title: string;
  content: string;
}

export interface SearchHit {
  topic: string;
  title: string;
  content: string;
}

const ENTRY_HEADING_RE = /^##\s+(.+)$/;

// ─── Parse a topic file into entries ───────────────────────

function parseEntries(content: string): KnowledgeEntry[] {
  const lines = content.split("\n");
  const entries: KnowledgeEntry[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const m = line.match(ENTRY_HEADING_RE);
    if (m) {
      if (currentTitle) {
        entries.push({ title: currentTitle, content: currentLines.join("\n").trim() });
      }
      currentTitle = m[1].trim();
      currentLines = [];
    } else if (currentTitle) {
      currentLines.push(line);
    }
  }

  if (currentTitle) {
    entries.push({ title: currentTitle, content: currentLines.join("\n").trim() });
  }

  return entries;
}

function appendEntry(fileContent: string, title: string, content: string): string {
  const block = `\n## ${title}\n\n${content}\n`;
  const base = fileContent.endsWith("\n") ? fileContent : fileContent + "\n";
  return base + block;
}

// ─── KnowledgeBase ─────────────────────────────────────────

export class KnowledgeBase {
  private knowledgePath: string;

  constructor(
    private client: GitHubClient,
    basePath: string,
    private maxRetries: number
  ) {
    this.knowledgePath = `${basePath}/knowledge`;
  }

  private topicPath(topic: string): string {
    const safe = topic.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    return `${this.knowledgePath}/${safe}.md`;
  }

  /**
   * List all topic names. 1 API call, no file content read.
   */
  async listTopics(): Promise<string[]> {
    const files = await this.client.listDirectory(this.knowledgePath);
    return files.map((f) => f.replace(/\.md$/, ""));
  }

  /**
   * Get all entries in a topic. 1 API call.
   */
  async getTopic(topic: string): Promise<{ topic: string; entries: KnowledgeEntry[] }> {
    const file = await this.client.getFile(this.topicPath(topic));
    return { topic, entries: parseEntries(file.content) };
  }

  /**
   * Add a new entry to a topic. Creates the topic file if it doesn't exist.
   */
  async addKnowledge(
    topic: string,
    title: string,
    content: string
  ): Promise<{ success: true }> {
    const log = getLogger();
    const path = this.topicPath(topic);

    try {
      await this.atomicUpdate(
        path,
        (current) => appendEntry(current, title, content),
        `feat(ai): add knowledge to ${topic}`
      );
    } catch (err) {
      if (isNotFound(err)) {
        const displayName = topic.charAt(0).toUpperCase() + topic.slice(1);
        const initial = `# ${displayName}\n\n## ${title}\n\n${content}\n`;
        await this.client.createFile(
          path,
          initial,
          `feat(ai): create knowledge topic ${topic}`
        );
      } else throw err;
    }

    log.info("addKnowledge", { topic, title });
    return { success: true };
  }

  /**
   * Search across ALL topics by keyword. Returns matching entries.
   * Reads from cache when available — first call loads, subsequent calls are free.
   */
  async searchKnowledge(query: string): Promise<SearchHit[]> {
    const log = getLogger();
    const topics = await this.listTopics();
    if (topics.length === 0) return [];

    const lower = query.toLowerCase();
    const hits: SearchHit[] = [];

    // Read all topic files in parallel (cached after first read)
    const files = await Promise.all(
      topics.map(async (topic) => {
        try {
          const file = await this.client.getFile(this.topicPath(topic));
          return { topic, content: file.content };
        } catch {
          return null;
        }
      })
    );

    for (const f of files) {
      if (!f) continue;
      const entries = parseEntries(f.content);
      for (const entry of entries) {
        if (
          entry.title.toLowerCase().includes(lower) ||
          entry.content.toLowerCase().includes(lower)
        ) {
          hits.push({ topic: f.topic, title: entry.title, content: entry.content });
        }
      }
    }

    log.info("searchKnowledge", { query, hits: hits.length, topicsScanned: topics.length });
    return hits;
  }

  // ─── Atomic update with retry ───────────────────────────

  private async atomicUpdate(
    path: string,
    updateFn: (content: string) => string,
    message: string
  ): Promise<void> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const file = await this.client.getFile(path, true);
      const newContent = updateFn(file.content);
      if (newContent === file.content) return;

      try {
        await this.client.updateFile(path, newContent, file.sha, message);
        return;
      } catch (err) {
        if (err instanceof ConflictError && attempt < this.maxRetries) continue;
        throw err;
      }
    }
    throw new ConflictError(path);
  }
}
