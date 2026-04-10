<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class SetCacheDriver extends Command
{
    protected $signature = 'cache:driver {driver=file}';
    protected $description = 'Set the cache driver';

    public function handle()
    {
        $driver = $this->argument('driver');
        $envPath = base_path('.env');
        
        if (File::exists($envPath)) {
            $env = File::get($envPath);
            $newEnv = preg_replace(
                '/^CACHE_DRIVER=.*/m',
                'CACHE_DRIVER='.$driver,
                $env
            );
            
            File::put($envPath, $newEnv);
            $this->info("Cache driver set to: {$driver}");
            
            // Clear config cache
            $this->call('config:clear');
            $this->info('Configuration cache cleared!');
            
            // Clear the cache
            $this->call('cache:clear');
            $this->info('Application cache cleared!');
            
            return 0;
        }
        
        $this->error('.env file not found!');
        return 1;
    }
}
