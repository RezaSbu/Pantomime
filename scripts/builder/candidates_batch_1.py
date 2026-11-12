# scripts/builder/candidates_batch_1.py
# Exactly fills: football, sports, celebrities, famous_figures, music
# Target quotas: easy: 27, medium: 81, hard: 162

# 1. FOOTBALL
from scripts.builder.data_batch_a import football_easy_candidates, football_medium_candidates, football_hard_candidates

# 2. SPORTS
from scripts.builder.pool_group_sports_celebs import sports_easy, sports_medium, sports_hard

# 3. CELEBRITIES
celebs_easy = [
    ("نوید پورفرج", "ic"), ("الناز ملک", "ic"), ("مهدی حسینی‌نیا", "ic"),
    ("مجید واشقانی", "ic"), ("علی اوجی", "ic"), ("نرگس محمدی", "ic"),
    ("نیوشا ضیغمی", "ic"), ("بهاره رهنما", "ic"), ("فلور نظری", "ic"),
    ("سید جواد رضویان", "ic"), ("یوسف صیادی", "ic"), ("حسین سلیمانی", "ic"),
    ("سیاوش خیرابی", "ic"), ("محسن کیایی", "ic"), ("مصطفی کیایی", "ic"),
    ("آرمان درویش", "ic"), ("امیرحسین آرمان", "ic"), ("ساقی حاجی‌پور", "ic"),
    ("شیدا خلیق", "ic"), ("سوگل طهماسبی", "ic"), ("مریم مومن", "ic"),
    ("المیرا دهقانی", "ic"), ("ندا جبرائیلی", "ic"), ("لاله مرزبان", "ic"),
    ("ماهور الوند", "ic"), ("زیبا کرمعلی", "ic"), ("مینا وحید", "ic"),
    ("سمیرا حسن‌پور", "ic"), ("روشنک گرامی", "ic"), ("الهه حصاری", "ic"),
    ("تیموتی شالامی", "fc"), ("زندیا کلمن", "fc"), ("مارگو رابی", "fc"),
    ("رایان گاسلینگ", "fc"), ("دواین جانسون", "fc"), ("جیسون استاتهام", "fc")
]

from scripts.builder.pool_group_sports_celebs import celebs_medium, celebs_hard

# 4. FAMOUS FIGURES
from scripts.builder.pool_group_sports_celebs import famous_easy, famous_medium, famous_hard

# 5. MUSIC
from scripts.builder.pool_group_sports_celebs import music_easy, music_medium, music_hard
