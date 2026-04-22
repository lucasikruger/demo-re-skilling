<?php

namespace App\Services;

use App\Models\ContextChunk;
use App\Models\InterviewSession;
use Illuminate\Support\Collection;

class RetrievalService
{
    public function __construct(protected EmbeddingService $embedding)
    {
    }

    public function retrieveForSession(InterviewSession $session, string $query, int $limit = 6): Collection
    {
        $queryEmbedding = $this->embedding->embed($query);

        return ContextChunk::query()
            ->where(function ($builder) use ($session): void {
                $builder->where('scope', 'global')
                    ->orWhere(function ($sessionBuilder) use ($session): void {
                        $sessionBuilder->where('scope', 'session')
                            ->where('interview_session_id', $session->id);
                    });
            })
            ->with('contextItem')
            ->get()
            ->map(function (ContextChunk $chunk) use ($queryEmbedding) {
                $chunk->retrieval_score = $this->embedding->similarity($queryEmbedding, $chunk->embedding ?? []);

                return $chunk;
            })
            ->sortByDesc('retrieval_score')
            ->take($limit)
            ->values();
    }
}
