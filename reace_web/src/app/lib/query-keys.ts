export const adminKeys = {
  all: ["admin"] as const,
  stats: () => ["admin", "stats"] as const,
  tutorialCategories: () => ["admin", "tutorials", "categories"] as const,
  tutorialArticles: (params: Record<string, unknown>) => ["admin", "tutorials", "articles", params] as const,
  tutorialLinkOptions: () => ["admin", "tutorials", "link-options"] as const,
  templates: (params: Record<string, unknown>) => ["admin", "templates", params] as const,
  feedback: (params: Record<string, unknown>) => ["admin", "feedback", params] as const,
  users: (params: Record<string, unknown>) => ["admin", "users", params] as const,
  notificationsStats: () => ["admin", "notifications", "stats"] as const,
  notifications: (params: Record<string, unknown>) => ["admin", "notifications", params] as const,
  questionCategories: () => ["admin", "question-categories"] as const,
  questions: (params: Record<string, unknown>) => ["admin", "questions", params] as const,
  practiceCampaignLevels: () => ["admin", "practice-campaign", "levels"] as const,
  practiceCampaignDaily: () => ["admin", "practice-campaign", "daily"] as const,
  pointsStats: () => ["admin", "points", "stats"] as const,
  pointsGrantUsers: (params: Record<string, unknown>) => ["admin", "points", "grant-users", params] as const,
  pointsOptions: () => ["admin", "points", "options"] as const,
  pointsRules: () => ["admin", "points", "rules"] as const,
  pointsRecords: (params: Record<string, unknown>) => ["admin", "points", "records", params] as const,
  levelsOverview: () => ["admin", "levels", "overview"] as const,
  levelsUsers: (params: Record<string, unknown>) => ["admin", "levels", "users", params] as const,
  levelsLogs: (params: Record<string, unknown>) => ["admin", "levels", "logs", params] as const,
  assistantConfigs: () => ["admin", "assistant", "configs"] as const,
  assistantStats: (params: Record<string, unknown>) => ["admin", "assistant", "stats", params] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params: Record<string, unknown>) => ["notifications", "list", params] as const,
  detail: (id: number | string) => ["notifications", "detail", id] as const,
};

export const profileKeys = {
  overview: () => ["profile", "overview"] as const,
  props: () => ["profile", "props"] as const,
  tab: (tab: string) => ["profile", "tab", tab] as const,
};

export const homeKeys = {
  overview: () => ["home", "overview"] as const,
  checkinStatus: () => ["home", "checkin-status"] as const,
  levelRules: () => ["home", "level-rules"] as const,
};

export const tutorialKeys = {
  home: () => ["tutorials", "home"] as const,
  article: (id: number | string) => ["tutorials", "article", id] as const,
};

export const templateKeys = {
  list: (category: string) => ["templates", "list", category] as const,
  records: () => ["templates", "records"] as const,
};

export const practiceKeys = {
  categories: () => ["practice", "categories"] as const,
  questionList: () => ["practice", "question-list"] as const,
  leaderboard: () => ["practice", "leaderboard"] as const,
  detail: (id: number | string) => ["practice", "detail", id] as const,
  submissions: (params: Record<string, unknown>) => ["practice", "submissions", params] as const,
  history: () => ["practice", "history"] as const,
  recordDetail: (id: number | string) => ["practice", "record-detail", id] as const,
  campaignOverview: () => ["practice", "campaign", "overview"] as const,
  campaignChapters: () => ["practice", "campaign", "chapters"] as const,
  campaignChapter: (id: number | string) => ["practice", "campaign", "chapter", id] as const,
  campaignLevel: (id: number | string) => ["practice", "campaign", "level", id] as const,
  campaignDaily: () => ["practice", "campaign", "daily"] as const,
  campaignWrongs: () => ["practice", "campaign", "wrongs"] as const,
  campaignRankings: (scope: string) => ["practice", "campaign", "rankings", scope] as const,
};

export const settingsKeys = {
  overview: () => ["settings", "overview"] as const,
  privacy: () => ["settings", "privacy"] as const,
};

export const pointsKeys = {
  overview: () => ["points", "overview"] as const,
  records: () => ["points", "records"] as const,
  tasks: () => ["points", "tasks"] as const,
};

export const mallKeys = {
  overview: () => ["mall", "overview"] as const,
  items: () => ["mall", "items"] as const,
  types: () => ["mall", "types"] as const,
};
