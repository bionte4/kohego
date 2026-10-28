import { createPublisherSeed, type PublisherBook } from "@/lib/publisher";

export const PUBLISHER_KEY = "kohego.publisher.v1";

export function loadPublisher(): PublisherBook {
  try {
    const raw = localStorage.getItem(PUBLISHER_KEY);
    if (!raw) return createPublisherSeed();
    const parsed = JSON.parse(raw) as Partial<PublisherBook>;
    if (parsed.version !== 1 || !Array.isArray(parsed.posts)) return createPublisherSeed();
    return {
      version: 1,
      posts: parsed.posts.map((post) => ({
        ...post,
        media: Array.isArray(post.media) ? post.media : [],
      })),
    };
  } catch {
    return createPublisherSeed();
  }
}

export function savePublisher(book: PublisherBook) {
  try {
    localStorage.setItem(PUBLISHER_KEY, JSON.stringify(book));
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

export function replacePublisher(next: PublisherBook) {
  memory = next;
  const saved = savePublisher(next);
  listeners.forEach((listener) => listener());
  return saved;
}
