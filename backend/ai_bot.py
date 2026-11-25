"""Bộ máy AI Bot — 3 cấp độ Dễ / Trung bình / Khó (tương thích bộ luật Business Tour mới)."""
import random

from board import CITIES, DICE_PROB, GROUPS, JAIL_FINE, RESORTS, TILES, WORLD_CUP_MOVE_FEE, WORLD_TOUR_FEE

RESERVE = {"EASY": 150, "MEDIUM": 350}


# ---------------------------------------------------------------- analysis helpers
def effective_diff(p):
    return p.difficulty if p.is_bot else "MEDIUM"


def opponents(game, p):
    return [q for q in game.alive() if q.id != p.id]


def hard_reserve(game, p):
    rmax = 0
    for k in range(1, 13):
        i = (p.pos + k) % 32
        ts = game.tiles[i]
        if ts["owner"] and ts["owner"] != p.id:
            rmax = max(rmax, game.rent(i))
    return max(300, 0.8 * rmax)


def reserve_for(game, p, diff):
    return hard_reserve(game, p) if diff == "HARD" else RESERVE[diff]


def completes_group(game, p, idx):
    t = TILES[idx]
    if t["type"] == "RESORT":
        return sum(1 for i in RESORTS if game.tiles[i]["owner"] == p.id) >= 2
    g = GROUPS[t["group"]]
    return all(game.tiles[i]["owner"] == p.id or i == idx for i in g)


def group_progress(game, p, idx):
    t = TILES[idx]
    g = RESORTS if t["type"] == "RESORT" else GROUPS[t["group"]]
    return sum(1 for i in g if game.tiles[i]["owner"] == p.id)


def opp_needs(game, p, idx):
    return any(b["tile"] == idx and b["player_id"] != p.id for b in game.beacons())


def s_prob(game, p, idx):
    total = 0.0
    for q in opponents(game, p):
        d = (idx - q.pos) % 32
        total += DICE_PROB.get(d, 0)
    return total


def protected(game, p, idx):
    t = TILES[idx]
    ts = game.tiles[idx]
    if t["type"] == "RESORT" or ts["level"] == 4 or ts.get("festival"):
        return True
    if game.owns_group(p.id, idx):
        return True
    for q in opponents(game, p):
        if game.would_win(q.id, extra_tiles=[idx]):
            return True
    return False


# ---------------------------------------------------------------- decisions
def decide(game, p):
    diff = effective_diff(p)
    pend = game.pending
    kind = pend["kind"]
    fn = {"ROLL": d_roll, "BUY": d_buy, "BUILD": d_build, "BUYOUT": d_buyout,
          "SELECT": d_select, "LIQUIDATE": d_liquidate}[kind]
    return fn(game, p, pend, diff)


def d_roll(game, p, pend, diff):
    if pend.get("can_use_jail_card"):
        return "ROLL_DICE", {"pay_jail_fine": False, "use_jail_card": True}
    pay = False
    if pend.get("can_pay_fine"):
        ratio = game.unowned_ratio()
        if diff == "EASY":
            pay = random.random() < 0.45
        elif diff == "MEDIUM":
            pay = p.money >= JAIL_FINE + 350 and ratio > 0.35
        else:
            pay = ratio > 0.4 and p.money >= JAIL_FINE + 250
    return "ROLL_DICE", {"pay_jail_fine": pay}


def _choose_level(game, p, pend, diff, reserve):
    costs = pend["costs"]
    lo = pend["current_level"] + 1 if pend["kind"] == "BUILD" else 0
    affordable = [lv for lv in range(lo, pend["max_level"] + 1) if p.money - costs[lv] >= reserve]
    if not affordable:
        return None
    if diff == "EASY":
        return random.choice(affordable)
    if diff == "MEDIUM":
        idx = pend["tile"]
        cap = pend["max_level"] if idx >= 13 or game.owns_group(p.id, idx) else min(pend["max_level"], max(lo, 1))
        best = [lv for lv in affordable if lv <= cap]
        return max(best) if best else min(affordable)
    idx = pend["tile"]
    best, best_u = None, -1e9
    for lv in affordable:
        rent = pend["rents"][lv] if pend.get("rents") else 0
        u = rent * (1 + 4 * s_prob(game, p, idx)) - 0.15 * costs[lv]
        if lv == 4:
            u += 150
        if u > best_u:
            best, best_u = lv, u
    return best


