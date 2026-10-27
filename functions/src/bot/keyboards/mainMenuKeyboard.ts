import { Keyboard } from "grammy";
import { texts } from "../../config/texts";

/** Unpaid users get an extra row with the buy button. */
export function mainMenuKeyboard(paid: boolean): Keyboard {
  const keyboard = new Keyboard().text(texts.menu.lessons).text(texts.menu.progress).text(texts.menu.help);
  if (!paid) {
    keyboard.row().text(texts.menu.buy);
  }
  return keyboard.resized().persistent();
}
