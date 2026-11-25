# TÀI LIỆU ĐẶC TẢ YÊU CẦU & KẾ HOẠCH PHÁT TRIỂN DỰ ÁN

## DỰ ÁN: BUSINESS TOUR 3D WEB (MULTIPLAYER & AI BOT)

* **Phiên bản tài liệu:** 2.0.0 (Tích hợp đầy đủ chế độ Chơi với máy - AI Bot)
* **Nền tảng mục tiêu:** Web Browser (Desktop & Responsive WebGL)
* **Ngăn xếp công nghệ (Tech Stack):** Python (FastAPI, WebSockets, AsyncIO, Authlib, PyJWT, PostgreSQL, Redis) + Frontend 3D (Three.js, Cannon-es, GSAP, HTML5/CSS3)
* **Mô hình phát triển:** Agile / Scrum (16 tuần — 4 Releases — 8 Sprints)

---

## PHẦN 1: TỔNG QUAN DỰ ÁN & KIẾN TRÚC HỆ THỐNG

### 1.1. Mục tiêu sản phẩm & Các chế độ chơi
Xây dựng tựa game Cờ Tỷ Phú trực tuyến trên nền tảng Web với đồ họa 3D sinh ngẫu nhiên (Procedural 3D), nhân vật hình người có hoạt ảnh, tung xúc xắc vật lý 3D đồng bộ thời gian thực và áp dụng chuẩn bộ luật **Business Tour** (nhịp độ nhanh, công bằng, không pay-to-win). Hệ thống hỗ trợ 4 chế độ chơi linh hoạt (từ 2 đến 4 người tham gia/ván):

1. **Đấu trực tuyến (PvP Online):** 2 đến 4 người chơi thật ghép phòng công khai hoặc tạo phòng riêng bằng mã mời.
2. **Chơi với máy (Solo vs AI Bot):** 1 người chơi thật đấu với 1 đến 3 AI Bot có thể tùy chọn độ khó riêng lẻ (Dễ, Trung bình, Khó), cho phép trải nghiệm ngay lập tức mà không cần chờ ghép trận.
3. **Phòng hỗn hợp (PvP + AI Bot):** Nhóm 2–3 bạn bè có thể thêm AI Bot vào các vị trí còn trống để đủ bàn 4 người.
4. **Tự động tiếp quản (Auto-Takeover):** Khi người chơi thật bị mất kết nối mạng quá 30 giây hoặc thoát trận giữa chừng, AI Bot (mức Trung bình) tự động tiếp quản nhân vật để ván đấu không bị gián đoạn; người chơi có thể kết nối lại (Reconnect) để giành lại quyền điều khiển.

### 1.2. Hệ thống xác thực người dùng (Authentication)
Hỗ trợ 3 phương thức đăng nhập hợp nhất trên cùng một bảng định danh `users`:

1. **Google (Gmail - OAuth 2.0 / OpenID Connect):** Trích xuất `sub`, tên hiển thị, email và ảnh đại diện.
2. **Facebook (Meta Login - OAuth 2.0):** Trích xuất `id`, tên hiển thị và ảnh đại diện công khai.
3. **Khách (Guest Mode):** Tạo tài khoản tạm tức thì bằng `UUID`, tự sinh tên hiển thị (ví dụ: `Khach_A9F2`) và ảnh đại diện ngẫu nhiên, lưu JWT vào `localStorage` để giữ phiên khi tải lại trang và cho phép liên kết nâng cấp lên Google/Facebook.

### 1.3. Kiến trúc kỹ thuật (Server-Authoritative & Async AI)
* **Máy chủ quyết định kết quả (Server-Authoritative):** Toàn bộ logic tung xúc xắc, di chuyển, trừ tiền, tính tiền thuê, rút thẻ Cơ Hội, quyết định của AI Bot và kiểm tra điều kiện thắng được xử lý 100% ở Backend Python để chống gian lận tuyệt đối.
* **Đồng bộ cảnh 3D ngẫu nhiên:** Khi tạo phòng, Server sinh một khóa hạt giống duy nhất `match_seed` (số nguyên 32-bit) gửi cho mọi Client. Tất cả trình duyệt sử dụng chung `match_seed` để sinh địa hình, thời tiết và kiến trúc nhà 3D giống hệt nhau.
* **Vòng lặp AI bất đồng bộ:** AI Bot chạy ngay trên Server Python thông qua `asyncio.create_task()` gắn trực tiếp vào máy trạng thái lượt chơi (FSM), sử dụng chung giao thức sự kiện WebSocket như người chơi thật nên Frontend không cần viết lại logic xử lý riêng cho Bot.

---

## PHẦN 2: ĐẶC TẢ LUẬT CHƠI CHI TIẾT (CHUẨN BUSINESS TOUR 32 Ô)

### 2.1. Cấu trúc Bản đồ 32 ô (Chỉ số từ 0 đến 31)
Bàn cờ hình vuông gồm 4 cạnh, mỗi cạnh có 9 ô (tính cả 2 ô góc). Mỗi người chơi (và mỗi AI Bot) khởi đầu tại ô `0` với số vốn **1500 USD**.

| Chỉ số | Tên ô | Loại ô | Nhóm màu / Phân loại | Giá mua gốc (USD) | Chi phí xây 1 cấp (USD) | Tiền thuê gốc Cấp 0 (USD) |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: |
| **0** | **Bắt Đầu (START)** | `START` | Ô Góc 1 | 0 | 0 | Nhận +200 USD khi qua / dừng |
| 1 | Hà Nội | `CITY` | Nâu (2 ô) | 60 | 30 | 10 |
| 2 | Cơ Hội | `CHANCE` | Sự kiện | 0 | 0 | Rút 1 lá bài Cơ Hội |
| 3 | TP. Hồ Chí Minh | `CITY` | Nâu (2 ô) | 60 | 30 | 12 |
| 4 | Bãi Biển Nha Trang | `RESORT` | Bãi Biển (4 ô) | 150 | Không xây | 25 / 50 / 100 / 200 |
| 5 | Bangkok | `CITY` | Xanh Nhạt (3 ô) | 100 | 50 | 18 |
| 6 | Singapore | `CITY` | Xanh Nhạt (3 ô) | 100 | 50 | 18 |
| 7 | Kuala Lumpur | `CITY` | Xanh Nhạt (3 ô) | 120 | 60 | 22 |
| **8** | **Đảo Hoang (Nhà Tù)** | `JAIL` | Ô Góc 2 | 0 | 0 | Giam tối đa 3 lượt |
| 9 | Seoul | `CITY` | Hồng (2 ô) | 140 | 70 | 26 |
| 10 | Thuế Thu Nhập | `TAX` | Thuế | 0 | 0 | Trừ 10% tiền mặt (tối thiểu 100 USD) |
| 11 | Busan | `CITY` | Hồng (2 ô) | 140 | 70 | 26 |
| 12 | Bãi Biển Jeju | `RESORT` | Bãi Biển (4 ô) | 150 | Không xây | 25 / 50 / 100 / 200 |
| 13 | Tokyo | `CITY` | Cam (3 ô) | 180 | 90 | 34 |
| 14 | Osaka | `CITY` | Cam (3 ô) | 180 | 90 | 34 |
| 15 | Kyoto | `CITY` | Cam (3 ô) | 200 | 100 | 38 |
| **16** | **Giải Vô Địch Thế Giới** | `CHAMPIONSHIP` | Ô Góc 3 | 0 | 0 | Chọn 1 thành phố tăng hệ số thuê |
| 17 | Berlin | `CITY` | Đỏ (2 ô) | 220 | 110 | 42 |
| 18 | Cơ Hội | `CHANCE` | Sự kiện | 0 | 0 | Rút 1 lá bài Cơ Hội |
| 19 | Munich | `CITY` | Đỏ (2 ô) | 220 | 110 | 42 |
| 20 | Bãi Biển Miami | `RESORT` | Bãi Biển (4 ô) | 150 | Không xây | 25 / 50 / 100 / 200 |
| 21 | Paris | `CITY` | Vàng (3 ô) | 260 | 130 | 50 |
| 22 | Lyon | `CITY` | Vàng (3 ô) | 260 | 130 | 50 |
| 23 | Nice | `CITY` | Vàng (3 ô) | 280 | 140 | 55 |
| **24** | **Du Lịch Thế Giới** | `WORLD_TOUR` | Ô Góc 4 | 0 | 0 | Chọn bay tới bất kỳ ô nào lượt sau |
| 25 | London | `CITY` | Xanh Lá (3 ô) | 300 | 150 | 60 |
| 26 | Thuế Xa Xỉ | `TAX` | Thuế | 0 | 0 | Trừ cố định 150 USD |
| 27 | Manchester | `CITY` | Xanh Lá (3 ô) | 300 | 150 | 60 |
| 28 | Bãi Biển Hawaii | `RESORT` | Bãi Biển (4 ô) | 150 | Không xây | 25 / 50 / 100 / 200 |
| 29 | Liverpool | `CITY` | Xanh Lá (3 ô) | 320 | 160 | 65 |
| 30 | New York | `CITY` | Xanh Đậm (2 ô) | 350 | 175 | 75 |
| 31 | Los Angeles | `CITY` | Xanh Đậm (2 ô) | 400 | 200 | 90 |

