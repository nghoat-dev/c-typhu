"""Lõi luật Business Tour 32 ô (phiên bản luật chuẩn cập nhật).

- Vốn khởi đầu 2,000K; qua ô Bắt Đầu +300K.
- Đầu trận chọn ngẫu nhiên 3 ô Lễ Hội (x2 tiền thuê từ đầu đến cuối).
- Xây nhà theo vòng: Vòng 1 & Vòng 2 tối đa Cấp 1; sau Vòng 2 tối đa Cấp 2; sau Vòng 3 tối đa Cấp 3;
  chỉ lên Khách sạn (Cấp 4) khi đã có đủ 3 nhà từ trước.
- Hệ số cho thuê tối đa = 10.
- Giải Đấu Thế Giới chỉ đặt tại 1 thành phố duy nhất trên bàn cờ (chuyển sang thành phố mình tốn 50K).
- Du Lịch Vòng Quanh Thế Giới bay tới thành phố chưa mua bất kỳ (hoặc ô của mình nếu đã mua hết).
- Công cụ xúc xắc: Ném Chẵn / Ném Lẻ / Ném Đôi (mỗi loại 1 lần/trận).
"""
import math
import random
import secrets

from board import (BUYABLE, CARDS, CITIES, GROUPS, JAIL_FINE, JAIL_IDX, K_LEVEL, MAX_RENT_MULT,
                   RESORTS, SALARY, SIDES, START_MONEY, TILES, WORLD_CUP_MOVE_FEE, WORLD_TOUR_FEE)

DIFF_LABEL = {"EASY": "Dễ", "MEDIUM": "TB", "HARD": "Khó"}


class Player:
    def __init__(self, pid, name, color, look, is_bot=False, difficulty="MEDIUM", avatar=None):
        self.id = pid
        self.name = name
        self.color = color
        self.look = look
        self.avatar = avatar
        self.is_bot = is_bot
        self.difficulty = difficulty
        self.is_ai_controlled = False
        self.connected = True
        self.left = False
        self.timeouts = 0
        self.money = START_MONEY
        self.pos = 0
        self.laps = 0
        self.in_jail = False
        self.jail_turns = 0
        self.angel = False
        self.jail_free = False
        self.dice_tools = {"EVEN": 0, "ODD": 0, "DOUBLE": 0}
        self.wt_target = None
        self.bankrupt = False
        self.bankrupt_order = None

    def to_dict(self):
        d = {k: getattr(self, k) for k in (
            "id", "name", "color", "look", "avatar", "is_bot", "difficulty", "is_ai_controlled",
            "connected", "money", "pos", "laps", "in_jail", "jail_turns", "angel", "jail_free",
            "wt_target", "bankrupt")}
        d["dice_tools"] = dict(self.dice_tools)
        return d


