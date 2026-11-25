"""Xác thực người dùng: Khách (Guest UUID + token ký HMAC), sẵn chỗ cho Google/Facebook OAuth."""
import base64
import hashlib
import hmac
import json
import os
import random
import secrets
import time
import uuid

import database

SECRET_FILE = os.path.join(os.path.dirname(__file__), ".secret")


def _secret():
    env = os.environ.get("BT_SECRET")
    if env:
        return env.encode()
    if not os.path.exists(SECRET_FILE):
        with open(SECRET_FILE, "w") as f:
            f.write(secrets.token_hex(32))
    with open(SECRET_FILE) as f:
        return f.read().strip().encode()


SECRET = _secret()
TOKEN_TTL = 60 * 60 * 24 * 30


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def make_token(user_id: str) -> str:
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64(json.dumps({"sub": user_id, "exp": int(time.time()) + TOKEN_TTL}).encode())
    sig = _b64(hmac.new(SECRET, f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def verify_token(token: str):
    try:
        header, payload, sig = token.split(".")
        expect = _b64(hmac.new(SECRET, f"{header}.{payload}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expect, sig):
            return None
        data = json.loads(_unb64(payload))
        if data.get("exp", 0) < time.time():
            return None
        return database.get_user(data["sub"])
    except Exception:
        return None


AVATARS = ["🦊", "🐼", "🐯", "🦁", "🐸", "🐵", "🐨", "🐙", "🦄", "🐧", "🐲", "🦉"]


def create_guest():
    uid = str(uuid.uuid4())
    name = "Khach_" + uid.replace("-", "")[:4].upper()
    user = {"id": uid, "name": name, "avatar": random.choice(AVATARS), "provider": "guest",
            "look": random.randint(0, 3), "ext_id": None, "email": None}
    database.save_user(user)
    return user


def social_login(provider: str, ext_id: str, name: str, email: str = "", avatar: str | None = None,
                 upgrade_uid: str | None = None):
    if provider not in ("google", "facebook"):
        raise ValueError("Nhà cung cấp không hợp lệ")
    ext_id = (ext_id or email or name).strip().lower()
    if not ext_id:
        raise ValueError("Thiếu định danh tài khoản")
    clean_name = (name or "").strip()[:24] or ("GoogleUser" if provider == "google" else "FBUser")
    chosen_avatar = avatar or ("🟦" if provider == "facebook" else "🟥")

    existing = database.find_user_by_ext(provider, ext_id)
    if existing:
        database.update_user(existing["id"], name=clean_name, email=email or existing.get("email"),
                             avatar=avatar or existing.get("avatar"))
        return database.get_user(existing["id"])

    if upgrade_uid:
        guest = database.get_user(upgrade_uid)
        if guest and guest.get("provider") == "guest":
            database.update_user(upgrade_uid, provider=provider, ext_id=ext_id,
                                 name=clean_name, email=email or None,
                                 avatar=avatar or guest.get("avatar") or chosen_avatar)
            return database.get_user(upgrade_uid)

    uid = str(uuid.uuid4())
    user = {"id": uid, "name": clean_name, "avatar": chosen_avatar, "provider": provider,
            "look": random.randint(0, 3), "ext_id": ext_id, "email": email or None}
    database.save_user(user)
    return user


def oauth_configured(provider: str) -> bool:
    key = {"google": "GOOGLE_CLIENT_ID", "facebook": "FACEBOOK_APP_ID"}.get(provider)
    return bool(key and os.environ.get(key))


def oauth_authorize_url(provider: str, redirect_uri: str, state: str = "") -> str | None:
    if not oauth_configured(provider):
        return None
    from urllib.parse import urlencode
    if provider == "google":
        params = urlencode({
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
        })
        return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
    params = urlencode({
        "client_id": os.environ["FACEBOOK_APP_ID"],
        "redirect_uri": redirect_uri,
        "scope": "public_profile,email",
        "state": state,
    })
    return f"https://www.facebook.com/v19.0/dialog/oauth?{params}"
