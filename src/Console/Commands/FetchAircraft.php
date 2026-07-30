<?php

namespace WorldView\Console\Commands;

use Illuminate\Console\Command;
use WorldView\Services\OpenSkyService;

class FetchAircraft extends Command
{
    protected $signature = 'worldview:fetch-aircraft';

    protected $description = 'Fetch aircraft data from OpenSky Network and cache it';

    public function handle(OpenSkyService $openSky): int
    {
        if (!config('worldview.aircraft.enabled', false)) {
            $this->warn('Aircraft tracking is disabled. Enable it in config/worldview.php');

            return Command::FAILURE;
        }

        $this->info('Fetching aircraft data from OpenSky Network...');

        try {
            $result = $openSky->proxy('states/all');

            if ($result['status'] === 200 && isset($result['data']['states'])) {
                $count = count($result['data']['states']);
                $this->info("Fetched {$count} aircraft states.");
                $this->line('Time: ' . ($result['data']['time'] ?? 'N/A'));
            } else {
                $this->warn('Unexpected response: HTTP ' . $result['status']);
            }

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Failed: ' . $e->getMessage());

            return Command::FAILURE;
        }
    }
}
