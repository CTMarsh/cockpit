import { Hono } from "hono";

export const sysmonRoutes = new Hono();

// Read /proc files - works on Linux host or when /proc is mounted
const PROC_ROOT = process.env.PROC_ROOT || "/proc";

function readProcFile(path: string): string {
  try {
    return Bun.file(`${PROC_ROOT}/${path}`).text() as unknown as string;
  } catch {
    return "";
  }
}

async function readProcFileAsync(path: string): Promise<string> {
  try {
    return await Bun.file(`${PROC_ROOT}/${path}`).text();
  } catch {
    return "";
  }
}

// Parse CPU stats from /proc/stat
async function getCpuUsage(): Promise<{ percent: number; cores: number }> {
  const stat1 = await readProcFileAsync("stat");
  await new Promise((r) => setTimeout(r, 200));
  const stat2 = await readProcFileAsync("stat");

  function parseCpu(content: string) {
    const line = content.split("\n").find((l) => l.startsWith("cpu "));
    if (!line) return { idle: 0, total: 0 };
    const parts = line.split(/\s+/).slice(1).map(Number);
    const idle = parts[3] + (parts[4] || 0); // idle + iowait
    const total = parts.reduce((a, b) => a + b, 0);
    return { idle, total };
  }

  const c1 = parseCpu(stat1);
  const c2 = parseCpu(stat2);
  const idleDelta = c2.idle - c1.idle;
  const totalDelta = c2.total - c1.total;
  const percent = totalDelta > 0 ? Math.round(((totalDelta - idleDelta) / totalDelta) * 1000) / 10 : 0;

  // Count CPU cores
  const cores = stat2.split("\n").filter((l) => /^cpu\d+/.test(l)).length;

  return { percent, cores };
}

// Parse memory from /proc/meminfo
async function getMemory(): Promise<{ totalMB: number; usedMB: number; freeMB: number; percent: number; availableMB: number }> {
  const content = await readProcFileAsync("meminfo");
  const lines = content.split("\n");
  const get = (key: string) => {
    const line = lines.find((l) => l.startsWith(key));
    return line ? parseInt(line.split(/\s+/)[1]) : 0;
  };

  const totalKB = get("MemTotal:");
  const availableKB = get("MemAvailable:") || get("MemFree:");
  const usedKB = totalKB - availableKB;

  return {
    totalMB: Math.round(totalKB / 1024),
    usedMB: Math.round(usedKB / 1024),
    freeMB: Math.round(availableKB / 1024),
    availableMB: Math.round(availableKB / 1024),
    percent: totalKB > 0 ? Math.round((usedKB / totalKB) * 1000) / 10 : 0,
  };
}

// Parse disk usage via df command (more reliable than /proc)
async function getDisk(): Promise<{ mounts: { filesystem: string; mountpoint: string; totalGB: number; usedGB: number; freeGB: number; percent: number }[] }> {
  try {
    const proc = Bun.spawn(["df", "-B1", "--output=source,target,size,used,avail,pcent", "-x", "tmpfs", "-x", "devtmpfs", "-x", "overlay"], {
      stdout: "pipe",
    });
    const text = await new Response(proc.stdout).text();
    const lines = text.trim().split("\n").slice(1);
    const mounts = lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6) return null;
        const totalBytes = parseInt(parts[2]);
        const usedBytes = parseInt(parts[3]);
        const freeBytes = parseInt(parts[4]);
        return {
          filesystem: parts[0],
          mountpoint: parts[1],
          totalGB: Math.round((totalBytes / 1073741824) * 10) / 10,
          usedGB: Math.round((usedBytes / 1073741824) * 10) / 10,
          freeGB: Math.round((freeBytes / 1073741824) * 10) / 10,
          percent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
        };
      })
      .filter(Boolean);
    return { mounts: mounts as any };
  } catch {
    return { mounts: [] };
  }
}

