<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class InterviewSession extends Model
{
    protected $fillable = [
        'participant_name',
        'participant_email',
        'flow_mode',
        'internal_session_code',
        'custom_demo_template_id',
        'status',
        'processing_stage',
        'completed_at',
        'interrupted_at',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
        'interrupted_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $session): void {
            $session->public_id ??= (string) Str::uuid();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function answers(): HasMany
    {
        return $this->hasMany(InterviewAnswer::class);
    }

    public function customDemoTemplate(): BelongsTo
    {
        return $this->belongsTo(CustomDemoTemplate::class);
    }

    public function contextItems(): HasMany
    {
        return $this->hasMany(ContextItem::class);
    }

    public function report(): HasOne
    {
        return $this->hasOne(Report::class);
    }
}
