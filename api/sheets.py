"""Google Sheets storage — mirrors google-apps-script.js behaviour."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from functools import lru_cache

import gspread
from google.oauth2.service_account import Credentials

from config import Settings, get_settings, load_service_account_info

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
TX_HEADERS = [
    "Date",
    "Time",
    "Category",
    "Amount",
    "Mode of Payment",
    "Note",
    "Split",
    "Paid",
    "Location",
    "Tags",
    "Id",
]
CATS_LIST = [
    "Food",
    "Travel & Commute",
    "Bills",
    "Q-Commerce",
    "Entertainment",
    "Investments",
    "Shopping",
    "Others",
]
SETTINGS_SHEET = "Settings"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def month_sheet_name(date_str: str) -> str | None:
    parts = str(date_str).split("-")
    if len(parts) < 2:
        return None
    return f"{MONTH_NAMES[int(parts[1]) - 1]} {parts[0]}"


def gen_id() -> str:
    return uuid.uuid4().hex[:8]


@lru_cache
def _client(settings: Settings) -> gspread.Client:
    info = load_service_account_info(settings)
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return gspread.authorize(creds)


def spreadsheet(settings: Settings | None = None):
    s = settings or get_settings()
    if not s.google_spreadsheet_id:
        raise ValueError("GOOGLE_SPREADSHEET_ID is not set")
    return _client(s).open_by_key(s.google_spreadsheet_id)


def get_or_create_month_sheet(ss: gspread.Spreadsheet, name: str) -> gspread.Worksheet:
    try:
        sheet = ss.worksheet(name)
    except gspread.WorksheetNotFound:
        sheet = ss.add_worksheet(title=name, rows=500, cols=len(TX_HEADERS))
        sheet.append_row(TX_HEADERS)
    else:
        row1 = sheet.row_values(1)
        if not row1 or not row1[0]:
            sheet.update("A1", [TX_HEADERS])
    return sheet


def all_month_sheets(ss: gspread.Spreadsheet) -> list[gspread.Worksheet]:
    return [ws for ws in ss.worksheets() if re.match(r"^[A-Z][a-z]{2} \d{4}$", ws.title)]


def row_to_txn(headers: list[str], row: list) -> dict:
    obj: dict = {}
    for i, h in enumerate(headers):
        val = row[i] if i < len(row) else ""
        if h == "Time" and isinstance(val, datetime):
            obj[h] = val.strftime("%H:%M")
        elif h == "Date" and isinstance(val, datetime):
            obj[h] = val.strftime("%Y-%m-%d")
        else:
            obj[h] = str(val or "").strip()
    return obj


def read_all_transactions(settings: Settings | None = None) -> list[dict]:
    ss = spreadsheet(settings)
    sheets = all_month_sheets(ss)
    legacy = None
    try:
        legacy = ss.worksheet("Transactions")
    except gspread.WorksheetNotFound:
        pass
    if legacy:
        sheets.append(legacy)

    rows: list[dict] = []
    for sheet in sheets:
        data = sheet.get_all_values()
        if len(data) < 2:
            continue
        headers = [h.strip() for h in data[0]]
        for row in data[1:]:
            if not row or not row[0]:
                continue
            rows.append(row_to_txn(headers, row))
    return rows


def append_transaction(body: dict, settings: Settings | None = None) -> dict:
    ss = spreadsheet(settings)
    name = month_sheet_name(body["Date"])
    if not name:
        raise ValueError(f"Invalid date: {body['Date']}")
    sheet = get_or_create_month_sheet(ss, name)
    txn_id = body.get("Id") or gen_id()
    tags = body.get("Tags") or ""
    if isinstance(tags, list):
        tags = " ".join(tags)
    sheet.append_row(
        [
            body["Date"],
            body["Time"],
            body["Category"],
            int(round(float(body["Amount"]))),
            body.get("Mode of Payment") or body.get("payment") or "UPI",
            body.get("Note") or "",
            body.get("Split") or 1,
            body.get("Paid") or body.get("paid_count") or 0,
            body.get("Location") or "",
            tags,
            txn_id,
        ],
        value_input_option="USER_ENTERED",
    )
    return {"ok": True, "id": txn_id}


def find_row(ss: gspread.Spreadsheet, body: dict) -> tuple[gspread.Worksheet, int] | None:
    txn_id = body.get("Id") or body.get("id") or ""
    key = body.get("oldKey") or "|".join(
        [
            body["Date"],
            body["Time"],
            str(int(round(float(body["Amount"])))),
            body["Category"],
        ]
    )
    name = month_sheet_name(body.get("Date") or key.split("|")[0])
    to_search = []
    if name:
        try:
            to_search.append(ss.worksheet(name))
        except gspread.WorksheetNotFound:
            pass
    to_search.extend(all_month_sheets(ss))
    seen: set[str] = set()

    for sheet in to_search:
        if sheet.title in seen:
            continue
        seen.add(sheet.title)
        data = sheet.get_all_values()
        if len(data) < 2:
            continue
        headers = [h.strip() for h in data[0]]
        di = headers.index("Date") if "Date" in headers else 0
        ti = headers.index("Time") if "Time" in headers else 1
        ai = headers.index("Amount") if "Amount" in headers else 3
        ci = headers.index("Category") if "Category" in headers else 2
        idi = headers.index("Id") if "Id" in headers else -1

        for r, row in enumerate(data[1:], start=2):
            if txn_id and idi >= 0 and str(row[idi] if idi < len(row) else "").strip() == txn_id:
                return sheet, r
            row_key = "|".join(
                [
                    str(row[di] if di < len(row) else ""),
                    str(row[ti] if ti < len(row) else "")[:5],
                    str(int(round(float(row[ai] if ai < len(row) else 0) or 0))),
                    str(row[ci] if ci < len(row) else ""),
                ]
            )
            if row_key == key:
                return sheet, r
    return None


def update_transaction(body: dict, settings: Settings | None = None) -> dict:
    ss = spreadsheet(settings)
    found = find_row(ss, body)
    if not found:
        return {"ok": True, "note": "row not found"}
    sheet, row_index = found
    tags = body.get("Tags") or ""
    if isinstance(tags, list):
        tags = " ".join(tags)
    row = [
        body["Date"],
        body["Time"],
        body["Category"],
        int(round(float(body["Amount"]))),
        body.get("Mode of Payment") or "UPI",
        body.get("Note") or "",
        body.get("Split") or 1,
        body.get("Paid") or 0,
        body.get("Location") or "",
        tags,
        body.get("Id") or "",
    ]
    sheet.update(f"A{row_index}:K{row_index}", [row], value_input_option="USER_ENTERED")
    return {"ok": True}


def delete_transaction(body: dict, settings: Settings | None = None) -> dict:
    ss = spreadsheet(settings)
    found = find_row(ss, body)
    if not found:
        return {"ok": True, "note": "row not found"}
    sheet, row_index = found
    sheet.delete_rows(row_index)
    return {"ok": True}


def expense_to_sheet_row(payload: dict) -> dict:
    return {
        "Date": payload["date"],
        "Time": payload["time"],
        "Category": payload["category"],
        "Amount": payload["amount"],
        "Mode of Payment": payload.get("payment") or "UPI",
        "Note": payload.get("note") or "",
        "Split": payload.get("split") or 1,
        "Paid": payload.get("paid_count") or 0,
        "Location": payload.get("location") or "",
        "Tags": payload.get("tags") or [],
        "Id": payload.get("id") or gen_id(),
    }
