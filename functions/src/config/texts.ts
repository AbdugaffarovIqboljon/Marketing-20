import type { Broadcast, BroadcastAudience } from "../models/broadcast";
import type { SourceStats, StatsReport } from "../models/stats";
import { escapeHtml } from "../utils/html";
import { config } from "./config";

const PROGRESS_BAR_LENGTH = 10;
const FUNNEL_PER_LINE = 5;
const NO_SOURCE_LABEL = "(manbasiz)";
const OTHER_SOURCES_LABEL = "boshqalar";

function formatAmount(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("ru-RU", { timeZone: config.timeZone, dateStyle: "short", timeStyle: "short" });
}

export interface AdminReceiptInfo {
  readonly firstName: string;
  readonly username: string | null;
  readonly userId: number;
  readonly source: string | null;
  readonly amount: number;
  readonly createdAt: Date;
}

function progressBar(passed: number, total: number): string {
  const filled = Math.min(PROGRESS_BAR_LENGTH, Math.round((passed / total) * PROGRESS_BAR_LENGTH));
  return "▰".repeat(filled) + "▱".repeat(PROGRESS_BAR_LENGTH - filled);
}

function percent(part: number, total: number): string {
  return total === 0 ? "0" : ((part / total) * 100).toFixed(1);
}

function funnelLines(passedByLesson: readonly number[]): string {
  const cells = passedByLesson.map((count, index) => `${index + 1}: ${count}`);
  const lines: string[] = [];
  for (let start = 0; start < cells.length; start += FUNNEL_PER_LINE) {
    lines.push(cells.slice(start, start + FUNNEL_PER_LINE).join(" · "));
  }
  return lines.join("\n");
}

function sourceLines(sources: readonly SourceStats[]): string {
  if (sources.length === 0) {
    return "—";
  }
  const top = sources.slice(0, config.statsTopSources);
  const rest = sources.slice(config.statsTopSources);
  const lines = top.map((entry) => `${entry.source ?? NO_SOURCE_LABEL}: ${entry.users} / ${entry.paid}`);
  if (rest.length > 0) {
    const users = rest.reduce((sum, entry) => sum + entry.users, 0);
    const paid = rest.reduce((sum, entry) => sum + entry.paid, 0);
    lines.push(`${OTHER_SOURCES_LABEL}: ${users} / ${paid}`);
  }
  return lines.join("\n");
}

const broadcastAudienceLabels: Record<BroadcastAudience, string> = {
  all: "Hammaga",
  unpaid: "To'lamaganlarga",
  paid: "To'laganlarga",
};

function broadcastCounters(broadcast: Broadcast): string {
  return (
    `✅ Yuborildi: ${broadcast.sent}\n` +
    `⚠️ Xato: ${broadcast.failed}\n` +
    `🚫 Bloklagan: ${broadcast.blocked}`
  );
}

