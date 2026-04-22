<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InterviewAnswer extends Model
{
    protected $fillable = [
        'public_id',
        'interview_session_id',
        'question_id',
        'prompt_snapshot',
        'sort_order',
        'time_limit_seconds',
        'status',
        'audio_path',
        'mime_type',
        'duration_seconds',
        'transcript',
        'prosody_summary',
        'prosody_payload',
        'question_materials',
        'model_trace',
        'processed_at',
    ];

    protected $casts = [
        'prosody_payload' => 'array',
        'question_materials' => 'array',
        'model_trace' => 'array',
        'processed_at' => 'datetime',
    ];

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(InterviewSession::class, 'interview_session_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function promptLabel(): string
    {
        return $this->prompt_snapshot ?: (string) optional($this->question)->prompt;
    }
}
