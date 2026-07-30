<?php

namespace WorldView\Http\Controllers;

use Illuminate\Routing\Controller;
use WorldView\Services\KmlParser;

class WorldViewController extends Controller
{
    protected KmlParser $kml;

    public function __construct(KmlParser $kml)
    {
        $this->kml = $kml;
    }

    public function __invoke()
    {
        $kmlPath = config('worldview.kml.path');
        $kmlFeatures = [];
        $kmlBounds = null;

        if ($kmlPath && file_exists($kmlPath)) {
            $kmlFeatures = $this->kml->parseFile($kmlPath);

            if (!empty($kmlFeatures)) {
                $lats = array_column($kmlFeatures, 'latitude');
                $lngs = array_column($kmlFeatures, 'longitude');
                $kmlBounds = [
                    'north' => max($lats),
                    'south' => min($lats),
                    'east' => max($lngs),
                    'west' => min($lngs),
                ];
            }
        }

        return view('worldview::map', [
            'aircraftEnabled' => config('worldview.aircraft.enabled', false),
            'pinsEnabled' => config('worldview.pins.enabled', true),
            'kmlFeatures' => $kmlFeatures,
            'kmlBounds' => $kmlBounds,
            'pins' => [],
            'routePrefix' => config('worldview.route_prefix', 'world-view'),
            'fetchInterval' => config('worldview.aircraft.fetch_interval', 15000),
            'maxAircraft' => config('worldview.aircraft.max_aircraft', 1000),
            'weatherEnabled' => !empty(config('worldview.openweather.key')),
        ]);
    }
}
