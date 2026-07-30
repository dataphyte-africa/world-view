<?php

use Illuminate\Support\Facades\Route;
use WorldView\Http\Controllers\WorldViewController;
use WorldView\Http\Controllers\OpenSkyProxyController;
use WorldView\Http\Controllers\PinController;
use WorldView\Http\Controllers\HealthController;

$prefix = config('worldview.route_prefix', 'world-view');
$rateLimit = config('worldview.rate_limit_max', 30);

Route::group(['prefix' => $prefix], function () use ($rateLimit) {
    Route::get('/', WorldViewController::class)->name('worldview.map');

    Route::get('/health', HealthController::class)->name('worldview.health');

    Route::get('/opensky/{path}', [OpenSkyProxyController::class, 'proxy'])
        ->where('path', '.*')
        ->middleware('worldview.ratelimit:' . $rateLimit);

    Route::get('/weather', [\WorldView\Http\Controllers\WeatherProxyController::class, 'show'])->name('worldview.weather');

    Route::get('/pins', [PinController::class, 'index'])->name('worldview.pins.index');
    Route::post('/pins', [PinController::class, 'store'])->name('worldview.pins.store');
    Route::delete('/pins/{id}', [PinController::class, 'destroy'])->name('worldview.pins.destroy');
});
