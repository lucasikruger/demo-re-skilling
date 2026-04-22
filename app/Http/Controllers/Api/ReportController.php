<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewSession;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    public function show(InterviewSession $interviewSession): JsonResponse
    {
        $session = $interviewSession->load(['answers.question', 'report']);

        return response()->json([
            'session' => $session,
            'report' => $session->report,
        ]);
    }
}
