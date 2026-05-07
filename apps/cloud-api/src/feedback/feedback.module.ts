import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminAuthService } from "../auth/admin-auth.service";
import { AdminGuard } from "../auth/admin.guard";
import { CloudAdminSessionEntity } from "../entities/cloud-admin-session.entity";
import { CloudFeedbackEntity } from "../entities/cloud-feedback.entity";
import { FeedbackAdminController } from "./feedback-admin.controller";
import { FeedbackPublicController } from "./feedback-public.controller";
import { FeedbackService } from "./feedback.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([CloudFeedbackEntity, CloudAdminSessionEntity]),
  ],
  controllers: [FeedbackPublicController, FeedbackAdminController],
  providers: [FeedbackService, AdminGuard, AdminAuthService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
