import { AggregateField, Timestamp, type Firestore } from "firebase-admin/firestore";
import type { PaymentStatus } from "../models/payment";
import type { SourceStats } from "../models/stats";
import { PAYMENTS_COLLECTION } from "./paymentRepository";
import { USERS_COLLECTION } from "./userRepository";

/** Read-only aggregations for the admin /stats report. */
export class StatsRepository {
  constructor(private readonly db: Firestore) {}

  async countUsers(): Promise<number> {
    return (await this.users().count().get()).data().count;
  }

  async countUsersCreatedSince(since: Date): Promise<number> {
    const query = this.users().where("createdAt", ">=", Timestamp.fromDate(since));
    return (await query.count().get()).data().count;
  }

  async countUsersWhere(field: "paid" | "blocked", value: boolean): Promise<number> {
    return (await this.users().where(field, "==", value).count().get()).data().count;
  }

  async countUsersPassed(lessonNumber: number): Promise<number> {
    const query = this.users().where("passedLessons", "array-contains", lessonNumber);
    return (await query.count().get()).data().count;
  }

  async countPayments(status: PaymentStatus): Promise<number> {
    return (await this.payments().where("status", "==", status).count().get()).data().count;
  }

  async approvedRevenue(): Promise<number> {
    const snapshot = await this.payments()
      .where("status", "==", "approved")
      .aggregate({ revenue: AggregateField.sum("amount") })
      .get();
    return snapshot.data().revenue;
  }

  /** Firestore cannot group by a field, so this reads two small fields of every user. */
  async usersBySource(): Promise<SourceStats[]> {
    const snapshot = await this.users().select("source", "paid").get();
    const bySource = new Map<string | null, { users: number; paid: number }>();
    for (const doc of snapshot.docs) {
      const source: unknown = doc.get("source");
      const key = typeof source === "string" ? source : null;
      const entry = bySource.get(key) ?? { users: 0, paid: 0 };
      entry.users += 1;
      entry.paid += doc.get("paid") === true ? 1 : 0;
      bySource.set(key, entry);
    }
    return [...bySource].map(([source, entry]) => ({ source, ...entry }));
  }

  private users() {
    return this.db.collection(USERS_COLLECTION);
  }

  private payments() {
    return this.db.collection(PAYMENTS_COLLECTION);
  }
}
