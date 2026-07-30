<?php

namespace WorldView\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use WorldView\Services\OpenSkyService;

class OpenSkyProxyController extends Controller
{
    protected OpenSkyService $openSky;

    public function __construct(OpenSkyService $openSky)
    {
        $this->openSky = $openSky;
    }

    public function proxy(Request $request, string $path)
    {
        if (!config('worldview.aircraft.enabled', false)) {
            return response()->json(['error' => 'Aircraft tracking is disabled'], 404);
        }

        try {
            $result = $this->openSky->proxy($path, $request->query());

            return response()->json($result['data'], $result['status']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 502);
        }
    }
}
