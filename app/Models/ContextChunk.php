<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContextChunk extends Model
{
    protected $fillable = [
        'context_item_id',
        'interview_session_id',
        'scope',
        'chunk_index',
        'content',
        'embedding',
        'token_count',
        'metadata',
    ];

    protected $casts = [
        'embedding' => 'array',
        'metadata' => 'array',
    ];

    public function contextItem(): BelongsTo
    {
        return $this->belongsTo(ContextItem::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(InterviewSession::class, 'interview_session_id');
    }
}
