import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { SystemService } from './system.service';

// 每次 API 进程启动都换一个 buildId。客户端 inline script 周期性 fetch
// /api/system/build-id，发现变了就清 SW + reload，让用户完全无感升级。
const SYSTEM_BUILD_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('status')
  getStatus() {
    return this.systemService.getStatus();
  }

  @Get('build-id')
  getBuildId() {
    return { buildId: SYSTEM_BUILD_ID };
  }

  @Get('scheduler')
  getSchedulerStatus() {
    return this.systemService.getSchedulerStatus();
  }

  @Post('scheduler/run/:id')
  runSchedulerJob(@Param('id') id: string) {
    return this.systemService.runSchedulerJob(id);
  }

  @Get('realtime')
  getRealtimeStatus() {
    return this.systemService.getRealtimeStatus();
  }

  @Get('provider')
  getProviderConfig() {
    return this.systemService.getProviderConfig();
  }

  @Put('provider')
  setProviderConfig(
    @Body()
    body: {
      endpoint: string;
      model: string;
      apiKey?: string;
      mode?: string;
      apiStyle?: string;
      transcriptionEndpoint?: string;
      transcriptionModel?: string;
      transcriptionApiKey?: string;
      ttsEndpoint?: string;
      ttsApiKey?: string;
      ttsModel?: string;
      ttsVoice?: string;
      imageGenerationEndpoint?: string;
      imageGenerationModel?: string;
      imageGenerationApiKey?: string;
    },
  ) {
    return this.systemService.setProviderConfig(body);
  }

  @Post('provider/test')
  testProviderConnection(
    @Body()
    body: {
      endpoint: string;
      model: string;
      apiKey?: string;
      mode?: string;
      apiStyle?: string;
      transcriptionEndpoint?: string;
      transcriptionModel?: string;
      transcriptionApiKey?: string;
      ttsEndpoint?: string;
      ttsApiKey?: string;
      ttsModel?: string;
      ttsVoice?: string;
      imageGenerationEndpoint?: string;
      imageGenerationModel?: string;
      imageGenerationApiKey?: string;
    },
  ) {
    return this.systemService.testProviderConnection(body);
  }

  @Post('inference/preview')
  runInferencePreview(
    @Body() body: { prompt: string; model?: string; systemPrompt?: string },
  ) {
    return this.systemService.runInferencePreview(body);
  }

  @Get('logs')
  getSystemLogs() {
    return this.systemService.getSystemLogs();
  }

  @Post('diag/export')
  exportDiagnostics() {
    return this.systemService.exportDiagnostics();
  }
}
