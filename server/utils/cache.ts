interface CacheEntry {
  data: any;
  expires: number;
}

export class GitSeeCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;

  constructor(ttl: number = 300) { // 5 minutes default
    this.ttl = ttl * 1000; // convert to ms
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl
    });
  }

  clear(): void {
    this.cache.clear();
  }
}