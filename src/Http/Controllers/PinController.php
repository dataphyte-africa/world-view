<?php

namespace WorldView\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use WorldView\Models\Pin;

class PinController extends Controller
{
    public function index()
    {
        return Pin::all()->map(function ($pin) {
            return [
                'id' => $pin->id,
                'name' => $pin->name,
                'lat' => $pin->latitude,
                'lng' => $pin->longitude,
                'imageUrl' => $pin->image_url ?? '',
                'createdAt' => $pin->created_at->timestamp,
            ];
        });
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
            'imageUrl' => 'nullable|string|max:2000',
        ]);

        $pin = Pin::create([
            'name' => $validated['name'],
            'latitude' => $validated['lat'],
            'longitude' => $validated['lng'],
            'image_url' => $validated['imageUrl'] ?? null,
        ]);

        return response()->json([
            'id' => $pin->id,
            'name' => $pin->name,
            'lat' => $pin->latitude,
            'lng' => $pin->longitude,
            'imageUrl' => $pin->image_url ?? '',
            'createdAt' => $pin->created_at->timestamp,
        ], 201);
    }

    public function destroy(int $id)
    {
        $pin = Pin::findOrFail($id);
        $pin->delete();

        return response()->json(['message' => 'Pin deleted'], 200);
    }
}
