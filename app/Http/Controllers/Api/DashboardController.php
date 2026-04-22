<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomDemoTemplate;
use App\Models\ContextItem;
use App\Models\InterviewSession;
use App\Models\Question;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'questions' => Question::ordered()->get(),
            'globalContextItems' => ContextItem::query()
                ->where('scope', 'global')
                ->latest()
                ->get(),
            'customDemos' => CustomDemoTemplate::query()
                ->latest()
                ->get(),
            'sessions' => InterviewSession::query()
                ->with('report')
                ->latest()
                ->take(10)
                ->get(),
        ]);
    }
}
