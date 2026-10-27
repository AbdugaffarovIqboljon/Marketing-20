import type { Timestamp } from "firebase-admin/firestore";

export type PaymentStatus = "awaiting_receipt" | "pending" | "approved" | "rejected" | "expired";
export type PaymentDecision = Extract<PaymentStatus, "approved" | "rejected">;
export type ReceiptType = "photo" | "document";

/** A payment the user can still act on; a user has at most one. */
export const OPEN_PAYMENT_STATUSES: readonly PaymentStatus[] = ["awaiting_receipt", "pending"];

export interface PaymentAdmin {
  readonly id: number;
  readonly name: string;
}

export interface Payment {
  readonly id: string;
  readonly userId: number;
  /** Course price plus a tail reserved in paymentAmounts while open, so a transfer can be matched to its user. */
  readonly amount: number;
  readonly status: PaymentStatus;
  readonly receiptFileId: string | null;
  readonly receiptType: ReceiptType | null;
  readonly adminMessageId: number | null;
  readonly createdAt: Timestamp;
  readonly decidedAt: Timestamp | null;
  readonly decidedBy: PaymentAdmin | null;
}

/** The shape stored in Firestore: the payment id is the document key. */
export type PaymentDocument = Omit<Payment, "id">;

export interface Receipt {
  readonly fileId: string;
  readonly type: ReceiptType;
}
