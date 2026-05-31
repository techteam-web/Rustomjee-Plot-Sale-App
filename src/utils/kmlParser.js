const NON_PLOT_NAMES = new Set(['site office', 'untitled placemark', 'kasara video', 'untitled image overlay']);

export async function fetchAndParseKML(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch KML from ${url}`);
      return [];
    }
    const kmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    const seenPlotNos = new Set();
    const markers = [];

    for (let i = 0; i < placemarks.length; i++) {
      const pm = placemarks[i];
      const nameNode = pm.getElementsByTagName('name')[0];
      const name = nameNode ? nameNode.textContent.trim() : '';

      // Skip known non-plot markers
      if (NON_PLOT_NAMES.has(name.toLowerCase())) continue;

      // Skip non-numeric names (infrastructure labels, folders)
      const plotNo = parseInt(name, 10);
      if (isNaN(plotNo)) continue;

      // Deduplicate: KML has duplicate entries for plots 2-26 across two folders
      if (seenPlotNos.has(plotNo)) continue;
      seenPlotNos.add(plotNo);

      const pointNode = pm.getElementsByTagName('Point')[0];
      if (!pointNode) continue;

      const coordsNode = pointNode.getElementsByTagName('coordinates')[0];
      if (!coordsNode) continue;

      const coords = coordsNode.textContent.trim().split(',');
      if (coords.length < 2) continue;

      const longitude = parseFloat(coords[0]);
      const latitude = parseFloat(coords[1]);
      if (isNaN(longitude) || isNaN(latitude)) continue;

      markers.push({ name, plotNo, longitude, latitude });
    }

    return markers;
  } catch (err) {
    console.error('Error parsing KML:', err);
    return [];
  }
}
