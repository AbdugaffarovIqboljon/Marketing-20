import { config } from "./config";

const PROGRESS_BAR_LENGTH = 10;

function formatAmount(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function progressBar(passed: number, total: number): string {
  const filled = Math.min(PROGRESS_BAR_LENGTH, Math.round((passed / total) * PROGRESS_BAR_LENGTH));
  return "▰".repeat(filled) + "▱".repeat(PROGRESS_BAR_LENGTH - filled);
}

export const texts = {
  menu: {
    lessons: "📚 Darslarim",
    progress: "📊 Progress",
    help: "🆘 Yordam",
  },

  welcome: (firstName: string): string =>
    `Assalomu alaykum, ${firstName}! 👋\n\n` +
    `${config.courseName} kursiga xush kelibsiz.\n` +
    `Kursda ${config.lessonCount} ta video dars bor. 1-dars bepul, qolgan darslar to'lovdan so'ng ochiladi.\n` +
    `Kurs narxi: ${formatAmount(config.priceUzs)} so'm.\n\n` +
    `Pastdagi menyudan foydalaning.`,

  lessonLabel: (number: number, title: string): string => `${number}-dars. ${title}`,
  watchedButton: "Ko'rdim, testga o'tish",
  quizComingSoon: "Test tez orada qo'shiladi. Biroz sabr qiling 🙂",

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

  lessonLocked: (number: number): string =>
    `🔒 ${number}-dars yopiq.\n` +
    `Keyingi darslarni ochish uchun kursga to'lov qilish kerak. To'lov bo'limi tez orada qo'shiladi.`,
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

  startRequired: "Boshlash uchun /start buyrug'ini yuboring.",
  unknownMessage: "Tushunmadim. Iltimos, pastdagi menyudan foydalaning.",
  staleCallback: "Bu tugma eskirgan. Menyudan qayta tanlang yoki /start ni yuboring.",
  genericError: `Kutilmagan xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring. Muammo davom etsa, ${config.supportUsername} ga yozing.`,
};
