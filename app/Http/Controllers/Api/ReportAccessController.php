<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportAccessController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (! hash_equals(config('services.demo.reports_password'), $validated['password'])) {
            return response()->json([
                'message' => 'La contrasena de informes es incorrecta.',
            ], 422);
        }

        $sessions = InterviewSession::query()
            ->with('report')
            ->where(function ($query) {
                $query->whereHas('report')
                    ->orWhere('status', 'interrupted');
            })
            ->latest('completed_at')
            ->latest()
            ->get();

        return response()->json([
            'sessions' => $sessions,
        ]);
    }
}
