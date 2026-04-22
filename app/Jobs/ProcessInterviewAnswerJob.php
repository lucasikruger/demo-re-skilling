<?php

namespace App\Jobs;

use App\Models\InterviewAnswer;
use App\Services\GeminiService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ProcessInterviewAnswerJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $answerId)
    {
    }

    public function handle(GeminiService $gemini): void
    {
        $answer = InterviewAnswer::with(['question', 'session.customDemoTemplate'])->findOrFail($this->answerId);
        $answer->update([
            'status' => 'processing',
            'model_trace' => array_merge($answer->model_trace ?? [], [
                'status' => 'processing',
                'started_at' => now()->toIso8601String(),
                'prompt' => $answer->promptLabel(),
            ]),
        ]);

        $analysis = $gemini->analyzeAnswer($answer);

        $answer->update([
            'status' => 'processed',
            'transcript' => $analysis['transcript'] ?? '',
            'prosody_summary' => $analysis['prosody_summary'] ?? '',
            'prosody_payload' => $analysis['prosody_payload'] ?? [],
            'model_trace' => array_merge($answer->model_trace ?? [], [
                'status' => 'processed',
                'finished_at' => now()->toIso8601String(),
                'response' => $analysis['model_output'] ?? [],
            ]),
            'processed_at' => now(),
        ]);
    }

    public function failed(Throwable $exception): void
    {
        InterviewAnswer::find($this->answerId)?->update([
            'status' => 'failed',
            'model_trace' => [
                'status' => 'failed',
                'error' => $exception->getMessage(),
                'failed_at' => now()->toIso8601String(),
            ],
        ]);
    }
}
