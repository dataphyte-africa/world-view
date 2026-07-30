<?php

namespace WorldView;

class WorldView
{
    protected array $config;

    public function __construct()
    {
        $this->config = config('worldview', []);
    }

    public function config(string $key, mixed $default = null): mixed
    {
        return data_get($this->config, $key, $default);
    }

    public function isAircraftEnabled(): bool
    {
        return $this->config('aircraft.enabled', false);
    }

    public function openSkyClientId(): ?string
    {
        return $this->config('aircraft.opensky_client_id') ?: env('OPENSKY_CLIENT_ID');
    }

    public function openSkyClientSecret(): ?string
    {
        return $this->config('aircraft.opensky_client_secret') ?: env('OPENSKY_CLIENT_SECRET');
    }

    public function rateLimitMax(): int
    {
        return $this->config('rate_limit_max', 30);
    }
}
