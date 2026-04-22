<?php

namespace App\Services;

use Smalot\PdfParser\Parser;

class DocumentTextExtractor
{
    public function extract(string $absolutePath, ?string $mimeType = null): string
    {
        if ($mimeType === 'application/pdf' || str_ends_with(strtolower($absolutePath), '.pdf')) {
            return $this->extractPdf($absolutePath);
        }

        return trim(file_get_contents($absolutePath) ?: '');
    }

    protected function extractPdf(string $absolutePath): string
    {
        $parser = new Parser();
        $pdf = $parser->parseFile($absolutePath);

        return trim($pdf->getText());
    }
}
