import { InlineKeyboard } from "grammy";
import { texts } from "../../config/texts";
import { BROADCAST_AUDIENCES, type BroadcastAudience } from "../../models/broadcast";
import { callbackData } from "../callbackData";

export function broadcastAudienceKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const audience of BROADCAST_AUDIENCES) {
    keyboard.text(texts.broadcastAudience[audience], callbackData.broadcastAudience(audience)).row();
  }
  return keyboard;
}

export function broadcastConfirmKeyboard(audience: BroadcastAudience): InlineKeyboard {
  return new InlineKeyboard()
    .text(texts.broadcastConfirmButton, callbackData.confirmBroadcast(audience))
    .text(texts.broadcastCancelButton, callbackData.cancelBroadcast);
}
