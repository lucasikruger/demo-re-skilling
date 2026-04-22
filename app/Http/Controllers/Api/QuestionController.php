<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Question;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuestionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string', 'max:255'],
        ]);

        $position = (int) Question::max('position') + 1;

        $question = Question::create([
            'prompt' => $validated['prompt'],
            'position' => max(1, $position),
            'is_active' => true,
        ]);

        return response()->json($question, 201);
    }

    public function update(Request $request, Question $question): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string', 'max:255'],
            'position' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $question->update($validated);

        return response()->json($question->fresh());
    }

    public function destroy(Question $question): JsonResponse
    {
        $question->delete();

        return response()->json(['deleted' => true]);
    }
}
