import { InlineKeyboard } from "grammy";
import { texts } from "../../config/texts";
import { callbackData } from "../callbackData";

export function paywallKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text(texts.payButton, callbackData.startPayment);
}

export function adminDecisionKeyboard(paymentId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(texts.adminApproveButton, callbackData.approvePayment(paymentId))
    .text(texts.adminRejectButton, callbackData.rejectPayment(paymentId));
}