### 2.2. Quy tắc 4 Ô Góc Đặc Biệt
1. **Ô 0 - Bắt Đầu (START):** Mỗi lần đi qua hoặc dừng tại ô `0`, nhận **200 USD** và tăng biến đếm vòng `laps` thêm 1.
2. **Ô 8 - Đảo Hoang (Lost Island / Jail):**
   * Bị giữ tối đa **3 lượt**.
   * **Cách thoát:** (a) Đóng phạt **50 USD** đầu lượt rồi tung xúc xắc bình thường; (b) Tung được xúc xắc đôi ($d_1 = d_2$) để thoát ngay và đi theo số nút vừa tung (không thưởng thêm lượt đôi); (c) Hết 3 lượt không ra đôi thì bắt buộc trừ 50 USD và di chuyển theo lần tung thứ 3.
3. **Ô 16 - Giải Vô Địch Thế Giới (World Championship):**
   * Nếu sở hữu ít nhất 1 Thành phố, chọn 1 Thành phố để đăng cai giải đấu.
   * Hệ số giải đấu $M_{\text{champ}}$ tăng cộng dồn mỗi lần chọn lại ($M_{\text{champ}} \in \{2, 3, 4, 5\}$).
4. **Ô 24 - Du Lịch Thế Giới (World Tour):**
   * Trả phí vé máy bay **50 USD** (tùy chọn) và chỉ định trước 1 ô đích bất kỳ từ `0` đến `31`.
   * Ở lượt kế tiếp, thay vì tung xúc xắc, nhân vật bay thẳng tới ô đã chọn. Nếu đi qua ô `0` theo chiều kim đồng hồ, vẫn nhận đủ **200 USD**.

### 2.3. Quy tắc Xây dựng, Mua lại đất (Takeover) & Công thức Tài chính

#### A. Phân cấp công trình (5 cấp độ: $L \in \{0, 1, 2, 3, 4\}$)
* **Cấp 0:** Đất trống (chỉ có quyền sở hữu).
* **Cấp 1, 2, 3:** 1 Nhà, 2 Nhà, 3 Nhà (Biệt thự, Khu phố, Tòa cao ốc).
* **Cấp 4:** **Khách sạn (Hotel / Landmark)** — Cấp độ tối thượng, bất khả xâm phạm.

#### B. Giới hạn xây dựng theo vòng chơi (`laps`)
* **Vòng 1 ($laps = 0$):** Khi vào đất trống, được mua đất và xây ngay tối đa lên **Cấp 2**.
* **Từ Vòng 2 trở đi ($laps \ge 1$):** Khi vào đất trống, được mua đất và xây ngay tối đa lên **Cấp 3**.
* **Nâng cấp Khách sạn (Cấp 4):** Không xây thẳng từ đất trống lên Cấp 4 trong 1 lượt. Thành phố bắt buộc đạt **Cấp 3** từ trước; khi quay lại chính ô đó (hoặc dùng thẻ nâng cấp/mua lại từ cấp 3), mới được nâng lên **Cấp 4**.

#### C. Công thức tính toán chuẩn (Backend Python)
Gọi $P_{\text{base}}$ là giá mua gốc của ô đất, $L \in \{0, 1, 2, 3, 4\}$ là cấp độ công trình hiện tại, và $C_{\text{build}} = 0.5 \times P_{\text{base}}$ là chi phí xây 1 cấp nhà.

1. **Tổng giá trị hiện tại của ô đất ($V_{\text{total}}$):**
   $$V_{\text{total}} = P_{\text{base}} + L \times C_{\text{build}}$$

2. **Tiền thuê Thành phố ($R_{\text{city}}$):**
   Với $R_0$ là tiền thuê gốc Cấp 0, hệ số cấp độ $k_L \in \{1,\ 2.5,\ 6,\ 14,\ 30\}$, hệ số độc quyền nhóm màu $M_{\text{color}} \in \{1, 2\}$, hệ số Giải Vô Địch $M_{\text{champ}} \ge 1$, và trạng thái cúp điện $B_{\text{blackout}} \in \{0, 1\}$ ($0$ nếu đang cúp điện):
   $$R_{\text{city}} = \lfloor R_0 \times k_L \rfloor \times M_{\text{color}} \times M_{\text{champ}} \times B_{\text{blackout}}$$

3. **Tiền thuê Bãi Biển ($R_{\text{resort}}$):**
   Với $n \in \{1, 2, 3, 4\}$ là số Bãi Biển chủ đất sở hữu:
   $$R_{\text{resort}} = 25 \times 2^{n - 1}$$

4. **Chi phí Mua lại đất đối thủ (Buyout - $P_{\text{buyout}}$):**
   Chỉ áp dụng cho Thành phố có $L \le 3$ (không áp dụng cho Khách sạn Cấp 4 và Bãi Biển). Sau khi trả tiền thuê $R_{\text{city}}$, người chơi có thể trả $P_{\text{buyout}}$ cho chủ cũ để chiếm quyền sở hữu và được phép nâng thêm tối đa 1 cấp ngay lập tức:
   $$P_{\text{buyout}} = 2 \times V_{\text{total}}$$

5. **Giá bán thanh lý cho Ngân hàng khi thiếu tiền ($V_{\text{liquidate}}$):**
   $$V_{\text{liquidate}} = 0.5 \times V_{\text{total}}$$

