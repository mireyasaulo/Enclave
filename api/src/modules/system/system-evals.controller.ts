import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { SystemService } from './system.service';

// Eval suites run LLM calls against datasets and burn provider quota; in
// multi-tenant cloud mode they also share `runtime-data/evals/*.json` across
// every per-account API child, so concurrent runs would clobber each other.
// Gate the whole surface behind AdminGuard — only the admin app (which sends
// X-Admin-Secret) gets in.
@Controller('system/evals')
@UseGuards(AdminGuard)
export class SystemEvalsController {
  constructor(private readonly systemService: SystemService) {}

  @Get('overview')
  getEvalOverview() {
    return this.systemService.getEvalOverview();
  }

  @Get('datasets')
  listEvalDatasets() {
    return this.systemService.listEvalDatasets();
  }

  @Get('datasets/:id')
  getEvalDataset(@Param('id') id: string) {
    return this.systemService.getEvalDataset(id);
  }

  @Get('strategies')
  listEvalStrategies() {
    return this.systemService.listEvalMemoryStrategies();
  }

  @Get('prompt-variants')
  listEvalPromptVariants() {
    return this.systemService.listEvalPromptVariants();
  }

  @Get('experiments')
  listEvalExperimentPresets() {
    return this.systemService.listEvalExperimentPresets();
  }

  @Post('experiments/:id/run')
  runEvalExperimentPreset(@Param('id') id: string) {
    return this.systemService.runEvalExperimentPreset(id);
  }

  @Get('reports')
  listEvalExperimentReports() {
    return this.systemService.listEvalExperimentReports();
  }

  @Get('runs')
  listEvalRuns(
    @Query('datasetId') datasetId?: string,
    @Query('experimentLabel') experimentLabel?: string,
    @Query('providerModel') providerModel?: string,
    @Query('judgeModel') judgeModel?: string,
    @Query('promptVariant') promptVariant?: string,
    @Query('memoryPolicyVariant') memoryPolicyVariant?: string,
  ) {
    return this.systemService.listEvalRuns({
      datasetId,
      experimentLabel,
      providerModel,
      judgeModel,
      promptVariant,
      memoryPolicyVariant,
    });
  }

  @Post('runs')
  runEvalDataset(
    @Body()
    body: {
      datasetId: string;
      mode?: 'single' | 'pairwise';
      experimentLabel?: string;
      providerOverride?: string;
      judgeModelOverride?: string;
      promptVariant?: string;
      memoryPolicyVariant?: string;
    },
  ) {
    return this.systemService.runEvalDataset(body);
  }

  @Get('runs/:id')
  getEvalRun(@Param('id') id: string) {
    return this.systemService.getEvalRun(id);
  }

  @Get('comparisons')
  listEvalComparisons(
    @Query('datasetId') datasetId?: string,
    @Query('experimentLabel') experimentLabel?: string,
    @Query('providerModel') providerModel?: string,
    @Query('judgeModel') judgeModel?: string,
    @Query('promptVariant') promptVariant?: string,
    @Query('memoryPolicyVariant') memoryPolicyVariant?: string,
  ) {
    return this.systemService.listEvalComparisons({
      datasetId,
      experimentLabel,
      providerModel,
      judgeModel,
      promptVariant,
      memoryPolicyVariant,
    });
  }

  @Post('compare')
  compareEvalRuns(
    @Body()
    body: {
      baselineRunId: string;
      candidateRunId: string;
    },
  ) {
    return this.systemService.compareEvalRuns(body);
  }

  @Post('compare/run')
  runPairwiseEval(
    @Body()
    body: {
      datasetId: string;
      experimentLabel?: string;
      baselineProviderOverride?: string;
      baselineJudgeModelOverride?: string;
      baselinePromptVariant?: string;
      baselineMemoryPolicyVariant?: string;
      candidateProviderOverride?: string;
      candidateJudgeModelOverride?: string;
      candidatePromptVariant?: string;
      candidateMemoryPolicyVariant?: string;
    },
  ) {
    return this.systemService.runPairwiseEval(body);
  }

  @Get('traces')
  listGenerationTraces(
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('characterId') characterId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.systemService.listGenerationTraces({
      source,
      status,
      characterId,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Get('traces/:id')
  getGenerationTrace(@Param('id') id: string) {
    return this.systemService.getGenerationTrace(id);
  }

  @Post('reports/:id/decision')
  updateEvalReportDecision(
    @Param('id') id: string,
    @Body()
    body: {
      decisionStatus: 'keep-testing' | 'promote' | 'rollback' | 'archive';
      appliedAction?: string | null;
      decidedBy?: string | null;
      note?: string | null;
    },
  ) {
    return this.systemService.updateEvalReportDecision(id, body);
  }
}
