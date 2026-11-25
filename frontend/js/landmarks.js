// Icon sắc nét cho ô Cơ Hội (bánh xe cầu vồng 8 múi rực rỡ to rõ), Thuế (hóa đơn đỏ-trắng) và Resort.
export function drawLandmark(g, idx, cx, cy, sz) {
  g.save();
  g.translate(cx, cy);
  const s = sz / 120;
  g.scale(s, s);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  if (idx === 12 || idx === 20 || idx === 28) {
    // Bánh xe cầu vồng 8 múi màu rực rỡ chiếm ~55% ô Cơ hội
    const cols = ['#ff3b30', '#ff9500', '#ffcc00', '#65c466', '#2ac9c9', '#007aff', '#8e5ce6', '#ff2d55'];
    const r = 54;
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2;
      const a1 = ((i + 1) / 8) * Math.PI * 2;
      g.fillStyle = cols[i];
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a0, a1); g.closePath(); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2.4; g.stroke();
    }
    g.strokeStyle = '#ffffff'; g.lineWidth = 4.5;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#94a3b8';
    g.beginPath(); g.arc(0, 0, 5.5, 0, Math.PI * 2); g.fill();
  } else if (idx === 30) {
    // Ô Thuế: Xấp tiền/hóa đơn đỏ-trắng gọn nét
    g.save();
    g.rotate(-0.14);
    g.fillStyle = '#e5e7eb'; g.strokeStyle = '#64748b'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(-32, -30, 68, 50, 6); g.fill(); g.stroke();
    g.translate(-6, 7);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.roundRect(-32, -30, 68, 50, 6); g.fill(); g.stroke();
    g.strokeStyle = '#94a3b8'; g.lineWidth = 3.5;
    for (const y of [-12, -1, 10]) { g.beginPath(); g.moveTo(-20, y); g.lineTo(10, y); g.stroke(); }
    g.fillStyle = '#dc2626';
    g.beginPath(); g.roundRect(15, -16, 15, 24, 3); g.fill();
    g.restore();
  } else {
    // Ô Bãi Biển / Resort: Chiếc ô bãi biển tối giản thanh lịch
    g.strokeStyle = '#854d27'; g.lineWidth = 4.5;
    g.beginPath(); g.moveTo(4, 24); g.lineTo(12, -16); g.stroke();
    g.fillStyle = '#ef4444';
    g.beginPath(); g.moveTo(-16, -8); g.quadraticCurveTo(14, -36, 36, 0); g.closePath(); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -13); g.quadraticCurveTo(14, -29, 20, -4); g.closePath(); g.fill();
  }
  g.restore();
}
