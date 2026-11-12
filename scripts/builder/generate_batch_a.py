# scripts/builder/generate_batch_a.py
# Pool generator for: football, sports, celebrities, famous_figures, music
import json, re

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

def pick_unique(candidates, target_count, seen_global, formatter=None):
    chosen = []
    for raw in candidates:
        text = raw if isinstance(raw, str) else raw[0]
        n = norm(text)
        if n not in existing and n not in seen_global:
            seen_global.add(n)
            if formatter:
                chosen.append(formatter(raw))
            else:
                chosen.append(raw)
            if len(chosen) == target_count:
                break
    if len(chosen) < target_count:
        raise ValueError(f"Not enough unique candidates! Needed {target_count}, got {len(chosen)}")
    return chosen

print("Batch A helper ready.")
