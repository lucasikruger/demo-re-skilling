<?php

namespace App\Services;

use App\Models\InterviewSession;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

class ReportPdfService
{
    public function render(InterviewSession $session): string
    {
        $pdf = Pdf::loadView('pdf.report', [
            'session' => $session->load(['answers.question', 'report']),
            'report' => $session->report,
        ]);

        $path = 'reports/'.$session->public_id.'.pdf';
        Storage::disk(config('filesystems.default'))->put($path, $pdf->output());

        return $path;
    }
}
