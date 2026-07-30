<?php

namespace Acme\WorldView;

use Statamic\Providers\AddonServiceProvider;
use WorldView\WorldViewServiceProvider as CoreServiceProvider;

class WorldViewServiceProvider extends AddonServiceProvider
{
    protected $views = [
        'worldview' => __DIR__ . '/../../../../resources/views',
    ];

    protected $assets = [
        __DIR__ . '/../../../../resources/assets' => 'vendor/worldview',
    ];

    public function boot(): void
    {
        parent::boot();

        $this->app->register(CoreServiceProvider::class);

        $this->publishes([
            __DIR__ . '/../../config/worldview.php' => config_path('worldview.php'),
        ], 'worldview-config');
    }

    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../../config/worldview.php', 'worldview');
    }
}
