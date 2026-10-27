import { Composer } from "grammy";
import type { UserService } from "../../services/userService";
import type { BotContext } from "../context";

/** Tracks blocks and unblocks of the bot in private chats; never counts as user activity. */
export function createMembershipComposer(userService: UserService): Composer<BotContext> {
  const composer = new Composer<BotContext>();

  composer.on("my_chat_member", async (ctx) => {
    const { status } = ctx.myChatMember.new_chat_member;
    if (status === "kicked" || status === "member") {
      await userService.setBlocked(ctx.myChatMember.from.id, status === "kicked");
    }
  });

  return composer;
}
