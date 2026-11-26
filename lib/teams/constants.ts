/** 團隊功能限制（不改方案價格／文件提問額度） */
export const TEAM_LIMITS = {
  /** 每位 BUSINESS 使用者最多擁有的團隊數 */
  maxOwnedTeams: 1,
  /** 單一團隊最多成員（含擁有者） */
  maxMembers: 10,
  /** 邀請有效天數 */
  inviteExpiryDays: 14,
} as const;
