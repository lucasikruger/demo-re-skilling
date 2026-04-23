<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessInterviewAnswerJob;
use App\Models\InterviewAnswer;
use App\Models\InterviewSession;
use App\Models\Question;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class InterviewAnswerController extends Controller
{
    public function store(Request $request, InterviewSession $interviewSession, Question $question): JsonResponse
    {
        $answer = InterviewAnswer::query()
            ->where('interview_session_id', $interviewSession->id)
            ->where('question_id', $question->id)
            ->firstOrFail();

        return $this->storeForAnswer($request, $interviewSession, $answer);
    }

    public function storeByAnswer(Request $request, InterviewSession $interviewSession, InterviewAnswer $interviewAnswer): JsonResponse
    {
        abort_unless($interviewAnswer->interview_session_id === $interviewSession->id, 404);

        return $this->storeForAnswer($request, $interviewSession, $interviewAnswer);
    }

    protected function storeForAnswer(Request $request, InterviewSession $interviewSession, InterviewAnswer $answer): JsonResponse
    {
        $disk = Storage::disk(config('filesystems.default'));

        $validated = $request->validate([
            'audio' => ['required', 'file', 'max:10240'],
            'duration_seconds' => ['nullable', 'integer', 'min:1'],
        ]);

        if ($answer->audio_path) {
            $disk->delete($answer->audio_path);
        }

        $file = $validated['audio'];
        $path = $file->store('answers/'.$interviewSession->public_id, config('filesystems.default'));

        $answer->update([
            'status' => 'queued',
            'audio_path' => $path,
            'mime_type' => $file->getMimeType(),
            'duration_seconds' => $validated['duration_seconds'] ?? null,
            'transcript' => null,
            'prosody_summary' => null,
            'prosody_payload' => null,
            'model_trace' => [
                'status' => 'queued',
                'used_files' => collect($answer->question_materials ?? [])
                    ->where('type', 'file')
                    ->values()
                    ->all(),
                'used_texts' => collect($answer->question_materials ?? [])
                    ->where('type', 'text')
                    ->values()
                    ->all(),
            ],
            'processed_at' => null,
        ]);

        ProcessInterviewAnswerJob::dispatch($answer->id);

        return response()->json($answer->fresh());
    }
}
