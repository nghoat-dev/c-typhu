"""Quản lý phòng chơi, kết nối WebSocket, vòng lặp AI bất đồng bộ, hẹn giờ lượt & tự động tiếp quản."""
import asyncio
import random
import string
import time

import ai_bot
import database
from board import CHARACTERS, MATCH_MAX_SECONDS, board_payload
from game_engine import Game, Player

TURN_SECONDS = 30
DISCONNECT_GRACE = 30
COLORS = [c["color"] for c in CHARACTERS]
BOT_NAMES = ["Robot Tỷ Phú", "Nữ Bá Tước AI", "Thuyền Trưởng Bot", "Giáo Sư Máy", "Cô Nàng Pixel",
             "Ông Trùm Chip", "Đại Gia Silicon", "Lady Byte", "Bá Tước Nơ-ron", "Cậu Bé Thuật Toán"]
BOT_AVATARS = ["🤖", "👾", "🦾", "🛸", "💾", "🧠"]


class Seat:
    def __init__(self, sid, name, avatar, look, is_bot=False, difficulty="MEDIUM"):
        self.id = sid
        self.name = name
        self.avatar = avatar
        self.look = look
        self.is_bot = is_bot
        self.difficulty = difficulty
        self.connected = True

    def to_dict(self, color=None):
        col = COLORS[self.look % len(COLORS)] if color is None else color
        return {"id": self.id, "name": self.name, "avatar": self.avatar, "look": self.look % 4,
                "is_bot": self.is_bot, "difficulty": self.difficulty, "connected": self.connected,
                "color": col}


