<?php

namespace App\Services;

class ChunkingService
{
    public function split(string $content, int $chunkSize = 500, int $overlap = 80): array
    {
        $normalized = trim(preg_replace('/\s+/', ' ', $content) ?? '');

        if ($normalized === '') {
            return [];
        }

        $chunks = [];
        $start = 0;
        $length = mb_strlen($normalized);

        while ($start < $length) {
            $chunk = mb_substr($normalized, $start, $chunkSize);
            $chunks[] = trim($chunk);
            $start += max(1, $chunkSize - $overlap);
        }

        return array_values(array_filter($chunks));
    }
}
