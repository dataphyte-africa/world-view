<?php

namespace WorldView\Models;

use Illuminate\Database\Eloquent\Model;

class Pin extends Model
{
    protected $table = 'worldview_pins';

    protected $fillable = [
        'name',
        'latitude',
        'longitude',
        'image_url',
        'metadata',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'metadata' => 'array',
    ];
}