export const texts = {
  menu: {
    lessons: "📚 Darslarim",
    progress: "📊 Progress",
    help: "🆘 Yordam",
    buy: "💳 Kursni sotib olish",
  },

  welcome: (firstName: string): string =>
    `Assalomu alaykum, ${firstName}! 👋\n\n` +
    `${config.courseName} kursiga xush kelibsiz.\n` +
    `Kursda ${config.lessonCount} ta video dars bor. 1-dars bepul, qolgan darslar to'lovdan so'ng ochiladi.\n` +
    `Kurs narxi: ${formatAmount(config.priceUzs)} so'm.\n\n` +
    `Pastdagi menyudan foydalaning.`,

  lessonLabel: (number: number, title: string): string => `${number}-dars. ${title}`,
  watchedButton: "Ko'rdim, testga o'tish",

  quizPassed: (correct: number, total: number, percent: number): string =>
    `✅ Test topshirildi!\n\nTo'g'ri javoblar: ${correct}/${total} (${percent}%).`,
  quizFailed: (correct: number, total: number, percent: number): string =>
    `❌ Test topshirilmadi.\n\nTo'g'ri javoblar: ${correct}/${total} (${percent}%). ` +
    `O'tish uchun kamida ${config.passPercent}% kerak. Darsni yana bir ko'rib, qayta urinib ko'ring.`,
  retryQuizButton: "Qayta topshirish",
  courseFinished:
    `🎉 Tabriklaymiz! Siz ${config.courseName} kursining barcha ${config.lessonCount} ta darsini tugatdingiz.`,
  quizUnavailable:
    `Kechirasiz, testni yuborib bo'lmadi. Birozdan so'ng qayta urinib ko'ring. ` +
    `Muammo davom etsa, ${config.supportUsername} ga yozing.`,

  lessonLocked: (number: number): string => `🔒 ${number}-dars yopiq. Davom etish uchun kursni sotib oling.`,

  paywall:
    `💎 ${config.courseName}\n\n` +
    `Kurs narxi: ${formatAmount(config.priceUzs)} so'm.\n\n` +
    `To'lovdan so'ng siz olasiz:\n` +
    `• barcha ${config.lessonCount} ta video darsga to'liq kirish\n` +
    `• har bir darsdan keyin test va natija\n` +
    `• ${config.supportUsername} orqali yordam`,
  payButton: "💳 To'lov qilish",

  paymentDetails: (amount: number): string =>
    `💳 To'lov ma'lumotlari\n\n` +
    `Karta raqami: <code>${escapeHtml(config.cardNumber)}</code>\n` +
    `Karta egasi: ${escapeHtml(config.cardHolder)}\n` +
    `To'lov summasi: <code>${amount}</code> so'm\n\n` +
    `❗️ Aynan shu summani o'tkazing (oxirgi raqamlari ham muhim, shu orqali to'lovingizni topamiz).\n` +
    `To'lovdan so'ng chek rasmini (yoki PDF) shu yerga yuboring.`,
  alreadyPaid: "✅ Kurs uchun to'lov allaqachon to'langan. Darsingizni davom ettiring.",
  paymentUnavailable:
    `Kechirasiz, hozir to'lov yaratib bo'lmadi. Birozdan so'ng qayta urinib ko'ring. ` +
    `Muammo davom etsa, ${config.supportUsername} ga yozing.`,

  receiptReceived: "🧾 Chek qabul qilindi va tekshirilmoqda. Tasdiqlangach sizga xabar beramiz.",
  receiptAlreadyPending: `Chekingiz allaqachon tekshirilmoqda. Savol bo'lsa, "🆘 Yordam" bo'limidan foydalaning.`,
  receiptNoPayment: `Avval "💳 To'lov qilish" tugmasini bosing, to'lovni amalga oshiring va keyin chekni yuboring.`,
  receiptWrongType: "Chek sifatida faqat rasm yoki PDF fayl qabul qilinadi.",
  receiptForwardFailed:
    `Kechirasiz, chekni yuborib bo'lmadi. Iltimos, birozdan so'ng qayta yuboring. ` +
    `Muammo davom etsa, ${config.supportUsername} ga yozing.`,

  paymentApproved: "🎉 To'lovingiz tasdiqlandi! Endi barcha darslar siz uchun ochiq.",
  paymentRejected:
    `❌ To'lovingiz tasdiqlanmadi. Agar xatolik bo'lsa, ${config.supportUsername} ga yozing. ` +
    `Qaytadan to'lov qilish uchun "💳 Kursni sotib olish" tugmasini bosing.`,

  adminApproveButton: "✅ Tasdiqlash",
  adminRejectButton: "❌ Rad etish",
  adminReceiptCaption: (info: AdminReceiptInfo): string =>
    `🧾 Yangi to'lov cheki\n\n` +
    `Ism: ${escapeHtml(info.firstName)}\n` +
    `Username: ${info.username === null ? "—" : `@${escapeHtml(info.username)}`}\n` +
    `Telegram ID: <code>${info.userId}</code>\n` +
    `Manba: ${info.source === null ? "—" : escapeHtml(info.source)}\n` +
    `Summa: <code>${info.amount}</code> so'm\n` +
    `Sana: ${formatDateTime(info.createdAt)}`,
  adminDecisionLine: (approved: boolean, adminName: string, at: Date): string =>
    `${approved ? "✅ Tasdiqlandi" : "❌ Rad etildi"} — ${escapeHtml(adminName)}, ${formatDateTime(at)}`,
  adminDecided: (approved: boolean): string => (approved ? "To'lov tasdiqlandi." : "To'lov rad etildi."),
  adminAlreadyDecided: (approved: boolean, adminName: string): string =>
    `Bu to'lov allaqachon ${approved ? "tasdiqlangan" : "rad etilgan"}: ${adminName}.`,
  lessonNotReached: (number: number): string =>
    `${number}-dars hali ochilmagan. Avval oldingi darslarni va testlarni tugating.`,
  lessonNotFound: "Bunday dars topilmadi.",
  lessonUnavailable:
    `Kechirasiz, darsni yuborib bo'lmadi. Birozdan so'ng qayta urinib ko'ring. ` +
    `Muammo davom etsa, ${config.supportUsername} ga yozing.`,

  lessonsListTitle: "Ochiq darslaringiz. Ko'rish uchun birini tanlang:",

  progress: (passed: number, total: number, currentLesson: number): string =>
    `${progressBar(passed, total)} ${passed}/${total}\n\n` +
    `✅ O'tilgan darslar: ${passed} ta\n` +
    `📍 Hozirgi dars: ${currentLesson}-dars`,

  help: `Savollaringiz bo'lsa, yordam xizmatiga yozing: ${config.supportUsername}`,

  reminderFirst:
    `👋 ${config.courseName} kursidagi bepul darsni ko'rdingizmi?\n\n` +
    `Qolgan darslarni ochish uchun kursni sotib oling. Kurs narxi: ${formatAmount(config.priceUzs)} so'm.`,
  reminderSecond:
    `⏳ ${config.courseName} kursi sizni kutmoqda!\n\n` +
    `To'lovdan so'ng barcha ${config.lessonCount} ta dars va testlar ochiladi. ` +
    `Savollar bo'lsa, ${config.supportUsername} ga yozing.`,

  stats: (report: StatsReport): string =>
    `📊 Statistika\n\n` +
    `👥 Foydalanuvchilar: ${formatAmount(report.totalUsers)}\n` +
    `🆕 Bugun: ${report.newToday} · 7 kunda: ${report.newLast7Days}\n` +
    `💳 To'laganlar: ${report.paidUsers} (${percent(report.paidUsers, report.totalUsers)}%)\n` +
    `💰 Tushum: ${formatAmount(report.revenue)} so'm\n` +
    `🧾 Tekshiruvda: ${report.pendingPayments} · To'lov kutilmoqda: ${report.awaitingPayments}\n` +
    `🚫 Bloklaganlar: ${report.blockedUsers}\n\n` +
    `📚 Darsdan o'tganlar:\n${funnelLines(report.passedByLesson)}\n\n` +
    `🔗 Manbalar (foydalanuvchi / to'lagan):\n${sourceLines(report.sources)}`,

  broadcastAudience: broadcastAudienceLabels,
  broadcastConfirmButton: "✅ Yuborish",
  broadcastCancelButton: "✖️ Bekor qilish",
  broadcastReplyRequired: "Tarqatmoqchi bo'lgan xabaringizga javob (reply) qilib /broadcast yozing.",
  broadcastOwnMessage: "Botning o'z xabarini tarqatib bo'lmaydi. Xabarni guruhga o'zingiz yuboring va unga /broadcast bilan javob yozing.",
  broadcastBusy: "Hozir boshqa tarqatma davom etmoqda. U tugagach, qayta urinib ko'ring.",
  broadcastChooseAudience: "📣 Bu xabar kimlarga yuborilsin?",
  broadcastConfirm: (audience: BroadcastAudience, count: number): string =>
    `📣 Auditoriya: ${broadcastAudienceLabels[audience]}\n` +
    `Qabul qiluvchilar: ${formatAmount(count)} ta\n\n` +
    `Yuborishni tasdiqlaysizmi?`,
  broadcastNoRecipients: (audience: BroadcastAudience): string =>
    `"${broadcastAudienceLabels[audience]}" bo'yicha qabul qiluvchi yo'q. Boshqa auditoriyani tanlang.`,
  broadcastQueued: (audience: BroadcastAudience, total: number): string =>
    `⏳ Tarqatma navbatga qo'yildi: ${broadcastAudienceLabels[audience]}, ${formatAmount(total)} ta qabul qiluvchi.\n` +
    `Bir daqiqa ichida boshlanadi, jarayon shu xabarda ko'rinadi.`,
  broadcastStarted: "Tarqatma navbatga qo'yildi.",
  broadcastCancelled: "Tarqatma bekor qilindi.",
  broadcastProgress: (broadcast: Broadcast): string =>
    `📣 Tarqatma davom etmoqda: ${broadcastAudienceLabels[broadcast.audience]}\n\n` +
    `${broadcastCounters(broadcast)}\n` +
    `Jami: ${broadcast.sent + broadcast.failed + broadcast.blocked}/${broadcast.total}`,
  broadcastFinished: (broadcast: Broadcast): string =>
    `🏁 Tarqatma yakunlandi: ${broadcastAudienceLabels[broadcast.audience]}\n\n${broadcastCounters(broadcast)}`,
  broadcastAborted: (broadcast: Broadcast): string =>
    `⛔️ Tarqatma to'xtatildi: asl xabar o'chirilgan.\n\n${broadcastCounters(broadcast)}`,

  startRequired: "Boshlash uchun /start buyrug'ini yuboring.",
  unknownMessage: "Tushunmadim. Iltimos, pastdagi menyudan foydalaning.",
  staleCallback: "Bu tugma eskirgan. Menyudan qayta tanlang yoki /start ni yuboring.",
  genericError: `Kutilmagan xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring. Muammo davom etsa, ${config.supportUsername} ga yozing.`,
};