// Parse network stats from /proc/net/dev
async function getNetwork(): Promise<{ interfaces: { name: string; rxBytes: number; txBytes: number; rxMB: number; txMB: number }[] }> {
  const content = await readProcFileAsync("net/dev");
  const lines = content.split("\n").slice(2); // skip headers
  const interfaces = lines
    .map((line) => {
      const parts = line.trim().split(/[\s:]+/);
      if (parts.length < 11) return null;
      const name = parts[0];
      if (name === "lo") return null; // skip loopback
      const rxBytes = parseInt(parts[1]);
      const txBytes = parseInt(parts[9]);
      return {
        name,
        rxBytes,
        txBytes,
        rxMB: Math.round((rxBytes / 1048576) * 10) / 10,
        txMB: Math.round((txBytes / 1048576) * 10) / 10,
      };
    })
    .filter(Boolean);
  return { interfaces: interfaces as any };
}

// Parse uptime
async function getUptime(): Promise<{ seconds: number; formatted: string }> {
  const content = await readProcFileAsync("uptime");
  const seconds = parseFloat(content.split(" ")[0]) || 0;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return { seconds, formatted: `${days}d ${hours}h ${mins}m` };
}

// Parse load average
async function getLoadAvg(): Promise<{ load1: number; load5: number; load15: number }> {
  const content = await readProcFileAsync("loadavg");
  const parts = content.split(" ");
  return {
    load1: parseFloat(parts[0]) || 0,
    load5: parseFloat(parts[1]) || 0,
    load15: parseFloat(parts[2]) || 0,
  };
}

// Get hostname
async function getHostname(): Promise<string> {
  try {
    const content = await readProcFileAsync("sys/kernel/hostname");
    return content.trim();
  } catch {
    return "unknown";
  }
}

// GET /api/sysmon/metrics — all system metrics in one call
sysmonRoutes.get("/metrics", async (c) => {
  const [cpu, memory, disk, network, uptime, loadAvg, hostname] = await Promise.all([
    getCpuUsage(),
    getMemory(),
    getDisk(),
    getNetwork(),
    getUptime(),
    getLoadAvg(),
    getHostname(),
  ]);

  return c.json({
    hostname,
    cpu,
    memory,
    disk,
    network,
    uptime,
    loadAvg,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/sysmon/processes — running process list
sysmonRoutes.get("/processes", async (c) => {
  try {
    const proc = Bun.spawn(["ps", "aux", "--sort=-pcpu"], { stdout: "pipe" });
    const text = await new Response(proc.stdout).text();
    const lines = text.trim().split("\n");
    const header = lines[0];
    const processes = lines.slice(1, 101).map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        user: parts[0],
        pid: parseInt(parts[1]),
        cpu: parseFloat(parts[2]),
        mem: parseFloat(parts[3]),
        vsz: parseInt(parts[4]),
        rss: parseInt(parts[5]),
        stat: parts[7],
        start: parts[8],
        time: parts[9],
        command: parts.slice(10).join(" "),
      };
    });
    return c.json({ processes });
  } catch {
    return c.json({ processes: [], error: "Failed to read process list" });
  }
});

// POST /api/sysmon/kill/:pid — kill a process by PID
sysmonRoutes.post("/kill/:pid", async (c) => {
  const pid = parseInt(c.req.param("pid"));
  if (isNaN(pid) || pid <= 1) {
    return c.json({ error: "Invalid PID. Cannot kill PID 0 or 1." }, 400);
  }

  // Don't allow killing critical system processes
  const protectedPids = [1, 2];
  if (protectedPids.includes(pid)) {
    return c.json({ error: "Cannot kill protected system process" }, 403);
  }

  try {
    const proc = Bun.spawn(["kill", "-15", String(pid)], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    if (proc.exitCode === 0) {
      return c.json({ ok: true, pid, signal: "SIGTERM" });
    }
    const stderr = await new Response(proc.stderr).text();
    return c.json({ error: stderr.trim() || "Failed to kill process" }, 400);
  } catch (e: any) {
    return c.json({ error: e.message || "Kill failed" }, 500);
  }
});

// GET /api/sysmon/health
sysmonRoutes.get("/health", (c) => c.json({ module: "sysmon", status: "ok" }));
