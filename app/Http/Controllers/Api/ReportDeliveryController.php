<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\InterviewReportMail;
use App\Models\InterviewSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ReportDeliveryController extends Controller
{
    public function __invoke(Request $request, InterviewSession $interviewSession): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        abort_unless($interviewSession->report, 404);

        Mail::to($validated['email'])->send(new InterviewReportMail($interviewSession->load('report')));

        return response()->json([
            'sent' => true,
        ]);
    }
}
