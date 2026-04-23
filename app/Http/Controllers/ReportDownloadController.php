<?php

namespace App\Http\Controllers;

use App\Models\InterviewSession;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportDownloadController extends Controller
{
    public function __invoke(InterviewSession $interviewSession): StreamedResponse
    {
        abort_unless($interviewSession->report?->pdf_path, 404);

        return Storage::disk(config('filesystems.default'))->download(
            $interviewSession->report->pdf_path,
            'informe-'.$interviewSession->public_id.'.pdf'
        );
    }
}
