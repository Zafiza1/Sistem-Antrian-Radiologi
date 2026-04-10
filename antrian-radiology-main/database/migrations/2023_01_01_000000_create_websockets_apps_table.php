<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('websockets_apps', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->string('key');
            $table->string('secret');
            $table->string('path')->default('/');
            $table->string('host')->nullable();
            $table->boolean('enable_client_messages')->default(false);
            $table->boolean('enabled')->default(true);
            $table->integer('max_connections')->nullable();
            $table->boolean('enable_statistics')->default(true);
            $table->timestamps();
        });

        // Insert default app
        DB::table('websockets_apps')->insert([
            'name' => env('APP_NAME', 'QueueRadiology'),
            'key' => env('PUSHER_APP_KEY', '4b9f385e81fdb462f797'),
            'secret' => env('PUSHER_APP_SECRET', '1540d8603d4968d722bd'),
            'path' => '/',
            'enable_client_messages' => true,
            'enable_statistics' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down()
    {
        Schema::dropIfExists('websockets_apps');
    }
};