def d_buy(game, p, pend, diff):
    idx = pend["tile"]
    price = pend["costs"][0]
    win = game.would_win(p.id, extra_tiles=[idx])
    block = opp_needs(game, p, idx)
    comp = completes_group(game, p, idx)
    if win or (diff != "EASY" and block):
        lv = _choose_level(game, p, pend, diff, reserve_for(game, p, diff)) if not win else 0
        return "BUY_OR_BUILD", {"tile_idx": idx, "target_level": lv or 0}
    reserve = reserve_for(game, p, diff)
    if diff == "EASY":
        if p.money - price < reserve:
            return "SKIP", {}
    elif diff == "MEDIUM":
        if p.money - price < reserve:
            prio = comp or TILES[idx]["type"] == "RESORT" or group_progress(game, p, idx) > 0 or game.tiles[idx]["festival"]
            if not (prio and p.money - price >= 100):
                return "SKIP", {}
    else:
        if p.money - price < reserve * 0.6 and not (comp and p.money - price >= 80):
            return "SKIP", {}
    lv = _choose_level(game, p, pend, diff, reserve)
    if lv is None:
        lv = 0
    return "BUY_OR_BUILD", {"tile_idx": idx, "target_level": lv}


def d_build(game, p, pend, diff):
    reserve = reserve_for(game, p, diff)
    lv = _choose_level(game, p, pend, diff, reserve)
    if lv is None:
        return "SKIP", {}
    return "BUY_OR_BUILD", {"tile_idx": pend["tile"], "target_level": lv}


def d_buyout(game, p, pend, diff):
    idx = pend["tile"]
    price = pend["price"]
    after = p.money - price
    reserve = reserve_for(game, p, diff)
    do = False
    if diff == "EASY":
        do = random.random() < 0.15 and after >= 150
    elif diff == "MEDIUM":
        do = (completes_group(game, p, idx) or price < 0.45 * p.money) and after >= 150
        if game.would_win(p.id, extra_tiles=[idx]):
            do = True
    else:
        if game.would_win(p.id, extra_tiles=[idx]):
            do = True
        elif opp_needs(game, p, idx):
            do = after >= 0
        elif completes_group(game, p, idx) and after >= reserve * 0.7:
            do = True
        elif price < 0.3 * p.money and after >= reserve:
            do = True
    if not do:
        return "SKIP", {}
    up = pend["can_upgrade"] and after - pend["upgrade_cost"] >= (reserve if diff != "EASY" else 150)
    return "BUYOUT_TILE", {"tile_idx": idx, "upgrade_after": bool(up)}


def _wt_utility(game, p, idx):
    t = TILES[idx]
    ts = game.tiles[idx]
    u = 0.0
    if ts["owner"] is None:
        if p.money >= t["price"]:
            if game.would_win(p.id, extra_tiles=[idx]):
                u += 1000
            if opp_needs(game, p, idx):
                u += 900
            if completes_group(game, p, idx):
                u += 180
            if ts["festival"]:
                u += 120
            u += 100 * (t["rent"] / t["price"]) * (2 if 9 <= idx <= 23 else 1) + 20
        else:
            u -= 50
    elif ts["owner"] == p.id:
        u += 50 if ts["level"] < 4 and p.money >= t["build"] else 10
    return u


