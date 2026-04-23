<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateInterviewReportJob;
use App\Models\InterviewAnswer;
use App\Models\InterviewSession;
use App\Models\Question;
use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InterviewSessionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'participant_name' => ['required', 'string', 'max:255'],
        ]);

        $session = InterviewSession::create([
            'participant_name' => $validated['participant_name'],
            'flow_mode' => 'default',
            'status' => 'recording',
            'processing_stage' => 'Cargando preguntas',
        ]);

        Question::ordered()->where('is_active', true)->get()->each(function (Question $question) use ($session): void {
            InterviewAnswer::create([
                'public_id' => (string) str()->uuid(),
                'interview_session_id' => $session->id,
                'question_id' => $question->id,
                'prompt_snapshot' => $question->prompt,
                'sort_order' => $question->position,
                'time_limit_seconds' => 180,
            ]);
        });

        return response()->json($this->payload($session->fresh(['answers.question', 'contextItems', 'report'])), 201);
    }

    public function show(InterviewSession $interviewSession): JsonResponse
    {
        return response()->json($this->payload(
            $interviewSession->load(['answers.question', 'contextItems.chunks', 'report', 'customDemoTemplate'])
        ));
    }

    public function finalize(InterviewSession $interviewSession, Request $request): JsonResponse
    {
        $email = $request->string('email')->value() ?: null;

        $interviewSession->update([
            'status' => 'queued_for_report',
            'processing_stage' => 'Preparando informe',
            'participant_email' => $email,
        ]);

        Report::firstOrCreate(
            ['interview_session_id' => $interviewSession->id],
            ['status' => 'queued']
        );

        GenerateInterviewReportJob::dispatch($interviewSession->id);

        return response()->json(['queued' => true]);
    }

    public function interrupt(InterviewSession $interviewSession): JsonResponse
    {
        if (in_array($interviewSession->status, ['report_ready', 'interrupted'], true)) {
            return response()->json(['interrupted' => true]);
        }

        $interviewSession->update([
            'status' => 'interrupted',
            'processing_stage' => 'Sesion interrumpida',
            'interrupted_at' => now(),
        ]);

        return response()->json(['interrupted' => true]);
    }

    public function syncQuestions(InterviewSession $interviewSession): JsonResponse
    {
        DB::transaction(function () use ($interviewSession): void {
            $interviewSession->answers()->delete();

            Question::ordered()->where('is_active', true)->get()->each(function (Question $question) use ($interviewSession): void {
                InterviewAnswer::create([
                    'public_id' => (string) str()->uuid(),
                    'interview_session_id' => $interviewSession->id,
                    'question_id' => $question->id,
                    'prompt_snapshot' => $question->prompt,
                    'sort_order' => $question->position,
                    'time_limit_seconds' => 180,
                ]);
            });
        });

        return response()->json($this->payload(
            $interviewSession->fresh()->load(['answers.question', 'contextItems.chunks', 'report'])
                ->load('customDemoTemplate')
        ));
    }

    protected function payload(InterviewSession $session): array
    {
        return [
            'session' => $session,
            'answers' => $session->answers->sortBy('sort_order')->values(),
            'contextItems' => $session->contextItems->values(),
            'report' => $session->report,
            'customDemoTemplate' => $session->customDemoTemplate,
        ];
    }
}
