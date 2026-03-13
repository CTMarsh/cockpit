import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_SENTINEL_HOSTS = process.env.REDIS_SENTINEL_HOSTS; // e.g. "cockpit-redis-0:26379,cockpit-redis-1:26379,cockpit-redis-2:26379"
const REDIS_SENTINEL_MASTER = process.env.REDIS_SENTINEL_MASTER || "cockpit-master";

function parseSentinelHosts(hosts: string): Array<{ host: string; port: number }> {
  return hosts.split(",").map((h) => {
    const [host, port] = h.trim().split(":");
    return { host, port: parseInt(port) || 26379 };
  });
}

function createRedisClient(role: "main" | "sub"): Redis {
  if (REDIS_SENTINEL_HOSTS) {
    // Sentinel-aware connection — automatic failover
    return new Redis({
      sentinels: parseSentinelHosts(REDIS_SENTINEL_HOSTS),
      name: REDIS_SENTINEL_MASTER,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      sentinelRetryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
      },
    });
  }

  // Direct connection (development or single-instance)
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });
}

// Main client for commands
const redis = createRedisClient("main");

// Separate client for pub/sub (pub/sub enters subscriber mode, can't do other commands)
const redisSub = createRedisClient("sub");

async function connectRedis() {
  try {
    await redis.connect();
    await redisSub.connect();
    const mode = REDIS_SENTINEL_HOSTS ? "Sentinel" : "direct";
    console.log(`✅ Redis connected (${mode})`);
  } catch (err) {
    console.warn("⚠️ Redis not available, WebSocket collaboration will be local-only:", (err as Error).message);
  }
}

export { redis, redisSub, connectRedis };
export default redis;
