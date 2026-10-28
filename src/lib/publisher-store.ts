import { noteLedgerWrite } from "@/lib/ledger-bus";
import { createPublisherSeed, type PublisherBook } from "@/lib/publisher";

export const PUBLISHER_KEY = "kohego.publisher.v1";

export function parsePublisherBook(input: unknown): PublisherBook | null {
  if (!input || typeof input !== "object") return null;
  const parsed = input as Partial<PublisherBook>;
  if (parsed.version !== 1 || !Array.isArray(parsed.posts)) return null;
  return {
    version: 1,
    posts: parsed.posts.map((post) => ({
      ...post,
      media: Array.isArray(post.media) ? post.media : [],
    })),
  };
}

export function loadPublisher(): PublisherBook {
  try {
    const raw = localStorage.getItem(PUBLISHER_KEY);
    if (!raw) return createPublisherSeed();
    return parsePublisherBook(JSON.parse(raw) as unknown) ?? createPublisherSeed();
  } catch {
    return createPublisherSeed();
  }
}

let quietWrites = false;

export function savePublisher(book: PublisherBook) {
  try {
    localStorage.setItem(PUBLISHER_KEY, JSON.stringify(book));
    if (!quietWrites) noteLedgerWrite("publisher");
    return true;
  } catch {
    return false;
  }
}

let memory: PublisherBook | null = null;
let wroteInitial = false;
const listeners = new Set<() => void>();

export function subscribePublisher(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPublisherClient() {
  if (!memory || memory.version !== 1) {
    memory = loadPublisher();
    wroteInitial = false;
  }
  if (memory.posts.some((post) => !Array.isArray(post.media))) {
    memory = {
      version: 1,
      posts: memory.posts.map((post) => ({
        ...post,
        media: Array.isArray(post.media) ? post.media : [],
      })),
    };
    wroteInitial = false;
  }
  if (!wroteInitial) {
    wroteInitial = true;
    savePublisher(memory);
  }
  return memory;
}

export function getPublisherServer(): PublisherBook | null {
  return null;
}

export function replacePublisher(next: PublisherBook, options?: { quiet?: boolean }) {
  const previous = quietWrites;
  quietWrites = options?.quiet ?? false;
  memory = next;
  const saved = savePublisher(next);
  quietWrites = previous;
  listeners.forEach((listener) => listener());
  return saved;
}
