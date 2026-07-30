<?php

namespace WorldView\Services;

use SimpleXMLElement;

class KmlParser
{
    public function parse(string $kmlContent): array
    {
        $xml = simplexml_load_string($kmlContent);
        if (!$xml) {
            return [];
        }

        $namespaces = $xml->getNamespaces(true);
        if (isset($namespaces[''])) {
            $xml->registerXPathNamespace('kml', $namespaces['']);
            $prefix = 'kml:';
        } else {
            $prefix = '';
        }

        $placemarks = $xml->xpath('//' . $prefix . 'Placemark') ?? [];
        $features = [];

        foreach ($placemarks as $pm) {
            $name = $pm->name ? (string) $pm->name : 'Untitled';
            $coordsEl = $pm->xpath('.' . $prefix . 'Point/' . $prefix . 'coordinates');
            $coordsStr = $coordsEl ? (string) $coordsEl[0] : null;

            if (!$coordsStr) {
                $coordsEl = $pm->xpath($prefix . 'coordinates');
                $coordsStr = $coordsEl ? (string) $coordsEl[0] : null;
            }

            if (!$coordsStr) {
                continue;
            }

            $parts = explode(',', trim($coordsStr));
            if (count($parts) < 2) {
                continue;
            }

            $lng = (float) $parts[0];
            $lat = (float) $parts[1];

            if (is_nan($lat) || is_nan($lng)) {
                continue;
            }

            $description = $pm->description ? (string) $pm->description : '';

            $features[] = [
                'name' => $name,
                'latitude' => $lat,
                'longitude' => $lng,
                'description' => $description,
                'is_highlighted' => stripos($name, 'affected') === 0,
            ];
        }

        return $features;
    }

    public function parseFile(string $filePath): array
    {
        if (!file_exists($filePath)) {
            return [];
        }

        $content = file_get_contents($filePath);

        return $this->parse($content);
    }
}
