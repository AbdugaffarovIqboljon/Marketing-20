import { Keyboard } from "grammy";
import { texts } from "../../config/texts";

export function mainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text(texts.menu.lessons)
    .text(texts.menu.progress)
    .text(texts.menu.help)
    .resized()
    .persistent();
}
