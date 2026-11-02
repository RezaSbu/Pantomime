import { CategoryItem } from '../types/game';

/**
 * The exact 18 initial categories specified in Section 6 of the product specification.
 * Note: Golden Challenge ('golden') is handled as an independent special challenge pool,
 * never mixed into regular category random selection.
 */
export const INITIAL_CATEGORIES: CategoryItem[] = [
  {
    id: 'football',
    name: 'فوتبال',
    description: 'بازیکنان ایرانی و خارجی، باشگاه‌ها، مربیان، جام‌ها و اصطلاحات فوتبالی',
    icon: 'Trophy',
    enabledByDefault: true,
  },
  {
    id: 'sports',
    name: 'ورزش',
    description: 'رشته‌های ورزشی، قهرمانان المپیک، فنون و رقابت‌های ورزشی',
    icon: 'Medal',
    enabledByDefault: true,
  },
  {
    id: 'movies',
    name: 'فیلم',
    description: 'آثار ماندگار و شناخته‌شده سینمای ایران و جهان',
    icon: 'Film',
    enabledByDefault: true,
  },
  {
    id: 'series',
    name: 'سریال',
    description: 'سریال‌های محبوب تلویزیونی و نمایش خانگی ایرانی و خارجی',
    icon: 'Tv',
    enabledByDefault: true,
  },
  {
    id: 'cartoons',
    name: 'کارتون',
    description: 'انیمیشن‌ها و کارتون‌های خاطره‌انگیز ایرانی و جهانی',
    icon: 'Smile',
    enabledByDefault: true,
  },
  {
    id: 'celebrities',
    name: 'سلبریتی',
    description: 'بازیگران، خوانندگان، مجریان، کمدین‌ها و چهره‌های شناخته‌شده',
    icon: 'Star',
    enabledByDefault: true,
  },
  {
    id: 'famous_figures',
    name: 'مشاهیر',
    description: 'دانشمندان، شاعران، مخترعان، فیلسوفان و شخصیت‌های ماندگار تاریخی',
    icon: 'GraduationCap',
    enabledByDefault: true,
  },
  {
    id: 'books',
    name: 'کتاب',
    description: 'شاهکارهای ادبیات ایران و جهان، رمان‌ها و کتاب‌های مشهور',
    icon: 'BookOpen',
    enabledByDefault: true,
  },
  {
    id: 'music',
    name: 'موسیقی',
    description: 'سازهای ایرانی و جهانی، سبک‌ها، قطعات ماندگار و اصطلاحات موسیقی',
    icon: 'Music',
    enabledByDefault: true,
  },
  {
    id: 'places',
    name: 'اماکن',
    description: 'بناهای تاریخی، جاذبه‌های گردشگری و مکان‌های عمومی و نمادین',
    icon: 'Landmark',
    enabledByDefault: true,
  },
  {
    id: 'cities_countries',
    name: 'شهر و کشور',
    description: 'شهرهای ایران و جهان و کشورهای شناخته‌شده با ویژگی‌های نمادین',
    icon: 'Globe',
    enabledByDefault: true,
  },
  {
    id: 'proverbs',
    name: 'ضرب‌المثل',
    description: 'ضرب‌المثل‌های اصیل و رایج فارسی با امتیاز و زمان اختصاصی',
    icon: 'Quote',
    isProverb: true,
    enabledByDefault: true,
  },
  {
    id: 'abstract',
    name: 'مفاهیم انتزاعی',
    description: 'مفاهیم ذهنی و موقعیت‌های معنایی چالش‌برانگیز با قابلیت اجرای پانتومیم',
    icon: 'Lightbulb',
    enabledByDefault: true,
  },
  {
    id: 'animals',
    name: 'حیوانات',
    description: 'پستانداران، پرندگان، آبزیان و جانوران خاص با رفتارهای نمایشی',
    icon: 'PawPrint',
    enabledByDefault: true,
  },
  {
    id: 'food',
    name: 'غذا',
    description: 'غذاهای اصیل ایرانی، دسرها، نوشیدنی‌ها و خوراکی‌های ملل',
    icon: 'UtensilsCrossed',
    enabledByDefault: true,
  },
  {
    id: 'jobs',
    name: 'شغل',
    description: 'مشاغل سنتی، تخصصی، صنعتی و حرفه‌های روزمره و خاص',
    icon: 'Briefcase',
    enabledByDefault: true,
  },
  {
    id: 'objects',
    name: 'اشیاء',
    description: 'ابزارها، وسایل خانه، اشیای خاطره‌انگیز و وسایل کاربردی',
    icon: 'Package',
    enabledByDefault: true,
  },
  {
    id: 'tech_science',
    name: 'تکنولوژی و علم',
    description: 'فناوری‌های نوین، پدیده‌های علمی، فضا، پزشکی و مهندسی',
    icon: 'Cpu',
    enabledByDefault: true,
  },
];

export const GOLDEN_CATEGORY_META: CategoryItem = {
  id: 'golden',
  name: 'موضوع طلایی',
  description: 'چالش ویژه ۳۰ امتیازی با عبارات چندمرحله‌ای و نیازمند خلاقیت بالا',
  icon: 'Crown',
  enabledByDefault: true,
};
