import type { ReactNode } from "react";
import type { DynamicArrayHydrationRule } from "../lib/excel";

export type AdminStatsGroup = Record<string, number | undefined>;

export type AdminStatsPayload = {
  overview?: AdminStatsGroup;
  users?: AdminStatsGroup;
  moderation?: AdminStatsGroup;
  practice?: AdminStatsGroup;
  pointsAndLevels?: AdminStatsGroup;
  notifications?: AdminStatsGroup;
  userCount?: number;
  pendingFeedback?: number;
};

export type PagedAdminResponse<T> = {
  records: T[];
  total: number;
};

export type AdminEditableUserRole = "admin" | "moderator" | "user";

export type AdminUserForm = {
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  password: string;
  role: AdminEditableUserRole;
  status: number;
  isMuted?: boolean;
  forceChangePassword?: boolean;
  notifyUser?: boolean;
};

export type AdminUserRecord = {
  id: number;
  username: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role?: string | null;
  status?: number | null;
  isMuted?: boolean;
  level?: number;
  levelName?: string | null;
  points?: number;
  exp?: number;
  source?: string | null;
  sourceChannel?: string | null;
  lastLoginTime?: string | null;
  lastActiveTime?: string | null;
  updateTime?: string | null;
  createTime?: string | null;
  forceChangePassword?: boolean | null;
};

export type AdminUserToggleResponse = {
  locked?: boolean;
  muted?: boolean;
};

export type AdminNotificationForm = {
  title: string;
  content: string;
  type: string;
  status: string;
  targetType: string;
  targetRoles: string;
  targetUserIds?: string;
  attachments: string;
  scheduledTime?: string | null;
  pinned?: boolean;
};

export type AdminNotificationRecord = AdminNotificationForm & {
  id: number;
  createTime?: string | null;
  sendTime?: string | null;
  scheduledTime?: string | null;
  pinnedUntil?: string | null;
  readCount?: number;
  totalCount?: number;
};

export type AdminNotificationStats = {
  total?: number;
  sent?: number;
  draft?: number;
  scheduled?: number;
  totalUsers?: number;
};

export type QuestionCategoryForm = {
  name: string;
  description: string;
  groupName: string;
  frontDisplayName?: string;
  iconKey?: string;
  recommendedDifficulty?: string;
  sortOrder: number | string;
  enabled: boolean;
};

export type QuestionCategoryRecord = QuestionCategoryForm & {
  id: number;
  questionCount?: number;
};

export type PracticeCampaignLevelRecord = {
  id: number;
  title?: string | null;
  chapterName?: string | null;
  questionTitle?: string | null;
  levelType?: string | null;
  difficulty?: string | null;
  targetTimeSeconds?: number;
  rewardExp?: number;
  rewardPoints?: number;
  firstPassBonus?: number;
  enabled?: boolean;
};

export type LevelConfigForm = {
  levelType: string;
  difficulty: string;
  targetTimeSeconds: string;
  rewardExp: string;
  rewardPoints: string;
  firstPassBonus: string;
  enabled: boolean;
};

export type QuestionGradingMode = "simple" | "dynamic_array";

export type QuestionDynamicArrayRuleForm = DynamicArrayHydrationRule & {
  score: number | string;
  label: string;
  formulaKeywordsText: string;
  requireAnchorFormula: boolean;
  requireSpillCellsWithoutFormula: boolean;
};

export type AdminQuestionForm = {
  title: string;
  questionCategoryId: string | number;
  difficulty: string | number;
  points: string | number;
  explanation: string;
  enabled: boolean;
  templateFileUrl: string;
  idealAnswerImageUrl: string;
  answerSheet: string;
  answerRange: string;
  answerSnapshotJson: string;
  checkFormula: boolean;
  gradingMode: QuestionGradingMode;
  dynamicArrayRules: QuestionDynamicArrayRuleForm[];
  gradingRuleJson: string;
  sheetCountLimit: string | number;
  version: string | number;
};

