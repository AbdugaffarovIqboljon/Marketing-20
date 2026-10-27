import { FieldValue, Timestamp, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import type {
  Broadcast,
  BroadcastCounters,
  BroadcastDocument,
  BroadcastStatus,
  NewBroadcast,
} from "../models/broadcast";

const BROADCASTS_COLLECTION = "broadcasts";
const LOCKS_COLLECTION = "locks";
/** Holds the id of the one active broadcast; its existence blocks a second one. */
const BROADCAST_LOCK_ID = "broadcast";

function toBroadcast(snapshot: DocumentSnapshot): Broadcast {
  return { id: snapshot.id, ...(snapshot.data() as BroadcastDocument) };
}

function increments(delta: BroadcastCounters) {
  return {
    sent: FieldValue.increment(delta.sent),
    failed: FieldValue.increment(delta.failed),
    blocked: FieldValue.increment(delta.blocked),
  };
}

function holdsLease(broadcast: Broadcast, leaseId: string): boolean {
  return broadcast.status === "active" && broadcast.leaseId === leaseId;
}

export class BroadcastRepository {
  constructor(private readonly db: Firestore) {}

  async hasActive(): Promise<boolean> {
    return (await this.lock().get()).exists;
  }

  async findActive(): Promise<Broadcast | undefined> {
    const lock = await this.lock().get();
    const broadcastId: unknown = lock.get("broadcastId");
    if (typeof broadcastId !== "string") {
      return undefined;
    }
    const snapshot = await this.broadcasts().doc(broadcastId).get();
    return snapshot.exists ? toBroadcast(snapshot) : undefined;
  }

  /** Creates the broadcast and takes the lock; resolves undefined if another broadcast is active. */
  async createIfIdle(input: NewBroadcast): Promise<Broadcast | undefined> {
    const lockRef = this.lock();

    return this.db.runTransaction(async (transaction) => {
      if ((await transaction.get(lockRef)).exists) {
        return undefined;
      }

      const ref = this.broadcasts().doc();
      const document: BroadcastDocument = {
        ...input,
        status: "active",
        cursor: null,
        sent: 0,
        failed: 0,
        blocked: 0,
        createdAt: Timestamp.now(),
        finishedAt: null,
        leaseId: null,
        leaseUntil: null,
      };
      transaction.create(ref, document);
      transaction.create(lockRef, { broadcastId: ref.id });
      return { id: ref.id, ...document };
    });
  }

  /** Grants the run exclusive sending rights unless another run holds a live lease. */
  async acquireLease(broadcastId: string, leaseId: string, leaseUntil: Timestamp): Promise<Broadcast | undefined> {
    const ref = this.broadcasts().doc(broadcastId);

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return undefined;
      }
      const broadcast = toBroadcast(snapshot);
      if (broadcast.status !== "active" || (broadcast.leaseUntil !== null && broadcast.leaseUntil.toMillis() > Date.now())) {
        return undefined;
      }
      transaction.update(ref, { leaseId, leaseUntil });
      return { ...broadcast, leaseId, leaseUntil };
    });
  }

  /**
   * Saves the cursor and adds `delta` to the counters while the lease is held.
   * A null `leaseUntil` releases the lease. Resolves false if the lease was lost.
   */
  async checkpoint(
    broadcastId: string,
    leaseId: string,
    cursor: string | null,
    delta: BroadcastCounters,
    leaseUntil: Timestamp | null,
  ): Promise<boolean> {
    const ref = this.broadcasts().doc(broadcastId);

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || !holdsLease(toBroadcast(snapshot), leaseId)) {
        return false;
      }
      transaction.update(ref, {
        ...increments(delta),
        cursor,
        leaseId: leaseUntil === null ? null : leaseId,
        leaseUntil,
      });
      return true;
    });
  }

  /** Closes the broadcast and frees the lock; resolves to the final state, or undefined if the lease was lost. */
  async finish(
    broadcastId: string,
    leaseId: string,
    delta: BroadcastCounters,
    status: Exclude<BroadcastStatus, "active">,
  ): Promise<Broadcast | undefined> {
    const ref = this.broadcasts().doc(broadcastId);
    const lockRef = this.lock();

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const lock = await transaction.get(lockRef);
      if (!snapshot.exists) {
        return undefined;
      }
      const broadcast = toBroadcast(snapshot);
      if (!holdsLease(broadcast, leaseId)) {
        return undefined;
      }

      const finishedAt = Timestamp.now();
      transaction.update(ref, { ...increments(delta), status, finishedAt, leaseId: null, leaseUntil: null });
      if (lock.get("broadcastId") === broadcastId) {
        transaction.delete(lockRef);
      }
      return {
        ...broadcast,
        status,
        finishedAt,
        leaseId: null,
        leaseUntil: null,
        sent: broadcast.sent + delta.sent,
        failed: broadcast.failed + delta.failed,
        blocked: broadcast.blocked + delta.blocked,
      };
    });
  }

  private lock() {
    return this.db.collection(LOCKS_COLLECTION).doc(BROADCAST_LOCK_ID);
  }

  private broadcasts() {
    return this.db.collection(BROADCASTS_COLLECTION);
  }
}
