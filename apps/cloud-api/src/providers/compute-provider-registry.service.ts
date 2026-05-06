import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LocalProcessComputeProviderService } from "../orchestration/local-process-compute-provider.service";
import { MockComputeProviderService } from "../orchestration/mock-compute-provider.service";
import { ManualDockerComputeProviderService } from "./manual-docker-compute-provider.service";
import type { WorldComputeProvider } from "./compute-provider.types";

@Injectable()
export class ComputeProviderRegistryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly mockComputeProvider: MockComputeProviderService,
    private readonly manualDockerComputeProvider: ManualDockerComputeProviderService,
    private readonly localProcessComputeProvider: LocalProcessComputeProviderService,
  ) {}

  getDefaultProviderKey() {
    const configuredProviderKey = this.configService.get<string>("CLOUD_DEFAULT_PROVIDER_KEY")?.trim();
    if (configuredProviderKey) {
      return this.requireProvider(configuredProviderKey).key;
    }

    if (this.configService.get<string>("CLOUD_LOCAL_PROCESS_PROVIDER")?.trim() === "1") {
      return this.localProcessComputeProvider.key;
    }

    return this.mockComputeProvider.key;
  }

  listProviders() {
    return [
      this.mockComputeProvider.summary,
      this.manualDockerComputeProvider.summary,
      this.localProcessComputeProvider.summary,
    ];
  }

  requireProvider(providerKey?: string | null): WorldComputeProvider {
    const normalizedProviderKey = providerKey?.trim();
    if (!normalizedProviderKey) {
      return this.requireProvider(this.getDefaultProviderKey());
    }

    switch (normalizedProviderKey) {
      case "manual":
      case this.manualDockerComputeProvider.key:
        return this.manualDockerComputeProvider;
      case this.mockComputeProvider.key:
        return this.mockComputeProvider;
      case this.localProcessComputeProvider.key:
        return this.localProcessComputeProvider;
      default:
        throw new BadRequestException(`Unsupported compute provider: ${normalizedProviderKey}`);
    }
  }

  getProvider(providerKey?: string | null): WorldComputeProvider {
    return this.requireProvider(providerKey);
  }
}
