"""Business Tour 3D — FastAPI app: REST (auth, bảng xếp hạng) + WebSocket + phục vụ frontend tĩnh.

Chạy:  python main.py   (mặc định http://localhost:8000)
"""
import os

from fastapi import Body, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import auth
import database
from rooms import RoomManager

FRONTEND = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

app = FastAPI(title="Business Tour 3D")
manager = RoomManager()


def _user_from_header(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Thiếu token")
    user = auth.verify_token(authorization[7:])
    if not user:
        raise HTTPException(401, "Token không hợp lệ")
    return user


@app.post("/api/auth/guest")
def guest_login():
    user = auth.create_guest()
    return {"token": auth.make_token(user["id"]), "user": user}


@app.post("/api/auth/social")
def social_login(payload: dict = Body(...), authorization: str | None = Header(None)):
    provider = str(payload.get("provider", "")).lower()
    email = str(payload.get("email", "")).strip()
    name = str(payload.get("name", "")).strip()
    ext_id = str(payload.get("ext_id") or email or name).strip()
    avatar = payload.get("avatar")
    upgrade_uid = None
    if authorization and authorization.startswith("Bearer "):
        cur = auth.verify_token(authorization[7:])
        if cur and cur.get("provider") == "guest":
            upgrade_uid = cur["id"]
    try:
        user = auth.social_login(provider, ext_id, name, email=email, avatar=avatar, upgrade_uid=upgrade_uid)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"token": auth.make_token(user["id"]), "user": user}


@app.get("/api/auth/providers")
def providers():
    return {"google": auth.oauth_configured("google"), "facebook": auth.oauth_configured("facebook")}


@app.get("/api/me")
def me(authorization: str | None = Header(None)):
    user = _user_from_header(authorization)
    return {"user": user, "in_room": manager.user_room.get(user["id"])}


@app.get("/api/leaderboard")
def leaderboard(mode: str = "PVP"):
    return {"mode": mode, "rows": database.leaderboard("AI" if mode.upper() == "AI" else "PVP")}


@app.get("/api/history")
def history(authorization: str | None = Header(None)):
    user = _user_from_header(authorization)
    return {"rows": database.history(user["id"])}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket, token: str = ""):
    user = auth.verify_token(token)
    await ws.accept()
    if not user:
        await ws.send_json({"type": "ERROR", "message": "Phiên đăng nhập không hợp lệ", "fatal": True, "auth": True})
        await ws.close()
        return
    uid = user["id"]
    await manager.connect(user, ws)
    try:
        while True:
            msg = await ws.receive_json()
            if isinstance(msg, dict):
                try:
                    await manager.handle(uid, msg)
                except Exception as e:  # không để lỗi một tin nhắn làm rớt kết nối
                    import traceback
                    traceback.print_exc()
                    await ws.send_json({"type": "ERROR", "message": f"Lỗi máy chủ: {e}"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await manager.disconnect(uid, ws)


@app.get("/")
def index():
    return FileResponse(os.path.join(FRONTEND, "index.html"), headers={"Cache-Control": "no-cache"})


app.mount("/", StaticFiles(directory=FRONTEND), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