### 2.4. Luật Tung Đôi, Bộ bài Cơ Hội & Phá sản
* **Tung Đôi (Doubles):** Nếu $d_1 = d_2$, người chơi được thưởng thêm 1 lượt tung sau khi xử lý xong ô đích. Nếu tung đôi **3 lần liên tiếp** trong cùng 1 lượt, lập tức vào ô `8` (Đảo Hoang).
* **Bộ bài Cơ Hội (Chance Deck — 8 loại thẻ):**
  1. **Thẻ Thiên Thần (Angel Card):** Lưu trong túi đồ (tối đa 1 thẻ), tự động kích hoạt miễn 100% tiền thuê ở lần tiếp theo dẫm vào đất đối thủ.
  2. **Cúp Điện (Blackout):** Chọn 1 Thành phố đối thủ làm mất tiền thuê ($B_{\text{blackout}} = 0$) trong 2 vòng.
  3. **Động Đất (Earthquake):** Giảm 1 cấp nhà tại 1 Thành phố đối thủ (không tác dụng với Khách sạn Cấp 4).
  4. **Tráo Đổi Thành Phố (City Exchange):** Đổi 1 Thành phố của bản thân lấy 1 Thành phố của đối thủ (trừ Khách sạn và Bãi Biển).
  5. **Miễn Phí Nâng Cấp (Free Upgrade):** Nâng miễn phí 1 cấp cho 1 Thành phố của bản thân.
  6. **Lệnh Triệu Tập (Teleport):** Bay thẳng tới ô Bắt Đầu (+200 USD), Giải Vô Địch hoặc Du Lịch Thế Giới.
  7. **Cổ Tức Đầu Tư (Dividend):** Nhận thưởng ngẫu nhiên từ 100 USD đến 250 USD.
  8. **Lệnh Bắt Giữ (Arrest Warrant):** Đi thẳng vào Đảo Hoang (không nhận lương nếu vượt qua ô Bắt Đầu).
* **Phá sản (Bankruptcy):** Khi khoản nợ lớn hơn tiền mặt, hệ thống buộc người chơi bán tài sản (giá $50\%$). Nếu bán hết vẫn không đủ trả, người chơi bị tuyên bố phá sản, chuyển toàn bộ tiền mặt còn lại cho chủ nợ và rời khỏi vòng lượt.

### 2.5. Bốn (4) Điều kiện Chiến Thắng

| STT | Điều kiện thắng | Tên hệ thống | Tiêu chí kiểm tra trong Backend |
| :---: | :--- | :--- | :--- |
| 1 | **Phá sản đối thủ** | `BANKRUPTCY` | Chỉ còn duy nhất 1 người chơi (hoặc Bot) có `is_bankrupt == False`. |
| 2 | **Độc quyền 3 Màu** | `TRIPLE_MONOPOLY` | Sở hữu trọn bộ ít nhất **3 trong 8 nhóm màu** Thành phố. |
| 3 | **Độc quyền 1 Cạnh** | `LINE_MONOPOLY` | Sở hữu toàn bộ ô mua được (Thành phố + Bãi Biển) trên **1 cạnh bất kỳ** (`[1,3,4,5,6,7]`, `[9,11,12,13,14,15]`, `[17,19,20,21,22,23]`, hoặc `[25,27,28,29,30,31]`). |
| 4 | **Độc quyền Bãi Biển** | `RESORT_MONOPOLY` | Sở hữu trọn bộ cả **4 ô Bãi Biển** (`[4, 12, 20, 28]`). |

### 2.6. Máy trạng thái hữu hạn của Lượt chơi (Turn FSM)
```text
[WAITING_START] -> [TURN_START]
                       |
       +---(Người chơi là AI Bot?)---> [AI_THINKING_DELAY (1.2s - 2.0s)] --+
       |                                                                   |
       v                                                                   v
  (Có vé World Tour?) --Có--> [SELECT_WORLD_TOUR_TARGET] ------------> [MOVING]
       |
     Không
       v
  [WAITING_ROLL] --(Tung xúc xắc)--> [DICE_PHYSICS] -----------------> [MOVING]
                                                                           |
                                                                           v
[TURN_END] <---(Hết hành động)--- [RESOLVING_ACTION] <----(Dừng tại ô)-----+
    |                              (Mua / Xây / Trả thuê / Buyout /
    |                               Thanh lý / Thẻ Cơ Hội / Giải Vô Địch)
    +---(Tung đôi < 3 lần & chưa vào tù)---> [TURN_START (Same Player)]
    +---(Đạt 1/4 điều kiện thắng)----------> [GAME_FINISHED]
    +---(Chuyển người chơi kế tiếp)--------> [TURN_START (Next Player)]
```

---

## PHẦN 3: THIẾT KẾ HỆ THỐNG CHƠI VỚI MÁY (AI BOT ENGINE)

### 3.1. Các chế độ hoạt động của AI Bot
* **Chế độ Đấu đơn (Solo vs Bot):** Người chơi bấm "Chơi với máy" ngay từ màn hình chính, chọn số lượng Bot ($1$ đến $3$) và cấp độ cho từng Bot. Ván đấu khởi tạo ngay lập tức với `match_seed` ngẫu nhiên.
* **Chế độ Lấp chỗ trống (Mixed Lobby):** Chủ phòng bấm nút "+ Thêm Bot" vào các ghế trống trong sảnh chờ và có thể xóa hoặc đổi độ khó Bot trước khi bắt đầu.
* **Chế độ Tự động tiếp quản (AFK / Disconnect Takeover):**
  * Nếu người chơi thật quá thời gian lượt (30 giây) liên tiếp 2 lần hoặc ngắt kết nối WebSocket quá 30 giây, cờ `player.is_ai_controlled = True` được bật.
  * AI Bot (cấp độ **Trung bình**) tự động điều khiển nhân vật để tránh làm kẹt trận đấu.
  * Khi người chơi kết nối lại thành công, cờ `player.is_ai_controlled` chuyển về `False` và quyền điều khiển được trả lại ngay lập tức ở hành động kế tiếp.

### 3.2. Phân cấp 3 Độ khó Trí tuệ Nhân tạo

| Cấp độ AI | Quỹ tiền dự phòng ($M_{\text{reserve}}$) | Chiến lược Mua đất & Xây nhà | Chiến lược Mua lại đất (Buyout) & Thẻ kỹ năng | Đối tượng phù hợp |
| :--- | :---: | :--- | :--- | :--- |
| **1. Dễ (Easy - Tập sự)** | $100$ USD | Mua đất trống nếu đủ tiền; xây ngẫu nhiên Cấp 1–2; không tối ưu gom bộ màu. | Rất ít khi Mua lại đất (xác suất $15\%$); chọn mục tiêu Giải Vô Địch và Cơ Hội ngẫu nhiên. | Người mới làm quen luật chơi. |
| **2. Trung bình (Medium - Tiêu chuẩn)** | $300$ USD | Luôn giữ quỹ dự phòng an toàn; ưu tiên mua Bãi Biển và ô còn thiếu trong nhóm màu đang có; xây nhà Cấp 2–3 ở nửa sau bàn cờ. | Mua lại đất khi hoàn thành nhóm màu hoặc giá buyout nhỏ hơn $45\%$ tiền mặt; dùng Thẻ tấn công vào ô giá trị cao nhất của đối thủ. | Chế độ mặc định & Auto-Takeover. |
| **3. Khó (Hard - Chiến thuật Heuristic)** | Linh hoạt theo tiền thuê lớn nhất trên bàn | Tính điểm hữu ích (Utility Score) cho mọi hành động; chủ động khóa thế thắng đặc biệt và xây Khách sạn Cấp 4 tại các ô trọng điểm. | Chặn đứng mọi nguy cơ thua đặc biệt; tính xác suất 2 xúc xắc để đặt Giải Vô Địch và bay Du Lịch Thế Giới tối ưu. | Người chơi muốn thử thách chiến thuật cao. |

