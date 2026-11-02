import { INITIAL_CATEGORIES } from '../src/data/categories';
import { INITIAL_WORDS, validateWordBank } from '../src/data/initialWordBank';

const report = validateWordBank(INITIAL_WORDS, INITIAL_CATEGORIES);

console.log('====================================================');
console.log('گزارش اعتبارسنجی بانک کلمات ادابازی (Word Bank QA)');
console.log('====================================================');
console.log(`مجموع کل کلمات و عبارات: ${report.totalWords}`);
console.log(`کلمات ۱۹ دسته اصلی: ${report.regularWordsCount}`);
console.log(`عبارات موضوع طلایی (۳۰ امتیازی): ${report.goldenWordsCount}`);
console.log('----------------------------------------------------');

for (const stat of report.categoryStats) {
  console.log(
    `${stat.categoryName.padEnd(16)} | آسان: ${String(stat.easy).padStart(3)} | متوسط: ${String(
      stat.medium
    ).padStart(3)} | سخت: ${String(stat.hard).padStart(3)} | کل: ${stat.total}`
  );
}

console.log('----------------------------------------------------');
console.log('نسبت محتوایی دسته فوتبال:');
console.log(
  `  بازیکنان: ${report.footballRatios.playerPercent}% | سایر موضوعات فوتبالی: ${report.footballRatios.otherPercent}%`
);
console.log(
  `  در میان بازیکنان -> خارجی: ${report.footballRatios.foreignAmongPlayersPercent}% | ایرانی: ${report.footballRatios.iranianAmongPlayersPercent}%`
);
console.log('نسبت محتوایی دسته سلبریتی:');
console.log(
  `  کل -> ایرانی: ${report.celebrityRatios.overallIranianPercent}% | خارجی: ${report.celebrityRatios.overallForeignPercent}%`
);
console.log(
  `  به تفکیک سطح -> آسان: ${report.celebrityRatios.byDifficulty.easy.iranianPercent}% | متوسط: ${report.celebrityRatios.byDifficulty.medium.iranianPercent}% | سخت: ${report.celebrityRatios.byDifficulty.hard.iranianPercent}%`
);
console.log('----------------------------------------------------');
console.log(`شناسه‌های تکراری: ${report.duplicateIds.length}`);
console.log(`واژه‌های تکراری: ${report.duplicateTexts.length}`);
if (report.duplicateTexts.length > 0) {
  for (const dup of report.duplicateTexts) {
    console.log('  تکرار:', dup.normalized, dup.items);
  }
}
console.log(`کلمات بدون دسته معتبر: ${report.orphanCategoryWords.length}`);
console.log(`کلمات با سطح نامعتبر: ${report.invalidDifficultyWords.length}`);
console.log(`داده‌های ناقص: ${report.incompleteWords.length}`);
console.log(`موارد نیازمند بررسی انسانی: ${report.needsHumanReview.length}`);

if (
  report.duplicateIds.length > 0 ||
  report.duplicateTexts.length > 0 ||
  report.orphanCategoryWords.length > 0 ||
  report.invalidDifficultyWords.length > 0 ||
  report.incompleteWords.length > 0
) {
  process.exit(1);
}
console.log('✅ تمام تست‌های اعتبارسنجی بانک کلمات با موفقیت کامل انجام شد!');
