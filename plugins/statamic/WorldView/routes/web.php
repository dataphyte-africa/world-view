<?php

use Illuminate\Support\Facades\Route;
use WorldView\Http\Controllers\WorldViewController;
use WorldView\Http\Controllers\OpenSkyProxyController;
use WorldView\Http\Controllers\PinController;
use WorldView\Http\Controllers\HealthController;

$prefix = config('worldview.route_prefix', 'world-view');
$rateLimit = config('worldview.rate_limit_max', 30);

Route::middleware('web')->group(function () use ($prefix, $rateLimit) {
    Route::get($prefix, WorldViewController::class)->name('worldview.map');

    Route::get($prefix . '/health', HealthController::class)->name('worldview.health');

    Route::get($prefix . '/opensky/{path}', [OpenSkyProxyController::class, 'proxy'])
        ->where('path', '.*');

    Route::get($prefix . '/pins', [PinController::class, 'index'])->name('worldview.pins.index');
    Route::post($prefix . '/pins', [PinController::class, 'store'])->name('worldview.pins.store');
    Route::delete($prefix . '/pins/{id}', [PinController::class, 'destroy'])->name('worldview.pins.destroy');
});