### 3.3. Thuật toán Ra quyết định cho AI Khó (Heuristic Utility Engine)

Mỗi khi cần đưa ra lựa chọn (Mua/Xây, Buyout, chọn ô bay Du Lịch Thế Giới, đặt Giải Vô Địch, hoặc chọn mục tiêu thẻ Cơ Hội), AI Khó tính toán **Điểm hữu ích** $U(t)$ cho từng ô mục tiêu $t \in \{0, \dots, 31\}$:

$$U(t) = w_1 \cdot S_{\text{win}}(t) + w_2 \cdot S_{\text{block}}(t) + w_3 \cdot S_{\text{econ}}(t) + w_4 \cdot S_{\text{prob}}(t) - w_5 \cdot S_{\text{risk}}(t)$$

Trong đó các thành phần trọng số được định nghĩa cụ thể như sau:

1. **Điểm tiến gần chiến thắng ($S_{\text{win}}$):**
   * Cộng $+1000$ điểm nếu chiếm ô $t$ giúp AI đạt ngay lập tức `RESORT_MONOPOLY`, `LINE_MONOPOLY` hoặc `TRIPLE_MONOPOLY`.
   * Cộng $+180$ điểm nếu hoàn thành thêm 1 nhóm màu (kích hoạt x2 tiền thuê) hoặc sở hữu Bãi Biển thứ 3.
2. **Điểm chặn đối thủ thắng ($S_{\text{block}}$):**
   * Cộng $+900$ điểm (ưu tiên tối đa) nếu một đối thủ đang chỉ thiếu duy nhất ô $t$ để thắng đặc biệt (trạng thái *Victory Beacon*). AI sẵn sàng dùng **Du Lịch Thế Giới** bay thẳng tới $t$ hoặc chi tiền **Buyout** / dùng thẻ **Tráo Đổi Thành Phố** để phá thế thắng của đối thủ.
3. **Điểm hiệu quả kinh tế ($S_{\text{econ}}$):**
   * Tính tỷ suất hoàn vốn thuê dự kiến: $S_{\text{econ}}(t) = \frac{R_{\text{expected}}(t)}{\text{Cost}(t)}$. Ưu tiên các ô thuộc cạnh 2, cạnh 3 (từ ô 9 đến ô 23) vì tỷ lệ chi phí/tiền thuê cân bằng nhất ở giữa trận.
4. **Điểm xác suất đối thủ dẫm vào ($S_{\text{prob}}$):**
   * Dựa trên phân phối xác suất tổng 2 viên xúc xắc 6 mặt (với xác suất lớn nhất rơi vào khoảng cách $d \in \{6, 7, 8\}$ bước, cụ thể $P(d=7) = \frac{6}{36}$, $P(d=6) = P(d=8) = \frac{5}{36}$):
     $$S_{\text{prob}}(t) = \sum_{p \in \text{Opponents}} P\big(\text{dist}(p, t)\big)$$
   * AI sử dụng $S_{\text{prob}}(t)$ để chọn Thành phố đăng cai **Giải Vô Địch Thế Giới** sao cho khả năng đối thủ bước trúng ở lượt kế tiếp là cao nhất.
5. **Điểm rủi ro thanh khoản ($S_{\text{risk}}$):**
   * Tính quỹ dự phòng động dựa trên mức tiền thuê cao nhất $R_{\max}$ nằm trong phạm vi 12 ô phía trước AI:
     $$M_{\text{reserve\_hard}} = \max\big(250,\ 0.8 \times R_{\max}\big)$$
   * Nếu tiền mặt sau giao dịch nhỏ hơn $M_{\text{reserve\_hard}}$ (và giao dịch đó không mang lại chiến thắng tức thì hoặc chặn thua), $S_{\text{risk}}$ tăng vọt để AI từ chối xây thêm nhà, tránh rơi vào bẫy phá sản.
6. **Thuật toán Thanh lý thông minh khi thiếu tiền:**
   * Khi rơi vào trạng thái `LIQUIDATION_REQUIRED`, AI sắp xếp tài sản theo thứ tự ưu tiên bán: (1) Ô lẻ chưa đủ bộ màu $\rightarrow$ (2) Ô cấp thấp ở cạnh 1 $\rightarrow$ (3) Giữ lại tối đa Bãi Biển, Khách sạn Cấp 4 và các ô đang chặn thế thắng của đối thủ.
7. **Quyết định thoát Đảo Hoang (Nhà Tù):**
   * Giai đoạn đầu trận (còn nhiều hơn $40\%$ ô đất trống): AI trả ngay 50 USD đầu lượt để ra ngoài mua đất sớm.
   * Giai đoạn cuối trận (bàn cờ đầy Khách sạn của đối thủ): AI cố tình không trả tiền phạt, chờ tung xúc xắc đôi để tận dụng 3 lượt trú ẩn an toàn trên đảo.

### 3.4. Nhịp độ tự nhiên & Hiển thị AI Bot trên Giao diện 3D
* **Độ trễ mô phỏng người thật (Human-like Pacing):** Mỗi hành động của Bot trong `ai_bot.py` được chèn độ trễ ngẫu nhiên có kiểm soát bằng `asyncio.sleep(random.uniform(1.0, 1.8))` trước khi tung xúc xắc và trước khi quyết định mua/xây nhà, đảm bảo người chơi kịp quan sát xúc xắc 3D lăn, nhân vật Bot nhảy từng bước và đọc thông báo sự kiện.
* **Nhận diện trực quan:** Nhân vật của Bot mang huy hiệu `[BOT - Dễ/TB/Khó]` trên thẻ người chơi ở góc màn hình, sử dụng danh sách tên và ngoại hình 3D sinh ngẫu nhiên (ví dụ: *Robot Tỷ Phú*, *Nữ Bá Tước AI*, *Thuyền Trưởng Bot*) kèm biểu cảm hoạt ảnh (`Celebrate`, `Sad`) giống hệt người chơi thật.

---

## PHẦN 4: THIẾT KẾ ĐỒ HỌA 3D NGẪU NHIÊN (PROCEDURAL 3D GRAPHICS)

### 4.1. Bộ sinh số ngẫu nhiên đồng bộ (Seeded PRNG)
Mọi hiệu ứng sinh ngẫu nhiên trên Client đều đi qua bộ sinh `Mulberry32` khởi tạo từ `match_seed` do Server cấp:
$$x_{n+1} = \text{PRNG}(\text{match\_seed}, n) \in [0, 1)$$
Nhờ đó, mọi người chơi trong cùng phòng đều thấy cùng một cảnh quan, kiểu nhà và thời tiết mà không tốn băng thông tải dữ liệu.

### 4.2. Hệ thống Sinh Môi trường & Sàn đấu Ngẫu nhiên (Procedural Biome Generator)
Mỗi trận đấu bốc thăm ngẫu nhiên 1 trong 4 Quần xã sinh học (Biomes) cho ánh sáng, Skybox, vật liệu bàn cờ và khu vực cảnh quan trung tâm (`12 x 12` đơn vị):

