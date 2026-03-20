import type { GitHubClient } from "../github/client.js";
import { isNotFound, ConflictError } from "../errors.js";
import { getLogger } from "../logger.js";

// ─── Types ─────────────────────────────────────────────────

export interface TopicMeta {
  name: string;
  description: string;
  tags: string[];
  file: string;
}

export interface KnowledgeEntry {
  title: string;
  content: string;
}

export interface TopicData {
  meta: TopicMeta;
  entries: KnowledgeEntry[];
}

export interface SearchHit {
  topic: string;
  title: string;
  content: string;
  matchedBy: "tag" | "title" | "content";
}

// ─── Frontmatter Parser ───────────────────────────────────

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;
const ENTRY_HEADING_RE = /^##\s+(.+)$/;

function parseFrontmatter(content: string): {
  meta: { name: string; description: string; tags: string[] };
  body: string;
} {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return {
      meta: { name: "", description: "", tags: [] },
      body: content,
    };
  }

  const raw = match[1];
  const body = content.slice(match[0].length);

  let name = "";
  let description = "";
  let tags: string[] = [];

  for (const line of raw.split("\n")) {
    const [key, ...rest] = line.split(":");
    const val = rest.join(":").trim();
    switch (key.trim()) {
      case "name":
        name = val;
        break;
      case "description":
        description = val;
        break;
      case "tags":
        tags = val.split(",").map((t) => t.trim()).filter(Boolean);
        break;
    }
  }

  return { meta: { name, description, tags }, body };
}

function buildFrontmatter(name: string, description: string, tags: string[]): string {
  return `---\nname: ${name}\ndescription: ${description}\ntags: ${tags.join(", ")}\n---\n\n`;
}

// ─── Entry Parser ──────────────────────────────────────────

function parseEntries(body: string): KnowledgeEntry[] {
  const lines = body.split("\n");
  const entries: KnowledgeEntry[] = [];
  let title = "";
  let buf: string[] = [];

  for (const line of lines) {
    const m = line.match(ENTRY_HEADING_RE);
    if (m) {
      if (title) entries.push({ title, content: buf.join("\n").trim() });
      title = m[1].trim();
      buf = [];
    } else if (title) {
      buf.push(line);
    }
  }
  if (title) entries.push({ title, content: buf.join("\n").trim() });

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
   * List all topics with metadata (name, description, tags).
   * Reads all files but they're cached — Claude can pick the right topic without reading entries.
   */
  async listTopics(): Promise<TopicMeta[]> {
    const files = await this.client.listDirectory(this.knowledgePath);
    if (files.length === 0) return [];

    const results = await Promise.all(
      files.map(async (f) => {
        const slug = f.replace(/\.md$/, "");
        try {
          const file = await this.client.getFile(`${this.knowledgePath}/${f}`);
          const { meta } = parseFrontmatter(file.content);
          return {
            name: meta.name || slug,
            description: meta.description,
            tags: meta.tags,
            file: slug,
          };
        } catch {
          return { name: slug, description: "", tags: [], file: slug };
        }
      })
    );

    return results;
  }

  /**
   * Get full topic with meta + all entries. 1 API call (cached).
   */
  async getTopic(topic: string): Promise<TopicData> {
    const file = await this.client.getFile(this.topicPath(topic));
    const { meta, body } = parseFrontmatter(file.content);
    return {
      meta: { ...meta, name: meta.name || topic, file: topic },
      entries: parseEntries(body),
    };
  }

  /**
   * Add a new knowledge entry to a topic.
   * Creates the topic file with frontmatter if it doesn't exist.
   */
  async addKnowledge(
    topic: string,
    title: string,
    content: string,
    description?: string,
    tags?: string[]
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
        const fm = buildFrontmatter(
          displayName,
          description || "",
          tags || [topic]
        );
        const initial = `${fm}## ${title}\n\n${content}\n`;
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
   * Search across all topics. Tag matches rank first, then title, then content.
   * All files are read in parallel and cached.
   */
  async searchKnowledge(query: string, limit = 20): Promise<SearchHit[]> {
    const log = getLogger();
    const files = await this.client.listDirectory(this.knowledgePath);
    if (files.length === 0) return [];

    const lower = query.toLowerCase();
    const hits: SearchHit[] = [];

    // Load files sequentially with early termination for tag matches
    for (const f of files) {
      if (hits.length >= limit) break;

      let fileContent: string;
      try {
        const file = await this.client.getFile(`${this.knowledgePath}/${f}`);
        fileContent = file.content;
      } catch {
        continue;
      }

      const slug = f.replace(/\.md$/, "");
      const { meta, body } = parseFrontmatter(fileContent);
      const entries = parseEntries(body);
      const tagMatch = meta.tags.some((t) => t.toLowerCase().includes(lower));

      for (const entry of entries) {
        if (hits.length >= limit) break;
        if (tagMatch) {
          hits.push({ topic: slug, title: entry.title, content: entry.content, matchedBy: "tag" });
        } else if (entry.title.toLowerCase().includes(lower)) {
          hits.push({ topic: slug, title: entry.title, content: entry.content, matchedBy: "title" });
        } else if (entry.content.toLowerCase().includes(lower)) {
          hits.push({ topic: slug, title: entry.title, content: entry.content, matchedBy: "content" });
        }
      }
    }

    // Sort: tag > title > content
    const order = { tag: 0, title: 1, content: 2 };
    hits.sort((a, b) => order[a.matchedBy] - order[b.matchedBy]);

    log.info("searchKnowledge", { query, hits: hits.length, limit });
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
