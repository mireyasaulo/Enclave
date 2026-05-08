// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type { CloudComputeProviderSummary } from "@yinjie/contracts";
import { ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";
import { Repository } from "typeorm";
import { CloudInstanceEntity } from "../entities/cloud-instance.entity";
import { CloudWorldEntity } from "../entities/cloud-world.entity";
import type {
  InspectWorldInstanceResult,
  ProvisionWorldInstanceResult,
  WorldComputeProvider,
  WorldInstancePowerTransitionResult,
} from "../providers/compute-provider.types";
import {
  buildWorldBootstrapConfig,
  resolveCloudPlatformBaseUrl,
} from "./world-bootstrap-config";

type RunningChild = {
  pid: number;
  port: number;
  // cloud-api 重启后我们能 reattach 到孤儿 child 进程，但拿不到原始 ChildProcess
  // 句柄。child=null 时用 process.kill / probe-by-pid 操作。
  child: ChildProcess | null;
  startedAt: Date;
};

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const REPO_ROOT =
  process.env.YINJIE_REPO_ROOT?.trim() || findRepoRoot(__dirname);
const API_DIST_ENTRY = path.join(REPO_ROOT, "api", "dist", "main.js");
const ACCOUNTS_ROOT = path.join(REPO_ROOT, "data", "accounts");
const LOG_DIR = path.join(REPO_ROOT, "logs", "dev-services");
const HEALTH_DEADLINE_MS = 60_000;
const HEALTH_POLL_INTERVAL_MS = 500;
const STOP_GRACE_MS = 5_000;

@Injectable()
export class LocalProcessComputeProviderService
  implements WorldComputeProvider, OnModuleInit, OnModuleDestroy
{
  readonly key = "local-process";
  readonly summary: CloudComputeProviderSummary = {
    key: this.key,
    label: "Local Process Provider",
    description:
      "Spawns a per-account main-api child process with isolated database and media directories.",
    provisionStrategy: "local-process",
    deploymentMode: "local-process",
    defaultRegion: "local",
    defaultZone: "local-a",
    capabilities: {
      managedProvisioning: true,
      managedLifecycle: true,
      bootstrapPackage: false,
      snapshots: false,
    },
  };

  private readonly logger = new Logger(LocalProcessComputeProviderService.name);
  private readonly running = new Map<string, RunningChild>();
  private readonly basePort: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(CloudInstanceEntity)
    private readonly instanceRepo: Repository<CloudInstanceEntity>,
  ) {
    const configured = parseInt(
      process.env.CLOUD_LOCAL_PROCESS_BASE_PORT?.trim() ?? "",
      10,
    );
    this.basePort = Number.isFinite(configured) && configured > 0 ? configured : 3010;
  }

  async onModuleInit() {
    if (!existsSync(API_DIST_ENTRY)) {
      this.logger.warn(
        `api dist not found at ${API_DIST_ENTRY}; spawn will fail until the api package is built.`,
      );
    }

    // cloud-api 重启时，已 spawn 的 child 进程是孤儿但仍占着 port + 持着 sqlite。
    // 之前会无差别 mark stopped → lifecycle worker 看到 stopped 就尝试再 spawn，
    // 撞上 EADDRINUSE 卡死。这里改成：能 ping 通就 reattach (in-memory 重新登记)，
    // 真死了才 mark stopped 让 worker 走重启流程。
    const localProcessInstances = await this.instanceRepo.find({
      where: { providerKey: this.key },
    });
    this.logger.log(
      `onModuleInit scanning ${localProcessInstances.length} local-process instance(s) for reattach`,
    );
    for (const instance of localProcessInstances) {
      const port = this.parsePersistedPort(instance);
      const pidRaw = instance.launchConfig?.pid;
      const pid =
        typeof pidRaw === "string" && pidRaw.trim()
          ? Number(pidRaw)
          : Number(pidRaw ?? 0);

      // 不论 powerState 是什么，先 probe pid+port；活着就 reattach。
      // 之前会 spawn 失败一次然后把 launchConfig.pid 改成新 pid，再重启时
      // 那个新 pid 已死，但 port 仍被原孤儿占着 → reattach 永远失败。这里
      // 改成只信端口存活：能 ping 通就直接当 running，pid 只用来后续 kill。
      const portHealthy =
        port && Number.isFinite(port) && port > 0
          ? await this.pingHealth(port, 1_500)
          : false;

      this.logger.log(
        `instance world=${instance.worldId} powerState=${instance.powerState} port=${port} pid=${pid} pidAlive=${pid > 0 ? this.isPidAlive(pid) : "n/a"} portHealthy=${portHealthy}`,
      );

      if (portHealthy && port) {
        this.running.set(instance.worldId, {
          pid,
          port,
          child: null,
          startedAt: instance.bootstrappedAt ?? new Date(),
        });
        this.logger.log(
          `reattached to live local api child world=${instance.worldId} pid=${pid} port=${port}`,
        );
        if (instance.powerState !== "running") {
          instance.powerState = "running";
          instance.lastOperationAt = new Date();
          await this.instanceRepo.save(instance);
        }
      } else {
        instance.powerState = "stopped";
        instance.lastOperationAt = new Date();
        await this.instanceRepo.save(instance);
      }
    }
  }

  private isPidAlive(pid: number) {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    const entries = Array.from(this.running.entries());
    this.running.clear();
    for (const [worldId, state] of entries) {
      this.logger.log(
        `terminating local api child for world=${worldId} pid=${state.pid}`,
      );
      this.terminateChild(state);
    }
  }

  async createInstance(
    world: CloudWorldEntity,
  ): Promise<ProvisionWorldInstanceResult> {
    const port = this.allocatePort();
    const accountDir = this.resolveAccountDir(world.phone);
    mkdirSync(accountDir, { recursive: true });

    const child = await this.spawnChild(world, port, accountDir);
    this.running.set(world.id, {
      pid: child.pid ?? 0,
      port,
      child,
      startedAt: new Date(),
    });

    return {
      providerKey: this.key,
      providerInstanceId: `local-process-${randomUUID()}`,
      providerVolumeId: accountDir,
      providerSnapshotId: null,
      region: world.providerRegion ?? this.summary.defaultRegion ?? "local",
      zone: world.providerZone ?? this.summary.defaultZone ?? "local-a",
      privateIp: "127.0.0.1",
      publicIp: null,
      apiBaseUrl: `http://127.0.0.1:${port}`,
      adminUrl: null,
      imageId: null,
      flavor: "local-process",
      diskSizeGb: 0,
      launchConfig: {
        port: String(port),
        pid: String(child.pid ?? ""),
        accountDir,
      },
    };
  }

  async startInstance(
    instance: CloudInstanceEntity,
    world: CloudWorldEntity,
  ): Promise<WorldInstancePowerTransitionResult> {
    const existing = this.running.get(world.id);
    if (existing && this.isAlive(existing)) {
      return { powerState: "running", providerSnapshotId: null };
    }

    const port = this.parsePersistedPort(instance) ?? this.allocatePort();
    const accountDir = this.resolveAccountDir(world.phone);
    mkdirSync(accountDir, { recursive: true });

    const child = await this.spawnChild(world, port, accountDir);
    this.running.set(world.id, {
      pid: child.pid ?? 0,
      port,
      child,
      startedAt: new Date(),
    });

    instance.launchConfig = {
      ...(instance.launchConfig ?? {}),
      port: String(port),
      pid: String(child.pid ?? ""),
      accountDir,
    };

    return { powerState: "running", providerSnapshotId: null };
  }

  async stopInstance(
    _instance: CloudInstanceEntity,
    world: CloudWorldEntity,
  ): Promise<WorldInstancePowerTransitionResult> {
    const state = this.running.get(world.id);
    if (state) {
      this.running.delete(world.id);
      this.terminateChild(state);
    }
    return { powerState: "stopped", providerSnapshotId: null };
  }

  async inspectInstance(
    instance: CloudInstanceEntity | null,
    world: CloudWorldEntity,
  ): Promise<InspectWorldInstanceResult> {
    const state = this.running.get(world.id);
    let deploymentState: InspectWorldInstanceResult["deploymentState"];
    let rawStatus: string;

    if (state && this.isAlive(state)) {
      const healthy = await this.pingHealth(state.port, 1_500);
      deploymentState = healthy ? "running" : "starting";
      rawStatus = healthy ? "running" : "starting";
    } else if (instance && instance.powerState === "stopped") {
      deploymentState = "stopped";
      rawStatus = "stopped";
    } else if (instance) {
      deploymentState = "missing";
      rawStatus = "absent";
    } else {
      deploymentState = "missing";
      rawStatus = "absent";
    }

    return {
      providerKey: this.key,
      deploymentMode: this.summary.deploymentMode,
      executorMode: "child-process",
      remoteHost: "localhost",
      remoteDeployPath: this.resolveAccountDir(world.phone),
      projectName: world.slug ?? world.id,
      containerName: state ? `local-api-${world.phone}-${state.port}` : null,
      deploymentState,
      providerMessage: state
        ? `Local api child running on port ${state.port}.`
        : "No local api child is currently registered for this world.",
      rawStatus,
    };
  }

  private resolveAccountDir(phone: string) {
    const sanitized = phone.replace(/[^a-zA-Z0-9_-]+/g, "");
    if (!sanitized) {
      throw new Error(`Cannot derive account dir from phone "${phone}"`);
    }
    return path.join(ACCOUNTS_ROOT, sanitized);
  }

  private allocatePort() {
    const used = new Set<number>();
    for (const state of this.running.values()) {
      used.add(state.port);
    }
    let port = this.basePort;
    while (used.has(port)) {
      port += 1;
    }
    return port;
  }

  private parsePersistedPort(instance: CloudInstanceEntity | null) {
    const raw = instance?.launchConfig?.port;
    if (typeof raw !== "string") return null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private isAlive(state: RunningChild) {
    if (state.child) {
      if (!state.child.pid) return false;
      if (state.child.exitCode !== null) return false;
      return this.isPidAlive(state.child.pid);
    }
    if (!state.pid) return false;
    return this.isPidAlive(state.pid);
  }

  private async spawnChild(
    world: CloudWorldEntity,
    port: number,
    accountDir: string,
  ) {
    const bootstrap = buildWorldBootstrapConfig(world, this.configService);
    mkdirSync(LOG_DIR, { recursive: true });
    const outFd = openSync(
      path.join(LOG_DIR, `api-${world.phone}.out.log`),
      "a",
    );
    const errFd = openSync(
      path.join(LOG_DIR, `api-${world.phone}.err.log`),
      "a",
    );

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...bootstrap.env,
      PORT: String(port),
      YINJIE_DATA_ROOT: accountDir,
      DATABASE_PATH: path.join(accountDir, "database.sqlite"),
      CLOUD_PLATFORM_BASE_URL: resolveCloudPlatformBaseUrl(this.configService),
      PUBLIC_API_BASE_URL: `http://127.0.0.1:${port}`,
    };

    this.logger.log(
      `spawning api child for phone=${world.phone} world=${world.id} port=${port} dir=${accountDir}`,
    );

    const child = spawn(process.execPath, ["--enable-source-maps", API_DIST_ENTRY], {
      cwd: path.join(REPO_ROOT, "api"),
      env,
      stdio: ["ignore", outFd, errFd],
      detached: false,
      windowsHide: true,
    });

    child.on("exit", (code, signal) => {
      const previous = this.running.get(world.id);
      if (previous && previous.child === child) {
        this.running.delete(world.id);
      }
      this.logger.warn(
        `api child for world=${world.id} exited code=${code} signal=${signal}`,
      );
      void this.markInstanceStopped(world.id);
    });

    child.on("error", (err) => {
      this.logger.error(
        `failed to spawn api child for world=${world.id}: ${err.message}`,
      );
    });

    await this.waitForHealthy(port, child);
    return child;
  }

  private async waitForHealthy(port: number, child: ChildProcess) {
    const deadline = Date.now() + HEALTH_DEADLINE_MS;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(
          `api child exited before health check passed (code=${child.exitCode})`,
        );
      }
      if (await this.pingHealth(port, 1_000)) {
        return;
      }
      await this.sleep(HEALTH_POLL_INTERVAL_MS);
    }
    throw new Error(`api child on port ${port} did not become healthy in time`);
  }

  private async pingHealth(port: number, timeoutMs: number) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/world/owner`, {
        method: "GET",
        signal: ctrl.signal,
      });
      return res.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private terminateChild(state: RunningChild) {
    if (!state.pid) {
      return;
    }
    if (state.child && state.child.exitCode !== null) {
      return;
    }
    if (!state.child && !this.isPidAlive(state.pid)) {
      return;
    }
    const sendSignal = (signal: NodeJS.Signals) => {
      if (state.child) {
        try {
          state.child.kill(signal);
        } catch (err) {
          this.logger.warn(
            `${signal} via child handle failed for pid=${state.pid}: ${(err as Error).message}`,
          );
        }
      } else {
        try {
          process.kill(state.pid, signal);
        } catch (err) {
          this.logger.warn(
            `${signal} via process.kill failed for pid=${state.pid}: ${(err as Error).message}`,
          );
        }
      }
    };
    sendSignal("SIGTERM");
    setTimeout(() => {
      const stillAlive = state.child
        ? state.child.exitCode === null
        : this.isPidAlive(state.pid);
      if (stillAlive) {
        sendSignal("SIGKILL");
      }
    }, STOP_GRACE_MS).unref?.();
  }

  private async markInstanceStopped(worldId: string) {
    try {
      const instance = await this.instanceRepo.findOne({ where: { worldId } });
      if (!instance) return;
      if (instance.powerState !== "stopped") {
        instance.powerState = "stopped";
        instance.lastOperationAt = new Date();
        await this.instanceRepo.save(instance);
      }
    } catch (err) {
      this.logger.warn(
        `failed to mark instance stopped for world=${worldId}: ${(err as Error).message}`,
      );
    }
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
// i18n-ignore-end