| Chủ đề (Biome) | Ánh sáng & Skybox | Vật thể trung tâm sinh ngẫu nhiên (Procedural Props) | Hiệu ứng thời tiết (Particles) |
| :--- | :--- | :--- | :--- |
| **1. Đảo Nhiệt Đới** | Nắng vàng ấm, biển xanh ngọc | Dừa 3D thân cong ngẫu nhiên, đảo cát, thuyền buồm chạy vòng tròn, nước gợn sóng Shader | Cánh chim biển, ánh nắng lấp lánh |
| **2. Đô Thị Đêm Neon** | Trời đêm tím than, ánh sáng Rim Light | Cụm tòa nhà chọc trời Procedural ở tâm, biển hiệu phát sáng Bloom, xe bay trên cao | Hạt mưa neon, sương mù tầng thấp |
| **3. Bắc Âu Tuyết Phủ** | Ánh sáng lạnh xanh lam, cực quang | Rừng thông phủ tuyết phân bố bằng Poisson Disk Sampling, hồ đóng băng phản chiếu | Bông tuyết rơi chậm 3D |
| **4. Thung Lũng Mùa Thu** | Hoàng hôn cam đỏ, bóng đổ dài | Đồi thấp Low-Poly (Perlin Noise), cây phong tán lá cam/vàng/đỏ, cối xay gió quay | Lá phong rơi theo hướng gió ngẫu nhiên |

### 4.3. Kiến trúc Công trình 3D Sinh Ngẫu Nhiên (Procedural Architecture)
Bộ sinh `BuildingFactory` tạo kiến trúc riêng biệt cho mỗi ô đất dựa trên hạt giống $(\text{match\_seed} + \text{tile\_idx})$:
* **Cấp 1 (Biệt thự):** Tự chọn kiểu mái (mái thái chữ A, mái bằng, mái vòm), vị trí ống khói, ban công và 1–2 cây mini.
* **Cấp 2 (Khu phố):** Sinh 2 khối nhà có chênh lệch độ cao ngẫu nhiên $\pm 15\%$, xoay hướng vào tâm bàn cờ, bổ sung đèn đường phát sáng.
* **Cấp 3 (Tòa nhà Cao tầng):** Sinh tháp tầng bậc (stepped tower), tạo lưới cửa sổ phát sáng bằng Canvas Texture ngẫu nhiên (tỷ lệ bật đèn $40\%$ đến $80\%$).
* **Cấp 4 (Khách sạn / Landmark):** Sinh công trình biểu tượng (Tháp xoắn, Mái vòm pha lê hoặc Tháp đôi có cầu kính) kèm vòng hào quang màu chủ sở hữu và cột cờ xoay 360 độ.

### 4.4. Nhân vật Hình người 3D & Tùy biến Ngẫu nhiên
* **Khung xương & Hoạt ảnh:** Mô hình hình người `.glb` (hoặc Modular Low-Poly Humanoid có khớp đầu, thân, tay, chân) tích hợp `THREE.AnimationMixer` gồm 5 trạng thái: `Idle`, `Run/Hop`, `Celebrate`, `Sad/Dizzy`, và `Fly` (bay máy bay mini khi dùng Du Lịch Thế Giới).
* **Tùy biến ngẫu nhiên:** Tự động phối màu trang phục, kiểu tóc và phụ kiện đầu (Mũ tỷ phú, Kính râm, Vương miện, Tai nghe) cho cả người chơi lẫn AI Bot; cho phép bấm nút "Đổi ngoại hình ngẫu nhiên" tại sảnh chờ.
* **Chống chồng chéo:** Khi có $k \in \{2, 3, 4\}$ nhân vật đứng chung 1 ô, tự động chia 4 góc phần tư với độ lệch $(\pm 0.35,\ 0,\ \pm 0.35)$ quanh tâm ô.

### 4.5. Tung Xúc Xắc Vật Lý 3D Ngẫu nhiên & Đồng bộ Server
Áp dụng kỹ thuật **Deterministic Physics Mapping** với **Cannon-es**:
1. Server gửi kết quả thật `[d1, d2]`.
2. Client chọn ngẫu nhiên vị trí ném, lực ném và mô-men xoắn trong vùng an toàn giữa bàn cờ (có tường vô hình chặn rơi ra ngoài), chạy mô phỏng vật lý ngầm (pre-step 120 khung hình trong dưới 5ms) để ghi lại toàn bộ quỹ đạo và mặt ngửa mô phỏng $d_{\text{sim}}$.
3. Tính ma trận quaternion xoay bù giữa $d_{\text{sim}}$ và mặt thật từ Server, áp vào mesh xúc xắc 3D rồi phát lại quỹ đạo vật lý đó. Kết quả vừa nảy va chạm ngẫu nhiên 100%, vừa khớp chính xác tuyệt đối với Server.

### 4.6. Hiệu ứng Hình ảnh (VFX), Camera & Giao diện HUD 2D
* **Camera thông minh:** Góc nhìn chéo đẳng cự mặc định; tự chuyển mượt (`lerp`) bám theo xúc xắc và nhân vật di chuyển; hỗ trợ `OrbitControls` tự do xoay/zoom.
* **Cột cảnh báo Chiến Thắng (Victory Beacon):** Bất kỳ ô nào mà người chơi hoặc AI Bot chỉ còn thiếu 1 bước để thắng đặc biệt sẽ dựng cột ánh sáng cảnh báo nhấp nháy trên sàn 3D.
* **HUD 2D Overlay:** 4 thẻ thông tin ở 4 góc màn hình (Avatar, Tên, Nhãn `[BOT]`, Tiền, Thẻ Thiên Thần, đếm ngược 30 giây), thanh hành động ở cạnh dưới, và khung Nhật ký trận đấu + Chat nhanh thu gọn ở cạnh phải.

---

## PHẦN 5: KẾ HOẠCH PHÁT TRIỂN DỰ ÁN (AGILE / SCRUM)

### 5.1. Product Roadmap (Lộ trình phát triển sản phẩm — 16 Tuần)
Dự án kéo dài **16 tuần** (từ **01/12/2026** đến **22/03/2027**), chia thành **4 Release** tương ứng **8 Sprint** (mỗi Sprint 2 tuần) cho nhóm phát triển 4 người (1 Backend/AI, 1 Frontend 3D, 1 Frontend UI/UX, 1 QA/DevOps).

| Giai đoạn / Release | Sprint | Mốc thời gian | Mục tiêu chính (Release Goal) | Hạng mục bàn giao trọng tâm (Key Deliverables) |
| :--- | :---: | :---: | :--- | :--- |
| **Release 1: MVP Foundation** | Sprint 1–2 | 01/12/2026 – 28/12/2026 | Chạy được phiên bản cốt lõi đăng nhập 3 kênh, tạo phòng WebSocket và luật di chuyển cơ bản trên nền 3D sơ khai. | • Auth Google, Facebook, Guest (JWT)<br>• Lobby tạo/vào phòng bằng mã mời<br>• Game Engine 32 ô cơ bản (Tung xúc xắc, di chuyển, mua đất, trả thuê, phá sản)<br>• Bàn cờ 3D đơn giản & quân cờ cơ bản (Three.js) |
| **Release 2: Full Rules & Solo AI** | Sprint 3–4 | 29/12/2026 – 25/01/2027 | Hoàn thiện toàn bộ luật Business Tour (4 cách thắng, Buyout, 4 ô góc) và ra mắt chế độ **Chơi với máy (AI Dễ & Trung bình)**. | • Luật xây nhà Cấp 1–4, Mua lại đất (Buyout)<br>• 4 Ô góc (Đảo Hoang, Giải Vô Địch, Du Lịch) & 8 thẻ Cơ Hội<br>• Kiểm tra 4 điều kiện thắng<br>• **AI Bot Engine (Dễ, Trung bình) + Chế độ Solo vs Bot & Auto-Takeover** |
| **Release 3: Procedural 3D & Smart AI** | Sprint 5–6 | 26/01/2027 – 22/02/2027 | Nâng cấp toàn diện đồ họa 3D sinh ngẫu nhiên, xúc xắc vật lý, nhân vật hình người và **AI Khó Heuristic**. | • Procedural Biome Generator (4 chủ đề theo `match_seed`)<br>• Kiến trúc công trình 3D ngẫu nhiên Cấp 1–4<br>• Nhân vật hình người `.glb` + 5 animation + tùy biến ngoại hình<br>• Xúc xắc vật lý Cannon-es đồng bộ Server<br>• **AI Bot Khó (Heuristic chặn thắng & tính xác suất xúc xắc)** |
| **Release 4: Polish, Social & Launch** | Sprint 7–8 | 23/02/2027 – 22/03/2027 | Hoàn thiện trải nghiệm người dùng, hiệu ứng VFX/âm thanh, bảng xếp hạng, tối ưu hiệu năng và triển khai thực tế. | • Camera điện ảnh, Victory Beacon VFX, Âm thanh (SFX/BGM)<br>• Chat nhanh, Biểu cảm 3D, Lịch sử đấu & Bảng xếp hạng<br>• Reconnect nâng cao, Stress Test 100 phòng đồng thời<br>• Triển khai Production (Docker, Nginx, HTTPS/WSS) |

