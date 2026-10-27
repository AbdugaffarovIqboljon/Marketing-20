import { Timestamp, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import {
  OPEN_PAYMENT_STATUSES,
  type Payment,
  type PaymentAdmin,
  type PaymentDecision,
  type PaymentDocument,
  type Receipt,
} from "../models/payment";
import type { User } from "../models/user";
import { toUser, USERS_COLLECTION } from "./userRepository";

const PAYMENTS_COLLECTION = "payments";

export type DecisionResult =
  | { readonly kind: "decided"; readonly payment: Payment; readonly user: User }
  | { readonly kind: "already_decided"; readonly payment: Payment }
  | { readonly kind: "not_pending" };

function toPayment(snapshot: DocumentSnapshot): Payment {
  return { id: snapshot.id, ...(snapshot.data() as PaymentDocument) };
}

function isOpen(payment: Payment): boolean {
  return OPEN_PAYMENT_STATUSES.includes(payment.status);
}

export class PaymentRepository {
  constructor(private readonly db: Firestore) {}

  async findOpenByUserId(userId: number): Promise<Payment | undefined> {
    const snapshot = await this.payments().where("userId", "==", userId).get();
    return snapshot.docs.map(toPayment).find(isOpen);
  }

  /**
   * Returns the user's open payment, or creates one with an amount no other
   * open payment uses. Resolves to undefined when every amount is taken.
   */
  async openForUser(userId: number, price: number, tailMax: number): Promise<Payment | undefined> {
    return this.db.runTransaction(async (transaction) => {
      const own = await transaction.get(this.payments().where("userId", "==", userId));
      const existing = own.docs.map(toPayment).find(isOpen);
      if (existing !== undefined) {
        return existing;
      }

      const open = await transaction.get(this.payments().where("status", "in", OPEN_PAYMENT_STATUSES).select("amount"));
      const usedAmounts = new Set(open.docs.map((doc) => doc.get("amount") as number));
      const freeAmounts: number[] = [];
      for (let tail = 1; tail <= tailMax; tail++) {
        if (!usedAmounts.has(price + tail)) {
          freeAmounts.push(price + tail);
        }
      }
      const amount = freeAmounts[Math.floor(Math.random() * freeAmounts.length)];
      if (amount === undefined) {
        return undefined;
      }

      const ref = this.payments().doc();
      const document: PaymentDocument = {
        userId,
        amount,
        status: "awaiting_receipt",
        receiptFileId: null,
        receiptType: null,
        adminMessageId: null,
        createdAt: Timestamp.now(),
        decidedAt: null,
        decidedBy: null,
      };
      transaction.create(ref, document);
      return { id: ref.id, ...document };
    });
  }

  /** Moves awaiting_receipt → pending with the receipt; resolves false if the payment is no longer awaiting one. */
  async claimReceipt(paymentId: string, receipt: Receipt): Promise<boolean> {
    const ref = this.payments().doc(paymentId);

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || toPayment(snapshot).status !== "awaiting_receipt") {
        return false;
      }
      transaction.update(ref, { status: "pending", receiptFileId: receipt.fileId, receiptType: receipt.type });
      return true;
    });
  }

  async setAdminMessageId(paymentId: string, adminMessageId: number): Promise<void> {
    await this.payments().doc(paymentId).update({ adminMessageId });
  }

  /** Undoes claimReceipt when the receipt never reached the admins. */
  async releaseReceipt(paymentId: string): Promise<void> {
    const ref = this.payments().doc(paymentId);

    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const payment = snapshot.exists ? toPayment(snapshot) : undefined;
      if (payment?.status === "pending" && payment.adminMessageId === null) {
        transaction.update(ref, { status: "awaiting_receipt", receiptFileId: null, receiptType: null });
      }
    });
  }

  /**
   * Decides a pending payment exactly once. Approval also marks the user paid
   * in the same transaction. A repeated decision changes nothing.
   */
  async decide(paymentId: string, decision: PaymentDecision, admin: PaymentAdmin): Promise<DecisionResult> {
    const ref = this.payments().doc(paymentId);

    return this.db.runTransaction(async (transaction): Promise<DecisionResult> => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return { kind: "not_pending" };
      }
      const payment = toPayment(snapshot);
      if (payment.status === "approved" || payment.status === "rejected") {
        return { kind: "already_decided", payment };
      }
      if (payment.status !== "pending") {
        return { kind: "not_pending" };
      }

      const userRef = this.db.collection(USERS_COLLECTION).doc(String(payment.userId));
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) {
        throw new Error(`User ${payment.userId} not found while deciding payment ${paymentId}`);
      }

      const decidedAt = Timestamp.now();
      transaction.update(ref, { status: decision, decidedAt, decidedBy: admin });
      let user = toUser(userSnapshot);
      if (decision === "approved") {
        transaction.update(userRef, { paid: true });
        user = { ...user, paid: true };
      }
      return { kind: "decided", payment: { ...payment, status: decision, decidedAt, decidedBy: admin }, user };
    });
  }

  private payments() {
    return this.db.collection(PAYMENTS_COLLECTION);
  }
}
