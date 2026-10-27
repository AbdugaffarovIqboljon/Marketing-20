import type { Timestamp } from "firebase-admin/firestore";

export type BroadcastAudience = "all" | "unpaid" | "paid";
export const BROADCAST_AUDIENCES: readonly BroadcastAudience[] = ["all", "unpaid", "paid"];

/** "aborted" means the source message was deleted mid-way. */
export type BroadcastStatus = "active" | "done" | "aborted";

export interface BroadcastCounters {
  readonly sent: number;
  readonly failed: number;
  readonly blocked: number;
}

export interface BroadcastAdmin {
  readonly id: number;
  readonly name: string;
}

export interface Broadcast extends BroadcastCounters {
  readonly id: string;
  readonly sourceChatId: number;
  readonly sourceMessageId: number;
  /** The admin-group prompt that is edited with progress. */
  readonly statusMessageId: number;
  readonly audience: BroadcastAudience;
  readonly status: BroadcastStatus;
  /** Id of the last user the broadcast moved past; recipients are walked in id order. */
  readonly cursor: string | null;
  /** Recipient count when the broadcast was confirmed. */
  readonly total: number;
  readonly createdBy: BroadcastAdmin;
  readonly createdAt: Timestamp;
  readonly finishedAt: Timestamp | null;
  /** The run currently allowed to send; a lease past leaseUntil may be taken over. */
  readonly leaseId: string | null;
  readonly leaseUntil: Timestamp | null;
}

/** The shape stored in Firestore: the broadcast id is the document key. */
export type BroadcastDocument = Omit<Broadcast, "id">;

export interface NewBroadcast {
  readonly sourceChatId: number;
  readonly sourceMessageId: number;
  readonly statusMessageId: number;
  readonly audience: BroadcastAudience;
  readonly total: number;
  readonly createdBy: BroadcastAdmin;
}

export function isBroadcastAudience(value: string | undefined): value is BroadcastAudience {
  return BROADCAST_AUDIENCES.some((audience) => audience === value);
}
