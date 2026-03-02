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

// Parse disk usage from /proc/mounts + statvfs
async function getDisk(): Promise<{ mounts: { filesystem: string; mountpoint: string; totalGB: number; usedGB: number; freeGB: number; percent: number }[] }> {
  try {
    // Read /proc/mounts to find real filesystems
    const mountsContent = await readProcFileAsync("1/mounts");
    const lines = mountsContent.split("\n").filter(Boolean);
    const mounts: any[] = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      const device = parts[0];
      const mountpoint = parts[1];
      const fstype = parts[2];

      // Skip virtual filesystems
      if (["proc", "sysfs", "devpts", "tmpfs", "devtmpfs", "cgroup", "cgroup2", "overlay", "mqueue", "hugetlbfs", "securityfs", "debugfs", "fusectl", "configfs", "pstore", "bpf", "tracefs", "nsfs", "autofs"].includes(fstype)) continue;
      if (device === "none" || device.startsWith("shm")) continue;

      // Use Bun.spawn to run stat on the mountpoint to get disk stats
      try {
        const statProc = Bun.spawn(["stat", "-f", "-c", "%b %f %s", mountpoint], { stdout: "pipe" });
        const statText = await new Response(statProc.stdout).text();
        const [totalBlocks, freeBlocks, blockSize] = statText.trim().split(/\s+/).map(Number);
        if (!totalBlocks || !blockSize) continue;

        const totalBytes = totalBlocks * blockSize;
        const freeBytes = freeBlocks * blockSize;
        const usedBytes = totalBytes - freeBytes;

        // Skip tiny filesystems (<100MB)
        if (totalBytes < 104857600) continue;

        mounts.push({
          filesystem: device,
          mountpoint,
          totalGB: Math.round((totalBytes / 1073741824) * 10) / 10,
          usedGB: Math.round((usedBytes / 1073741824) * 10) / 10,
          freeGB: Math.round((freeBytes / 1073741824) * 10) / 10,
          percent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
        });
      } catch {
        continue;
      }
    }

    // Deduplicate by filesystem device
    const seen = new Set<string>();
    const unique = mounts.filter((m) => {
      if (seen.has(m.filesystem)) return false;
      seen.add(m.filesystem);
      return true;
    });

    return { mounts: unique };
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

// GET /api/sysmon/processes — running process list from /proc
sysmonRoutes.get("/processes", async (c) => {
  try {
    const { readdirSync } = await import("fs");
    const entries = readdirSync(PROC_ROOT);
    const memTotal = (await getMemoryTotal()) || 1;
    const hertz = 100; // standard clock ticks per second
    const uptimeContent = await readProcFileAsync("uptime");
    const uptimeSecs = parseFloat(uptimeContent.split(" ")[0]) || 1;

    const processes: any[] = [];

    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      const pid = parseInt(entry);
      try {
        const statContent = await readProcFileAsync(`${pid}/stat`);
        const statusContent = await readProcFileAsync(`${pid}/status`);
        const cmdline = await readProcFileAsync(`${pid}/cmdline`);

        // Parse /proc/[pid]/stat
        // Format: pid (comm) state ppid pgroup session tty_nr ...
        const match = statContent.match(/^\d+\s+\((.+?)\)\s+(\S+)\s+(.+)/);
        if (!match) continue;
        const comm = match[1];
        const state = match[2];
        const statFields = match[3].split(/\s+/);
        const utime = parseInt(statFields[10]) || 0; // field 14 in stat (0-indexed from ppid)
        const stime = parseInt(statFields[11]) || 0; // field 15
        const starttime = parseInt(statFields[18]) || 0; // field 22

        // CPU% approximation
        const totalTime = utime + stime;
        const processUptime = uptimeSecs - (starttime / hertz);
        const cpuPercent = processUptime > 0 ? Math.round(((totalTime / hertz) / processUptime) * 1000) / 10 : 0;

        // Parse /proc/[pid]/status for memory and user
        const getStatusField = (key: string) => {
          const line = statusContent.split("\n").find((l: string) => l.startsWith(key));
          return line ? line.split(/:\s+/)[1]?.trim() : "";
        };
        const rssKB = parseInt(getStatusField("VmRSS")) || 0;
        const memPercent = Math.round((rssKB / memTotal) * 1000) / 10;
        const uid = getStatusField("Uid")?.split(/\s+/)[0] || "0";

        // Command line
        const command = cmdline ? cmdline.replace(/\0/g, " ").trim() : comm;

        processes.push({
          user: uid,
          pid,
          cpu: cpuPercent,
          mem: memPercent,
          rss: rssKB,
          stat: state,
          command: command.slice(0, 200),
        });
      } catch {
        // Process may have exited
        continue;
      }
    }

    // Sort by CPU descending, take top 100
    processes.sort((a, b) => b.cpu - a.cpu);
    return c.json({ processes: processes.slice(0, 100) });
  } catch (e: any) {
    return c.json({ processes: [], error: e.message || "Failed to read process list" });
  }
});

async function getMemoryTotal(): Promise<number> {
  const content = await readProcFileAsync("meminfo");
  const line = content.split("\n").find((l: string) => l.startsWith("MemTotal:"));
  return line ? parseInt(line.split(/\s+/)[1]) : 1;
}

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
    process.kill(pid, "SIGTERM");
    return c.json({ ok: true, pid, signal: "SIGTERM" });
  } catch (e: any) {
    return c.json({ error: e.message || "Kill failed" }, 500);
  }
});

// GET /api/sysmon/health
sysmonRoutes.get("/health", (c) => c.json({ module: "sysmon", status: "ok" }));
