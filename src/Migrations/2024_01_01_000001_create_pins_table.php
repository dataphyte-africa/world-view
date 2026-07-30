<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('worldview_pins', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->double('latitude', 10, 7);
            $table->double('longitude', 10, 7);
            $table->string('image_url')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worldview_pins');
    }
};
