"""Lưu trữ người dùng & lịch sử đấu (SQLite — thay thế nhẹ cho PostgreSQL khi chạy local)."""
import json
import os
import sqlite3
import threading
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "business_tour.db")
_lock = threading.Lock()
_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_conn.row_factory = sqlite3.Row
_conn.executescript("""
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT, avatar TEXT, provider TEXT, look INTEGER, created REAL,
    ext_id TEXT, email TEXT
);
CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, mode TEXT, winner_id TEXT, win_type TEXT, summary TEXT
);
CREATE TABLE IF NOT EXISTS match_players (
    match_id INTEGER, user_id TEXT, name TEXT, mode TEXT, won INTEGER, net_worth INTEGER
);
""")
for _col in ("ext_id TEXT", "email TEXT"):
    try:
        _conn.execute(f"ALTER TABLE users ADD COLUMN {_col}")
    except sqlite3.OperationalError:
        pass
_conn.commit()


def save_user(u):
    with _lock:
        _conn.execute(
            "INSERT OR REPLACE INTO users (id,name,avatar,provider,look,created,ext_id,email) VALUES (?,?,?,?,?,?,?,?)",
            (u["id"], u["name"], u["avatar"], u["provider"], u.get("look", 0), time.time(),
             u.get("ext_id"), u.get("email")))
        _conn.commit()


def get_user(uid):
    with _lock:
        r = _conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return dict(r) if r else None


def find_user_by_ext(provider, ext_id):
    if not ext_id:
        return None
    with _lock:
        r = _conn.execute("SELECT * FROM users WHERE provider=? AND ext_id=?", (provider, ext_id)).fetchone()
    return dict(r) if r else None


def update_user(uid, **fields):
    if not fields:
        return
    keys = ", ".join(f"{k}=?" for k in fields)
    with _lock:
        _conn.execute(f"UPDATE users SET {keys} WHERE id=?", (*fields.values(), uid))
        _conn.commit()


def record_match(mode, winner_id, win_type, summary, humans):
    with _lock:
        cur = _conn.execute("INSERT INTO matches (ts,mode,winner_id,win_type,summary) VALUES (?,?,?,?,?)",
                            (time.time(), mode, winner_id, win_type, json.dumps(summary, ensure_ascii=False)))
        mid = cur.lastrowid
        for s in summary:
            if s["id"] in humans:
                _conn.execute("INSERT INTO match_players VALUES (?,?,?,?,?,?)",
                              (mid, s["id"], s["name"], mode, int(s["id"] == winner_id), s["net_worth"]))
        _conn.commit()


def leaderboard(mode, limit=50):
    with _lock:
        rows = _conn.execute("""
            SELECT mp.user_id, u.name, u.avatar, SUM(mp.won) AS wins, COUNT(*) AS games
            FROM match_players mp LEFT JOIN users u ON u.id = mp.user_id
            WHERE mp.mode=? GROUP BY mp.user_id ORDER BY wins DESC, games ASC LIMIT ?""",
                             (mode, limit)).fetchall()
    return [dict(r) for r in rows]


def history(uid, limit=20):
    with _lock:
        rows = _conn.execute("""
            SELECT m.id, m.ts, m.mode, m.win_type, mp.won, mp.net_worth, m.summary
            FROM match_players mp JOIN matches m ON m.id = mp.match_id
            WHERE mp.user_id=? ORDER BY m.ts DESC LIMIT ?""", (uid, limit)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["summary"] = json.loads(d["summary"])
        out.append(d)
    return out
