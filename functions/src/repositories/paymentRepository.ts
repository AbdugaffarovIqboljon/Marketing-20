import {
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
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

export const PAYMENTS_COLLECTION = "payments";
/** One document per amount in use, keyed by the amount, so two open payments can never share one. */
const PAYMENT_AMOUNTS_COLLECTION = "paymentAmounts";

interface AmountReservation {
  readonly paymentId: string;
  readonly userId: number;
  readonly reservedAt: Timestamp;
}

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
   * Returns the user's open payment, or creates one with a freshly reserved
   * amount, preferring the amount of their previous payment. Resolves to
   * undefined when every amount is taken.
   */
  async openForUser(userId: number, price: number, tailMax: number): Promise<Payment | undefined> {
    return this.db.runTransaction(async (transaction) => {
      const own = (await transaction.get(this.payments().where("userId", "==", userId))).docs.map(toPayment);
      const existing = own.find(isOpen);
      if (existing !== undefined) {
        return existing;
      }

      const previous = own.reduce<Payment | undefined>(
        (latest, payment) => (latest === undefined || payment.createdAt.toMillis() > latest.createdAt.toMillis() ? payment : latest),
        undefined,
      );
      const amount = await this.pickFreeAmount(transaction, price, tailMax, previous?.amount);
      if (amount === undefined) {
        return undefined;
      }

      const ref = this.payments().doc();
      const now = Timestamp.now();
      const document: PaymentDocument = {
        userId,
        amount,
        status: "awaiting_receipt",
        receiptFileId: null,
        receiptType: null,
        adminMessageId: null,
        createdAt: now,
        decidedAt: null,
        decidedBy: null,
      };
      const reservation: AmountReservation = { paymentId: ref.id, userId, reservedAt: now };
      transaction.create(ref, document);
      // create() fails if the amount is already reserved, so a race can never hand out a duplicate.
      transaction.create(this.amounts().doc(String(amount)), reservation);
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

      const reservation = await this.findReservation(transaction, payment);

      const decidedAt = Timestamp.now();
      transaction.update(ref, { status: decision, decidedAt, decidedBy: admin });
      if (reservation !== undefined) {
        transaction.delete(reservation);
      }
      let user = toUser(userSnapshot);
      if (decision === "approved") {
        transaction.update(userRef, { paid: true });
        user = { ...user, paid: true };
      }
      return { kind: "decided", payment: { ...payment, status: decision, decidedAt, decidedBy: admin }, user };
    });
  }

  /** Ids of awaiting_receipt payments created before `before`, oldest first. */
  async findExpirable(before: Timestamp, limit: number): Promise<string[]> {
    const snapshot = await this.payments()
      .where("status", "==", "awaiting_receipt")
      .where("createdAt", "<", before)
      .orderBy("createdAt")
      .limit(limit)
      .select()
      .get();
    return snapshot.docs.map((doc) => doc.id);
  }

  /** Expires the payment and frees its amount; resolves false if it got a receipt or changed meanwhile. */
  async expire(paymentId: string, before: Timestamp): Promise<boolean> {
    const ref = this.payments().doc(paymentId);

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const payment = snapshot.exists ? toPayment(snapshot) : undefined;
      if (payment?.status !== "awaiting_receipt" || payment.createdAt.toMillis() >= before.toMillis()) {
        return false;
      }
      const reservation = await this.findReservation(transaction, payment);
      transaction.update(ref, { status: "expired" });
      if (reservation !== undefined) {
        transaction.delete(reservation);
      }
      return true;
    });
  }

  private async pickFreeAmount(
    transaction: Transaction,
    price: number,
    tailMax: number,
    preferred: number | undefined,
  ): Promise<number | undefined> {
    if (preferred !== undefined && preferred > price && preferred <= price + tailMax) {
      const snapshot = await transaction.get(this.amounts().doc(String(preferred)));
      if (!snapshot.exists) {
        return preferred;
      }
    }

    const reserved = await transaction.get(this.amounts().select());
    const usedAmounts = new Set(reserved.docs.map((doc) => Number(doc.id)));
    const freeAmounts: number[] = [];
    for (let tail = 1; tail <= tailMax; tail++) {
      if (!usedAmounts.has(price + tail)) {
        freeAmounts.push(price + tail);
      }
    }
    return freeAmounts[Math.floor(Math.random() * freeAmounts.length)];
  }

  /** The payment's amount reservation, if it still belongs to this payment. */
  private async findReservation(transaction: Transaction, payment: Payment): Promise<DocumentReference | undefined> {
    const ref = this.amounts().doc(String(payment.amount));
    const snapshot = await transaction.get(ref);
    return snapshot.get("paymentId") === payment.id ? ref : undefined;
  }

  private amounts() {
    return this.db.collection(PAYMENT_AMOUNTS_COLLECTION);
  }

  private payments() {
    return this.db.collection(PAYMENTS_COLLECTION);
  }
}
