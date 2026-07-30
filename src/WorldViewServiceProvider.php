<?php

namespace WorldView;

use Illuminate\Support\ServiceProvider;
use Illuminate\Routing\Router;
use WorldView\Http\Middleware\RateLimitMiddleware;

class WorldViewServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/Config/worldview.php', 'worldview');

        $this->app->singleton(WorldView::class, function () {
            return new WorldView();
        });
    }

    public function boot(): void
    {
        $this->loadRoutes();

        $this->loadViewsFrom(__DIR__ . '/../resources/views', 'worldview');

        $this->publishes([
            __DIR__ . '/Config/worldview.php' => config_path('worldview.php'),
        ], 'worldview-config');

        $this->publishes([
            __DIR__ . '/../resources/assets' => public_path('vendor/worldview'),
        ], 'worldview-assets');

        $this->loadMigrationsFrom(__DIR__ . '/Migrations');

        $this->registerMiddleware();

        if ($this->app->runningInConsole()) {
            $this->commands([
                Console\Commands\FetchAircraft::class,
            ]);
        }
    }

    protected function loadRoutes(): void
    {
        $this->loadRoutesFrom(__DIR__ . '/Http/Routes/api.php');
    }

    protected function registerMiddleware(): void
    {
        $router = $this->app->make(Router::class);
        $router->aliasMiddleware('worldview.ratelimit', RateLimitMiddleware::class);
    }
}
