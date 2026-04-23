<?php

namespace App\Jobs;

use App\Mail\InterviewReportMail;
use App\Models\InterviewSession;
use App\Models\Report;
use App\Services\GeminiService;
use App\Services\ReportPdfService;
use App\Services\RetrievalService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;
use Throwable;

class GenerateInterviewReportJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $sessionId)
    {
    }

    public function handle(RetrievalService $retrieval, GeminiService $gemini, ReportPdfService $pdf): void
    {
        $session = InterviewSession::with(['answers.question', 'report', 'customDemoTemplate'])->findOrFail($this->sessionId);
        $session->update([
            'status' => 'processing_report',
            'processing_stage' => 'Generando informe final',
        ]);

        $query = $session->answers->pluck('transcript')->filter()->implode(' ');
        $retrievedSnippets = $retrieval->retrieveForSession($session, $query)->map(function ($chunk) {
            return [
                'title' => $chunk->contextItem->title,
                'scope' => $chunk->scope,
                'source' => $chunk->contextItem->original_filename ?: $chunk->contextItem->title,
                'content' => $chunk->content,
                'score' => round($chunk->retrieval_score ?? 0, 4),
            ];
        });
        $templateSnippets = collect($session->customDemoTemplate?->definition['general_context_materials'] ?? [])->map(
            function (array $material) {
                return [
                    'title' => $material['title'] ?? 'Contexto general del test',
                    'scope' => 'template_general',
                    'source' => $material['original_filename'] ?? ($material['title'] ?? 'Contexto general del test'),
                    'content' => ($material['type'] ?? 'text') === 'text'
                        ? ($material['body_text'] ?? '')
                        : 'Archivo configurado para consolidar el informe final.',
                    'score' => 1.0,
                ];
            }
        );
        $snippets = $retrievedSnippets->concat($templateSnippets)->values()->all();

        $result = $gemini->generateReport($session->fresh(['answers.question']), $snippets);

        $report = Report::updateOrCreate(
            ['interview_session_id' => $session->id],
            [
                'status' => 'ready',
                'executive_summary' => $result['executive_summary'] ?? 'No se pudo generar un resumen ejecutivo.',
                'sections' => $result['sections'] ?? [],
                'trace' => [
                    'trace_summary' => $result['trace_summary'] ?? null,
                    'retrieved_context' => $snippets,
                    'template_context' => $templateSnippets->all(),
                    'answers' => $session->answers->map(function ($answer) use ($retrieval, $session) {
                        $answerSnippets = $retrieval->retrieveForSession(
                            $session,
                            $answer->transcript ?: $answer->promptLabel(),
                            4
                        )->map(function ($chunk) {
                            return [
                                'title' => $chunk->contextItem->title,
                                'scope' => $chunk->scope,
                                'source' => $chunk->contextItem->original_filename ?: $chunk->contextItem->title,
                                'content' => $chunk->content,
                                'score' => round($chunk->retrieval_score ?? 0, 4),
                            ];
                        })->all();

                        return [
                            'question' => $answer->promptLabel(),
                            'transcript' => $answer->transcript,
                            'prosody_summary' => $answer->prosody_summary,
                            'prosody_payload' => $answer->prosody_payload,
                            'question_materials' => $answer->question_materials,
                            'model_trace' => $answer->model_trace,
                            'processed_at' => optional($answer->processed_at)?->toIso8601String(),
                            'retrieved_context' => $answerSnippets,
                        ];
                    })->all(),
                    'session_code' => $session->internal_session_code,
                    'generated_at' => now()->toIso8601String(),
                ],
                'generated_at' => now(),
            ]
        );

        $pdfPath = $pdf->render($session->fresh(['answers.question', 'report']));
        $report->update(['pdf_path' => $pdfPath]);

        $session->update([
            'status' => 'report_ready',
            'processing_stage' => 'Informe listo',
            'completed_at' => now(),
        ]);

        if ($session->participant_email) {
            Mail::to($session->participant_email)->queue(new InterviewReportMail($session->fresh(['answers.question', 'report'])));
        }
    }

    public function failed(Throwable $exception): void
    {
        $session = InterviewSession::find($this->sessionId);

        if (! $session) {
            return;
        }

        $session->update([
            'status' => 'interrupted',
            'processing_stage' => 'Error al generar el informe. Intentá nuevamente.',
        ]);

        Report::where('interview_session_id', $session->id)->update([
            'status' => 'failed',
        ]);
    }
}
