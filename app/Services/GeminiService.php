<?php

namespace App\Services;

use App\Models\InterviewAnswer;
use App\Models\InterviewSession;
use App\Support\Json;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class GeminiService
{
    public function analyzeAnswer(InterviewAnswer $answer): array
    {
        if (! config('services.gemini.api_key')) {
            return $this->fakeAnswerAnalysis($answer);
        }

        $audioPath = Storage::disk('local')->path($answer->audio_path);
        $base64 = base64_encode(file_get_contents($audioPath) ?: '');

        $prosodyMaterials = collect($answer->session?->customDemoTemplate?->definition['prosody_materials'] ?? [])
            ->filter(fn ($m) => ($m['type'] ?? 'text') === 'text' && !empty($m['body_text']))
            ->map(fn ($m) => $m['body_text'])
            ->implode("\n\n");

        $questionMaterials = collect($answer->question_materials ?? [])->map(function (array $material) {
            if (($material['type'] ?? 'text') === 'text') {
                return [
                    'type' => 'text',
                    'title' => $material['title'] ?? 'Texto',
                    'content' => $material['body_text'] ?? '',
                ];
            }

            return [
                'type' => 'file',
                'title' => $material['title'] ?? ($material['original_filename'] ?? 'Archivo'),
                'original_filename' => $material['original_filename'] ?? null,
                'mime_type' => $material['mime_type'] ?? null,
            ];
        })->all();

        $basePrompt = <<<'PROMPT'
Analiza este audio en espanol y responde SOLO JSON con esta forma:
{
  "transcript": "texto",
  "prosody_summary": "resumen breve",
  "prosody_payload": {
    "fluidez": "alta|media|baja",
    "entonacion": "descripcion",
    "ritmo": "descripcion",
    "emocion_percibida": "descripcion"
  }
}
PROMPT;

        $fullPrompt = $prosodyMaterials
            ? $basePrompt."\n\nContexto adicional para el analisis:\n".$prosodyMaterials
            : $basePrompt;

        $payload = [
            'contents' => [[
                'parts' => [
                    ['text' => $fullPrompt],
                    [
                        'text' => json_encode([
                            'pregunta' => $answer->promptLabel(),
                            'materiales_de_apoyo' => $questionMaterials,
                        ], JSON_UNESCAPED_UNICODE),
                    ],
                    [
                        'inline_data' => [
                            'mime_type' => $answer->mime_type ?: 'audio/webm',
                            'data' => $base64,
                        ],
                    ],
                ],
            ]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
            ],
        ];

        $response = $this->client()->post(
            sprintf('%s/models/%s:generateContent', config('services.gemini.base_url'), config('services.gemini.model')),
            $payload
        )->throw()->json();

        $text = data_get($response, 'candidates.0.content.parts.0.text');
        $decoded = Json::decodeArray($text);

        return [
            'transcript' => data_get($decoded, 'transcript', ''),
            'prosody_summary' => data_get($decoded, 'prosody_summary', ''),
            'prosody_payload' => data_get($decoded, 'prosody_payload', []),
            'model_output' => $decoded,
        ];
    }

    public function generateReport(InterviewSession $session, array $contextSnippets): array
    {
        if (! config('services.gemini.api_key')) {
            return $this->fakeReport($session, $contextSnippets);
        }

        $answers = $session->answers->map(fn (InterviewAnswer $answer) => [
            'pregunta' => $answer->promptLabel(),
            'transcripcion' => $answer->transcript,
            'prosodia' => $answer->prosody_summary,
        ])->values()->all();

        $payload = [
            'contents' => [[
                'parts' => [[
                    'text' => json_encode([
                        'instruction' => 'Genera un informe final en espanol. Devuelve SOLO JSON con: executive_summary, sections (array con title, body) y trace_summary.',
                        'participante' => $session->participant_name,
                        'respuestas' => $answers,
                        'contexto' => $contextSnippets,
                    ], JSON_UNESCAPED_UNICODE),
                ]],
            ]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
            ],
        ];

        $response = $this->client()->post(
            sprintf('%s/models/%s:generateContent', config('services.gemini.base_url'), config('services.gemini.model')),
            $payload
        )->throw()->json();

        return Json::decodeArray(data_get($response, 'candidates.0.content.parts.0.text'));
    }

    protected function client(): PendingRequest
    {
        return Http::baseUrl(config('services.gemini.base_url'))
            ->timeout(120)
            ->withQueryParameters([
                'key' => config('services.gemini.api_key'),
            ]);
    }

    protected function fakeAnswerAnalysis(InterviewAnswer $answer): array
    {
        $question = $answer->promptLabel();

        return [
            'transcript' => 'Transcripcion simulada para la demo: respuesta asociada a "'.$question.'".',
            'prosody_summary' => 'Ritmo medio, tono estable y leves marcas de tension al desarrollar la idea principal.',
            'prosody_payload' => [
                'fluidez' => 'media',
                'entonacion' => 'estable con pequenos cambios de enfasis',
                'ritmo' => 'constante',
                'emocion_percibida' => 'control con algo de ansiedad funcional',
            ],
            'model_output' => [
                'transcript' => 'Transcripcion simulada para la demo: respuesta asociada a "'.$question.'".',
                'prosody_summary' => 'Ritmo medio, tono estable y leves marcas de tension al desarrollar la idea principal.',
                'prosody_payload' => [
                    'fluidez' => 'media',
                    'entonacion' => 'estable con pequenos cambios de enfasis',
                    'ritmo' => 'constante',
                    'emocion_percibida' => 'control con algo de ansiedad funcional',
                ],
            ],
        ];
    }

    protected function fakeReport(InterviewSession $session, array $contextSnippets): array
    {
        $answers = $session->answers;
        $themes = $answers->pluck('prosody_summary')->implode(' ');

        return [
            'executive_summary' => sprintf(
                'Informe demo para %s. Se observan patrones de comunicacion consistentes con presion moderada y necesidad de mayor claridad contextual.',
                $session->participant_name
            ),
            'sections' => [
                [
                    'title' => 'Hallazgos principales',
                    'body' => 'Las respuestas muestran consistencia narrativa, pero con marcas de tension en momentos de mayor carga. '.$themes,
                ],
                [
                    'title' => 'Contexto recuperado',
                    'body' => collect($contextSnippets)->pluck('content')->implode(' '),
                ],
                [
                    'title' => 'Siguientes pasos sugeridos',
                    'body' => 'Validar estos hallazgos con entrevistas adicionales y comparar con nuevos casos usando el mismo set de preguntas.',
                ],
            ],
            'trace_summary' => 'Modo demo sin API key: se generaron transcripciones y analisis simulados consistentes para exponer el flujo completo.',
        ];
    }
}
