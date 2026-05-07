export type CloudFeedbackCategory =
  | "bug"
  | "interaction"
  | "performance"
  | "content"
  | "feature";

export type CloudFeedbackPriority = "low" | "medium" | "high";

export type CloudFeedbackSource = "desktop" | "web" | "mobile" | "wechat";

export type CloudFeedbackStatus =
  | "new"
  | "in_progress"
  | "resolved"
  | "archived";

export interface SubmitCloudFeedbackRequest {
  source?: CloudFeedbackSource;
  category: CloudFeedbackCategory;
  priority: CloudFeedbackPriority;
  title: string;
  detail: string;
  reproduction?: string;
  expected?: string;
  diagnosticSummary?: string;
  includeSystemSnapshot?: boolean;
  clientRecordId?: string | null;
  clientSubmittedAt?: string | null;
  appPlatform?: string | null;
  apiBaseUrl?: string | null;
  ownerName?: string | null;
  ownerSignature?: string | null;
  submitterPhone?: string | null;
  submitterEmail?: string | null;
}

export interface CloudFeedbackSummary {
  id: string;
  source: CloudFeedbackSource;
  category: CloudFeedbackCategory;
  priority: CloudFeedbackPriority;
  status: CloudFeedbackStatus;
  title: string;
  detail: string;
  reproduction: string;
  expected: string;
  diagnosticSummary: string;
  includeSystemSnapshot: boolean;
  clientRecordId: string | null;
  clientSubmittedAt: string | null;
  appPlatform: string | null;
  apiBaseUrl: string | null;
  ownerName: string | null;
  ownerSignature: string | null;
  submitterPhone: string | null;
  submitterEmail: string | null;
  submitterIp: string | null;
  submitterUserAgent: string | null;
  handlerNote: string | null;
  handledAt: string | null;
  handledBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitCloudFeedbackResponse {
  success: true;
  feedback: CloudFeedbackSummary;
}

export interface ListCloudFeedbacksQuery {
  query?: string;
  category?: CloudFeedbackCategory;
  priority?: CloudFeedbackPriority;
  status?: CloudFeedbackStatus;
  source?: CloudFeedbackSource;
  page?: number;
  pageSize?: number;
}

export interface ListCloudFeedbacksResponse {
  items: CloudFeedbackSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    new: number;
    inProgress: number;
    resolved: number;
    archived: number;
    highPriority: number;
  };
}

export interface UpdateCloudFeedbackStatusRequest {
  status: CloudFeedbackStatus;
  handlerNote?: string | null;
}
