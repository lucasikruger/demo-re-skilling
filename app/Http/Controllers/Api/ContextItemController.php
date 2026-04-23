<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\IndexContextItemJob;
use App\Models\ContextItem;
use App\Models\InterviewSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ContextItemController extends Controller
{
    public function storeGlobalText(Request $request): JsonResponse
    {
        return $this->storeText($request, null, 'global');
    }

    public function storeSessionText(Request $request, InterviewSession $session): JsonResponse
    {
        return $this->storeText($request, $session, 'session');
    }

    public function storeGlobalDocument(Request $request): JsonResponse
    {
        return $this->storeDocument($request, null, 'global');
    }

    public function storeSessionDocument(Request $request, InterviewSession $session): JsonResponse
    {
        return $this->storeDocument($request, $session, 'session');
    }

    public function destroy(ContextItem $contextItem): JsonResponse
    {
        if ($contextItem->file_path) {
            Storage::disk(config('filesystems.default'))->delete($contextItem->file_path);
        }

        $contextItem->delete();

        return response()->json(['deleted' => true]);
    }

    protected function storeText(Request $request, ?InterviewSession $session, string $scope): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body_text' => ['required', 'string'],
        ]);

        $item = ContextItem::create([
            'interview_session_id' => $session?->id,
            'scope' => $scope,
            'kind' => 'text',
            'title' => $validated['title'],
            'body_text' => $validated['body_text'],
            'ingestion_status' => 'queued',
        ]);

        IndexContextItemJob::dispatch($item->id);

        return response()->json($item, 201);
    }

    protected function storeDocument(Request $request, ?InterviewSession $session, string $scope): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'document' => ['required', 'file', 'mimes:pdf,txt,md', 'max:10240'],
        ]);

        $file = $validated['document'];
        $path = $file->store(
            $scope === 'global' ? 'context/global' : 'context/sessions/'.$session->public_id,
            config('filesystems.default')
        );

        $item = ContextItem::create([
            'interview_session_id' => $session?->id,
            'scope' => $scope,
            'kind' => 'document',
            'title' => $validated['title'],
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'ingestion_status' => 'queued',
        ]);

        IndexContextItemJob::dispatch($item->id);

        return response()->json($item, 201);
    }
}