---

### 5.2. Product Backlog Chi tiết
*Quy ước:* **Story Point** theo dãy Fibonacci (`1, 2, 3, 5, 8, 13`), quy đổi tham chiếu $1\text{ SP} \approx 4\text{ giờ công}$. **Priority** theo chuẩn MoSCoW (`Must Have`, `Should Have`, `Could Have`).

| ID | User Story | Acceptance Criteria (Tiêu chí chấp nhận) | Story Point | Estimated Effort | Priority | Release |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **US-01** | Là **người chơi**, tôi muốn đăng nhập bằng tài khoản Google (Gmail) để lưu tên, avatar và lịch sử đấu. | • Chuyển hướng OAuth2 Google thành công.<br>• Lưu/cập nhật bản ghi user vào DB với `auth_provider='google'`.<br>• Cấp JWT hợp lệ và đưa vào Sảnh chờ trong dưới 3 giây. | 5 | 20h | Must Have | R1 |
| **US-02** | Là **người chơi**, tôi muốn đăng nhập bằng tài khoản Facebook để dễ dàng chơi cùng bạn bè. | • Tích hợp Meta Login OAuth2 lấy `id`, tên, avatar.<br>• Không tạo trùng tài khoản khi đăng nhập lại.<br>• Xử lý thông báo rõ ràng nếu người dùng hủy cấp quyền. | 5 | 20h | Must Have | R1 |
| **US-03** | Là **khách vãng lai**, tôi muốn bấm "Chơi ngay" không cần đăng ký để trải nghiệm game tức thì. | • Tạo user `guest` bằng UUID kèm tên & avatar ngẫu nhiên.<br>• Lưu JWT vào `localStorage`, F5 trình duyệt không mất phiên.<br>• Cho phép nâng cấp/liên kết sang Google hoặc Facebook. | 3 | 12h | Must Have | R1 |
| **US-04** | Là **chủ phòng**, tôi muốn tạo phòng chơi (2–4 người) và chia sẻ mã phòng để bạn bè tham gia. | • Sinh mã phòng 6 ký tự duy nhất và `match_seed` 32-bit.<br>• Đồng bộ danh sách người chơi qua WebSocket ngay lập tức.<br>• Chặn vào phòng khi đủ 4 người hoặc trận đã bắt đầu. | 5 | 20h | Must Have | R1 |
| **US-05** | Là **người chơi**, tôi muốn tung xúc xắc, di chuyển quanh 32 ô, mua đất trống và trả tiền thuê theo đúng lượt. | • Chỉ người tới lượt mới gọi được `ROLL_DICE` (Server kiểm tra).<br>• Qua ô `0` tự động cộng 200 USD và tăng `laps`.<br>• Tính đúng tiền thuê Cấp 0, Bãi Biển và trừ tiền tự động. | 8 | 32h | Must Have | R1 |
| **US-06** | Là **người chơi**, tôi muốn xây dựng công trình Cấp 1–3, nâng cấp Khách sạn Cấp 4 và Mua lại đất (Buyout) đối thủ. | • Chặn xây quá Cấp 2 ở Vòng 1 và Cấp 3 ở Vòng 2+ khi vào đất trống.<br>• Chỉ cho lên Khách sạn Cấp 4 khi ô đã đạt Cấp 3.<br>• Buyout tính đúng $2 \times V_{\text{total}}$, cấm Buyout Khách sạn & Bãi Biển. | 8 | 32h | Must Have | R2 |
| **US-07** | Là **người chơi**, tôi muốn tương tác đầy đủ với 4 ô góc (Đảo Hoang, Giải Vô Địch, Du Lịch Thế Giới) và 8 lá bài Cơ Hội. | • Đảo Hoang giữ tối đa 3 lượt; tung đôi hoặc trả 50 USD thoát ngay.<br>• Giải Vô Địch tăng cộng dồn hệ số thuê ($x2 \rightarrow x5$).<br>• Du Lịch Thế Giới bay đúng ô chọn ở lượt kế tiếp.<br>• 8 thẻ Cơ Hội hoạt động đúng (bao gồm Thẻ Thiên Thần). | 8 | 32h | Must Have | R2 |
| **US-08** | Là **người chơi**, tôi muốn hệ thống tự động thanh lý tài sản khi thiếu tiền và kết thúc trận ngay khi có người đạt 1 trong 4 điều kiện thắng. | • Tự động chuyển trạng thái `LIQUIDATION_REQUIRED` khi tiền mặt nhỏ hơn khoản nợ.<br>• Kiểm tra chính xác 4 điều kiện: Phá sản, 3 Màu, 1 Cạnh, 4 Bãi Biển sau mọi giao dịch đổi chủ. | 5 | 20h | Must Have | R2 |
| **US-09** | Là **người chơi đơn**, tôi muốn tạo trận **Chơi với máy (Solo vs Bot)** với 1–3 Bot tùy chọn độ khó để chơi bất cứ lúc nào. | • Nút "Chơi với máy" ở màn hình chính tạo phòng ngay dưới 1 giây.<br>• Cho phép chọn số lượng Bot (1–3) và độ khó từng Bot.<br>• Hỗ trợ thêm/xóa Bot trong phòng hỗn hợp với bạn bè. | 5 | 20h | Must Have | R2 |
| **US-10** | Là **người chơi**, tôi muốn đối đầu với **AI Bot Dễ & Trung bình** hoạt động mượt mà và tự động tiếp quản nếu người thật thoát trận. | • Bot thực thi trọn vẹn vòng đời FSM không gây treo phòng.<br>• Bot có độ trễ tự nhiên 1.2s–1.8s giữa các hành động.<br>• Tự động bật Bot Trung bình tiếp quản khi người thật AFK/ngắt kết nối quá 30 giây. | 8 | 32h | Must Have | R2 |
| **US-11** | Là **người chơi nâng cao**, tôi muốn thách đấu **AI Bot Khó (Heuristic)** biết chặn thế thắng đặc biệt và tối ưu tài chính. | • Bot tự tính điểm $U(t)$, ưu tiên chặn các ô đang có *Victory Beacon*.<br>• Bot biết giữ quỹ dự phòng động theo tiền thuê lớn nhất phía trước.<br>• Đặt Giải Vô Địch và bay Du Lịch Thế Giới theo xác suất xúc xắc. | 8 | 32h | Should Have | R3 |
| **US-12** | Là **người chơi**, tôi muốn mỗi ván đấu có không gian sàn đấu 3D sinh ngẫu nhiên (4 Biome) đồng nhất giữa mọi người chơi. | • Sinh chính xác cùng 1 Biome và bố cục cảnh quan từ `match_seed`.<br>• Đạt tối thiểu 60 FPS trên trình duyệt desktop phổ thông.<br>• Tích hợp 4 chủ đề: Nhiệt Đới, Đêm Neon, Tuyết Bắc Âu, Mùa Thu. | 8 | 32h | Must Have | R3 |
| **US-13** | Là **người chơi**, tôi muốn các công trình nhà và Khách sạn 3D khi xây lên có kiến trúc biến thể ngẫu nhiên và phân biệt rõ chủ sở hữu. | • Xây Cấp 1–4 hiển thị mô hình 3D khác biệt theo `match_seed + tile_idx`.<br>• Có hiệu ứng nảy (pop-in) khi xây dựng hoặc nâng cấp.<br>• Viền ô đất và cờ trên mái đổi đúng màu đại diện của chủ đất. | 8 | 32h | Must Have | R3 |
| **US-14** | Là **người chơi**, tôi muốn điều khiển nhân vật hình người 3D có hoạt ảnh sống động và tùy biến ngoại hình ngẫu nhiên. | • Tải mượt nhân vật `.glb` có đủ 5 animation (`Idle`, `Run`, `Celebrate`, `Sad`, `Fly`).<br>• Di chuyển nhảy/chạy từng ô theo đúng chiều bàn cờ.<br>• Tự động giãn tọa độ khi 2–4 nhân vật đứng chung 1 ô.<br>• Có nút đổi ngoại hình ngẫu nhiên tại sảnh chờ. | 8 | 32h | Must Have | R3 |
| **US-15** | Là **người chơi**, tôi muốn xem 2 viên xúc xắc 3D tung và nảy vật lý ngẫu nhiên nhưng luôn khớp kết quả máy chủ. | • Tích hợp Cannon-es pre-simulation dưới 5ms không gây khựng hình.<br>• Quỹ đạo nảy đa dạng, không bao giờ văng khỏi bàn cờ.<br>• Mặt ngửa cuối cùng khớp 100% với `[d1, d2]` từ Backend. | 8 | 32h | Must Have | R3 |
| **US-16** | Là **người chơi**, tôi muốn giao diện HUD 2D trực quan hiển thị 4 góc người chơi (gồm nhãn Bot), đếm ngược lượt và thanh hành động. | • Hiển thị Avatar, Tên, Tiền, Thẻ Thiên Thần, nhãn `[BOT]` và viền sáng tới lượt.<br>• Chỉ bật các nút hành động hợp lệ theo trạng thái FSM hiện tại.<br>• Thanh đếm ngược 30 giây đồng bộ với máy chủ. | 5 | 20h | Must Have | R2 |
| **US-17** | Là **người chơi**, tôi muốn có hiệu ứng Camera điện ảnh, cột sáng cảnh báo thắng (Victory Beacon) và âm thanh sống động. | • Camera tự động bám theo xúc xắc, nhân vật và cho phép xoay tự do.<br>• Ô thiếu 1 bước để thắng đặc biệt hiện cột ánh sáng cảnh báo.<br>• Có âm thanh xúc xắc, bước chân, xây nhà, thu tiền và nút tắt/mở âm. | 5 | 20h | Should Have | R4 |
| **US-18** | Là **người chơi**, tôi muốn gửi tin nhắn nhanh, biểu cảm 3D trong trận và xem lịch sử biến động tài chính. | • Khung chat hỗ trợ gửi text và 6 biểu cảm nhanh (vui, khóc, khiêu khích...).<br>• Nhật ký trận đấu ghi rõ từng khoản thu/chi và hành động của Bot.<br>• Chống spam tin nhắn (rate limit 1 tin/2 giây). | 3 | 12h | Could Have | R4 |
| **US-19** | Là **người chơi**, tôi muốn xem bảng xếp hạng, thống kê tỷ lệ thắng (PvP và đấu Bot) và hồ sơ cá nhân. | • Lưu kết quả ván đấu vào PostgreSQL (phân tách xếp hạng PvP và đấu AI).<br>• Hiển thị Top 50 người chơi có nhiều chiến thắng nhất.<br>• Xem lịch sử 20 trận gần nhất. | 5 | 20h | Could Have | R4 |
| **US-20** | Là **kỹ sư hệ thống**, tôi muốn đóng gói ứng dụng bằng Docker, hỗ trợ Redis lưu trạng thái phòng và tự động kết nối lại khi rớt mạng. | • Trạng thái phòng đồng bộ Redis, chịu tải tối thiểu 100 phòng chạy song song.<br>• Người chơi rớt mạng tải lại trang tự động vào lại đúng trận đang đánh.<br>• Triển khai HTTPS + WSS ổn định qua Nginx Reverse Proxy. | 8 | 32h | Must Have | R4 |

