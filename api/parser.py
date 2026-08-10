"""Expense text parsing — OpenAI with local fallback (mirrors app/src/lib/ai-parse.ts)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from openai import OpenAI

IST = ZoneInfo("Asia/Kolkata")

CATEGORIES = (
    "Food, Travel & Commute, Bills, Q-Commerce, Entertainment, Investments, Shopping, Others"
)

CAT_KEYWORDS: dict[str, list[str]] = {
    "Food": ["food", "eat", "restaurant", "cafe", "coffee", "starbucks", "lunch", "dinner"],
    "Travel & Commute": ["metro", "bus", "auto", "cab", "ola", "uber", "fuel", "parking", "rapido"],
    "Bills": ["bill", "recharge", "subscription", "apple care", "applecare", "rent", "emi", "insurance"],
    "Q-Commerce": ["blinkit", "zepto", "swiggy", "zomato", "instamart"],
    "Entertainment": ["movie", "netflix", "spotify", "prime", "cinema"],
    "Investments": ["zerodha", "groww", "sip", "mutual fund", "invest"],
    "Shopping": ["amazon", "flipkart", "myntra", "shop", "mall"],
    "Others": ["misc", "other"],
}


def today_ist() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def yesterday_ist() -> str:
    return (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")


def now_time_ist() -> str:
    return datetime.now(IST).strftime("%H:%M")


def norm_cat(raw: str) -> str:
    r = (raw or "").strip().lower()
    mapping = {
        "travel": "Travel & Commute",
        "commute": "Travel & Commute",
        "transport": "Travel & Commute",
        "food": "Food",
        "bills": "Bills",
        "q-commerce": "Q-Commerce",
        "entertainment": "Entertainment",
        "investments": "Investments",
        "shopping": "Shopping",
    }
    for key, val in mapping.items():
        if key in r:
            return val
    for cat in CAT_KEYWORDS:
        if cat.lower() == r:
            return cat
    return "Others"


def suggest_cat(text: str) -> str | None:
    n = text.lower()
    for cat, kws in CAT_KEYWORDS.items():
        if any(kw in n for kw in kws):
            return cat
    return None


def parse_tags(text: str) -> list[str]:
    return list({t.lower() for t in re.findall(r"#[\w-]+", text)})


def extract_amount(text: str) -> float:
    m = re.search(r"(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)", text, re.I)
    if m:
        return float(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)", text)
    return float(m.group(1)) if m else 0.0


def parse_date(text: str) -> str:
    lower = text.lower()
    if "yesterday" in lower:
        return yesterday_ist()
    if "today" in lower or "just now" in lower:
        return today_ist()
    m = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b", text)
    if m:
        day, month = m.group(1).zfill(2), m.group(2).zfill(2)
        year = m.group(3) or str(datetime.now(IST).year)
        if len(year) == 2:
            year = f"20{year}"
        return f"{year}-{month}-{day}"
    return today_ist()


def parse_payment(text: str) -> str:
    if re.search(r"\b(credit card|cc|card)\b", text, re.I):
        return "Credit Card"
    return "UPI"


def clean_note(text: str) -> str:
    note = re.sub(r"(?i)(?:i\s+)?(?:spent|paid|spend)\s*", "", text)
    note = re.sub(r"(?i)(?:₹|rs\.?|inr)\s*\d+(?:\.\d+)?", "", note)
    note = re.sub(r"(?i)\b\d+(?:\.\d+)?\s*(?:rupees?)?", "", note)
    note = re.sub(r"(?i)\b(for|on|at|in|today|yesterday|upi|credit card)\b", " ", note)
    return re.sub(r"\s+", " ", note).strip()[:120]


def parse_local(text: str) -> dict | None:
    trimmed = text.strip()
    if not trimmed:
        return None
    amount = extract_amount(trimmed)
    if amount <= 0:
        return None
    note = clean_note(trimmed) or trimmed[:80]
    category = suggest_cat(note) or suggest_cat(trimmed) or "Others"
    return {
        "amount": amount,
        "category": category,
        "note": note,
        "payment": parse_payment(trimmed),
        "date": parse_date(trimmed),
        "time": now_time_ist(),
        "location": "",
        "tags": parse_tags(trimmed),
        "recurring": bool(re.search(r"\b(subscription|monthly|recurring|apple care)\b", trimmed, re.I)),
        "split": 1,
        "currency": "INR",
    }


def parse_openai(text: str, api_key: str) -> dict | None:
    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.1,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    f"You parse Indian personal expense sentences into JSON. Today is {today_ist()} (IST). "
                    f"Categories: {CATEGORIES}. Payment: UPI or Credit Card. "
                    "Keys: amount, category, note, payment, date (YYYY-MM-DD), location, tags (array), "
                    "recurring (bool), split (1-10)."
                ),
            },
            {"role": "user", "content": text},
        ],
    )
    raw = resp.choices[0].message.content
    if not raw:
        return None
    parsed = json.loads(raw)
    amount = float(parsed.get("amount") or 0)
    if amount <= 0:
        return None
    return {
        "amount": amount,
        "category": norm_cat(str(parsed.get("category", "Others"))),
        "note": str(parsed.get("note") or clean_note(text)).strip(),
        "payment": "Credit Card"
        if "credit" in str(parsed.get("payment", "")).lower()
        else "UPI",
        "date": str(parsed.get("date") or today_ist())[:10],
        "time": now_time_ist(),
        "location": str(parsed.get("location") or "").strip(),
        "tags": parsed.get("tags") if isinstance(parsed.get("tags"), list) else parse_tags(text),
        "recurring": bool(parsed.get("recurring")),
        "split": min(10, max(1, int(parsed.get("split") or 1))),
        "currency": "INR",
    }


def parse_expense_text(text: str, openai_api_key: str = "") -> tuple[dict, str]:
    if openai_api_key:
        try:
            ai = parse_openai(text, openai_api_key)
            if ai:
                return ai, "ai"
        except Exception:
            local = parse_local(text)
            if local:
                return local, "local"
            raise
    local = parse_local(text)
    if not local:
        raise ValueError('Could not parse expense. Try: "spent 50 at Starbucks"')
    return local, "local"
