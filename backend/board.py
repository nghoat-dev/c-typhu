"""Định nghĩa bàn cờ Business Tour 32 ô chuẩn quốc tế (đơn vị K = 1.000 tiền giấy)."""

START_MONEY = 2000        # 2.000.000 tiền giấy khởi đầu
SALARY = 300              # 300.000 mỗi lần qua ô Bắt Đầu
JAIL_FINE = 200           # 200.000 để rời Hòn đảo bị lãng quên
WORLD_CUP_MOVE_FEE = 50   # 50.000 để chuyển Giải đấu Thế giới sang thành phố của mình
WORLD_TOUR_FEE = 50       # 50.000 vé Du lịch vòng quanh thế giới (theo GDD trang 33)
JAIL_IDX = 8
MAX_RENT_MULT = 10        # Hệ số cho thuê tối đa là 10
MATCH_MAX_SECONDS = 1800  # Giới hạn ván đấu 30 phút
K_LEVEL = [1, 2.5, 6, 14, 30]

# 4 nhân vật đã chọn theo ảnh mẫu & GDD Business Tour
CHARACTERS = [
    {"id": 0, "name": "Doanh nhân", "color": "#d81b60",
     "desc": "Một doanh nhân chuyên nghiệp và uy tín."},
    {"id": 1, "name": "Khách du lịch", "color": "#689f38",
     "desc": "Một người tìm kiếm các cuộc phiêu lưu."},
    {"id": 2, "name": "Quý bà với một con chó", "color": "#eab308",
     "desc": "Một quý cô quyến rũ và người bạn trung thành."},
    {"id": 3, "name": "Nữ doanh nhân", "color": "#2563eb",
     "desc": "Đừng cản đường cô ấy!"},
]

GROUPS = {
    "SPAIN": [1, 2, 3],
    "CHINA": [5, 6, 7],
    "ITALY": [9, 10, 11],
    "GERMANY": [13, 15],
    "UK_AUS": [17, 19],
    "USA": [21, 22, 23],
    "FRANCE": [26, 27],
    "RUSSIA": [29, 31],
}
GROUP_INFO = {
    "SPAIN": {"name": "Tây Ban Nha", "color": "#dfa5a5"},
    "CHINA": {"name": "Trung Quốc", "color": "#b9add4"},
    "ITALY": {"name": "Ý", "color": "#f5d6b0"},
    "GERMANY": {"name": "Đức", "color": "#bcd482"},
    "UK_AUS": {"name": "Anh & Úc", "color": "#ebd798"},
    "USA": {"name": "Mỹ", "color": "#bfa9b0"},
    "FRANCE": {"name": "Pháp", "color": "#98c7c7"},
    "RUSSIA": {"name": "Nga", "color": "#99badd"},
}
RESORTS = [4, 14, 18, 25]
SIDES = [
    [1, 2, 3, 4, 5, 6, 7],
    [9, 10, 11, 13, 14, 15],
    [17, 18, 19, 21, 22, 23],
    [25, 26, 27, 29, 31],
]


