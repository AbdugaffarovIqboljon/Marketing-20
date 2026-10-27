export interface SourceStats {
  /** Null means the user came without a /start payload. */
  readonly source: string | null;
  readonly users: number;
  readonly paid: number;
}

export interface StatsReport {
  readonly totalUsers: number;
  readonly newToday: number;
  readonly newLast7Days: number;
  readonly paidUsers: number;
  readonly revenue: number;
  readonly pendingPayments: number;
  readonly awaitingPayments: number;
  readonly blockedUsers: number;
  /** Index i holds how many users passed lesson i + 1. */
  readonly passedByLesson: readonly number[];
  /** Sorted by user count, largest first. */
  readonly sources: readonly SourceStats[];
}
