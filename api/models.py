from typing import Literal

from pydantic import BaseModel, Field


class ParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class ParsedExpense(BaseModel):
    amount: float
    category: str
    note: str
    payment: Literal["UPI", "Credit Card"] = "UPI"
    date: str
    time: str
    location: str = ""
    tags: list[str] = []
    recurring: bool = False
    split: int = 1
    currency: str = "INR"


class ParseResponse(BaseModel):
    result: ParsedExpense
    source: Literal["ai", "local"]


class ExpensePayload(BaseModel):
    id: str | None = None
    date: str
    time: str
    category: str
    amount: float
    payment: str = "UPI"
    note: str = ""
    split: int = 1
    paid_count: int = 0
    location: str = ""
    tags: list[str] = []
    recurring: bool = False


class ExpenseQuickAdd(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class ExpenseQuickAddResponse(BaseModel):
    parsed: ParsedExpense
    source: Literal["ai", "local"]
    saved: bool
    id: str | None = None


class SettingsPayload(BaseModel):
    monthly_budget: float = 0
    cat_budgets: dict[str, float] = {}
    goals: list[dict] = []
    recurring: list[dict] = []