def _city(name, group, price, rent):
    return {"name": name, "type": "CITY", "group": group, "price": price,
            "build": price // 2, "rent": rent}


def _resort(name):
    return {"name": name, "type": "RESORT", "group": "RESORT", "price": 200, "build": 0, "rent": 25}


TILES = [
    {"name": "Bắt Đầu", "type": "START"},
    _city("Granada", "SPAIN", 60, 10),
    _city("Seville", "SPAIN", 60, 12),
    _city("Madrid", "SPAIN", 80, 16),
    _resort("Bali"),
    _city("Hồng Kông", "CHINA", 100, 18),
    _city("Bắc Kinh", "CHINA", 100, 20),
    _city("Thượng Hải", "CHINA", 120, 24),
    {"name": "Hòn Đảo Bị Lãng Quên", "type": "JAIL"},
    _city("Venice", "ITALY", 140, 28),
    _city("Milan", "ITALY", 140, 28),
    _city("Roma", "ITALY", 160, 32),
    {"name": "Cơ Hội", "type": "CHANCE"},
    _city("Hamburg", "GERMANY", 180, 36),
    _resort("Síp"),
    _city("Berlin", "GERMANY", 200, 40),
    {"name": "Giải Đấu Thế Giới", "type": "CHAMPIONSHIP"},
    _city("London", "UK_AUS", 220, 44),
    _resort("Dubai"),
    _city("Sydney", "UK_AUS", 240, 48),
    {"name": "Cơ Hội", "type": "CHANCE"},
    _city("Chicago", "USA", 260, 52),
    _city("Las Vegas", "USA", 280, 56),
    _city("New York", "USA", 300, 60),
    {"name": "Chuyến Đi Vòng Quanh Thế Giới", "type": "WORLD_TOUR"},
    _resort("Nice"),
    _city("Lyon", "FRANCE", 320, 64),
    _city("Paris", "FRANCE", 350, 70),
    {"name": "Cơ Hội", "type": "CHANCE"},
    _city("Sochi", "RUSSIA", 380, 76),
    {"name": "Thuế", "type": "TAX"},
    _city("Moskva", "RUSSIA", 420, 85),
]
for _i, _t in enumerate(TILES):
    _t["idx"] = _i

BUYABLE = [i for i, t in enumerate(TILES) if t["type"] in ("CITY", "RESORT")]
CITIES = [i for i, t in enumerate(TILES) if t["type"] == "CITY"]

# Bộ bài Cơ Hội theo GDD trang 22 & 27-32 (3 hạng: Vàng GOLD, Bạc SILVER, Mộc WOOD)
CARDS = {
    "ANGEL": {"tier": "GOLD", "name": "Phiếu Giảm Giá", "icon": "😇",
              "desc": "Thẻ Vàng: Miễn 100% tiền thuê ở lần tới dẫm vào đất đối thủ."},
    "BIRTHDAY": {"tier": "GOLD", "name": "Chúc Mừng Sinh Nhật", "icon": "🎂",
                 "desc": "Thẻ Vàng: Nhận ngay 25K quà sinh nhật từ mỗi đối thủ."},
    "START_GO": {"tier": "GOLD", "name": "Đầu Tiên", "icon": "🏁",
                 "desc": "Thẻ Vàng: Di chuyển ngay tới ô Bắt Đầu và nhận 300K."},
    "FREE_UPGRADE": {"tier": "GOLD", "name": "Nâng Cấp Miễn Phí", "icon": "🏗️",
                     "desc": "Thẻ Vàng: Nâng miễn phí 1 cấp cho 1 thành phố của bạn."},
    "JAIL_FREE": {"tier": "GOLD", "name": "Đường Về Nhà", "icon": "🪪",
                  "desc": "Thẻ Vàng: Lưu giữ để thoát khỏi Hòn đảo bị lãng quên miễn phí."},
    "INVITATION": {"tier": "SILVER", "name": "Thư Mời", "icon": "✈️",
                   "desc": "Thẻ Bạc: Tham gia chuyến đi vòng quanh thế giới (tới ô Du lịch)."},
    "BLACKOUT": {"tier": "SILVER", "name": "Cúp Điện", "icon": "⚡",
                 "desc": "Thẻ Bạc: Tắt đèn 1 thành phố đối thủ trong 3 vòng."},
    "EXCHANGE": {"tier": "SILVER", "name": "Tráo Đổi Thành Phố", "icon": "🔄",
                 "desc": "Thẻ Bạc: Đổi 1 thành phố của bạn lấy 1 thành phố đối thủ."},
    "TELEPORT": {"tier": "SILVER", "name": "Chuyến Đi Du Lịch", "icon": "🌀",
                 "desc": "Thẻ Bạc: Bay tới Bắt Đầu, Giải Đấu Thế Giới hoặc Du Lịch Thế Giới."},
    "EARTHQUAKE": {"tier": "WOOD", "name": "Phá Hoại", "icon": "🌋",
                   "desc": "Thẻ Mộc: Phá hủy 1 cấp nhà đối thủ (không gồm Khách sạn)."},
    "TAX_AUDIT": {"tier": "WOOD", "name": "Phạt Ngân Sách", "icon": "📉",
                  "desc": "Thẻ Mộc: Nộp phạt ngay 50K vào quỹ trò chơi."},
    "ARREST": {"tier": "WOOD", "name": "Hòn Đảo Bị Lãng Quên", "icon": "🏝️",
               "desc": "Thẻ Mộc: Di chuyển thẳng tới Hòn đảo bị lãng quên."},
}

WIN_TYPES = {
    "BANKRUPTCY": "Phá sản tất cả đối thủ",
    "TRIPLE_MONOPOLY": "Độc quyền 3 màu",
    "LINE_MONOPOLY": "Độc quyền 1 cạnh",
    "RESORT_MONOPOLY": "Độc quyền 4 Khu Nghỉ Mát",
    "HIGHEST_ASSETS": "Tổng tài sản cao nhất (Hết giờ)",
}

DICE_PROB = {d: (6 - abs(d - 7)) / 36 for d in range(2, 13)}


def board_payload():
    return {"tiles": TILES, "groups": GROUPS, "group_info": GROUP_INFO, "resorts": RESORTS,
            "sides": SIDES, "cards": CARDS, "win_types": WIN_TYPES, "characters": CHARACTERS}
