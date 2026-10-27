import { config } from "../config/config";
import { texts } from "../config/texts";
import type { StatsReport } from "../models/stats";
import type { StatsRepository } from "../repositories/statsRepository";
import { hoursToMs, startOfDayInTimeZone } from "../utils/time";

const WEEK_HOURS = 7 * 24;

export class StatsService {
  constructor(private readonly stats: StatsRepository) {}

  /** Builds the admin /stats message; "today" follows config.timeZone. */
  async buildReport(): Promise<string> {
    const now = new Date();
    const lessonNumbers = Array.from({ length: config.lessonCount }, (_, index) => index + 1);

    const [
      totalUsers,
      newToday,
      newLast7Days,
      paidUsers,
      revenue,
      pendingPayments,
      awaitingPayments,
      blockedUsers,
      passedByLesson,
      sources,
    ] = await Promise.all([
      this.stats.countUsers(),
      this.stats.countUsersCreatedSince(startOfDayInTimeZone(now, config.timeZone)),
      this.stats.countUsersCreatedSince(new Date(now.getTime() - hoursToMs(WEEK_HOURS))),
      this.stats.countUsersWhere("paid", true),
      this.stats.approvedRevenue(),
      this.stats.countPayments("pending"),
      this.stats.countPayments("awaiting_receipt"),
      this.stats.countUsersWhere("blocked", true),
      Promise.all(lessonNumbers.map((lessonNumber) => this.stats.countUsersPassed(lessonNumber))),
      this.stats.usersBySource(),
    ]);

    const report: StatsReport = {
      totalUsers,
      newToday,
      newLast7Days,
      paidUsers,
      revenue,
      pendingPayments,
      awaitingPayments,
      blockedUsers,
      passedByLesson,
      sources: sources.sort((a, b) => b.users - a.users),
    };
    return texts.stats(report);
  }
}
