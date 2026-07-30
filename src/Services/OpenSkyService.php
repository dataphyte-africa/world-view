<?php

namespace WorldView\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class OpenSkyService
{
    protected Client $http;

    protected string $authUrl = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

    protected string $apiBase = 'https://opensky-network.org';

    protected int $timeout = 15;

    public function __construct(?Client $client = null)
    {
        $this->http = $client ?? new Client(['timeout' => $this->timeout]);
    }

    public function getToken(): string
    {
        $cacheKey = 'worldview.opensky.token';

        return Cache::remember($cacheKey, now()->addMinutes(5), function () {
            $clientId = config('worldview.aircraft.opensky_client_id');
            $clientSecret = config('worldview.aircraft.opensky_client_secret');

            if (!$clientId || !$clientSecret) {
                throw new \RuntimeException('OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET must be set');
            }

            try {
                $response = $this->http->post($this->authUrl, [
                    'form_params' => [
                        'grant_type' => 'client_credentials',
                        'client_id' => $clientId,
                        'client_secret' => $clientSecret,
                    ],
                ]);

                $data = json_decode($response->getBody(), true);
                $token = $data['access_token'] ?? null;

                if (!$token) {
                    throw new \RuntimeException('No access_token in OpenSky auth response');
                }

                if (isset($data['expires_in'])) {
                    Cache::put($cacheKey, $token, now()->addSeconds((int) $data['expires_in'] - 60));
                }

                return $token;
            } catch (GuzzleException $e) {
                Log::error('[WorldView OpenSky] Auth failed: ' . $e->getMessage());
                throw new \RuntimeException('OpenSky authentication failed: ' . $e->getMessage());
            }
        });
    }

    public function proxy(string $path, array $query = []): array
    {
        $cleanPath = ltrim($path, '/');
        if (!str_starts_with($cleanPath, 'api/')) {
            $cleanPath = 'api/' . $cleanPath;
        }

        if (!$this->isValidPath($cleanPath)) {
            throw new \InvalidArgumentException('Invalid path');
        }

        $url = rtrim($this->apiBase, '/') . '/' . $cleanPath;

        if (!empty($query)) {
            $url .= '?' . http_build_query($query);
        }

        $options = [
            'headers' => ['Accept' => 'application/json'],
            'timeout' => $this->timeout,
        ];

        try {
            $token = $this->getToken();
            $options['headers']['Authorization'] = 'Bearer ' . $token;
        } catch (\Exception $e) {
            Log::warning('[WorldView OpenSky] Proceeding anonymously: ' . $e->getMessage());
        }

        try {
            $response = $this->http->get($url, $options);
            $body = (string) $response->getBody();
            $data = json_decode($body, true);

            return [
                'status' => $response->getStatusCode(),
                'data' => $data ?? $body,
            ];
        } catch (GuzzleException $e) {
            Log::error('[WorldView OpenSky] Proxy failed: ' . $e->getMessage());
            throw new \RuntimeException('OpenSky proxy request failed: ' . $e->getMessage());
        }
    }

    protected function isValidPath(string $path): bool
    {
        return strlen($path) > 0
            && strlen($path) < 200
            && !str_contains($path, '..')
            && preg_match('/^[a-zA-Z0-9_\/\-.?&=]+$/', $path) === 1;
    }
}
