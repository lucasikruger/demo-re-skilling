<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class CustomDemoTemplate extends Model
{
    protected $fillable = [
        'name',
        'internal_code',
        'definition',
    ];

    protected $casts = [
        'definition' => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $template): void {
            $template->public_id ??= (string) Str::uuid();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(InterviewSession::class);
    }
}
