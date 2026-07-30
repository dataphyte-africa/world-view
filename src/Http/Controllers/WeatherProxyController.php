<?php

namespace WorldView\Http\Controllers;

use Illuminate\Routing\Controller;
use Illuminate\Http\Request;
use GuzzleHttp\Client;

class WeatherProxyController extends Controller
{
    public function show(Request $request)
    {
        $lat = $request->query('lat');
        $lng = $request->query('lng');
        $apiKey = config('worldview.openweather.key');

        if (!$apiKey) {
            return response()->json(['error' => 'OpenWeather API key not configured'], 503);
        }

        if ($lat === null || $lng === null) {
            return response()->json(['error' => 'lat and lng required'], 400);
        }

        $client = new Client();
        $response = $client->get('https://api.openweathermap.org/data/2.5/weather', [
            'query' => [
                'lat' => $lat,
                'lon' => $lng,
                'appid' => $apiKey,
                'units' => 'metric',
            ],
        ]);

        $data = json_decode($response->getBody(), true);
        $wind = $data['wind'] ?? [];

        return response()->json([
            'wind_speed' => $wind['speed'] ?? null,
            'wind_deg' => $wind['deg'] ?? null,
            'gust' => $wind['gust'] ?? null,
            'location' => $data['name'] ?? null,
            'timestamp' => now()->timestamp,
        ]);
    }
}
