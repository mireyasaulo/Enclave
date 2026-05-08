import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CloudComputeProviderSummary } from "@yinjie/contracts";
import { randomUUID } from "node:crypto";
import { CloudInstanceEntity } from "../entities/cloud-instance.entity";
import { CloudWorldEntity } from "../entities/cloud-world.entity";
import type {
// i18n-ignore-start: data / seed / preset content — not user-facing UI.
  InspectWorldInstanceResult,
  ProvisionWorldInstanceResult,
  WorldComputeProvider,
  WorldInstancePowerTransitionResult,
} from "../providers/compute-provider.types";
import {
  buildWorldBootstrapConfig,
  resolveSuggestedWorldAdminUrl,
  resolveSuggestedWorldApiBaseUrl,
} from "./world-bootstrap-config";

@Injectable()
export class MockComputeProviderService implements WorldComputeProvider {
  readonly key = "mock";
  readonly summary: CloudComputeProviderSummary = {
    key: this.key,
    label: "Mock Local Provider",
    description: "Local in-process provider that simulates lifecycle transitions for development and orchestration testing.",
    provisionStrategy: "mock",
    deploymentMode: "mock",
    defaultRegion: "mock-local",
    defaultZone: "mock-a",
    capabilities: {
      managedProvisioning: true,
      managedLifecycle: true,
      bootstrapPackage: true,
      snapshots: true,
    },
  };

  constructor(private readonly configService: ConfigService) {}

  createInstance(world: CloudWorldEntity): ProvisionWorldInstanceResult {
    const bootstrapConfig = buildWorldBootstrapConfig(world, this.configService);

    return {
      providerKey: this.key,
      providerInstanceId: `mock-instance-${randomUUID()}`,
      providerVolumeId: `mock-volume-${world.slug ?? world.id}`,
      providerSnapshotId: null,
      region: world.providerRegion ?? "mock-local",
      zone: world.providerZone ?? "mock-a",
      privateIp: "127.0.0.1",
      publicIp: null,
      apiBaseUrl: this.resolveApiBaseUrl(world),
      adminUrl: this.resolveAdminUrl(world),
      imageId: "mock-image-v1",
      flavor: "mock.small",
      diskSizeGb: 20,
      launchConfig: bootstrapConfig.env,
    };
  }

  startInstance(
    instance: CloudInstanceEntity,
    world: CloudWorldEntity,
  ): WorldInstancePowerTransitionResult {
    return {
      powerState: "running",
      providerSnapshotId:
        instance.providerSnapshotId ?? `mock-snapshot-${world.slug ?? world.id}`,
    };
  }

  stopInstance(
    instance: CloudInstanceEntity,
    world: CloudWorldEntity,
  ): WorldInstancePowerTransitionResult {
    return {
      powerState: "stopped",
      providerSnapshotId:
        instance.providerSnapshotId ?? `mock-snapshot-${world.slug ?? world.id}`,
    };
  }

  inspectInstance(
    instance: CloudInstanceEntity | null,
    world: CloudWorldEntity,
  ): InspectWorldInstanceResult {
    const rawStatus = instance?.powerState ?? "absent";

    return {
      providerKey: this.key,
      deploymentMode: this.summary.deploymentMode,
      executorMode: "in-process",
      remoteHost: "localhost",
      remoteDeployPath: null,
      projectName: world.slug ?? world.id,
      containerName: instance?.providerInstanceId ?? null,
      deploymentState: this.mapPowerStateToDeploymentState(rawStatus),
      providerMessage: "Mock provider mirrors the persisted instance power state.",
      rawStatus,
    };
  }

  resolveApiBaseUrl(world: CloudWorldEntity) {
    const resolved = resolveSuggestedWorldApiBaseUrl(world, this.configService);
    if (resolved) {
      return resolved;
    }
    // 历史上这里硬编码 fallback 到 http://localhost:3000，公网部署时被浏览器
    // 解析成访问者自己机器的 3000 端口，连不上 → welcome 卡死。多租户接入
    // 之后 mock provider 已不该再当默认 (CLOUD_DEFAULT_PROVIDER_KEY=local-process)，
    // 这里改成返回显眼占位符，让上层 / nginx 反代立刻报错而不是默默连错。
    return "http://mock-provider-not-configured.invalid";
  }

  resolveAdminUrl(world: CloudWorldEntity) {
    return resolveSuggestedWorldAdminUrl(world, this.configService);
  }

  private mapPowerStateToDeploymentState(rawStatus: string): InspectWorldInstanceResult["deploymentState"] {
    switch (rawStatus) {
      case "running":
        return "running";
      case "starting":
      case "provisioning":
        return "starting";
      case "stopped":
      case "stopping":
        return "stopped";
      case "error":
        return "error";
      case "absent":
      default:
        return "missing";
    }
  }
}
// i18n-ignore-end
