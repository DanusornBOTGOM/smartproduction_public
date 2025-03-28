// services/cacheService.js
class CacheService {
    constructor() {
        this.cache = new Map();
        this.timeouts = new Map();
    }

    async get(key) {
        return this.cache.get(key);
    }

    async set(key, value, ttl) {
        this.cache.set(key, value);
        
        // Clear old timeout if exists
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
        }
        
        // Set new timeout
        const timeout = setTimeout(() => {
            this.cache.delete(key);
            this.timeouts.delete(key);
        }, ttl * 1000);
        
        this.timeouts.set(key, timeout);
    }
}