def d_select(game, p, pend, diff):
    opts = pend["options"]
    purpose = pend["purpose"]

    def pick(i):
        return "SELECT_TARGET", {"purpose": purpose, "tile_idx": i}

    if diff == "EASY":
        if purpose in ("WORLD_TOUR", "CHAMPIONSHIP") and random.random() < 0.4:
            return "SKIP", {}
        return pick(random.choice(opts))

    if purpose == "CHAMPIONSHIP":
        wc_tile = pend.get("wc_tile")
        def score_wc(i):
            cost = WORLD_CUP_MOVE_FEE if (wc_tile is not None and wc_tile != i) else 0
            if p.money < cost:
                return -1e9
            new_champ = 2 + game.wc_bonus
            r = game.rent(i, champ=new_champ)
            return r * (1 if diff == "MEDIUM" else (s_prob(game, p, i) + 0.05)) - cost
        return pick(max(opts, key=score_wc))

    if purpose == "WORLD_TOUR":
        if p.money < WORLD_TOUR_FEE:
            return "SKIP", {}
        if diff == "MEDIUM":
            cand = [i for i in opts if game.tiles[i]["owner"] is None and p.money - WORLD_TOUR_FEE - TILES[i]["price"] >= 150]
            if not cand:
                return "SKIP", {}
            cand.sort(key=lambda i: (completes_group(game, p, i), TILES[i]["type"] == "RESORT",
                                     game.tiles[i]["festival"], TILES[i]["price"]), reverse=True)
            return pick(cand[0])
        best = max(opts, key=lambda i: _wt_utility(game, p, i))
        if _wt_utility(game, p, best) < 25 or (game.tiles[best]["owner"] is None and p.money - WORLD_TOUR_FEE - TILES[best]["price"] < 50):
            return "SKIP", {}
        return pick(best)

    card = pend.get("card")
    if card in ("BLACKOUT", "EARTHQUAKE"):
        def score(i):
            s = game.rent(i) + game.tile_value(i) * 0.1
            if diff == "HARD":
                s *= 1 + 3 * s_prob(game, p, i) if card == "BLACKOUT" else 1
                if any(b["tile"] in GROUPS.get(TILES[i]["group"], []) and b["player_id"] == game.tiles[i]["owner"]
                       for b in game.beacons()):
                    s += 200
            return s
        return pick(max(opts, key=score))
    if card == "EXCHANGE":
        if pend.get("step") == 1:
            def keep_score(i):
                s = game.tile_value(i) + group_progress(game, p, i) * 80
                if game.owns_group(p.id, i):
                    s += 1000
                return s
            return pick(min(opts, key=keep_score))
        mine = pend.get("mine")

        def take_score(i):
            s = game.tile_value(i)
            if diff == "HARD":
                if game.would_win(p.id, extra_tiles=[i], remove_tiles=[mine]):
                    s += 5000
                owner = game.tiles[i]["owner"]
                if owner and game.would_win(owner, extra_tiles=[mine]):
                    s -= 4000
                if completes_group(game, p, i):
                    s += 300
                for b in game.beacons():
                    if b["player_id"] == owner:
                        g = TILES[b["tile"]].get("group")
                        if i in GROUPS.get(g, []) or b["tile"] == i:
                            s += 400
            return s
        return pick(max(opts, key=take_score))
    if card == "FREE_UPGRADE":
        return pick(max(opts, key=lambda i: game.rent(i, level=min(4, game.tiles[i]["level"] + 1)) - game.rent(i)))
    if card == "TELEPORT":
        has_city = any(TILES[i]["type"] == "CITY" for i in game.owned(p.id))
        if has_city and 16 in opts:
            return pick(16)
        if p.money >= 400 and 24 in opts:
            return pick(24)
        return pick(0)
    return pick(opts[0])


def d_liquidate(game, p, pend, diff):
    need = pend["debt"] - p.money
    opts = pend["options"]

    def prio(o):
        i = o["tile"]
        prot = protected(game, p, i)
        partial = 0 if not game.owns_group(p.id, i) else 1
        side1 = 0 if i < 8 else 1
        return (prot, partial, side1, game.tiles[i]["level"], o["value"])

    order = sorted(opts, key=prio) if diff != "EASY" else sorted(opts, key=lambda o: o["value"])
    chosen, total = [], 0
    for o in order:
        if total >= need:
            break
        chosen.append(o["tile"])
        total += o["value"]
    return "LIQUIDATE_TILES", {"tile_indices": chosen}


def safe_default(game, p):
    pend = game.pending
    kind = pend["kind"]
    if kind == "ROLL":
        return "ROLL_DICE", {"pay_jail_fine": False}
    if kind in ("BUY", "BUILD", "BUYOUT"):
        return "SKIP", {}
    if kind == "SELECT":
        if pend.get("can_skip"):
            return "SKIP", {}
        return d_select(game, p, pend, "MEDIUM")
    return d_liquidate(game, p, pend, "MEDIUM")
