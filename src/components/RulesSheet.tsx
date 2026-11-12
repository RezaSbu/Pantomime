import { Crown, Lock, RefreshCw, Trophy, Volume2, X, Zap } from 'lucide-react';
import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { formatNum } from '../utils/format';

export const RulesSheet: React.FC = () => {
  const isRulesOpen = useGameStore((s) => s.isRulesOpen);
  const setRulesOpen = useGameStore((s) => s.setRulesOpen);
  const settings = useGameStore((s) => s.settings);

  if (!isRulesOpen) return null;

  const p = settings.persianDigits;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => setRulesOpen(false)}
    >
      <div
        className="w-full max-w-lg max-h-[88dvh] rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-gentle-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            قوانین مسابقه ادابازی
          </h2>
          <button
            type="button"
            onClick={() => setRulesOpen(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="بستن راهنما"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>قفل اختصاصی موضوع و سطح برای هر تیم</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              در نوبت هر تیم، همان تیم از بین تمام ۱۹ موضوع و ۳ سطح دشواری (آسان، متوسط، سخت) انتخاب می‌کند. هر موضوع و سطحی که یک تیم انتخاب کند <strong>فقط برای همان تیم بسته می‌شود</strong> و سایر تیم‌ها همچنان می‌توانند همان موضوع و سطح را برای خودشان انتخاب کنند.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-950 p-4 space-y-2.5 tabular-nums">
            <div className="font-extrabold text-slate-900 dark:text-slate-200 flex items-center gap-2 text-xs sm:text-sm">
              <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>امتیاز پایه و سیستم پله‌ای امتیاز تایم</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              امتیاز تایم به‌صورت <strong>پله‌ای</strong> محاسبه می‌شود؛ هرچه زودتر پاسخ دهید پله بالاتر می‌گیرید و با گذشت زمان پله‌به‌پله کمتر می‌شود:
            </p>
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs space-y-1.5">
              <div className="pt-1 flex justify-between gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">موضوعات عادی — آسان ({formatNum(35, p)} ثانیه)</span>
                <span>{formatNum(2, p)} امتیاز · تا {formatNum(10, p)}ث (+{formatNum(2, p)}) · تا {formatNum(20, p)}ث (+{formatNum(1, p)})</span>
              </div>
              <div className="pt-1.5 flex justify-between gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">موضوعات عادی — متوسط ({formatNum(70, p)} ثانیه)</span>
                <span>{formatNum(4, p)} امتیاز · تا {formatNum(18, p)}ث (+{formatNum(3, p)}) · تا {formatNum(35, p)}ث (+{formatNum(2, p)}) · تا {formatNum(50, p)}ث (+{formatNum(1, p)})</span>
              </div>
              <div className="pt-1.5 flex justify-between gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">موضوعات عادی — سخت ({formatNum(110, p)} ثانیه)</span>
                <span>{formatNum(6, p)} امتیاز · تا {formatNum(25, p)}ث (+{formatNum(4, p)}) · تا {formatNum(50, p)}ث (+{formatNum(2, p)}) · تا {formatNum(75, p)}ث (+{formatNum(1, p)})</span>
              </div>
              <div className="pt-1.5 flex justify-between gap-2 text-emerald-800 dark:text-emerald-300">
                <span className="font-bold">ضرب‌المثل ({formatNum(80, p)} / {formatNum(100, p)} / {formatNum(120, p)} ثانیه)</span>
                <span>{formatNum(5, p)} / {formatNum(8, p)} / {formatNum(10, p)} امتیاز + امتیاز تایم پله‌ای تا +{formatNum(5, p)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/25 p-4 space-y-1.5 tabular-nums">
            <h3 className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-2 text-sm">
              <Crown className="w-4 h-4 text-amber-500 shrink-0" />
              <span>قانون موضوع طلایی {formatNum(30, p)} امتیازی (فقط دور آخر!)</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              موضوع طلایی فقط در <strong>آخرین دور مسابقه</strong> باز می‌شود ({formatNum(170, p)} ثانیه = ۲ دقیقه و ۵۰ ثانیه). امتیاز تایم پله‌ای: تا {formatNum(45, p)}ث (+{formatNum(10, p)})، تا {formatNum(90, p)}ث (+{formatNum(6, p)}) و تا {formatNum(130, p)}ث (+{formatNum(3, p)}).
            </p>
          </div>

          <div className="rounded-2xl border border-rose-500/40 bg-rose-50/60 dark:bg-rose-950/25 p-4 space-y-1.5 tabular-nums">
            <h3 className="font-extrabold text-rose-900 dark:text-rose-300 flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-rose-500 shrink-0 fill-current" />
              <span>قانون هیجان‌انگیز «ریسک ۲۰ ثانیه‌ای» (کلمات ۶ امتیازی)</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              به ازای هر ۵ دور بازی، هر تیم <strong>۱ فرصت ریسک ۲۰ ثانیه‌ای</strong> دریافت می‌کند (با حداقل ۱ فرصت حتی در بازی‌های کوتاه). اجراکننده پس از دیدن کلمه ۶ امتیازی (به جز موضوعات کودکان و ضرب‌المثل) می‌تواند ریسک کند: زمان به <strong>تنها ۲۰ ثانیه</strong> فشرده می‌شود؛ در صورت حدس موفق تیم <strong>+{formatNum(20, p)} امتیاز</strong> و در صورت عدم موفقیت <strong>−{formatNum(5, p)} امتیاز</strong> دریافت خواهد کرد. خطاهای حین اجرا نیز اعمال می‌گردد.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-rose-500" />
                <span>خطا (حداکثر ۳ بار −{formatNum(1, p)}) و تعویض (−{formatNum(1, p)})</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                هر خطای اجراکننده (مثل حرف زدن یا اشاره مستقیم) ۱ امتیاز کم می‌کند و در هر کلمه <strong>حداکثر تا ۳ بار</strong> امکان ثبت خطا وجود دارد و پس از آن دکمه خطا قفل می‌شود. تعویض کلمه هم ۱ بار و با کسر ۱ امتیاز مجاز است و دکمه «غلط» برای ثبت عدم پاسخ صحیح است.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>ترتیب چرخشی و جزئیات نوبت</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                اجرای هر دور همیشه از <strong>تیم اول</strong> شروع شده و چرخشی ادامه می‌یابد. در پایان هر نوبت هم ریز امتیاز کلمه، تایم، تعویض و خطا نمایش داده می‌شود.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 pt-1">
            <Volume2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>افکت‌های صوتی هیجانی شروع مسابقه، تیک‌تاک ساعت با شمارش تند ۱۰ ثانیه پایانی، پاسخ صحیح و بوق پایان زمان از نوار بالا قابل کنترل هستند.</span>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setRulesOpen(false)}
            className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm transition-colors"
          >
            متوجه شدم، بزن بریم!
          </button>
        </div>
      </div>
    </div>
  );
};