* **Tổng khối lượng công việc toàn dự án:** **126 Story Points** ($\approx 504\text{ giờ công}$).

---

### 5.3. User Story Map (Bản đồ Câu chuyện Người dùng theo User & Release)

Bản đồ dưới đây tổ chức theo trục ngang gồm **Nhóm người dùng (User Personas)** $\rightarrow$ **Hoạt động chính (User Activities)** $\rightarrow$ **Tác vụ (User Tasks)**, và phân tầng theo trục dọc ứng với **4 Release** bàn giao giá trị tăng dần:

| Nhóm User (Personas) | **1. Khách & Người chơi mới**<br>*(Truy cập & Định danh)* | **2. Chủ phòng & Người tìm trận**<br>*(Thiết lập phòng & Ghép Bot)* | **3. Người chơi trong trận**<br>*(Lối chơi & Luật Business Tour)* | **4. Người chơi trong trận**<br>*(Trải nghiệm 3D & Tương tác)* | **5. Người chơi quay lại & Hệ thống**<br>*(Cộng đồng & Vận hành)* |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User Activities (Xương sống)** | **Đăng nhập & Quản lý Hồ sơ** | **Tạo phòng, Mời bạn & Cấu hình AI** | **Thi đấu theo Luật 32 Ô & Đấu Trí AI** | **Thưởng thức Không gian 3D & HUD** | **Giao tiếp, Xếp hạng & Ổn định** |
| **User Tasks (Tác vụ cốt lõi)** | • Đăng nhập Google/FB<br>• Chơi Khách tức thì<br>• Tùy biến ngoại hình | • Tạo/Vào phòng PvP<br>• Tạo phòng Solo vs Bot<br>• Chọn độ khó Bot | • Tung xúc xắc & Di chuyển<br>• Mua đất, Xây nhà, Buyout<br>• Xử lý 4 Ô góc & Cơ Hội<br>• Phá sản & 4 cách thắng | • Quan sát sàn 3D ngẫu nhiên<br>• Xem xúc xắc vật lý 3D<br>• Theo dõi nhân vật & HUD | • Chat & Biểu cảm<br>• Xem Bảng xếp hạng<br>• Kết nối lại khi rớt mạng |
| **RELEASE 1 (MVP)**<br>*(Sprint 1–2)* | • `[US-01]` Đăng nhập Gmail<br>• `[US-02]` Đăng nhập Facebook<br>• `[US-03]` Chơi Khách (JWT) | • `[US-04]` Tạo phòng PvP, nhập mã mời & sinh `match_seed` | • `[US-05]` Tung xúc xắc, di chuyển 32 ô, mua đất, trả thuê cơ bản | • Bàn cờ 3D khung cơ bản & quân cờ tạm (tích hợp trong `US-05`) | • Kết nối WebSocket đồng bộ trạng thái phòng cơ bản |
| **RELEASE 2 (Core & Solo AI)**<br>*(Sprint 3–4)* | • Tự động nhận diện phiên Khách khi quay lại sảnh | • `[US-09]` Tạo trận Solo vs 1–3 Bot & thêm/xóa Bot phòng hỗn hợp | • `[US-06]` Xây Cấp 1–4 & Buyout<br>• `[US-07]` 4 Ô góc & 8 thẻ Cơ Hội<br>• `[US-08]` Thanh lý & 4 cách thắng<br>• `[US-10]` AI Bot Dễ/TB & Auto-Takeover | • `[US-16]` Giao diện HUD 2D 4 góc, nhãn `[BOT]`, đếm ngược 30s, thanh hành động | • Nhật ký sự kiện ván đấu cơ bản trên HUD |
| **RELEASE 3 (3D & Smart AI)**<br>*(Sprint 5–6)* | • Đổi ngoại hình nhân vật 3D ngẫu nhiên tại sảnh (`US-14`) | • Tùy chọn cấp độ **AI Khó** cho từng ghế Bot trong phòng | • `[US-11]` AI Bot Khó (Heuristic chặn thế thắng & tính xác suất xúc xắc) | • `[US-12]` 4 Biome 3D ngẫu nhiên<br>• `[US-13]` Kiến trúc nhà 3D ngẫu nhiên<br>• `[US-14]` Nhân vật người `.glb` 5 animation<br>• `[US-15]` Xúc xắc vật lý Cannon-es | • Đồng bộ 100% seed 3D & quỹ đạo vật lý không lệch khung hình |
| **RELEASE 4 (Launch)**<br>*(Sprint 7–8)* | • Nâng cấp tài khoản Khách sang Google/FB & xem hồ sơ (`US-19`) | • Ghép trận nhanh tự động (Quick Match) | • Cân bằng tham số kinh tế & tinh chỉnh trọng số Heuristic AI qua test thực tế | • `[US-17]` Camera điện ảnh, cột sáng Victory Beacon, âm thanh SFX/BGM | • `[US-18]` Chat nhanh & Biểu cảm 3D<br>• `[US-19]` Bảng xếp hạng & Lịch sử đấu<br>• `[US-20]` Redis, Reconnect, Docker/HTTPS |

