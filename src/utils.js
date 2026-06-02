export function hdist(a, b) {
  const R = 6371000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Compute price based on proximity to real amenity centers (from KML)
// amen = { club: [lng,lat], park1: [lng,lat], park2: [lng,lat], water: [lng,lat] }
export function calcPrice(plot, amen) {
  const BASE = 3500;

  const clubDist = Math.round(hdist(plot.center, amen.club));
  const clubPrem = clubDist < 150 ? 900 : clubDist < 250 ? 600 : clubDist < 400 ? 350 : clubDist < 600 ? 150 : 0;

  let parkPrem = 0;
  [amen.park1, amen.park2].forEach(pk => {
    const d = Math.round(hdist(plot.center, pk));
    parkPrem += d < 150 ? 600 : d < 250 ? 350 : d < 400 ? 200 : d < 600 ? 80 : 0;
  });
  parkPrem = Math.min(parkPrem, 900);

  let waterPrem = 0;
  if (amen.water) {
    const waterDist = Math.round(hdist(plot.center, amen.water));
    waterPrem = waterDist < 150 ? 400 : waterDist < 300 ? 200 : waterDist < 500 ? 100 : 0;
  }

  const psf = BASE + clubPrem + parkPrem + waterPrem;
  return {
    psf,
    total: Math.round(psf * plot.area_sqft),
    premium: clubPrem + parkPrem + waterPrem,
    clubDist
  };
}

export function formatCurrency(v) {
  return v >= 10000000 ? `₹${(v / 10000000).toFixed(2)} Cr` : `₹${(v / 10000000).toFixed(3)} Cr`;
}

// MapLibre `zoom` is a fixed geographic scale, so a narrower map shows less
// area at the same zoom — which is why the tuned framing looks right on large
// screens but too tight on smaller ones. Keep the framing on wide maps and zoom
// OUT on smaller ones so the whole site stays in view. log2 is exact: each zoom
// level doubles the scale, so −1 zoom doubles the visible width.
//   baseZoom  : framing tuned for a large screen
//   width     : current map (container) width in CSS px
//   refWidth  : map width at which baseZoom is "perfect" (≈ 2k/4xl screen area)
//   maxZoomOut: cap on how far we zoom out on tiny screens
export function responsiveMapZoom(baseZoom, width, refWidth = 2200, maxZoomOut = 2.6) {
  const w = Math.max(360, width || refWidth);
  const z = baseZoom + Math.log2(w / refWidth);
  return Math.min(baseZoom, Math.max(baseZoom - maxZoomOut, z));
}

export function getAmenitiesWithDistance(plotCenter, amenities) {
  return amenities.map(a => ({
    ...a,
    distance: Math.round(hdist(plotCenter, [a.longitude, a.latitude])),
    distanceKm: (Math.round(hdist(plotCenter, [a.longitude, a.latitude])) / 1000).toFixed(2)
  })).sort((a, b) => a.distance - b.distance);
}
