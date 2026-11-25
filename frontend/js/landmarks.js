// Icon sắc nét cho ô Cơ Hội (bánh xe cầu vồng 8 múi), Thuế (hóa đơn + dấu đỏ) và Resort (ô bãi biển).
export function drawLandmark(g, idx, cx, cy, sz) {
  g.save();
  g.translate(cx, cy);
  const s = sz / 120;
  g.scale(s, s);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  if (idx === 12 || idx === 20 || idx === 28) {
    // Bánh xe cầu vồng 8 múi màu rực rỡ + viền ngoài đậm sắc nét
    const cols = ['#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#2ac9c9', '#007aff', '#8e5ce6', '#ff2d55'];
    const r = 53;
    g.save();
    g.shadowColor = 'rgba(15, 23, 42, 0.25)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 3;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(0, 0, r + 3, 0, Math.PI * 2); g.fill();
    g.restore();

    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2;
      const a1 = ((i + 1) / 8) * Math.PI * 2;
      g.fillStyle = cols[i];
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a0, a1); g.closePath(); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2.6; g.stroke();
    }
    g.strokeStyle = '#1e293b'; g.lineWidth = 3.2;
    g.beginPath(); g.arc(0, 0, r + 1.5, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1e293b'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = '#334155';
    g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
  } else if (idx === 30) {
    // Ô Thuế: Hóa đơn tương phản cao + dấu đỏ nổi bật
    g.save();
    g.rotate(-0.12);
    g.shadowColor = 'rgba(15, 23, 42, 0.22)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 3;
    g.fillStyle = '#e2e8f0'; g.strokeStyle = '#1e293b'; g.lineWidth = 3.5;
    g.beginPath(); g.roundRect(-34, -32, 72, 54, 7); g.fill(); g.stroke();
    g.shadowBlur = 0; g.shadowOffsetY = 0;

    g.translate(-6, 7);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#1e293b'; g.lineWidth = 3.5;
    g.beginPath(); g.roundRect(-34, -32, 72, 54, 7); g.fill(); g.stroke();

    g.strokeStyle = '#475569'; g.lineWidth = 4;
    for (const y of [-14, -2, 10]) { g.beginPath(); g.moveTo(-22, y); g.lineTo(10, y); g.stroke(); }

    g.fillStyle = '#dc2626'; g.strokeStyle = '#7f1d1d'; g.lineWidth = 2;
    g.beginPath(); g.roundRect(15, -18, 17, 28, 4); g.fill(); g.stroke();
    g.fillStyle = '#ffffff';
    g.font = '900 18px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('$', 23.5, -3);
    g.restore();
  } else {
    // Ô Bãi Biển / Resort: Chiếc ô bãi biển to, viền đậm sắc nét
    g.save();
    g.fillStyle = 'rgba(15, 23, 42, 0.14)';
    g.beginPath(); g.ellipse(6, 28, 22, 6, 0, 0, Math.PI * 2); g.fill();

    g.strokeStyle = '#5c3417'; g.lineWidth = 5.5;
    g.beginPath(); g.moveTo(2, 26); g.lineTo(12, -20); g.stroke();

    g.fillStyle = '#ef4444'; g.strokeStyle = '#1e293b'; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(-24, -6); g.quadraticCurveTo(14, -44, 42, 2); g.closePath(); g.fill(); g.stroke();

    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(-4, -12); g.quadraticCurveTo(14, -34, 22, -2); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  g.restore();
}
