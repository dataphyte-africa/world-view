<?php

return [
    'route_prefix' => env('WORLDVIEW_ROUTE_PREFIX', 'world-view'),

    'rate_limit_max' => env('WORLDVIEW_RATE_LIMIT', 30),

    'aircraft' => [
        'enabled' => env('WORLDVIEW_AIRCRAFT_ENABLED', false),
        'opensky_client_id' => env('OPENSKY_CLIENT_ID'),
        'opensky_client_secret' => env('OPENSKY_CLIENT_SECRET'),
        'fetch_interval' => env('WORLDVIEW_AIRCRAFT_INTERVAL', 15000),
        'max_aircraft' => env('WORLDVIEW_MAX_AIRCRAFT', 1000),
    ],

    'pins' => [
        'enabled' => true,
    ],

    'openweather' => [
        'key' => env('WORLDVIEW_OWM_KEY'),
    ],

    'kml' => [
        'path' => env('WORLDVIEW_KML_PATH', storage_path('app/worldview/locations.kml')),
    ],
];
