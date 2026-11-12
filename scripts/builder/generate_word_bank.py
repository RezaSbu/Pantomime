# scripts/builder/generate_word_bank.py
# Comprehensive expansion generator for all 20 categories
import json, re, os

with open('/tmp/existing_words.json') as f:
    existing = set(json.load(f))

def norm(s):
    s = s.strip()
    s = s.replace('ي', 'ی').replace('ى', 'ی').replace('ك', 'ک').replace('ة', 'ه').replace('ؤ', 'و')
    s = re.sub(r'[إأآ]', 'ا', s)
    s = re.sub(r'[\u064B-\u065F\u0670\u0640]', '', s)
    s = re.sub(r'[\u200C\u200B\u00A0\-_،,.;:؟?!«»()\"\'\[\]]', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip().lower()

seen_global = set()

def pick_clean(candidates, needed, cat_name, tier):
    picked = []
    for c in candidates:
        text = c if isinstance(c, str) else c[0]
        # if c is formatted code like "fp('...')", extract inner text
        m = re.search(r"'(.*?)'", text)
        clean_text = m.group(1) if m and ('(' in text) else text
        n = norm(clean_text)
        if n not in existing and n not in seen_global:
            seen_global.add(n)
            picked.append(c)
            if len(picked) == needed:
                break
    if len(picked) < needed:
        raise ValueError(f"Category {cat_name} [{tier}]: needed {needed}, but only got {len(picked)} unique items!")
    return picked

print("Generator framework initialized.")
