import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type {
// i18n-ignore-start: data / seed / preset content — not user-facing UI.
  CloudFeedbackSummary,
  ListCloudFeedbacksResponse,
} from "@yinjie/contracts";
import { Brackets, Repository } from "typeorm";
import { CloudFeedbackEntity } from "../entities/cloud-feedback.entity";
import type {
  ListCloudFeedbacksDto,
  SubmitCloudFeedbackDto,
  UpdateCloudFeedbackStatusDto,
} from "./feedback.dto";

type SubmitContext = {
  submitterIp: string | null;
  submitterUserAgent: string | null;
};

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(CloudFeedbackEntity)
    private readonly repo: Repository<CloudFeedbackEntity>,
  ) {}

  async submit(
    dto: SubmitCloudFeedbackDto,
    context: SubmitContext,
  ): Promise<CloudFeedbackSummary> {
    const entity = this.repo.create({
      source: dto.source ?? "desktop",
      category: dto.category,
      priority: dto.priority,
      title: dto.title,
      detail: dto.detail,
      reproduction: dto.reproduction ?? "",
      expected: dto.expected ?? "",
      diagnosticSummary: dto.diagnosticSummary ?? "",
      includeSystemSnapshot: dto.includeSystemSnapshot ?? false,
      clientRecordId: dto.clientRecordId ?? null,
      clientSubmittedAt: dto.clientSubmittedAt ?? null,
      appPlatform: dto.appPlatform ?? null,
      apiBaseUrl: dto.apiBaseUrl ?? null,
      ownerName: dto.ownerName ?? null,
      ownerSignature: dto.ownerSignature ?? null,
      submitterPhone: dto.submitterPhone ?? null,
      submitterEmail: dto.submitterEmail ?? null,
      submitterIp: context.submitterIp,
      submitterUserAgent: context.submitterUserAgent,
      status: "new",
    });
    const saved = await this.repo.save(entity);
    return this.toSummary(saved);
  }

  async list(query: ListCloudFeedbacksDto): Promise<ListCloudFeedbacksResponse> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize =
      query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;

    const builder = this.repo.createQueryBuilder("feedback");
    if (query.category) {
      builder.andWhere("feedback.category = :category", {
        category: query.category,
      });
    }
    if (query.priority) {
      builder.andWhere("feedback.priority = :priority", {
        priority: query.priority,
      });
    }
    if (query.status) {
      builder.andWhere("feedback.status = :status", { status: query.status });
    }
    if (query.source) {
      builder.andWhere("feedback.source = :source", { source: query.source });
    }
    if (query.query) {
      const like = `%${query.query.replace(/[%_]/g, (char) => `\\${char}`)}%`;
      builder.andWhere(
        new Brackets((qb) => {
          qb.where("feedback.title LIKE :like", { like })
            .orWhere("feedback.detail LIKE :like", { like })
            .orWhere("feedback.submitterPhone LIKE :like", { like })
            .orWhere("feedback.submitterEmail LIKE :like", { like })
            .orWhere("feedback.ownerName LIKE :like", { like });
        }),
      );
    }

    const total = await builder.clone().getCount();

    const items = await builder
      .orderBy("feedback.createdAt", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const stats = await this.computeStats();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      items: items.map((item) => this.toSummary(item)),
      total,
      page,
      pageSize,
      totalPages,
      stats,
    };
  }

  async getById(id: string): Promise<CloudFeedbackSummary> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException("反馈记录不存在。");
    }
    return this.toSummary(entity);
  }

  async updateStatus(
    id: string,
    dto: UpdateCloudFeedbackStatusDto,
    actor: string,
  ): Promise<CloudFeedbackSummary> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException("反馈记录不存在。");
    }
    entity.status = dto.status;
    entity.handlerNote = dto.handlerNote ?? entity.handlerNote ?? null;
    if (dto.status === "resolved" || dto.status === "archived") {
      entity.handledAt = entity.handledAt ?? new Date();
      entity.handledBy = entity.handledBy ?? actor;
    }
    if (dto.status === "in_progress" && !entity.handledBy) {
      entity.handledBy = actor;
    }
    if (dto.status === "new") {
      entity.handledAt = null;
      entity.handledBy = null;
    }
    const saved = await this.repo.save(entity);
    return this.toSummary(saved);
  }

  private async computeStats() {
    const rows = await this.repo
      .createQueryBuilder("feedback")
      .select("feedback.status", "status")
      .addSelect("feedback.priority", "priority")
      .addSelect("COUNT(*)", "count")
      .groupBy("feedback.status")
      .addGroupBy("feedback.priority")
      .getRawMany<{ status: string; priority: string; count: string }>();

    const stats = {
      new: 0,
      inProgress: 0,
      resolved: 0,
      archived: 0,
      highPriority: 0,
    };
    for (const row of rows) {
      const count = Number.parseInt(row.count, 10) || 0;
      if (row.status === "new") stats.new += count;
      if (row.status === "in_progress") stats.inProgress += count;
      if (row.status === "resolved") stats.resolved += count;
      if (row.status === "archived") stats.archived += count;
      if (row.priority === "high" && row.status !== "archived") {
        stats.highPriority += count;
      }
    }
    return stats;
  }

  private toSummary(entity: CloudFeedbackEntity): CloudFeedbackSummary {
    return {
      id: entity.id,
      source: entity.source as CloudFeedbackSummary["source"],
      category: entity.category as CloudFeedbackSummary["category"],
      priority: entity.priority as CloudFeedbackSummary["priority"],
      status: entity.status as CloudFeedbackSummary["status"],
      title: entity.title,
      detail: entity.detail,
      reproduction: entity.reproduction,
      expected: entity.expected,
      diagnosticSummary: entity.diagnosticSummary,
      includeSystemSnapshot: entity.includeSystemSnapshot,
      clientRecordId: entity.clientRecordId,
      clientSubmittedAt: entity.clientSubmittedAt,
      appPlatform: entity.appPlatform,
      apiBaseUrl: entity.apiBaseUrl,
      ownerName: entity.ownerName,
      ownerSignature: entity.ownerSignature,
      submitterPhone: entity.submitterPhone,
      submitterEmail: entity.submitterEmail,
      submitterIp: entity.submitterIp,
      submitterUserAgent: entity.submitterUserAgent,
      handlerNote: entity.handlerNote,
      handledAt: entity.handledAt ? entity.handledAt.toISOString() : null,
      handledBy: entity.handledBy,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
// i18n-ignore-end
