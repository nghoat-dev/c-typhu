"""Mô phỏng hàng loạt trận Bot vs Bot để kiểm tra luật chơi & AI (chạy: python sim_test.py)."""
import collections
import random
import sys

import ai_bot
from game_engine import Game, Player


def run(n_games=300, seed=1):
    random.seed(seed)
    stats = collections.Counter()
    wins_by_diff = collections.Counter()
    total_actions = 0
    for g in range(n_games):
        diffs = random.choice([["EASY", "MEDIUM"], ["MEDIUM", "HARD"], ["EASY", "MEDIUM", "HARD"],
                               ["HARD", "HARD", "EASY", "MEDIUM"]])
        players = [Player(f"b{i}", f"Bot{i}", "#fff", i, True, d) for i, d in enumerate(diffs)]
        game = Game(players, random.getrandbits(32))
        game.start()
        steps = 0
        while not game.finished:
            steps += 1
            if steps > 5000:
                stats["STALL"] += 1
                break
            p = game.player(game.pending["player_id"])
            action, data = ai_bot.decide(game, p)
            ok, err = game.handle(p.id, action, data)
            if not ok:
                print("REJECTED", action, data, err, game.pending)
                action, data = ai_bot.safe_default(game, p)
                ok, err = game.handle(p.id, action, data)
                if not ok:
                    print("FATAL", err)
                    sys.exit(1)
            # invariants
            for q in players:
                assert q.money >= 0, (q.id, q.money)
            for i, ts in enumerate(game.tiles):
                assert 0 <= ts["level"] <= 4
                if ts["owner"]:
                    assert not game.player(ts["owner"]).bankrupt
            game.pop_events()
        total_actions += steps
        if game.finished:
            stats[game.win_type] += 1
            wins_by_diff[game.player(game.winner).difficulty] += 1
    print("Kết quả:", dict(stats))
    print("Thắng theo độ khó:", dict(wins_by_diff))
    print("Số hành động TB/trận:", total_actions / n_games)


if __name__ == "__main__":
    run(int(sys.argv[1]) if len(sys.argv) > 1 else 300)
