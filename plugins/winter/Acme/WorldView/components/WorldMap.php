<?php

namespace Acme\WorldView\Components;

use Cms\Classes\ComponentBase;
use WorldView\Services\KmlParser;
use WorldView\Models\Pin;

class WorldMap extends ComponentBase
{
    protected KmlParser $kml;

    public function __construct(?KmlParser $kml = null)
    {
        $this->kml = $kml ?? new KmlParser();
    }

    public function componentDetails(): array
    {
        return [
            'name' => 'World Map',
            'description' => 'Displays an interactive world map',
        ];
    }

    public function defineProperties(): array
    {
        return [
            'aircraftEnabled' => [
                'title' => 'Aircraft Tracking',
                'description' => 'Enable OpenSky aircraft tracking',
                'type' => 'checkbox',
                'default' => false,
            ],
            'pinsEnabled' => [
                'title' => 'Pins',
                'description' => 'Enable pin placement on the map',
                'type' => 'checkbox',
                'default' => true,
            ],
            'height' => [
                'title' => 'Map Height',
                'description' => 'Height of the map container (e.g. 600px, 100vh)',
                'type' => 'string',
                'default' => '100vh',
            ],
        ];
    }

    public function onRun(): void
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

        $this->page['mapHeight'] = $this->property('height');
        $this->page['aircraftEnabled'] = $this->property('aircraftEnabled');
        $this->page['pinsEnabled'] = $this->property('pinsEnabled');
        $this->page['kmlFeatures'] = $kmlFeatures;
        $this->page['kmlBounds'] = $kmlBounds;
        $this->page['pins'] = Pin::all();
        $this->page['routePrefix'] = config('worldview.route_prefix', 'world-view');
        $this->page['fetchInterval'] = config('worldview.aircraft.fetch_interval', 15000);
        $this->page['maxAircraft'] = config('worldview.aircraft.max_aircraft', 1000);

        $this->addCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        $this->addJs('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        $this->addCss('/plugins/acme/worldview/assets/css/worldview.css');
        $this->addJs('/plugins/acme/worldview/assets/js/worldview.js');
    }
}
