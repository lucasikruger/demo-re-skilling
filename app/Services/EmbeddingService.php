<?php

namespace App\Services;

class EmbeddingService
{
    public function embed(string $content): array
    {
        $vector = array_fill(0, 16, 0.0);
        $words = preg_split('/[^[:alnum:]]+/u', mb_strtolower($content), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        foreach ($words as $word) {
            $hash = abs(crc32($word));
            $index = $hash % count($vector);
            $vector[$index] += 1;
        }

        $norm = sqrt(array_sum(array_map(static fn (float $item): float => $item * $item, $vector)));

        if ($norm <= 0.0) {
            return $vector;
        }

        return array_map(static fn (float $item): float => round($item / $norm, 6), $vector);
    }

    public function similarity(array $left, array $right): float
    {
        $score = 0.0;

        foreach ($left as $index => $value) {
            $score += $value * ($right[$index] ?? 0);
        }

        return $score;
    }
}