class Room:
    def __init__(self, manager, code, host_id, public):
        self.m = manager
        self.code = code
        self.host_id = host_id
        self.public = public
        self.seats: list[Seat] = []
        self.status = "LOBBY"
        self.game: Game | None = None
        self.seed = None
        self.lock = asyncio.Lock()
        self.version = 0
        self.busy_until = 0.0
        self.deadline = None
        self.match_deadline = None
        self.match_task: asyncio.Task | None = None
        self.task: asyncio.Task | None = None
        self.disc_tasks: dict[str, asyncio.Task] = {}
        self.last_chat: dict[str, float] = {}
        self.created = time.time()

    # ---------------------------------------------------------- lobby
    def humans(self):
        return [s for s in self.seats if not s.is_bot]

    def seat(self, sid):
        return next((s for s in self.seats if s.id == sid), None)

    def to_dict(self):
        return {"code": self.code, "host_id": self.host_id, "public": self.public, "status": self.status,
                "seats": [s.to_dict(COLORS[s.look % len(COLORS)]) for s in self.seats], "max": 4}

    async def broadcast(self, msg):
        for s in self.humans():
            await self.m.send(s.id, msg)

    async def push_room(self):
        await self.broadcast({"type": "ROOM_STATE", "room": self.to_dict()})

    def _free_look(self, exclude_sid=None):
        used = {s.look % 4 for s in self.seats if s.id != exclude_sid}
        avail = [i for i in range(4) if i not in used]
        return avail[0] if avail else len(self.seats) % 4

    def add_bot(self, difficulty):
        if len(self.seats) >= 4 or self.status != "LOBBY":
            return False
        used = {s.name for s in self.seats}
        name = random.choice([n for n in BOT_NAMES if n not in used])
        self.seats.append(Seat(f"bot-{random.getrandbits(40):x}", name, random.choice(BOT_AVATARS),
                               self._free_look(), True, difficulty))
        return True

    # ---------------------------------------------------------- game lifecycle
    async def start_game(self):
        self.seed = random.getrandbits(32)
        order = list(range(len(self.seats)))
        random.shuffle(order)
        players = []
        for i in order:
            s = self.seats[i]
            col = COLORS[s.look % len(COLORS)]
            p = Player(s.id, s.name, col, s.look % 4, s.is_bot, s.difficulty, s.avatar)
            p.connected = s.connected or s.is_bot
            players.append(p)
        self.game = Game(players, self.seed)
        self.status = "PLAYING"
        self.busy_until = time.time()
        self.match_deadline = self.busy_until + MATCH_MAX_SECONDS
        if self.match_task and not self.match_task.done():
            self.match_task.cancel()
        self.match_task = asyncio.create_task(self._match_timeout(MATCH_MAX_SECONDS))
        await self.push_room()
        await self.broadcast(self.sync_msg())
        async with self.lock:
            self.game.start()
            await self.flush()

    async def _match_timeout(self, delay):
        try:
            await asyncio.sleep(delay)
            async with self.lock:
                if self.status == "PLAYING" and self.game and not self.game.finished:
                    self.game.finish_by_time()
                    await self.flush()
        except asyncio.CancelledError:
            pass

    def sync_msg(self):
        g = self.game
        return {"type": "GAME_SYNC", "room": self.to_dict(), "seed": self.seed, "board": board_payload(),
                "state": g.snapshot(), "deadline": self.deadline, "turn_seconds": TURN_SECONDS,
                "match_deadline": self.match_deadline}

    def actor(self):
        g = self.game
        if not g or g.finished or not g.pending:
            return None
        return g.player(g.pending["player_id"])

    async def flush(self):
        """Gửi các sự kiện mới kèm snapshot trạng thái cuối cùng (có pending chính xác), rồi lên lịch Bot/hẹn giờ."""
        g = self.game
        events = g.pop_events()
        final_snap = g.snapshot()
        now = time.time()
        dur = sum(e.get("dur", 0.3) for e in events)
        self.busy_until = max(now, self.busy_until) + dur
        self.version += 1
        if self.task and not self.task.done() and self.task is not asyncio.current_task():
            self.task.cancel()
        self.task = None
        a = self.actor()
        self.deadline = None
        if a and not (a.is_bot or a.is_ai_controlled):
            self.deadline = self.busy_until + TURN_SECONDS
        if events:
            events[-1]["state"] = final_snap
        await self.broadcast({"type": "GAME_EVENTS", "events": events, "state": final_snap,
                              "deadline": self.deadline, "server_time": now})
        if g.finished:
            await self.on_finished()
            return
        if a:
            if a.is_bot or a.is_ai_controlled:
                delay = (self.busy_until - now) + random.uniform(1.0, 1.8)
                self.task = asyncio.create_task(self._bot_act(self.version, delay))
            else:
                self.task = asyncio.create_task(self._timeout(self.version, self.deadline - now))

    async def _bot_act(self, version, delay):
        try:
            await asyncio.sleep(max(0.2, delay))
            async with self.lock:
                if version != self.version:
                    return
                p = self.actor()
                if not p or not (p.is_bot or p.is_ai_controlled):
                    return
                try:
                    action, data = ai_bot.decide(self.game, p)
                    ok, err = self.game.handle(p.id, action, data)
                except Exception as e:  # an toàn: không để Bot làm treo phòng
                    print("AI error:", repr(e))
                    ok = False
                if not ok:
                    action, data = ai_bot.safe_default(self.game, p)
                    self.game.handle(p.id, action, data)
                await self.flush()
        except asyncio.CancelledError:
            pass

    async def _timeout(self, version, delay):
        try:
            await asyncio.sleep(max(0.5, delay))
            async with self.lock:
                if version != self.version:
                    return
                p = self.actor()
                if not p or p.is_bot or p.is_ai_controlled:
                    return
                p.timeouts += 1
                self.game.emit("LOG", dur=0.2, msg=f"⏰ {p.name} hết thời gian lượt ({p.timeouts}/2).")
                if p.timeouts >= 2:
                    self.set_takeover(p, True)
                    await self.flush()
                    return
                action, data = ai_bot.safe_default(self.game, p)
                self.game.handle(p.id, action, data)
                await self.flush()
        except asyncio.CancelledError:
            pass

    def set_takeover(self, p, active):
        if p.is_ai_controlled == active:
            return
        p.is_ai_controlled = active
        if not active:
            p.timeouts = 0
        self.game.emit("BOT_TAKEOVER", dur=0.4, player_id=p.id, active=active,
                       msg=(f"🤖 AI Bot (Trung bình) tạm tiếp quản {p.name}." if active
                            else f"🙋 {p.name} đã quay lại và giành lại quyền điều khiển."))

    async def on_finished(self):
        self.status = "FINISHED"
        if self.match_task and not self.match_task.done() and self.match_task is not asyncio.current_task():
            self.match_task.cancel()
        g = self.game
        try:
            mode = "AI" if any(p.is_bot for p in g.players) else "PVP"
            summ = [{"id": p.id, "name": p.name, "net_worth": g.net_worth(p)} for p in g.players]
            database.record_match(mode, g.winner, g.win_type, summ,
                                  {p.id for p in g.players if not p.is_bot})
        except Exception as e:
            print("record_match error", e)
        await self.push_room()

    async def game_action(self, uid, action, data):
        async with self.lock:
            g = self.game
            if not g or self.status != "PLAYING":
                return "Trận đấu chưa bắt đầu"
            p = g.player(uid)
            if not p:
                return "Bạn không ở trong trận này"
            if p.is_ai_controlled:
                self.set_takeover(p, False)
            ok, err = g.handle(uid, action, data)
            if not ok:
                if g.events:
                    await self.flush()
                return err
            p.timeouts = 0
            await self.flush()
            return None

    # ---------------------------------------------------------- connections
    async def on_disconnect(self, uid):
        s = self.seat(uid)
        if not s:
            return
        s.connected = False
        if self.status == "PLAYING":
            p = self.game.player(uid)
            if p:
                p.connected = False
        self.disc_tasks[uid] = asyncio.create_task(self._disc_grace(uid))
        await self.push_room()

    async def _disc_grace(self, uid):
        try:
            await asyncio.sleep(DISCONNECT_GRACE)
        except asyncio.CancelledError:
            return
        s = self.seat(uid)
        if not s or s.connected:
            return
        if self.status == "PLAYING":
            async with self.lock:
                p = self.game.player(uid)
                if p and not p.bankrupt and not self.game.finished:
                    self.set_takeover(p, True)
                    await self.flush()
        else:
            await self.m.leave(uid)

    async def on_reconnect(self, uid):
        s = self.seat(uid)
        if not s:
            return
        s.connected = True
        t = self.disc_tasks.pop(uid, None)
        if t:
            t.cancel()
        if self.status in ("PLAYING", "FINISHED") and self.game:
            async with self.lock:
                p = self.game.player(uid)
                if p:
                    p.connected = True
                    if p.is_ai_controlled and not p.left and not self.game.finished:
                        self.set_takeover(p, False)
                        await self.flush()
            await self.m.send(uid, self.sync_msg())
        await self.push_room()

    async def chat(self, uid, text, emote):
        now = time.time()
        if now - self.last_chat.get(uid, 0) < 2:
            await self.m.send(uid, {"type": "ERROR", "message": "Chống spam: tối đa 1 tin / 2 giây"})
            return
        self.last_chat[uid] = now
        s = self.seat(uid)
        if not s:
            return
        text = (text or "")[:140]
        await self.broadcast({"type": "CHAT", "from": uid, "name": s.name, "text": text, "emote": emote})


class RoomManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.user_room: dict[str, str] = {}
        self.conns: dict[str, object] = {}
        self.users: dict[str, dict] = {}

    async def send(self, uid, msg):
        ws = self.conns.get(uid)
        if ws:
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    def room_of(self, uid):
        code = self.user_room.get(uid)
        return self.rooms.get(code) if code else None

    def new_code(self):
        while True:
            code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if code not in self.rooms:
                return code

    def public_rooms(self):
        return [{"code": r.code, "players": len(r.seats), "host": r.seat(r.host_id).name if r.seat(r.host_id) else "?"}
                for r in self.rooms.values() if r.public and r.status == "LOBBY" and len(r.seats) < 4]

    async def connect(self, user, ws):
        uid = user["id"]
        old = self.conns.get(uid)
        if old and old is not ws:
            try:
                await old.send_json({"type": "ERROR", "message": "Tài khoản đã đăng nhập ở cửa sổ khác", "fatal": True})
                await old.close()
            except Exception:
                pass
        self.conns[uid] = ws
        self.users[uid] = user
        await self.send(uid, {"type": "HELLO", "user": user})
        r = self.room_of(uid)
        if r:
            await r.on_reconnect(uid)

    async def disconnect(self, uid, ws):
        if self.conns.get(uid) is not ws:
            return
        self.conns.pop(uid, None)
        r = self.room_of(uid)
        if r:
            await r.on_disconnect(uid)

    def make_seat(self, uid):
        u = self.users[uid]
        return Seat(uid, u["name"], u.get("avatar") or "🙂", int(u.get("look") or 0) % 4)

    async def create_room(self, uid, public=False, bots=None, solo=False):
        if self.room_of(uid):
            await self.leave(uid)
        code = self.new_code()
        r = Room(self, code, uid, public and not solo)
        r.seats.append(self.make_seat(uid))
        for d in (bots or [])[:3]:
            r.add_bot(d if d in ("EASY", "MEDIUM", "HARD") else "MEDIUM")
        self.rooms[code] = r
        self.user_room[uid] = code
        await r.push_room()
        if solo and len(r.seats) >= 2:
            await r.start_game()
        return r

    async def join(self, uid, code):
        code = (code or "").strip().upper()
        r = self.rooms.get(code)
        if not r:
            return "Không tìm thấy phòng " + code
        if r.seat(uid):
            await r.on_reconnect(uid)
            self.user_room[uid] = code
            return None
        if r.status != "LOBBY":
            return "Trận đấu trong phòng đã bắt đầu"
        if len(r.seats) >= 4:
            return "Phòng đã đủ 4 người"
        if self.room_of(uid):
            await self.leave(uid)
        r.seats.append(self.make_seat(uid))
        self.user_room[uid] = code
        await r.push_room()
        return None

    async def leave(self, uid):
        r = self.room_of(uid)
        self.user_room.pop(uid, None)
        if not r:
            return
        if r.status == "PLAYING" and r.game and not r.game.finished:
            async with r.lock:
                p = r.game.player(uid)
                if p:
                    p.left = True
                    p.connected = False
                    r.set_takeover(p, True)
                    await r.flush()
            s = r.seat(uid)
            if s:
                s.connected = False
        else:
            r.seats = [s for s in r.seats if s.id != uid]
        await self.send(uid, {"type": "LEFT_ROOM"})
        active_humans = [s for s in r.humans() if self.user_room.get(s.id) == r.code]
        if not active_humans:
            if r.task:
                r.task.cancel()
            if r.match_task:
                r.match_task.cancel()
            self.rooms.pop(r.code, None)
            return
        if r.host_id == uid:
            r.host_id = active_humans[0].id
        await r.push_room()

    async def handle(self, uid, msg):
        a = msg.get("action")
        r = self.room_of(uid)

        async def err(m):
            await self.send(uid, {"type": "ERROR", "message": m})

        if a == "CREATE_ROOM":
            await self.create_room(uid, bool(msg.get("public")), msg.get("bots"), bool(msg.get("solo")))
        elif a == "JOIN_ROOM":
            e = await self.join(uid, msg.get("code"))
            if e:
                await err(e)
        elif a == "QUICK_MATCH":
            rooms = self.public_rooms()
            if rooms:
                await self.join(uid, rooms[0]["code"])
            else:
                await self.create_room(uid, public=True)
        elif a == "LIST_ROOMS":
            await self.send(uid, {"type": "ROOM_LIST", "rooms": self.public_rooms()})
        elif a == "LEAVE_ROOM":
            await self.leave(uid)
        elif a == "SET_NAME":
            name = (msg.get("name") or "").strip()[:20]
            if name:
                self.users[uid]["name"] = name
                database.update_user(uid, name=name)
                await self.send(uid, {"type": "HELLO", "user": self.users[uid]})
                if r and r.status == "LOBBY" and r.seat(uid):
                    r.seat(uid).name = name
                    await r.push_room()
        elif a == "SET_LOOK":
            look = int(msg.get("look", 0)) % 4
            self.users[uid]["look"] = look
            database.update_user(uid, look=look)
            await self.send(uid, {"type": "HELLO", "user": self.users[uid]})
            if r and r.status == "LOBBY":
                s = r.seat(uid)
                if s:
                    s.look = look
                    for other in r.seats:
                        if other.id != uid and other.is_bot and (other.look % 4) == look:
                            other.look = r._free_look(other.id)
                    await r.push_room()
        elif not r:
            await err("Bạn chưa ở trong phòng nào")
        elif a == "CHAT":
            await r.chat(uid, msg.get("text"), msg.get("emote"))
        elif a == "RESUME_CONTROL":
            if r.status == "PLAYING" and r.game and not r.game.finished:
                async with r.lock:
                    p = r.game.player(uid)
                    if p and p.is_ai_controlled:
                        p.left = False
                        r.set_takeover(p, False)
                        await r.flush()
        elif a == "RANDOMIZE_LOOK":
            if r.status == "LOBBY":
                s = r.seat(msg.get("seat_id") or uid)
                if s and (s.id == uid or (s.is_bot and r.host_id == uid)):
                    s.look = (int(s.look) + 1) % 4
                    if s.id == uid:
                        self.users[uid]["look"] = s.look
                        database.update_user(uid, look=s.look)
                        await self.send(uid, {"type": "HELLO", "user": self.users[uid]})
                    else:
                        used = {q.look % 4 for q in r.seats if q.id != s.id}
                        for off in range(4):
                            cand = (s.look + off) % 4
                            if cand not in used:
                                s.look = cand
                                break
                    await r.push_room()
        elif a in ("ADD_BOT", "REMOVE_BOT", "SET_BOT_DIFFICULTY", "START_GAME", "SET_PUBLIC", "PLAY_AGAIN"):
            if r.host_id != uid:
                await err("Chỉ chủ phòng mới làm được việc này")
                return
            if a == "PLAY_AGAIN":
                if r.status == "FINISHED":
                    r.status = "LOBBY"
                    r.game = None
                    r.seats = [s for s in r.seats if s.is_bot or self.user_room.get(s.id) == r.code]
                    await r.push_room()
                return
            if r.status != "LOBBY":
                await err("Trận đấu đã bắt đầu")
                return
            if a == "ADD_BOT":
                if not r.add_bot(msg.get("difficulty", "MEDIUM")):
                    await err("Phòng đã đủ chỗ")
            elif a == "REMOVE_BOT":
                r.seats = [s for s in r.seats if not (s.is_bot and s.id == msg.get("seat_id"))]
            elif a == "SET_BOT_DIFFICULTY":
                s = r.seat(msg.get("seat_id"))
                if s and s.is_bot and msg.get("difficulty") in ("EASY", "MEDIUM", "HARD"):
                    s.difficulty = msg["difficulty"]
            elif a == "SET_PUBLIC":
                r.public = bool(msg.get("public"))
            elif a == "START_GAME":
                if len(r.seats) < 2:
                    await err("Cần ít nhất 2 người chơi (có thể thêm Bot)")
                    return
                await r.start_game()
                return
            await r.push_room()
        else:
            e = await r.game_action(uid, a, msg)
            if e:
                await err(e)
