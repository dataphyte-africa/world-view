<?php

namespace Acme\WorldView;

use System\Classes\PluginBase;
use WorldView\WorldViewServiceProvider;

class Plugin extends PluginBase
{
    public $require = ['WorldView.Core'];

    public function pluginDetails(): array
    {
        return [
            'name' => 'WorldView',
            'description' => 'Interactive world map with pins, heatmaps, KML layers, and optional aircraft tracking',
            'author' => 'Acme',
            'icon' => 'icon-globe',
        ];
    }

    public function boot(): void
    {
        $this->app->register(WorldViewServiceProvider::class);
    }

    public function registerComponents(): array
    {
        return [
            \Acme\WorldView\Components\WorldMap::class => 'worldMap',
        ];
    }

    public function registerSettings(): array
    {
        return [
            'worldview' => [
                'label' => 'WorldView',
                'description' => 'Manage WorldView configuration',
                'category' => 'WorldView',
                'icon' => 'icon-globe',
                'class' => \WorldView\Models\Settings::class,
                'order' => 500,
                'keywords' => 'map pins aircraft opensky',
            ],
        ];
    }

    public function registerListColumnTypes(): array
    {
        return [
            'worldview_pin_count' => function ($value, $column, $record) {
                return \WorldView\Models\Pin::count();
            },
        ];
    }
}
