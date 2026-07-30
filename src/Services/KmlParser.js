const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

class KmlParser {
  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name) => ['Placemark', 'Document'].includes(name),
    });
  }

  parse(kmlContent) {
    try {
      const result = this.parser.parse(kmlContent);
      const kml = result.kml || result;
      const doc = kml.Document;
      if (!doc || !doc.Placemark) return [];

      const placemarks = Array.isArray(doc.Placemark) ? doc.Placemark : [doc.Placemark];
      const features = [];

      for (const pm of placemarks) {
        if (!pm) continue;
        const name = pm.name || 'Untitled';
        const description = pm.description || '';

        let coordsStr = null;
        if (pm.Point && pm.Point.coordinates) {
          coordsStr = pm.Point.coordinates;
        } else if (pm.coordinates) {
          coordsStr = pm.coordinates;
        }

        if (!coordsStr) continue;

        const firstCoord = coordsStr.trim().split(/\s+/)[0];
        if (!firstCoord) continue;

        const parts = firstCoord.split(',').map(s => s.trim());
        if (parts.length < 2) continue;

        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (isNaN(lat) || isNaN(lng)) continue;

        features.push({
          name,
          latitude: lat,
          longitude: lng,
          description,
          is_highlighted: name.toLowerCase().startsWith('affected'),
        });
      }

      return features;
    } catch {
      return [];
    }
  }

  parseFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.parse(content);
    } catch {
      return [];
    }
  }
}

module.exports = { KmlParser };
