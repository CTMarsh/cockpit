import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Main client for commands
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) return null; // Stop retrying
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

// Separate client for pub/sub (pub/sub enters subscriber mode, can't do other commands)
const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

async function connectRedis() {
  try {
    await redis.connect();
    await redisSub.connect();
    console.log("✅ Redis connected");
  } catch (err) {
    console.warn("⚠️ Redis not available, WebSocket collaboration will be local-only:", (err as Error).message);
  }
}

export { redis, redisSub, connectRedis };
export default redis;
