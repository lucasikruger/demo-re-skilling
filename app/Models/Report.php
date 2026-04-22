<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    protected $fillable = [
        'interview_session_id',
        'status',
        'executive_summary',
        'sections',
        'trace',
        'pdf_path',
        'generated_at',
    ];

    protected $casts = [
        'sections' => 'array',
        'trace' => 'array',
        'generated_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(InterviewSession::class, 'interview_session_id');
    }
}
