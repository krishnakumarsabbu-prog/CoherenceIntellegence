"""Synthetic fraud transaction dataset and CSV parsing."""
import csv
import io
import json
import os
import random
from typing import Any

SAMPLE_DATASET_ID = "sample-txns-001"

FIELDS = [
    "transaction_id",
    "card_id",
    "merchant_id",
    "amount",
    "currency",
    "timestamp",
    "country",
    "mcc",
    "device_id",
    "is_fraud",
]


def _seed_rng() -> random.Random:
    return random.Random(20260726)


def generate_sample_transactions(n: int = 400) -> list[dict[str, Any]]:
    rng = _seed_rng()
    countries = ["US", "GB", "DE", "FR", "BR", "IN", "SG", "AU", "CA", "NG"]
    currencies = ["USD", "EUR", "GBP", "BRL", "INR", "SGD", "AUD", "CAD"]
    mccs = [5411, 5812, 5499, 5912, 6011, 4111, 4900, 5732, 5310, 5651]
    rows: list[dict[str, Any]] = []
    base_ts = 1753526400  # 2025-07-26 00:00:00 UTC
    for i in range(n):
        is_fraud = rng.random() < 0.05  # ~5% fraud rate
        if is_fraud:
            amount = round(rng.uniform(800, 9500), 2)
            country = rng.choice(["NG", "BR", "RU", "VN"])
            device_id = f"dev_{rng.randint(1, 12)}"
        else:
            amount = round(rng.uniform(5, 350), 2)
            country = rng.choice(countries)
            device_id = f"dev_{rng.randint(1, 200)}"
        rows.append(
            {
                "transaction_id": f"txn_{10000 + i}",
                "card_id": f"card_{rng.randint(1, 220)}",
                "merchant_id": f"mch_{rng.randint(1, 80)}",
                "amount": amount,
                "currency": rng.choice(currencies),
                "timestamp": base_ts + rng.randint(0, 86400 * 30),
                "country": country,
                "mcc": rng.choice(mccs),
                "device_id": device_id,
                "is_fraud": 1 if is_fraud else 0,
            }
        )
    return rows


def get_sample_dataset() -> dict[str, Any]:
    path = os.path.join(os.path.dirname(__file__), "..", "data", "sample_transactions.json")
    path = os.path.abspath(path)
    if not os.path.exists(path):
        rows = generate_sample_transactions()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(rows, f)
    else:
        with open(path) as f:
            rows = json.load(f)
    return {
        "id": SAMPLE_DATASET_ID,
        "name": "sample_transactions.json",
        "source": "sample",
        "row_count": len(rows),
        "rows": rows,
    }


def parse_csv(content: bytes, name: str = "upload.csv") -> dict[str, Any]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, Any]] = []
    for raw in reader:
        row: dict[str, Any] = {}
        for k, v in raw.items():
            if k is None:
                continue
            key = k.strip().lower()
            if key in ("is_fraud", "isfraud", "fraud", "label"):
                try:
                    row["is_fraud"] = int(float(v))
                except (ValueError, TypeError):
                    row["is_fraud"] = 0
            elif key in ("amount",):
                try:
                    row[key] = float(v)
                except (ValueError, TypeError):
                    row[key] = 0.0
            elif key in ("timestamp", "ts"):
                try:
                    row[key] = int(float(v))
                except (ValueError, TypeError):
                    row[key] = 0
            elif key in ("mcc",):
                try:
                    row[key] = int(float(v))
                except (ValueError, TypeError):
                    row[key] = 0
            else:
                row[key] = v
        if "transaction_id" not in row:
            row["transaction_id"] = f"txn_{len(rows):05d}"
        if "is_fraud" not in row:
            row["is_fraud"] = 0
        rows.append(row)
    return {
        "id": f"upload-{name}",
        "name": name,
        "source": "upload",
        "row_count": len(rows),
        "rows": rows,
    }
