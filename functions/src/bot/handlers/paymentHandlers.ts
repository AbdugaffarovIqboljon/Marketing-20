import { Composer } from "grammy";
import { texts } from "../../config/texts";
import type { PaymentService } from "../../services/paymentService";
import { callbackPatterns } from "../callbackData";
import type { UserContext } from "../context";

/** Private-chat side of payments: paywall, card details and receipt intake. */
export function createPaymentComposer(paymentService: PaymentService): Composer<UserContext> {
  const composer = new Composer<UserContext>();

  composer.hears(texts.menu.buy, async (ctx) => {
    await paymentService.showPaywall(ctx.user);
  });

  composer.callbackQuery(callbackPatterns.startPayment, async (ctx) => {
    await ctx.answerCallbackQuery();
    await paymentService.startPayment(ctx.user);
  });

  composer.on("message:photo", async (ctx) => {
    // Telegram lists photo sizes from smallest to largest.
    const largest = ctx.message.photo.at(-1);
    if (largest !== undefined) {
      await paymentService.receiveReceipt(ctx.user, ctx.message.message_id, { fileId: largest.file_id, type: "photo" });
    }
  });

  composer.on("message:document", async (ctx) => {
    const { file_id: fileId, mime_type: mimeType } = ctx.message.document;
    await paymentService.receiveDocument(ctx.user, ctx.message.message_id, fileId, mimeType);
  });

  composer.on(["message:video", "message:audio", "message:voice", "message:video_note"], async (ctx) => {
    await paymentService.rejectFileType(ctx.user);
  });

  return composer;
}
