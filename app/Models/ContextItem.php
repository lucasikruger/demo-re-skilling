<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ContextItem extends Model
{
    protected $fillable = [
        'interview_session_id',
        'scope',
        'kind',
        'title',
        'body_text',
        'file_path',
        'original_filename',
        'mime_type',
        'ingestion_status',
        'indexed_at',
    ];

    protected $casts = [
        'indexed_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(InterviewSession::class, 'interview_session_id');
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(ContextChunk::class);
    }
}
