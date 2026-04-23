<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomDemoTemplate;
use App\Models\InterviewAnswer;
use App\Models\InterviewSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CustomDemoTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            CustomDemoTemplate::query()->latest()->get()
        );
    }

    public function show(CustomDemoTemplate $customDemoTemplate): JsonResponse
    {
        return response()->json($customDemoTemplate);
    }

    public function findByCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'internal_code' => ['required', 'string'],
        ]);

        return response()->json(
            CustomDemoTemplate::query()
                ->where('internal_code', $validated['internal_code'])
                ->firstOrFail()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $template = CustomDemoTemplate::create($this->validatedTemplatePayload($request));
        $template->update([
            'definition' => $this->normalizeDefinition($request, $template),
        ]);

        return response()->json($template->fresh(), 201);
    }

    public function update(Request $request, CustomDemoTemplate $customDemoTemplate): JsonResponse
    {
        $customDemoTemplate->update($this->validatedTemplatePayload($request, $customDemoTemplate));
        $customDemoTemplate->update([
            'definition' => $this->normalizeDefinition($request, $customDemoTemplate),
        ]);

        return response()->json($customDemoTemplate->fresh());
    }

    public function destroy(CustomDemoTemplate $customDemoTemplate): JsonResponse
    {
        $customDemoTemplate->delete();

        return response()->json(['deleted' => true]);
    }

    public function createSession(Request $request, CustomDemoTemplate $customDemoTemplate): JsonResponse
    {
        $validated = $request->validate([
            'participant_name' => ['required', 'string', 'max:255'],
        ]);

        $definition = $customDemoTemplate->definition ?? [];
        $questions = collect($definition['questions'] ?? []);

        $session = InterviewSession::create([
            'participant_name' => $validated['participant_name'],
            'flow_mode' => 'custom',
            'internal_session_code' => $customDemoTemplate->internal_code,
            'custom_demo_template_id' => $customDemoTemplate->id,
            'status' => 'recording',
            'processing_stage' => 'Cargando demo custom',
        ]);

        $questions->values()->each(function (array $question, int $index) use ($session): void {
            $analysisMaterials = collect($question['analysis_materials'] ?? [])
                ->map(fn (array $material) => ['category' => 'analysis', ...$material])
                ->all();
            $prosodyMaterials = collect($question['prosody_materials'] ?? [])
                ->map(fn (array $material) => ['category' => 'prosody', ...$material])
                ->all();

            InterviewAnswer::create([
                'public_id' => (string) Str::uuid(),
                'interview_session_id' => $session->id,
                'question_id' => null,
                'prompt_snapshot' => $question['prompt'] ?? 'Pregunta sin texto',
                'sort_order' => $index + 1,
                'time_limit_seconds' => (int) ($question['time_limit_seconds'] ?? 180),
                'question_materials' => [...$analysisMaterials, ...$prosodyMaterials],
                'status' => 'pending',
            ]);
        });

        return response()->json([
            'session' => $session->fresh(['customDemoTemplate']),
            'answers' => $session->answers()->orderBy('sort_order')->get(),
            'contextItems' => [],
            'report' => null,
        ], 201);
    }

    protected function validatedTemplatePayload(Request $request, ?CustomDemoTemplate $template = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'definition' => ['required', 'string'],
        ]);

        $validated['internal_code'] = $request->input('internal_code')
            ?: Str::slug($validated['name']).'-'.Str::lower(Str::random(5));

        validator(
            ['internal_code' => $validated['internal_code']],
            ['internal_code' => ['required', 'string', 'max:255', Rule::unique('custom_demo_templates', 'internal_code')->ignore($template?->id)]]
        )->validate();

        return $validated;
    }

    protected function normalizeDefinition(Request $request, CustomDemoTemplate $template): array
    {
        $definition = json_decode((string) $request->input('definition'), true) ?: [];
        $generalContextMaterials = $this->normalizeMaterials(
            collect($definition['general_context_materials'] ?? [])->values(),
            $request,
            $template,
            'general'
        );

        $questions = collect($definition['questions'] ?? [])->values()->map(function (array $question) use ($request, $template) {
            $analysisMaterials = $this->normalizeMaterials(
                collect($question['analysis_materials'] ?? [])->values(),
                $request,
                $template,
                'analysis'
            );
            $prosodyMaterials = $this->normalizeMaterials(
                collect($question['prosody_materials'] ?? [])->values(),
                $request,
                $template,
                'prosody'
            );

            return [
                'prompt' => $question['prompt'] ?? 'Pregunta sin texto',
                'time_limit_seconds' => (int) ($question['time_limit_seconds'] ?? 180),
                'analysis_materials' => $analysisMaterials,
                'prosody_materials' => $prosodyMaterials,
            ];
        })->all();

        return [
            'general_context_materials' => $generalContextMaterials,
            'questions' => $questions,
        ];
    }

    protected function normalizeMaterials($materials, Request $request, CustomDemoTemplate $template, string $folder): array
    {
        return $materials->map(function (array $material) use ($request, $template, $folder) {
            if (($material['type'] ?? 'text') === 'text') {
                return Arr::only($material, ['type', 'title', 'body_text']);
            }

            $fileKey = $material['file_key'] ?? null;
            $uploadedFile = $fileKey ? $request->file("files.$fileKey") : null;

            if ($uploadedFile) {
                $path = $uploadedFile->store(
                    'custom-tests/'.$template->public_id.'/'.$folder,
                    config('filesystems.default')
                );

                return [
                    'type' => 'file',
                    'title' => $material['title'] ?? $uploadedFile->getClientOriginalName(),
                    'file_path' => $path,
                    'original_filename' => $uploadedFile->getClientOriginalName(),
                    'mime_type' => $uploadedFile->getMimeType(),
                ];
            }

            return Arr::only($material, ['type', 'title', 'file_path', 'original_filename', 'mime_type']);
        })->all();
    }
}