class Game:
    def __init__(self, players, seed):
        self.players = players
        self.seed = seed
        self.rng = random.Random(secrets.randbits(64))
        self.tiles = [{"owner": None, "level": 0, "champ": 1, "festival": False, "blackout": 0} for _ in TILES]
        self.festival_tiles = sorted(self.rng.sample(BUYABLE, 3))
        for fi in self.festival_tiles:
            self.tiles[fi]["festival"] = True
        self.wc_tile = None
        self.wc_bonus = 0
        self.turn = 0
        self.round = 1
        self.doubles = 0
        self.extra = False
        self.pending = None
        self.debt = None
        self.events = []
        self.finished = False
        self.winner = None
        self.win_type = None
        self.bankrupt_count = 0
        self.prev_beacons = set()

    # ------------------------------------------------------------------ helpers
    def player(self, pid):
        for p in self.players:
            if p.id == pid:
                return p
        return None

    def cur(self):
        return self.players[self.turn]

    def alive(self):
        return [p for p in self.players if not p.bankrupt]

    def owned(self, pid):
        return [i for i, t in enumerate(self.tiles) if t["owner"] == pid]

    @staticmethod
    def value(idx, level):
        t = TILES[idx]
        return t["price"] + level * t["build"]

    def tile_value(self, idx):
        return self.value(idx, self.tiles[idx]["level"])

    def liquidate_value(self, idx):
        return int(0.5 * self.tile_value(idx))

    def owns_group(self, pid, idx):
        g = TILES[idx].get("group")
        if g not in GROUPS:
            return False
        return all(self.tiles[i]["owner"] == pid for i in GROUPS[g])

    def rent_multiplier(self, idx, owner, champ_override=None):
        ts = self.tiles[idx]
        t = TILES[idx]
        mult = 1
        if ts["festival"]:
            mult += 1
        if t["type"] == "CITY" and all(self.tiles[i]["owner"] == owner or i == idx for i in GROUPS[t["group"]]):
            mult += 1
        if champ_override is not None:
            mult += max(0, champ_override - 1)
        elif self.wc_tile == idx:
            mult += self.wc_bonus
        return min(MAX_RENT_MULT, mult)

    def rent(self, idx, level=None, champ=None, owner=None):
        t = TILES[idx]
        ts = self.tiles[idx]
        owner = owner if owner is not None else ts["owner"]
        if owner is None:
            return 0
        mult = self.rent_multiplier(idx, owner, champ_override=champ)
        if t["type"] == "RESORT":
            n = sum(1 for i in RESORTS if self.tiles[i]["owner"] == owner)
            if idx not in [i for i in RESORTS if self.tiles[i]["owner"] == owner]:
                n += 1
            return 25 * (2 ** (n - 1)) * mult
        level = ts["level"] if level is None else level
        base = math.floor(t["rent"] * K_LEVEL[level])
        blackout = 0 if ts["blackout"] > 0 else 1
        return base * mult * blackout

    def build_cap(self, p):
        """Vòng 1 & 2 (laps < 2): tối đa Cấp 1; sau vòng 2 (laps == 2): Cấp 2; sau vòng 3+: Cấp 3."""
        if p.laps < 2:
            return 1
        if p.laps == 2:
            return 2
        return 3

    def emit(self, etype, dur=0.35, msg=None, **payload):
        ev = {"type": etype, "dur": dur, **payload}
        if msg:
            ev["msg"] = msg
        ev["state"] = self.snapshot()
        self.events.append(ev)

    def pop_events(self):
        ev, self.events = self.events, []
        return ev

    def net_worth(self, p):
        return p.money + sum(self.tile_value(i) for i in self.owned(p.id))

    # ------------------------------------------------------------------ victory
    def win_check_for(self, pid, owned_set):
        groups_done = sum(1 for g in GROUPS.values() if all(i in owned_set for i in g))
        if groups_done >= 3:
            return "TRIPLE_MONOPOLY"
        for side in SIDES:
            if all(i in owned_set for i in side):
                return "LINE_MONOPOLY"
        if all(i in owned_set for i in RESORTS):
            return "RESORT_MONOPOLY"
        return None

    def would_win(self, pid, extra_tiles=(), remove_tiles=()):
        s = set(self.owned(pid)) | set(extra_tiles)
        s -= set(remove_tiles)
        return self.win_check_for(pid, s)

    def obtainable(self, idx, pid):
        ts = self.tiles[idx]
        if ts["owner"] is None:
            return True
        if ts["owner"] == pid:
            return False
        return TILES[idx]["type"] == "CITY" and ts["level"] < 4

    def beacons(self):
        res = []
        seen = set()
        for p in self.alive():
            owned = set(self.owned(p.id))

            def add(idx, wt):
                if (p.id, idx) not in seen and self.obtainable(idx, p.id):
                    seen.add((p.id, idx))
                    res.append({"player_id": p.id, "tile": idx, "win_type": wt})

            miss = [i for i in RESORTS if i not in owned]
            if len(miss) == 1:
                add(miss[0], "RESORT_MONOPOLY")
            for side in SIDES:
                miss = [i for i in side if i not in owned]
                if len(miss) == 1:
                    add(miss[0], "LINE_MONOPOLY")
            done = sum(1 for g in GROUPS.values() if all(i in owned for i in g))
            if done >= 2:
                for g in GROUPS.values():
                    miss = [i for i in g if i not in owned]
                    if len(miss) == 1:
                        add(miss[0], "TRIPLE_MONOPOLY")
        return res

    def check_victory(self):
        if self.finished:
            return True
        alive = self.alive()
        if len(alive) == 1:
            self.finish(alive[0], "BANKRUPTCY")
            return True
        for p in alive:
            wt = self.win_check_for(p.id, set(self.owned(p.id)))
            if wt:
                self.finish(p, wt)
                return True
        return False

    def finish_by_time(self):
        if self.finished:
            return
        alive = self.alive()
        winner = max(alive, key=lambda p: (self.net_worth(p), p.money))
        self.finish(winner, "HIGHEST_ASSETS")

    def finish(self, winner, win_type):
        self.finished = True
        self.winner = winner.id
        self.win_type = win_type
        self.pending = None
        ranking = sorted(self.players, key=lambda p: (
            p.id != winner.id, p.bankrupt, -(p.bankrupt_order or 0) if p.bankrupt else 0,
            -self.net_worth(p)))
        summary = [{"id": p.id, "name": p.name, "color": p.color, "is_bot": p.is_bot,
                    "money": p.money, "net_worth": self.net_worth(p), "bankrupt": p.bankrupt,
                    "tiles": len(self.owned(p.id))} for p in ranking]
        self.emit("GAME_OVER", dur=1.0, winner_id=winner.id, win_type=win_type, summary=summary,
                  msg=f"🏆 {winner.name} chiến thắng!")

    def update_beacons(self):
        cur = self.beacons()
        keys = {(b["player_id"], b["tile"]) for b in cur}
        for b in cur:
            k = (b["player_id"], b["tile"])
            if k not in self.prev_beacons:
                p = self.player(b["player_id"])
                self.emit("VICTORY_ALERT", dur=0.6, player_id=p.id, target_tile=b["tile"],
                          win_type=b["win_type"],
                          msg=f"🚨 {p.name} chỉ còn thiếu {TILES[b['tile']]['name']} để thắng!")
        self.prev_beacons = keys

    # ------------------------------------------------------------------ snapshot
    def snapshot(self):
        tiles = []
        for i, ts in enumerate(self.tiles):
            d = dict(ts)
            d["rent"] = self.rent(i) if ts["owner"] else 0
            tiles.append(d)
        players_out = []
        for p in self.players:
            pd = p.to_dict()
            pd["net_worth"] = self.net_worth(p)
            players_out.append(pd)
        return {
            "turn_player": self.cur().id if self.players else None,
            "round": self.round,
            "wc_tile": self.wc_tile,
            "wc_bonus": self.wc_bonus,
            "festival_tiles": self.festival_tiles,
            "players": players_out,
            "tiles": tiles,
            "pending": self.pending,
            "beacons": self.beacons(),
            "finished": self.finished,
            "winner": self.winner,
            "win_type": self.win_type,
        }

    # ------------------------------------------------------------------ turn flow
    def start(self):
        fest_names = ", ".join(TILES[i]["name"] for i in self.festival_tiles)
        self.emit("LOG", dur=0.3,
                  msg=f"🎪 Lễ hội x2 tiền thuê tại: {fest_names}! Vốn ban đầu {START_MONEY}K.")
        self.begin_turn()

    def begin_turn(self):
        p = self.cur()
        for i, ts in enumerate(self.tiles):
            if ts["owner"] == p.id and ts["blackout"] > 0:
                ts["blackout"] -= 1
                if ts["blackout"] == 0:
                    self.emit("LOG", dur=0.2, msg=f"💡 {TILES[i]['name']} đã có điện trở lại.")
        self.set_roll_pending()
        self.emit("TURN", dur=0.45, player_id=p.id)

    def set_roll_pending(self):
        p = self.cur()
        self.pending = {"kind": "ROLL", "player_id": p.id, "in_jail": p.in_jail,
                        "jail_turns": p.jail_turns,
                        "can_pay_fine": p.in_jail and p.money >= JAIL_FINE,
                        "can_use_jail_card": p.in_jail and p.jail_free,
                        "dice_tools": dict(p.dice_tools),
                        "world_tour_target": p.wt_target}

    def end_action(self):
        if self.finished or self.check_victory():
            return
        p = self.cur()
        self.pending = None
        if not p.bankrupt and self.extra and not p.in_jail and p.wt_target is None:
            self.extra = False
            self.set_roll_pending()
            self.emit("LOG", dur=0.3, player_id=p.id, msg=f"🎲 {p.name} tung đôi — được thêm 1 lượt!")
            return
        self.next_turn()

    def next_turn(self):
        self.doubles = 0
        self.extra = False
        n = len(self.players)
        for _ in range(n):
            self.turn = (self.turn + 1) % n
            if self.turn == 0:
                self.round += 1
            if not self.players[self.turn].bankrupt:
                break
        self.begin_turn()

    # ------------------------------------------------------------------ actions
    def handle(self, pid, action, data):
        if self.finished:
            return False, "Trận đấu đã kết thúc"
        pend = self.pending
        if not pend or pend["player_id"] != pid:
            return False, "Chưa tới lượt của bạn"
        kind = pend["kind"]
        data = data or {}
        try:
            if action == "ROLL_DICE" and kind == "ROLL":
                pay = bool(data.get("pay_jail_fine"))
                use_card = bool(data.get("use_jail_card"))
                tool = data.get("dice_tool")
                if pay and not pend["can_pay_fine"]:
                    return False, "Không đủ tiền đóng phạt"
                if use_card and not pend["can_use_jail_card"]:
                    return False, "Bạn không có Thẻ Thoát Đảo"
                if tool and (tool not in ("EVEN", "ODD", "DOUBLE") or pend["dice_tools"].get(tool, 0) <= 0):
                    return False, "Công cụ xúc xắc không khả dụng"
                self.do_roll(pay, use_card, tool)
            elif action == "BUY_OR_BUILD" and kind in ("BUY", "BUILD"):
                return self.do_build(int(data.get("tile_idx", -1)), int(data.get("target_level", -1)))
            elif action == "BUYOUT_TILE" and kind == "BUYOUT":
                return self.do_buyout(int(data.get("tile_idx", -1)), bool(data.get("upgrade_after")))
            elif action == "SELECT_TARGET" and kind == "SELECT":
                return self.do_select(int(data.get("tile_idx", -1)))
            elif action == "LIQUIDATE_TILES" and kind == "LIQUIDATE":
                return self.do_liquidate([int(x) for x in data.get("tile_indices", [])])
            elif action == "SKIP" and (kind in ("BUY", "BUILD", "BUYOUT") or
                                       (kind == "SELECT" and pend.get("can_skip"))):
                self.pending = None
                self.end_action()
            else:
                return False, "Hành động không hợp lệ ở thời điểm này"
        finally:
            if not self.finished:
                self.update_beacons()
        return True, None

    # --- rolling / moving
    def _roll_pair(self, tool):
        if tool == "DOUBLE":
            d = self.rng.randint(1, 6)
            return d, d
        if tool == "EVEN":
            while True:
                d1, d2 = self.rng.randint(1, 6), self.rng.randint(1, 6)
                if (d1 + d2) % 2 == 0:
                    return d1, d2
        if tool == "ODD":
            while True:
                d1, d2 = self.rng.randint(1, 6), self.rng.randint(1, 6)
                if (d1 + d2) % 2 == 1:
                    return d1, d2
        return self.rng.randint(1, 6), self.rng.randint(1, 6)

    def do_roll(self, pay_fine, use_card=False, tool=None):
        p = self.cur()
        self.pending = None
        self.extra = False
        if p.wt_target is not None and not p.in_jail:
            target = p.wt_target
            p.wt_target = None
            self.move_to(p, target, "fly", msg=f"✈️ {p.name} bay tới {TILES[target]['name']}")
            self.resolve_tile(p)
            return
        if p.in_jail and use_card and p.jail_free:
            p.jail_free = False
            p.in_jail = False
            p.jail_turns = 0
            self.emit("LOG", dur=0.3, player_id=p.id, msg=f"🪪 {p.name} dùng Thẻ Thoát Đảo miễn phí!")
        elif p.in_jail and pay_fine:
            self.transfer(p, JAIL_FINE, None, "Đóng phạt Đảo Hoang")
            p.in_jail = False
            p.jail_turns = 0
            self.emit("LOG", dur=0.3, player_id=p.id, msg=f"⛵ {p.name} đóng phạt {JAIL_FINE}K rời Đảo Hoang.")

        if tool:
            p.dice_tools[tool] -= 1
        d1, d2 = self._roll_pair(tool)
        doubles = d1 == d2
        tool_tag = {"EVEN": " [Chẵn]", "ODD": " [Lẻ]", "DOUBLE": " [Đôi]"}.get(tool, "")
        self.emit("DICE_ROLLED", dur=2.5, player_id=p.id, is_bot=p.is_bot, dice=[d1, d2],
                  doubles=doubles, msg=f"🎲 {p.name} tung {d1} + {d2} = {d1 + d2}{tool_tag}{' (Đôi!)' if doubles else ''}")
        steps = d1 + d2
        if p.in_jail:
            if doubles:
                p.in_jail = False
                p.jail_turns = 0
                self.emit("LOG", dur=0.3, player_id=p.id, msg=f"🎉 {p.name} tung đôi, thoát khỏi Đảo Hoang!")
                self.move_steps(p, steps)
                self.resolve_tile(p)
                return
            p.jail_turns += 1
            if p.jail_turns >= 3:
                p.in_jail = False
                p.jail_turns = 0
                self.emit("LOG", dur=0.3, player_id=p.id, msg=f"⛓️ {p.name} hết 3 lượt, bắt buộc đóng phạt {JAIL_FINE}K.")
                self.charge(p, JAIL_FINE, None, "Phạt Đảo Hoang", ("MOVE", steps))
                return
            self.emit("LOG", dur=0.4, player_id=p.id, msg=f"🏝️ {p.name} vẫn mắc kẹt trên Đảo Hoang ({p.jail_turns}/3).")
            self.end_action()
            return
        if doubles:
            self.doubles += 1
            if self.doubles >= 3:
                self.emit("LOG", dur=0.3, player_id=p.id, msg=f"🚨 {p.name} tung đôi 3 lần liên tiếp — vào Đảo Hoang!")
                self.send_to_jail(p)
                self.end_action()
                return
            self.extra = True
        self.move_steps(p, steps)
        self.resolve_tile(p)

    def give_salary(self, p):
        p.money += SALARY
        p.laps += 1
        self.emit("MONEY", dur=0.4, changes=[{"player_id": p.id, "delta": SALARY}],
                  msg=f"💵 {p.name} qua ô Bắt Đầu, nhận {SALARY}K (vòng {p.laps + 1}).")

    def move_steps(self, p, steps):
        start = p.pos
        p.pos = (start + steps) % 32
        self.emit("MOVE", dur=0.35 + 0.27 * steps, player_id=p.id, frm=start, to=p.pos, steps=steps, kind="walk")
        if start + steps >= 32:
            self.give_salary(p)

    def move_to(self, p, target, kind, msg=None):
        start = p.pos
        steps = (target - start) % 32
        p.pos = target
        self.emit("MOVE", dur=1.8, player_id=p.id, frm=start, to=target, steps=steps, kind=kind, msg=msg)
        if steps > 0 and start + steps >= 32:
            self.give_salary(p)

    def send_to_jail(self, p):
        start = p.pos
        p.pos = JAIL_IDX
        p.in_jail = True
        p.jail_turns = 0
        p.wt_target = None
        self.extra = False
        self.emit("MOVE", dur=1.2, player_id=p.id, frm=start, to=JAIL_IDX, steps=0, kind="jail",
                  msg=f"🏝️ {p.name} bị đưa ra Hòn đảo bị lãng quên!")

    # --- money
    def transfer(self, p, amount, creditor_id, reason):
        p.money -= amount
        changes = [{"player_id": p.id, "delta": -amount}]
        if creditor_id:
            c = self.player(creditor_id)
            c.money += amount
            changes.append({"player_id": c.id, "delta": amount})
            msg = f"💸 {p.name} trả {amount}K cho {c.name} ({reason})."
        else:
            msg = f"💸 {p.name} trả {amount}K ({reason})."
        self.emit("MONEY", dur=0.6, changes=changes, msg=msg)

    def charge(self, p, amount, creditor_id, reason, cont):
        if p.money >= amount:
            self.transfer(p, amount, creditor_id, reason)
            self.run_cont(cont)
            return
        assets = p.money + sum(self.liquidate_value(i) for i in self.owned(p.id))
        if assets < amount:
            self.bankrupt(p, creditor_id, amount, reason)
            return
        self.debt = {"amount": amount, "creditor": creditor_id, "reason": reason, "cont": cont}
        self.set_liquidate_pending(p)
        self.emit("LOG", dur=0.4, player_id=p.id,
                  msg=f"⚠️ {p.name} thiếu tiền trả {amount}K — phải bán tài sản!")

    def set_liquidate_pending(self, p):
        self.pending = {"kind": "LIQUIDATE", "player_id": p.id, "debt": self.debt["amount"],
                        "creditor": self.debt["creditor"], "reason": self.debt["reason"],
                        "options": [{"tile": i, "value": self.liquidate_value(i)} for i in self.owned(p.id)]}

    def release_tile(self, idx):
        fest = self.tiles[idx]["festival"]
        if self.wc_tile == idx:
            self.wc_tile = None
        self.tiles[idx] = {"owner": None, "level": 0, "champ": 1, "festival": fest, "blackout": 0}

    def do_liquidate(self, indices):
        p = self.cur()
        indices = list(dict.fromkeys(indices))
        if not indices or any(self.tiles[i]["owner"] != p.id for i in indices if 0 <= i < 32) \
                or any(not (0 <= i < 32) for i in indices):
            return False, "Danh sách ô bán không hợp lệ"
        for i in indices:
            v = self.liquidate_value(i)
            self.release_tile(i)
            p.money += v
            self.emit("SELL", dur=0.5, player_id=p.id, tile=i, value=v,
                      changes=[{"player_id": p.id, "delta": v}],
                      msg=f"🏚️ {p.name} bán {TILES[i]['name']} cho ngân hàng được {v}K.")
        debt = self.debt
        if p.money >= debt["amount"]:
            self.debt = None
            self.pending = None
            self.transfer(p, debt["amount"], debt["creditor"], debt["reason"])
            self.run_cont(debt["cont"])
        else:
            self.set_liquidate_pending(p)
        return True, None

    def bankrupt(self, p, creditor_id, amount, reason):
        for i in self.owned(p.id):
            p.money += self.liquidate_value(i)
            self.release_tile(i)
        cash = p.money
        p.money = 0
        changes = [{"player_id": p.id, "delta": -cash}]
        c = self.player(creditor_id) if creditor_id else None
        if c:
            c.money += cash
            changes.append({"player_id": c.id, "delta": cash})
        p.bankrupt = True
        self.bankrupt_count += 1
        p.bankrupt_order = self.bankrupt_count
        p.in_jail = False
        p.wt_target = None
        self.debt = None
        self.emit("BANKRUPT", dur=1.2, player_id=p.id, changes=changes,
                  msg=f"💀 {p.name} phá sản! (không đủ trả {amount}K — {reason})")
        if p is self.cur():
            self.pending = None
            self.extra = False
            self.end_action()
        else:
            self.check_victory()

    def run_cont(self, cont):
        kind = cont[0]
        p = self.cur()
        if kind == "END":
            self.end_action()
        elif kind == "BUYOUT_OFFER":
            self.offer_buyout(p, cont[1])
        elif kind == "MOVE":
            self.move_steps(p, cont[1])
            self.resolve_tile(p)

    # --- tile resolution
    def resolve_tile(self, p):
        idx = p.pos
        t = TILES[idx]
        ts = self.tiles[idx]
        typ = t["type"]
        if typ == "START":
            self.end_action()
        elif typ in ("CITY", "RESORT"):
            if ts["owner"] is None:
                if p.money >= t["price"]:
                    max_level = 0 if typ == "RESORT" else self.build_cap(p)
                    costs = [t["price"] + lv * t["build"] for lv in range(max_level + 1)]
                    self.pending = {"kind": "BUY", "player_id": p.id, "tile": idx, "current_level": -1,
                                    "max_level": max_level, "costs": costs,
                                    "rents": [self.rent(idx, lv, None, p.id) for lv in range(max_level + 1)]}
                else:
                    self.emit("LOG", dur=0.3, player_id=p.id, msg=f"{p.name} không đủ tiền mua {t['name']}.")
                    self.end_action()
            elif ts["owner"] == p.id:
                self.offer_build(p, idx)
            else:
                owner = self.player(ts["owner"])
                rent = self.rent(idx)
                if rent > 0 and p.angel:
                    p.angel = False
                    self.emit("LOG", dur=0.6, player_id=p.id,
                              msg=f"😇 Thẻ Thiên Thần giúp {p.name} miễn {rent}K tiền thuê!")
                    rent = 0
                if rent > 0:
                    self.charge(p, rent, owner.id, f"thuê {t['name']}", ("BUYOUT_OFFER", idx))
                else:
                    if ts["blackout"] > 0:
                        self.emit("LOG", dur=0.3, msg=f"⚡ {t['name']} đang cúp điện — không thu tiền thuê.")
                    self.offer_buyout(p, idx)
        elif typ == "CHANCE":
            self.draw_card(p)
        elif typ == "JAIL":
            p.in_jail = True
            p.jail_turns = 0
            self.extra = False
            self.emit("LOG", dur=0.4, player_id=p.id, msg=f"🏝️ {p.name} dạt vào Hòn đảo bị lãng quên!")
            self.end_action()
        elif typ == "TAX":
            amount = max(50, int(self.net_worth(p) * 0.10))
            self.charge(p, amount, None, "Thuế 10% tổng tài sản", ("END",))
        elif typ == "CHAMPIONSHIP":
            mine = [i for i in self.owned(p.id) if TILES[i]["type"] == "CITY"]
            self.emit("WORLD_CUP_ARRIVE", dur=2.2, player_id=p.id, has_cities=bool(mine),
                      msg=f"🏆 Chúc mừng {p.name} đến với Giải Đấu Thế Giới!")
            if mine:
                valid = [i for i in mine if self.wc_tile in (None, i) or p.money >= WORLD_CUP_MOVE_FEE]
                if valid:
                    self.pending = {"kind": "SELECT", "player_id": p.id, "purpose": "CHAMPIONSHIP",
                                    "options": valid, "can_skip": True,
                                    "wc_tile": self.wc_tile, "move_fee": WORLD_CUP_MOVE_FEE,
                                    "prompt": "Chọn 1 thành phố đăng cai Giải Đấu Thế Giới (+1 hệ số thuê; chuyển từ ô khác mất 50K)"}
                else:
                    self.emit("LOG", dur=0.3, player_id=p.id, msg=f"🏆 {p.name} không đủ 50K để chuyển Giải Đấu Thế Giới.")
                    self.end_action()
            else:
                self.emit("LOG", dur=0.3, player_id=p.id, msg=f"🏆 {p.name} chưa có thành phố để tổ chức giải.")
                self.end_action()
        elif typ == "WORLD_TOUR":
            if p.money < WORLD_TOUR_FEE:
                self.emit("LOG", dur=0.3, player_id=p.id,
                          msg=f"✈️ {p.name} không đủ {WORLD_TOUR_FEE}K mua vé Du lịch thế giới.")
                self.end_action()
                return
            unowned = [i for i in BUYABLE if self.tiles[i]["owner"] is None]
            opts = unowned if unowned else self.owned(p.id)
            if opts:
                self.pending = {"kind": "SELECT", "player_id": p.id, "purpose": "WORLD_TOUR",
                                "options": opts, "can_skip": True, "cost": WORLD_TOUR_FEE,
                                "prompt": (f"Chọn 1 thành phố CHƯA BỊ MUA để bay tới lượt sau (vé {WORLD_TOUR_FEE}K)"
                                           if unowned
                                           else f"Chọn 1 ô TÀI SẢN CÁ NHÂN để bay tới lượt sau (vé {WORLD_TOUR_FEE}K)")}
            else:
                self.end_action()
        else:
            self.end_action()

    def offer_build(self, p, idx):
        t = TILES[idx]
        ts = self.tiles[idx]
        if t["type"] != "CITY" or ts["level"] >= 4:
            self.end_action()
            return
        lv = ts["level"]
        # Khách sạn (Cấp 4) chỉ xây được khi đã có đủ 3 nhà từ trước; không mua 3 nhà + khách sạn cùng lúc
        max_level = 4 if lv == 3 else min(3, max(lv + 1, self.build_cap(p)))
        if max_level <= lv or p.money < t["build"]:
            self.end_action()
            return
        costs = [(target - lv) * t["build"] if target > lv else 0 for target in range(max_level + 1)]
        self.pending = {"kind": "BUILD", "player_id": p.id, "tile": idx, "current_level": lv,
                        "max_level": max_level, "costs": costs,
                        "rents": [self.rent(idx, x) for x in range(max_level + 1)]}

    def offer_buyout(self, p, idx):
        ts = self.tiles[idx]
        t = TILES[idx]
        if (not p.bankrupt and t["type"] == "CITY" and ts["owner"] not in (None, p.id)
                and ts["level"] <= 3):
            price = 2 * self.tile_value(idx)
            if p.money >= price:
                self.pending = {"kind": "BUYOUT", "player_id": p.id, "tile": idx, "price": price,
                                "owner": ts["owner"], "level": ts["level"],
                                "upgrade_cost": t["build"],
                                "can_upgrade": ts["level"] == 3 and p.money - price >= t["build"]}
                return
        self.end_action()

    def do_build(self, idx, target):
        p = self.cur()
        pend = self.pending
        if idx != pend["tile"] or not (0 <= target <= pend["max_level"]):
            return False, "Cấp độ không hợp lệ"
        t = TILES[idx]
        ts = self.tiles[idx]
        if pend["kind"] == "BUY":
            cost = pend["costs"][target]
            if p.money < cost:
                return False, "Không đủ tiền"
            self.pending = None
            ts["owner"] = p.id
            ts["level"] = target
            p.money -= cost
            what = "mua đất" if target == 0 else f"mua đất và xây {target} nhà"
            self.emit("BUY", dur=0.9, player_id=p.id, tile=idx, level=target,
                      changes=[{"player_id": p.id, "delta": -cost}],
                      msg=f"🏠 {p.name} {what} tại {t['name']} ({cost}K).")
        else:
            if target <= ts["level"]:
                return False, "Phải nâng lên cấp cao hơn"
            cost = pend["costs"][target]
            if p.money < cost:
                return False, "Không đủ tiền"
            self.pending = None
            ts["level"] = target
            p.money -= cost
            self.emit("BUILD", dur=0.9, player_id=p.id, tile=idx, level=target,
                      changes=[{"player_id": p.id, "delta": -cost}],
                      msg=f"🏗️ {p.name} nâng {t['name']} lên {'Khách sạn' if target == 4 else f'{target} nhà'} ({cost}K).")
        self.end_action()
        return True, None

    def do_buyout(self, idx, upgrade_after):
        p = self.cur()
        pend = self.pending
        if idx != pend["tile"]:
            return False, "Ô không hợp lệ"
        ts = self.tiles[idx]
        t = TILES[idx]
        price = pend["price"]
        if p.money < price:
            return False, "Không đủ tiền"
        self.pending = None
        old = self.player(ts["owner"])
        p.money -= price
        old.money += price
        ts["owner"] = p.id
        self.emit("BUYOUT", dur=1.0, player_id=p.id, tile=idx, from_id=old.id,
                  changes=[{"player_id": p.id, "delta": -price}, {"player_id": old.id, "delta": price}],
                  msg=f"🤝 {p.name} mua lại {t['name']} từ {old.name} với giá {price}K!")
        if upgrade_after and ts["level"] == 3 and p.money >= t["build"]:
            ts["level"] += 1
            p.money -= t["build"]
            self.emit("BUILD", dur=0.8, player_id=p.id, tile=idx, level=ts["level"],
                      changes=[{"player_id": p.id, "delta": -t["build"]}],
                      msg=f"🏗️ {p.name} nâng {t['name']} lên Khách sạn.")
        self.end_action()
        return True, None

    # --- chance
    def draw_card(self, p):
        card = self.rng.choice(list(CARDS.keys()))
        info = CARDS[card]
        self.emit("CARD", dur=2.5, player_id=p.id, card=card, tier=info["tier"],
                  msg=f"{info['icon']} {p.name} rút {info['name']}")
        others = [q.id for q in self.alive() if q.id != p.id]
        opp_cities = [i for i in CITIES if self.tiles[i]["owner"] in others]
        my_cities = [i for i in CITIES if self.tiles[i]["owner"] == p.id]

        def select(options, prompt, **extra):
            if not options:
                self.emit("LOG", dur=0.3, msg="…nhưng không có mục tiêu hợp lệ, thẻ mất tác dụng.")
                self.end_action()
                return
            self.pending = {"kind": "SELECT", "player_id": p.id, "purpose": "CHANCE", "card": card,
                            "options": options, "can_skip": False, "prompt": prompt, **extra}

        if card == "ANGEL":
            p.angel = True
            self.end_action()
        elif card == "JAIL_FREE":
            p.jail_free = True
            self.end_action()
        elif card == "BIRTHDAY":
            total_gift = 0
            changes = []
            for q in self.alive():
                if q.id != p.id and q.money > 0:
                    amt = min(25, q.money)
                    q.money -= amt
                    total_gift += amt
                    changes.append({"player_id": q.id, "delta": -amt})
            if total_gift > 0:
                p.money += total_gift
                changes.append({"player_id": p.id, "delta": total_gift})
                self.emit("MONEY", dur=0.5, changes=changes,
                          msg=f"🎂 Chúc mừng sinh nhật! {p.name} nhận {total_gift}K từ các đối thủ.")
            self.end_action()
        elif card == "START_GO":
            if p.pos == 0:
                self.give_salary(p)
            else:
                self.move_to(p, 0, "fly", msg=f"🏁 {p.name} bay thẳng về ô Bắt Đầu!")
            self.end_action()
        elif card == "INVITATION":
            self.move_to(p, 24, "fly", msg=f"✈️ {p.name} nhận Thư mời tới Chuyến Đi Vòng Quanh Thế Giới!")
            self.resolve_tile(p)
        elif card == "BLACKOUT":
            select([i for i in opp_cities if self.tiles[i]["blackout"] == 0] or opp_cities,
                   "Chọn thành phố đối thủ để cúp điện 3 vòng")
        elif card == "EARTHQUAKE":
            select([i for i in opp_cities if 1 <= self.tiles[i]["level"] <= 3],
                   "Chọn thành phố đối thủ để phá hủy 1 cấp nhà")
        elif card == "EXCHANGE":
            mine = [i for i in my_cities if self.tiles[i]["level"] < 4]
            theirs = [i for i in opp_cities if self.tiles[i]["level"] < 4]
            if mine and theirs:
                select(mine, "Bước 1/2: Chọn thành phố CỦA BẠN để đem đổi", step=1)
            else:
                select([], "")
        elif card == "FREE_UPGRADE":
            select([i for i in my_cities if self.tiles[i]["level"] < 4], "Chọn thành phố của bạn để nâng miễn phí 1 cấp")
        elif card == "TELEPORT":
            select([0, 16, 24], "Chọn điểm đến: Bắt Đầu, Giải Đấu Thế Giới hoặc Du Lịch Thế Giới")
        elif card == "TAX_AUDIT":
            self.charge(p, 50, None, "Phạt ngân sách", ("END",))
        elif card == "ARREST":
            self.send_to_jail(p)
            self.end_action()

    def do_select(self, idx):
        p = self.cur()
        pend = self.pending
        if idx not in pend["options"]:
            return False, "Ô không hợp lệ"
        purpose = pend["purpose"]
        t = TILES[idx]
        ts = self.tiles[idx]
        self.pending = None
        if purpose == "CHAMPIONSHIP":
            if self.wc_tile is not None and self.wc_tile != idx:
                if p.money < WORLD_CUP_MOVE_FEE:
                    self.pending = pend
                    return False, "Không đủ 50K để chuyển Giải Đấu Thế Giới"
                self.transfer(p, WORLD_CUP_MOVE_FEE, None, "Chuyển Giải Đấu Thế Giới")
                self.tiles[self.wc_tile]["champ"] = 1
            self.wc_tile = idx
            self.wc_bonus += 1
            ts["champ"] = 1 + self.wc_bonus
            self.emit("CHAMPIONSHIP", dur=1.0, player_id=p.id, tile=idx, mult=self.rent_multiplier(idx, ts["owner"]),
                      msg=f"🏆 {t['name']} đăng cai Giải Đấu Thế Giới (hệ số thuê x{self.rent_multiplier(idx, ts['owner'])})!")
            self.end_action()
        elif purpose == "WORLD_TOUR":
            if p.money < WORLD_TOUR_FEE:
                self.pending = pend
                return False, f"Không đủ {WORLD_TOUR_FEE}K đặt vé Du lịch thế giới"
            if WORLD_TOUR_FEE > 0:
                self.transfer(p, WORLD_TOUR_FEE, None, "Vé Du lịch vòng quanh thế giới")
            p.wt_target = idx
            self.extra = False
            self.emit("LOG", dur=0.4, player_id=p.id, msg=f"✈️ {p.name} đặt vé bay tới {t['name']} ở lượt sau.")
            self.end_action()
        else:
            card = pend["card"]
            if card == "BLACKOUT":
                ts["blackout"] = 3
                self.emit("BLACKOUT", dur=0.9, player_id=p.id, tile=idx,
                          msg=f"⚡ {t['name']} bị cúp điện trong 3 vòng!")
                self.end_action()
            elif card == "EARTHQUAKE":
                ts["level"] -= 1
                self.emit("EARTHQUAKE", dur=1.0, player_id=p.id, tile=idx,
                          msg=f"🌋 Động đất! {t['name']} giảm xuống {ts['level']} nhà.")
                self.end_action()
            elif card == "EXCHANGE":
                if pend.get("step") == 1:
                    others = [q.id for q in self.alive() if q.id != p.id]
                    theirs = [i for i in CITIES if self.tiles[i]["owner"] in others and self.tiles[i]["level"] < 4]
                    self.pending = {"kind": "SELECT", "player_id": p.id, "purpose": "CHANCE", "card": card,
                                    "options": theirs, "can_skip": False, "step": 2, "mine": idx,
                                    "prompt": f"Bước 2/2: Chọn thành phố ĐỐI THỦ để đổi lấy {t['name']}"}
                else:
                    mine = pend["mine"]
                    other = self.player(ts["owner"])
                    self.tiles[mine]["owner"], ts["owner"] = other.id, p.id
                    self.emit("EXCHANGE", dur=1.0, player_id=p.id, tile=idx, other_tile=mine,
                              msg=f"🔄 {p.name} đổi {TILES[mine]['name']} lấy {t['name']} của {other.name}!")
                    self.end_action()
            elif card == "FREE_UPGRADE":
                ts["level"] += 1
                self.emit("BUILD", dur=0.9, player_id=p.id, tile=idx, level=ts["level"],
                          msg=f"🏗️ {t['name']} được nâng miễn phí lên {'Khách sạn' if ts['level'] == 4 else str(ts['level']) + ' nhà'}!")
                self.end_action()
            elif card == "TELEPORT":
                self.move_to(p, idx, "fly", msg=f"🌀 {p.name} được triệu tập tới {t['name']}.")
                self.resolve_tile(p)
        return True, None

    # ------------------------------------------------------------------ takeover helper
    def unowned_ratio(self):
        return sum(1 for i in BUYABLE if self.tiles[i]["owner"] is None) / len(BUYABLE)