export type AdminQuestionRecord = Partial<AdminQuestionForm> & {
  id: number;
  title: string;
  type?: string | null;
  categoryId?: number | string | null;
  questionCategoryId?: number | string | null;
  questionCategoryName?: string | null;
  expectedSnapshotJson?: string | null;
};

export type AdminQuestionsResponse = {
  questions: AdminQuestionRecord[];
  total: number;
};

export type PointsRuleForm = {
  name: string;
  description: string;
  taskKey: string;
  points: string | number;
  type: string;
  enabled: boolean;
  userVisible: boolean;
  sortOrder: string | number;
};

export type PointsRuleRecord = PointsRuleForm & {
  id: number;
};

export type PointsOptionKind = "type" | "task_key";

export type PointsOptionForm = {
  kind: PointsOptionKind;
  value: string;
  label: string;
  sortOrder: string | number;
};

export type PointsOptionRecord = PointsOptionForm & {
  id: number;
  optionValue?: string | null;
  usageCount?: number;
};

export type AdminOptionChoiceInput = {
  value?: string | null;
  optionValue?: string | null;
  label?: string | null;
};

export type PointsStatsResponse = {
  activeUsers?: number;
  totalPoints?: number;
  todayPoints?: number;
};

export type PointsOptionsResponse = {
  types: PointsOptionRecord[];
  taskKeys: PointsOptionRecord[];
};

export type PointsRecord = {
  id?: number;
  userId?: number;
  username?: string | null;
  user?: { username?: string | null } | null;
  change?: number;
  points?: number;
  reason?: string | null;
  bizLabel?: string | null;
  taskName?: string | null;
  createTime?: string | null;
};

export type PointsGrantResponse = {
  username?: string | null;
  points?: number;
};

export type LevelRuleForm = {
  level: string;
  name: string;
  threshold: string;
  enabled: boolean;
};

export type LevelRuleRecord = {
  level: number;
  name?: string | null;
  threshold?: number;
  enabled?: boolean;
};

export type ExpRuleForm = {
  key: string;
  name: string;
  description: string;
  minExp: string;
  maxExp: string;
  maxObtainCount: string;
  enabled: boolean;
};

export type ExpRuleRecord = {
  key: string;
  label?: string | null;
  description?: string | null;
  minExp?: number;
  maxExp?: number;
  maxObtainCount?: number | null;
  enabled?: boolean;
  rangeText?: string | null;
};

export type LevelsOverviewResponse = {
  stats?: {
    userCount?: number;
    totalExp?: number;
    todayExp?: number;
    highestLevelName?: string | null;
    highestLevel?: number;
    highestLevelUsers?: number;
  };
  levelRules?: LevelRuleRecord[];
  expRules?: ExpRuleRecord[];
};

export type LevelUserRecord = {
  id: number;
  username?: string | null;
  levelName?: string | null;
  level?: number;
  exp?: number;
  progress?: {
    current?: number;
    nextThreshold?: number;
  };
};

export type ExpLogRecord = {
  id: number;
  user?: { username?: string | null } | null;
  bizLabel?: string | null;
  bizType?: string | null;
  expChange?: number;
  reason?: string | null;
  createTime?: string | null;
};

export type FormDialogProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  contentClassName?: string;
  bodyClassName?: string;
  onSubmit: () => Promise<void> | void;
  children: ReactNode;
};

export type AdminConfirmRequest = {
  kind: "confirm";
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
};

export type AdminPromptRequest = {
  kind: "prompt";
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  resolve: (value: string | null) => void;
};

export type AdminFeedbackRequest = {
  kind: "feedback";
  type: "success" | "error";
  title?: string;
  message: string;
  confirmLabel?: string;
  durationMs?: number;
};

export type AdminDialogRequest = AdminConfirmRequest | AdminPromptRequest | AdminFeedbackRequest;
export type AdminDialogController = {
  showFeedback: (request: AdminFeedbackRequest) => void;
  openConfirm: (options: Omit<AdminConfirmRequest, "kind" | "resolve">) => Promise<boolean>;
  openPrompt: (options: Omit<AdminPromptRequest, "kind" | "resolve">) => Promise<string | null>;
};
