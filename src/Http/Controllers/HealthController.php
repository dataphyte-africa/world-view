<?php

namespace WorldView\Http\Controllers;

use Illuminate\Routing\Controller;

class HealthController extends Controller
{
    public function __invoke()
    {
        return response()->json([
            'status' => 'ok',
            'timestamp' => now()->timestamp,
            'version' => '1.0.0',
            'aircraft_enabled' => config('worldview.aircraft.enabled', false),
        ]);
    }
}
