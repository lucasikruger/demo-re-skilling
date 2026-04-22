<?php

namespace App\Jobs;

use App\Models\ContextItem;
use App\Services\ContextIngestionService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class IndexContextItemJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $contextItemId)
    {
    }

    public function handle(ContextIngestionService $ingestion): void
    {
        $item = ContextItem::findOrFail($this->contextItemId);

        $item->update(['ingestion_status' => 'processing']);
        $ingestion->ingest($item);
    }
}
