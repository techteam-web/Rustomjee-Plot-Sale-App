import { AMEN, FACING_LIST, ROAD_LIST } from './data/plots';

export function hdist(a, b) {
  const R = 6371000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function calcPrice(plot, idx) {
  const BASE = 3500;
  let breakdown = [{ l: 'Base Price', v: BASE, t: 'b' }];
  
  let sizeAdj = plot.area_sqft < 8000 ? 300 : plot.area_sqft > 50000 ? -200 : plot.area_sqft > 30000 ? -100 : 0;
  if (sizeAdj) breakdown.push({ l: 'Size Factor', v: sizeAdj, t: 'a' });
  
  const clubDist = Math.round(hdist(plot.center, AMEN.club.center));
  let clubPrem = clubDist < 150 ? 900 : clubDist < 250 ? 600 : clubDist < 400 ? 350 : clubDist < 600 ? 150 : 0;
  if (clubPrem) breakdown.push({ l: `Clubhouse (${clubDist}m)`, v: clubPrem, t: 'p' });
  
  let parkPrem = 0;
  [AMEN.park1, AMEN.park2].forEach(pk => {
    const d = Math.round(hdist(plot.center, pk.center));
    parkPrem += d < 150 ? 600 : d < 250 ? 350 : d < 400 ? 200 : d < 600 ? 80 : 0;
  });
  parkPrem = Math.min(parkPrem, 900);
  if (parkPrem) breakdown.push({ l: 'Park Proximity', v: parkPrem, t: 'p' });
  
  const waterDist = Math.round(hdist(plot.center, AMEN.water.center));
  let waterPrem = waterDist < 150 ? 400 : waterDist < 300 ? 200 : waterDist < 500 ? 100 : 0;
  if (waterPrem) breakdown.push({ l: `Water View (${waterDist}m)`, v: waterPrem, t: 'p' });
  
  const facingPrem = { 'North-East': 200, 'East': 200, 'North': 150, 'North-West': 100, 'South-East': 50 }[FACING_LIST[idx]] || 0;
  if (facingPrem) breakdown.push({ l: `${FACING_LIST[idx]} Facing`, v: facingPrem, t: 'p' });
  
  const roadPrem = ROAD_LIST[idx] === '15m Main Road' ? 200 : 0;
  if (roadPrem) breakdown.push({ l: '15m Road Frontage', v: roadPrem, t: 'p' });
  
  const psf = BASE + sizeAdj + clubPrem + parkPrem + waterPrem + facingPrem + roadPrem;
  return {
    psf,
    total: Math.round(psf * plot.area_sqft),
    breakdown,
    premium: clubPrem + parkPrem + waterPrem + facingPrem + roadPrem,
    clubDist,
    waterDist
  };
}

export function formatCurrency(v) {
  return v >= 10000000 ? `₹${(v / 10000000).toFixed(2)} Cr` : `₹${(v / 10000000).toFixed(3)} Cr`;
}
