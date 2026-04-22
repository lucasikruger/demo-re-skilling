<?php

namespace App\Services;

use App\Models\ContextChunk;
use App\Models\ContextItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ContextIngestionService
{
    public function __construct(
        protected ChunkingService $chunking,
        protected EmbeddingService $embedding,
        protected DocumentTextExtractor $extractor,
    ) {
    }

    public function ingest(ContextItem $item): void
    {
        $sourceText = $item->kind === 'text'
            ? (string) $item->body_text
            : $this->extractor->extract(Storage::disk('local')->path($item->file_path), $item->mime_type);

        $chunks = $this->chunking->split($sourceText);

        DB::transaction(function () use ($item, $chunks, $sourceText): void {
            $item->chunks()->delete();

            foreach ($chunks as $index => $chunk) {
                ContextChunk::create([
                    'context_item_id' => $item->id,
                    'interview_session_id' => $item->interview_session_id,
                    'scope' => $item->scope,
                    'chunk_index' => $index + 1,
                    'content' => $chunk,
                    'embedding' => $this->embedding->embed($chunk),
                    'token_count' => str_word_count($chunk),
                    'metadata' => [
                        'source_title' => $item->title,
                        'source_length' => mb_strlen($sourceText),
                    ],
                ]);
            }

            $item->forceFill([
                'body_text' => $item->kind === 'document' ? $sourceText : $item->body_text,
                'ingestion_status' => 'indexed',
                'indexed_at' => now(),
            ])->save();
        });
    }
}