---

## PHẦN 6: CẤU TRÚC THƯ MỤC & GIAO THỨC WEBSOCKET

### 6.1. Cấu trúc thư mục dự án chuẩn
```text
business-tour-3d/
├── backend/
│   ├── main.py                 # FastAPI App, WebSocket Endpoint & Room Manager
│   ├── auth.py                 # OAuth2 Google, Facebook & Guest JWT
│   ├── database.py             # Kết nối PostgreSQL (User/History) & Redis (Active Rooms)
│   ├── game_engine.py          # Lõi luật Business Tour 32 ô, FSM & Công thức tài chính
│   ├── ai_bot.py               # Bộ máy AI Bot (Easy, Medium, Hard Heuristic & Async Loop)
│   └── requirements.txt        # Danh sách thư viện Python
├── frontend/
│   ├── index.html              # Giao diện Login, Sảnh chờ (PvP / Solo Bot) & Canvas 3D
│   ├── css/
│   │   └── hud.css             # Giao diện HUD 2D, Modal sổ đỏ, Chat & Bảng xếp hạng
│   ├── js/
│   │   ├── app.js              # Xử lý Auth, Lobby & WebSocket Client
│   │   ├── prng.js             # Thuật toán Mulberry32 đồng bộ theo match_seed
│   │   ├── biome_gen.js        # Bộ sinh 4 quần xã 3D & hiệu ứng thời tiết
│   │   ├── building_gen.js     # Bộ sinh kiến trúc công trình 3D Cấp 1–4
│   │   ├── dice_physics.js     # Xúc xắc vật lý Cannon-es + Deterministic Mapping
│   │   └── scene3d.js          # Điều phối Three.js, Camera, Nhân vật .glb & VFX
│   └── assets/
│       ├── models/             # Các file nhân vật hình người .glb & phụ kiện
│       └── audio/              # Âm thanh xúc xắc, bước chân, xây nhà, chiến thắng
├── docker-compose.yml          # Khởi chạy Backend, PostgreSQL, Redis & Nginx
└── BUSINESS_TOUR_3D_SPEC.md    # Tài liệu đặc tả dự án này
```

### 6.2. Tóm tắt các sự kiện WebSocket cốt lõi

| Hướng truyền | Loại sự kiện (`type` / `action`) | Dữ liệu chính (Payload) | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| **Client $\rightarrow$ Server** | `ADD_BOT` / `REMOVE_BOT` | `{"difficulty": "EASY" \| "MEDIUM" \| "HARD"}` | Chủ phòng thêm hoặc xóa AI Bot tại sảnh chờ. |
| **Client $\rightarrow$ Server** | `START_GAME` | `{}` | Bắt đầu trận đấu, khóa phòng và gửi `match_seed`. |
| **Client $\rightarrow$ Server** | `ROLL_DICE` | `{"pay_jail_fine": bool}` | Yêu cầu tung xúc xắc (hoặc đóng 50 USD ra tù). |
| **Client $\rightarrow$ Server** | `BUY_OR_BUILD` | `{"tile_idx": int, "target_level": int}` | Mua đất trống hoặc nâng cấp công trình. |
| **Client $\rightarrow$ Server** | `BUYOUT_TILE` | `{"tile_idx": int, "upgrade_after": bool}` | Mua lại thành phố đối thủ với giá $2 \times V_{\text{total}}$. |
| **Client $\rightarrow$ Server** | `SELECT_TARGET` | `{"purpose": "CHAMPIONSHIP" \| "WORLD_TOUR" \| "CHANCE", "tile_idx": int}` | Chọn ô mục tiêu cho Giải Vô Địch, Du Lịch hoặc Thẻ Cơ Hội. |
| **Client $\rightarrow$ Server** | `LIQUIDATE_TILES` | `{"tile_indices": [int]}` | Bán danh sách ô đất cho ngân hàng để trả nợ. |
| **Server $\rightarrow$ Client** | `GAME_STARTED` | `{"match_seed": int, "players": [...], "turn_order": [...]}` | Khởi tạo bàn cờ 3D ngẫu nhiên đồng nhất ở mọi Client. |
| **Server $\rightarrow$ Client** | `DICE_ROLLED` | `{"player_id": str, "is_bot": bool, "dice": [d1, d2], "new_pos": int, "action": {...}}` | Phát sóng kết quả xúc xắc và di chuyển của người chơi hoặc Bot. |
| **Server $\rightarrow$ Client** | `BOT_TAKEOVER` | `{"player_id": str, "active": bool}` | Thông báo AI Bot đang tiếp quản hoặc trả lại quyền điều khiển. |
| **Server $\rightarrow$ Client** | `VICTORY_ALERT` | `{"player_id": str, "target_tile": int, "win_type": str}` | Kích hoạt cột sáng cảnh báo *Victory Beacon* trên bàn cờ 3D. |
| **Server $\rightarrow$ Client** | `GAME_OVER` | `{"winner_id": str, "win_type": str, "summary": {...}}` | Kết thúc ván đấu và hiển thị bảng tổng kết. |