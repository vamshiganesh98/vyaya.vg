"""Vyaya.vg Python API — AI parsing + Google Sheets backend."""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import Settings, get_settings
from models import (
    ExpensePayload,
    ExpenseQuickAdd,
    ExpenseQuickAddResponse,
    ParseRequest,
    ParseResponse,
    ParsedExpense,
)
from parser import parse_expense_text
from sheets import (
    append_transaction,
    delete_transaction,
    expense_to_sheet_row,
    gen_id,
    read_all_transactions,
    update_transaction,
)

app = FastAPI(title="Vyaya.vg API", version="1.0.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_secret(
    authorization: Annotated[str | None, Header()] = None,
    x_api_key: Annotated[str | None, Header()] = None,
) -> None:
    secret = get_settings().vyaya_api_secret
    if not secret:
        return
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    elif x_api_key:
        token = x_api_key.strip()
    if not token or not secrets.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/health")
def health():
    s = get_settings()
    return {
        "ok": True,
        "openai": bool(s.openai_api_key),
        "sheets": bool(s.google_spreadsheet_id and s.google_service_account_json),
    }


@app.post("/api/parse", response_model=ParseResponse, dependencies=[Depends(verify_secret)])
def parse_text(body: ParseRequest):
    result, source = parse_expense_text(body.text, get_settings().openai_api_key)
    return ParseResponse(result=ParsedExpense(**result), source=source)


@app.post("/api/expenses/quick", response_model=ExpenseQuickAddResponse, dependencies=[Depends(verify_secret)])
def quick_add(body: ExpenseQuickAdd):
    """Parse plain English and save to Google Sheets in one call (ideal for iPhone Shortcut)."""
    s = get_settings()
    parsed, source = parse_expense_text(body.text, s.openai_api_key)
    txn_id = gen_id()
    sheet_body = expense_to_sheet_row(
        {
            "id": txn_id,
            "date": parsed["date"],
            "time": parsed["time"],
            "category": parsed["category"],
            "amount": parsed["amount"],
            "payment": parsed["payment"],
            "note": parsed["note"],
            "split": parsed["split"],
            "paid_count": 0,
            "location": parsed["location"],
            "tags": parsed["tags"],
        }
    )
    append_transaction(sheet_body, s)
    return ExpenseQuickAddResponse(
        parsed=ParsedExpense(**parsed),
        source=source,
        saved=True,
        id=txn_id,
    )


@app.get("/api/expenses", dependencies=[Depends(verify_secret)])
def list_expenses():
    rows = read_all_transactions()
    return {"rows": rows}


@app.post("/api/expenses", dependencies=[Depends(verify_secret)])
def create_expense(body: ExpensePayload):
    txn_id = body.id or gen_id()
    sheet_body = expense_to_sheet_row({**body.model_dump(), "id": txn_id})
    append_transaction(sheet_body)
    return {"ok": True, "id": txn_id}


@app.put("/api/expenses", dependencies=[Depends(verify_secret)])
def modify_expense(body: ExpensePayload):
    if not body.id:
        raise HTTPException(status_code=400, detail="id required")
    sheet_body = expense_to_sheet_row(body.model_dump())
    update_transaction(sheet_body)
    return {"ok": True}


@app.delete("/api/expenses", dependencies=[Depends(verify_secret)])
def remove_expense(body: ExpensePayload):
    sheet_body = expense_to_sheet_row(body.model_dump())
    delete_transaction(sheet_body)
    return {"ok": True}
